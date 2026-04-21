
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { HttpError, requireEmployee } from '../_auth.js'

// External event types — cs_count is internal-only and excluded here
const EXTERNAL_ALLOWED_TYPES = new Set([
  'encounter_new', 'pcr_signed',
  'ics214_activity', 'ics214_signed',
  'med_admin', 'supply_run',
  'comp_claim', 'unit_deployed',
])

// Map drug names / item_type to safe category labels for de-identification
function deidentifyDrugCategory(itemType: string | null | undefined): string {
  if (!itemType) return 'Medication'
  const t = itemType.toLowerCase()
  if (t.includes('narcotic') || t.includes('opioid') || t.includes('opiate')) return 'Analgesic (Opioid)'
  if (t.includes('analgesic') || t.includes('pain')) return 'Analgesic'
  if (t.includes('benzo') || t.includes('sedative')) return 'Sedative'
  if (t.includes('vasopressor') || t.includes('pressor') || t.includes('cardiac')) return 'Cardiac/Vasopressor'
  if (t.includes('antiemetic') || t.includes('nausea')) return 'Antiemetic'
  if (t.includes('broncho') || t.includes('respiratory')) return 'Bronchodilator'
  if (t.includes('reversal') || t.includes('antidote')) return 'Reversal Agent'
  if (t.includes('anesthetic') || t.includes('antiarrhythmic')) return 'Anesthetic'
  if (t.includes('dextrose') || t.includes('glucose')) return 'Dextrose'
  if (t.includes('antibiotic')) return 'Antibiotic'
  if (t.includes('steroid') || t.includes('corticosteroid')) return 'Corticosteroid'
  return 'Medication'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createServiceClient()
    const code = req.query['code'] ? String(req.query['code']) : null
    const directIncidentId = req.query['incidentId'] ? String(req.query['incidentId']) : null

    let incidentId: string

    if (directIncidentId) {
      // Internal admin preview — require authenticated employee
      await requireEmployee(req)
      incidentId = directIncidentId
    } else if (code) {
      // External access via code
      const { data: codeRow, error: codeErr } = await supabase
        .from('incident_access_codes')
        .select('*')
        .eq('access_code', code.toUpperCase())
        .single()

      if (codeErr || !codeRow || !codeRow.active) {
        return res.status(404).json({ error: 'Invalid or inactive access code' })
      }
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Expired' })
      }

      // Log access (fire-and-forget)
      void supabase.from('incident_access_log').insert({
        access_code_id: codeRow.id,
        incident_id: codeRow.incident_id,
        access_code: code.toUpperCase(),
        label: codeRow.label,
        accessed_at: new Date().toISOString(),
        user_agent: req.headers['user-agent'] || null,
      })

      incidentId = codeRow.incident_id
    } else {
      return res.status(400).json({ error: 'Missing code or incidentId' })
    }

    const isExternal = !!code && !directIncidentId
    const limitNum = Math.min(parseInt(String(req.query['limit'] || '50'), 10) || 50, 200)
    const beforeTs = req.query['before'] ? String(req.query['before']) : new Date().toISOString()
    const typesRaw = req.query['types'] ? String(req.query['types']) : null

    // Determine types array — external must exclude cs_count
    let typesArr: string[] | null
    if (isExternal) {
      if (typesRaw) {
        // Filter out any internal-only types
        typesArr = typesRaw.split(',').filter(t => EXTERNAL_ALLOWED_TYPES.has(t))
        if (typesArr.length === 0) return res.json({ events: [] })
      } else {
        // Default to all allowed external types
        typesArr = [...EXTERNAL_ALLOWED_TYPES]
      }
    } else {
      typesArr = typesRaw ? typesRaw.split(',').filter(Boolean) : null
    }

    const { data, error } = await supabase.rpc('get_incident_timeline', {
      p_incident_id: incidentId,
      p_limit: limitNum,
      p_before: beforeTs,
      p_types: typesArr,
    })

    if (error) return res.status(500).json({ error: error.message })

    let events: Record<string, unknown>[] = (data as Record<string, unknown>[]) || []

    // De-identify MAR events for external access
    // The RPC stores item_type in the `acuity` field for med_admin events
    if (isExternal) {
      events = events.map(e => {
        if (e.event_type === 'med_admin') {
          const category = deidentifyDrugCategory(e.acuity as string | null)
          return { ...e, summary: `Medication administered (${category})`, acuity: null }
        }
        return e
      })
    }

    return res.json({ events })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[incident-access/timeline] error:', msg)
    return res.status(500).json({ error: msg })
  }
}
