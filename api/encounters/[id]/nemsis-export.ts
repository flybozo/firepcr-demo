import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../../_auth.js'
import { createServiceClient } from '../../_supabase.js'
import { buildPcrXml } from '../../../src/lib/nemsis/buildPcrXml.js'
import { rateLimit } from '../../_rateLimit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { user, employee } = await requireEmployee(req)

    // Rate limit: 10 exports per 2 minutes per user
    const rl = rateLimit(`nemsis:${user.id}`, 10, 120_000)
    if (!rl.ok) return res.status(429).json({ error: 'Too many export requests' })

    const { id } = req.query
    if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid encounter id' })

    const supabase = createServiceClient()

    // Fetch encounter
    const { data: enc, error: encErr } = await supabase
      .from('patient_encounters')
      .select('*')
      .eq('id', id)
      .single()
    if (encErr || !enc) return res.status(404).json({ error: 'Encounter not found' })

    // Authorization: admins can export anything; field users only their incident's encounters
    if (employee.app_role !== 'admin') {
      const { data: assignment } = await supabase
        .from('unit_assignments')
        .select('incident_unit_id, incident_units!inner(incident_id)')
        .eq('employee_id', employee.id)
        .is('released_at', null)
        .limit(100)
      const assignedIncidentIds = (assignment || []).map((a: any) => a.incident_units?.incident_id).filter(Boolean)
      if (!assignedIncidentIds.includes(enc.incident_id)) {
        return res.status(403).json({ error: 'You do not have access to this encounter' })
      }
    }

    // Fetch vitals (additional_vitals rows)
    const { data: vitals } = await supabase
      .from('additional_vitals')
      .select('*')
      .eq('encounter_id', id)
      .order('recorded_at', { ascending: true })

    // Fetch medications (dispense_admin_log)
    const { data: medications } = await supabase
      .from('dispense_admin_log')
      .select('*')
      .eq('encounter_id', enc.encounter_id)
      .order('date', { ascending: true })

    // Fetch procedures
    const { data: procedures } = await supabase
      .from('encounter_procedures')
      .select('*')
      .eq('encounter_id', id)
      .order('performed_at', { ascending: true })

    const xml = buildPcrXml(
      enc as Record<string, unknown>,
      (vitals ?? []) as Record<string, unknown>[],
      (medications ?? []) as Record<string, unknown>[],
      (procedures ?? []) as Record<string, unknown>[]
    )

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Content-Disposition', `attachment; filename="${enc.encounter_id || id}-NEMSIS.xml"`)
    return res.status(200).send(xml)
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[nemsis-export]', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
