import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireEmployee } from '../_auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee, supabase } = await requireEmployee(req)

    const { unit_id, incident_id, latitude, longitude, accuracy, heading, speed, source } = req.body ?? {}

    if (!unit_id || !incident_id || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'unit_id, incident_id, latitude, longitude required' })
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'latitude and longitude must be numbers' })
    }

    // Dedup: skip if same unit has a ping within 5 min within 0.001 deg
    const { data: existing } = await supabase
      .from('unit_location_pings')
      .select('id')
      .eq('unit_id', unit_id)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .gte('latitude', latitude - 0.001)
      .lte('latitude', latitude + 0.001)
      .gte('longitude', longitude - 0.001)
      .lte('longitude', longitude + 0.001)
      .limit(1)

    if (existing && existing.length > 0) {
      return res.json({ ok: true })
    }

    await supabase.from('unit_location_pings').insert({
      unit_id,
      incident_id,
      employee_id: employee.id,
      latitude,
      longitude,
      accuracy_meters: accuracy ?? null,
      heading: heading ?? null,
      speed_mps: speed ?? null,
      source: source ?? 'auto',
    })

    return res.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[location/ping] error:', msg)
    return res.status(500).json({ error: msg })
  }
}
