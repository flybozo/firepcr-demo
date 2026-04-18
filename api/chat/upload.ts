import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { rateLimit } from '../_rateLimit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req)

    // Rate limit: 10 uploads per minute per employee
    const rl = rateLimit(`chat-upload:${employee.id}`, 10, 60_000)
    if (!rl.ok) {
      res.setHeader('Retry-After', String(Math.ceil((rl.retryAfterMs || 60000) / 1000)))
      return res.status(429).json({ error: 'Too many uploads. Please wait a moment.' })
    }

    const supabase = createServiceClient()

    const channelId = req.query.channelId as string
    if (!channelId) throw new HttpError(400, 'channelId query param is required')

    // Verify membership
    const { data: membership } = await supabase
      .from('chat_members')
      .select('id')
      .eq('channel_id', channelId)
      .eq('employee_id', employee.id)
      .single()

    if (!membership) throw new HttpError(403, 'Not a member of this channel')

    // Accept JSON body with base64-encoded file data
    const { fileName, contentType: fileContentType, data } = (req.body || {}) as {
      fileName?: string
      contentType?: string
      data?: string
    }

    if (!fileName) throw new HttpError(400, 'fileName is required')
    if (!data) throw new HttpError(400, 'data (base64) is required')

    const contentType = fileContentType || 'application/octet-stream'
    const fileBuffer = Buffer.from(data, 'base64')

    if (fileBuffer.length === 0) {
      throw new HttpError(400, 'Empty file data')
    }

    const timestamp = Date.now()
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${channelId}/${timestamp}_${safeName}`

    console.log(`[chat/upload] Uploading ${fileName} (${fileBuffer.length} bytes, ${contentType})`)

    const { error: uploadErr } = await supabase.storage
      .from('chat-files')
      .upload(path, fileBuffer, {
        contentType: contentType || 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) throw new Error(uploadErr.message)

    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(path)

    return res.status(200).json({
      path,
      url: urlData.publicUrl,
      file_name: fileName,
    })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/upload]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
