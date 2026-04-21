
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { HttpError, requireEmployee } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { supabase } = await requireEmployee(req)

    const incident_id = req.query['incident_id'] as string
    if (!incident_id || typeof incident_id !== 'string') {
      return res.status(400).json({ error: 'incident_id required' })
    }

    const limitNum = Math.min(parseInt(String(req.query['limit'] || '50'), 10) || 50, 200)
    const beforeTs = req.query['before'] ? String(req.query['before']) : new Date().toISOString()
    const typesRaw = req.query['types'] ? String(req.query['types']) : null
    const typesArr = typesRaw ? typesRaw.split(',').filter(Boolean) : null

    const { data, error } = await supabase.rpc('get_incident_timeline', {
      p_incident_id: incident_id,
      p_limit: limitNum,
      p_before: beforeTs,
      p_types: typesArr,
    })

    if (error) return res.status(500).json({ error: error.message })

    return res.json({ events: data || [] })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[timeline] error:', msg)
    return res.status(500).json({ error: msg })
  }
}
