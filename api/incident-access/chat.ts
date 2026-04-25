
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { rateLimit } from '../_rateLimit.js'

function setCors(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = new Set([
    process.env.APP_BASE_URL,
    process.env.VITE_APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    'https://ram-field-ops.vercel.app',
    'https://firepcr-demo.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean) as string[])

  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
}

async function validateCode(supabase: ReturnType<typeof createServiceClient>, code: string) {
  const { data: codeRow, error } = await supabase
    .from('incident_access_codes')
    .select('*')
    .eq('access_code', code.toUpperCase())
    .single()
  if (error || !codeRow || !codeRow.active) return null
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) return null
  return codeRow
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const code = req.query.code as string
      const channelId = req.query.channelId as string
      if (!code || !channelId) return res.status(400).json({ error: 'code and channelId required' })

      const supabase = createServiceClient()
      const codeRow = await validateCode(supabase, code)
      if (!codeRow) return res.status(404).json({ error: 'Invalid or expired access code' })

      // Verify channelId belongs to this access code
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id, name')
        .eq('id', channelId)
        .eq('access_code_id', codeRow.id)
        .eq('type', 'external')
        .single()
      if (!channel) return res.status(403).json({ error: 'Channel not found for this access code' })

      const { data: messages, error: msgErr } = await supabase
        .from('chat_messages')
        .select(`
          id,
          channel_id,
          content,
          message_type,
          file_url,
          file_name,
          created_at,
          external_sender_name,
          access_code_id,
          sender_id,
          sender:employees!sender_id(id, name, headshot_url)
        `)
        .eq('channel_id', channelId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (msgErr) throw new Error(msgErr.message)

      // Look up avatar URLs for access codes referenced in external messages
      const extCodeIds = [...new Set((messages || []).filter((m: any) => !m.sender_id && m.access_code_id).map((m: any) => m.access_code_id))]
      const avatarMap: Record<string, string> = {}
      if (extCodeIds.length > 0) {
        const { data: codeRows } = await supabase
          .from('incident_access_codes')
          .select('id, avatar_url')
          .in('id', extCodeIds)
        for (const cr of codeRows || []) {
          if (cr.avatar_url) avatarMap[cr.id] = cr.avatar_url
        }
      }

      const formatted = (messages || []).reverse().map((m: any) => ({
        id: m.id,
        channel_id: m.channel_id,
        content: m.content,
        message_type: m.message_type,
        file_url: m.file_url || null,
        file_name: m.file_name || null,
        created_at: m.created_at,
        external_sender_name: m.external_sender_name,
        sender: m.sender_id
          ? { id: m.sender?.id || m.sender_id, name: m.sender?.name || 'Team Member', headshot_url: m.sender?.headshot_url || null }
          : { id: null, name: m.external_sender_name || 'External', headshot_url: m.access_code_id ? (avatarMap[m.access_code_id] || null) : null },
      }))

      return res.json({ messages: formatted })
    }

    if (req.method === 'POST') {
      const { code, channelId, content, image } = req.body as { code?: string; channelId?: string; content?: string; image?: string }
      if (!code || !channelId) return res.status(400).json({ error: 'code and channelId required' })
      if (!image && (!content || typeof content !== 'string' || content.trim().length === 0)) return res.status(400).json({ error: 'content or image required' })
      if (content && content.length > 4000) return res.status(400).json({ error: 'content too long' })

      const supabase = createServiceClient()
      const codeRow = await validateCode(supabase, code)
      if (!codeRow) return res.status(404).json({ error: 'Invalid or expired access code' })

      // Rate limit: 1 message per 2 seconds per access code
      const rl = rateLimit(`ext-chat:${codeRow.id}`, 1, 2_000)
      if (!rl.ok) return res.status(429).json({ error: 'Too many messages. Please wait a moment.' })

      // Verify channelId belongs to this access code
      const { data: channel } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('id', channelId)
        .eq('access_code_id', codeRow.id)
        .eq('type', 'external')
        .single()
      if (!channel) return res.status(403).json({ error: 'Channel not found for this access code' })

      // Handle image upload
      if (image) {
        // Validate data URL format
        const match = image.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
        if (!match) return res.status(400).json({ error: 'Invalid image format. Use JPEG, PNG, WebP, or GIF.' })
        const mimeType = match[1]
        const base64Data = match[2]
        const buffer = Buffer.from(base64Data, 'base64')
        if (buffer.byteLength > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image must be under 5MB.' })
        const ext = mimeType.split('/')[1].replace('jpeg', 'jpg')
        const timestamp = Date.now()
        const random = Math.random().toString(36).slice(2, 8)
        const filePath = `external-chat/${channelId}/${timestamp}-${random}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('chat-files')
          .upload(filePath, buffer, { contentType: mimeType, upsert: false })
        if (uploadErr) throw new Error(uploadErr.message)

        const { data: publicUrlData } = supabase.storage.from('chat-files').getPublicUrl(filePath)
        const fileUrl = publicUrlData.publicUrl

        const { data: imgMsg, error: imgErr } = await supabase
          .from('chat_messages')
          .insert({
            channel_id: channelId,
            sender_id: null,
            external_sender_name: codeRow.label || 'External',
            access_code_id: codeRow.id,
            content: fileUrl,
            message_type: 'image',
            file_url: fileUrl,
            file_name: `${timestamp}-${random}.${ext}`,
          })
          .select('id, channel_id, content, message_type, file_url, file_name, created_at, external_sender_name, access_code_id')
          .single()
        if (imgErr) throw new Error(imgErr.message)

        await supabase.from('chat_channels').update({ updated_at: new Date().toISOString() }).eq('id', channelId)

        return res.status(201).json({
          message: {
            ...imgMsg,
            sender: { id: null, name: codeRow.label || 'External', headshot_url: codeRow.avatar_url || null },
          },
        })
      }

      const { data: message, error: msgErr } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channelId,
          sender_id: null,
          external_sender_name: codeRow.label || 'External',
          access_code_id: codeRow.id,
          content: content!.trim(),
          message_type: 'text',
        })
        .select('id, channel_id, content, message_type, created_at, external_sender_name, access_code_id')
        .single()
      if (msgErr) throw new Error(msgErr.message)

      await supabase
        .from('chat_channels')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', channelId)

      return res.status(201).json({
        message: {
          ...message,
          sender: { id: null, name: codeRow.label || 'External', headshot_url: codeRow.avatar_url || null },
        },
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[incident-access/chat]', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
