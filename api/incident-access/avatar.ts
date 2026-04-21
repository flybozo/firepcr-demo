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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
}

const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { code, image } = req.body as { code?: string; image?: string }
    if (!code || !image) return res.status(400).json({ error: 'code and image (base64 data URL) required' })

    // Rate limit: 1 upload per 10 seconds per code
    const rl = rateLimit(`ext-avatar:${code}`, 1, 10_000)
    if (!rl.ok) return res.status(429).json({ error: 'Too many uploads. Please wait.' })

    const supabase = createServiceClient()

    // Validate access code
    const { data: codeRow, error: codeErr } = await supabase
      .from('incident_access_codes')
      .select('id, active, expires_at')
      .eq('access_code', code.toUpperCase())
      .single()
    if (codeErr || !codeRow || !codeRow.active) return res.status(404).json({ error: 'Invalid or inactive access code' })
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) return res.status(410).json({ error: 'Expired' })

    // Parse base64 data URL
    const match = image.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/)
    if (!match) return res.status(400).json({ error: 'Invalid image format. Must be JPEG, PNG, or WebP data URL.' })

    const mimeType = match[1]
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
    const base64Data = match[3]
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > MAX_SIZE) return res.status(400).json({ error: 'Image too large. Max 2MB.' })

    const storagePath = `external-avatars/${codeRow.id}.${ext}`

    // Upload to chat-files bucket (public) so the URL is directly accessible
    const { error: uploadErr } = await supabase.storage
      .from('chat-files')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      })
    if (uploadErr) throw new Error(uploadErr.message)

    // Get public URL (chat-files bucket is public)
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(storagePath)
    // Append cache-buster so browsers reload after re-upload
    const avatarUrl = urlData?.publicUrl ? `${urlData.publicUrl}?v=${Date.now()}` : null

    // Update access code record
    await supabase
      .from('incident_access_codes')
      .update({ avatar_url: avatarUrl })
      .eq('id', codeRow.id)

    return res.json({ avatar_url: avatarUrl })
  } catch (err: any) {
    console.error('[incident-access/avatar]', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

