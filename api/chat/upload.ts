import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req)
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

    // Parse multipart — Vercel parses body as Buffer for binary
    // We expect: Content-Type: application/octet-stream with X-File-Name header
    const fileName = req.headers['x-file-name'] as string
    const contentType = req.headers['content-type'] as string

    if (!fileName) throw new HttpError(400, 'X-File-Name header is required')

    const timestamp = Date.now()
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${channelId}/${timestamp}_${safeName}`

    // Read raw body
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const fileBuffer = Buffer.concat(chunks)

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
