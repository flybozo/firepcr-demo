import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase'

type EncounterRow = {
  id: string; date: string | null; unit: string | null;
  patient_age: number | null; patient_age_units: string | null;
  primary_symptom_text: string | null; initial_acuity: string | null;
  final_acuity: string | null; patient_disposition: string | null; created_at: string
}
type CompClaimRow = {
  id: string; date_of_injury: string | null; status: string | null; pdf_url: string | null;
  encounter_id: string | null; osha_recordable: boolean | null; created_at: string
}
type ICS214Row = {
  id: string; ics214_id: string; unit_name: string | null; op_date: string | null;
  status: string | null; pdf_url: string | null; created_at: string
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') return handleGET(req, res)
  if (req.method === 'POST') return handlePOST(req, res)
  if (req.method === 'PATCH') return handlePATCH(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

// ── GET: validate access code + return incident data ─────────────────────────
async function handleGET(req: VercelRequest, res: VercelResponse) {
  const code = req.query['code'] as string
  if (!code) return res.status(400).json({ error: 'Missing code' })

  const supabase = createServiceClient()

  const { data: codeRow, error: codeErr } = await supabase
    .from('incident_access_codes')
    .select('*')
    .eq('access_code', code.toUpperCase())
    .single()

  if (codeErr || !codeRow) return res.status(404).json({ error: 'Invalid or inactive access code' })
  if (!codeRow.active) return res.status(404).json({ error: 'Invalid or inactive access code' })
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Access code has expired' })
  }

  // Log access for analytics
  await supabase.from('incident_access_log').insert({
    access_code_id: codeRow.id,
    incident_id: codeRow.incident_id,
    access_code: code.toUpperCase(),
    label: codeRow.label,
    accessed_at: new Date().toISOString(),
    user_agent: req.headers['user-agent'] || null,
  }).catch(() => {}) // Non-blocking

  const incidentId = codeRow.incident_id

  // Fetch incident data
  const [
    { data: incident },
    { data: org },
    { data: encounters },
    { data: incidentUnits },
    { data: compClaims },
    { data: ics214s },
  ] = await Promise.all([
    supabase.from('incidents').select('*').eq('id', incidentId).single(),
    supabase.from('organizations').select('name, dba, logo_url').limit(1).single(),
    supabase.from('patient_encounters').select('id, date, unit, patient_age, patient_age_units, primary_symptom_text, initial_acuity, final_acuity, patient_disposition, created_at').eq('incident_id', incidentId).order('date', { ascending: false }),
    supabase.from('incident_units').select('id, unit:units(name)').eq('incident_id', incidentId),
    supabase.from('comp_claims').select('id, date_of_injury, status, pdf_url, encounter_id, osha_recordable, created_at').eq('incident_id', incidentId).order('created_at', { ascending: false }),
    supabase.from('ics214_headers').select('id, ics214_id, unit_name, op_date, status, pdf_url, created_at').eq('incident_id', incidentId).order('op_date', { ascending: false }),
  ])

  if (!incident) return res.status(404).json({ error: 'Incident not found' })

  const encounterList = (encounters || []) as EncounterRow[]
  const uniqueUnits = [...new Set(encounterList.map(e => e.unit).filter(Boolean))]
  const unitCount = (incidentUnits || []).length

  // Daily encounter counts for chart
  const dailyCounts: Record<string, number> = {}
  encounterList.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })
  const encountersByDay = Object.entries(dailyCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }))

  return res.json({
    incident,
    org: org || null,
    stats: {
      total_patients: encounterList.length,
      total_encounters: encounterList.length,
      units_deployed: unitCount,
      unique_units: uniqueUnits,
    },
    encounters: encounterList,
    encountersByDay,
    compClaims: (compClaims || []) as CompClaimRow[],
    ics214s: (ics214s || []) as ICS214Row[],
    codeLabel: codeRow.label,
  })
}

// ── POST: generate new access code ───────────────────────────────────────────
async function handlePOST(req: VercelRequest, res: VercelResponse) {
  const body = req.body
  const { incident_id, label } = body as { incident_id?: string; label?: string }
  if (!incident_id) return res.status(400).json({ error: 'incident_id required' })

  const supabase = createServiceClient()

  let code = ''
  let tries = 0
  while (tries < 5) {
    code = generateAccessCode()
    const { data: existing } = await supabase.from('incident_access_codes').select('id').eq('access_code', code).single()
    if (!existing) break
    tries++
  }

  const { data: newCode, error } = await supabase
    .from('incident_access_codes')
    .insert({ incident_id, access_code: code, label: label || null, created_by: 'Admin', active: true })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ code: newCode })
}

// ── PATCH: toggle code active/inactive ────────────────────────────────────────
async function handlePATCH(req: VercelRequest, res: VercelResponse) {
  const body = req.body
  const { code_id, active } = body as { code_id?: string; active?: boolean }
  if (!code_id || typeof active !== 'boolean') return res.status(400).json({ error: 'code_id and active required' })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('incident_access_codes')
    .update({ active })
    .eq('id', code_id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ code: data })
}
