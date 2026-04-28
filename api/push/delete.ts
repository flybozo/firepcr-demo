/**
 * DELETE /api/push/delete
 *
 * Admin-only endpoint to remove notifications from the history log.
 * Body accepts either:
 *   { id: string }                 \u2014 delete a single notification
 *   { ids: string[] }              \u2014 delete a list of notifications
 *   { older_than_days: number }    \u2014 delete every notification older than N days
 *
 * Cascades: notification_reads has ON DELETE CASCADE on notification_id, so
 * dismissed/read state for affected rows is cleaned up automatically.
 *
 * Returns: { deleted: number }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'

type DeleteRequest = {
  id?: string
  ids?: string[]
  older_than_days?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Admin gate \u2014 same gate as send.ts (admin: true).
    await requireEmployee(req, { admin: true })

    const body = (req.body || {}) as DeleteRequest
    const supabase = createServiceClient()

    let deleted = 0

    if (body.id) {
      const { error, count } = await supabase
        .from('push_notifications')
        .delete({ count: 'exact' })
        .eq('id', body.id)
      if (error) throw error
      deleted = count ?? 0
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error, count } = await supabase
        .from('push_notifications')
        .delete({ count: 'exact' })
        .in('id', body.ids)
      if (error) throw error
      deleted = count ?? 0
    } else if (typeof body.older_than_days === 'number' && body.older_than_days > 0) {
      const cutoff = new Date(Date.now() - body.older_than_days * 24 * 60 * 60 * 1000).toISOString()
      const { error, count } = await supabase
        .from('push_notifications')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff)
      if (error) throw error
      deleted = count ?? 0
    } else {
      return res.status(400).json({
        error: 'Provide id, ids[], or older_than_days in the request body.',
      })
    }

    return res.json({ deleted })
  } catch (err: any) {
    console.error('[push/delete] error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
