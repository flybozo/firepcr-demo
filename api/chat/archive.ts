import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'

/**
 * POST /api/chat/archive
 * Body: { channel_id: string, action: 'archive' | 'unarchive' }
 *
 * Archive or unarchive a chat channel. Requires authenticated employee.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req)
    const supabase = createServiceClient()

    const { channel_id, action } = req.body as { channel_id?: string; action?: string }
    if (!channel_id) throw new HttpError(400, 'channel_id is required')
    if (action !== 'archive' && action !== 'unarchive') throw new HttpError(400, 'action must be "archive" or "unarchive"')

    // Verify the employee is a member of this channel
    const { data: membership } = await supabase
      .from('chat_members')
      .select('id')
      .eq('channel_id', channel_id)
      .eq('employee_id', employee.id)
      .single()

    if (!membership) throw new HttpError(403, 'Not a member of this channel')

    const archived_at = action === 'archive' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('chat_channels')
      .update({ archived_at })
      .eq('id', channel_id)

    if (error) throw new Error(error.message)

    return res.status(200).json({ ok: true, archived_at })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/archive]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
