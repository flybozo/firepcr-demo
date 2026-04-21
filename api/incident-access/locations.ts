import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = req.query['code'] as string
  if (!code) return res.status(400).json({ error: 'code required' })

  const supabase = createServiceClient()

  // Validate access code
  const { data: codeRow } = await supabase
    .from('incident_access_codes')
    .select('incident_id, active, expires_at')
    .eq('access_code', code)
    .single()

  if (!codeRow || !codeRow.active) return res.status(403).json({ error: 'Invalid or inactive access code' })
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) return res.status(403).json({ error: 'Access code expired' })

  const { data, error } = await supabase.rpc('get_unit_locations', { p_incident_id: codeRow.incident_id })
  if (error) return res.status(500).json({ error: error.message })

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ locations: data ?? [] })
}
