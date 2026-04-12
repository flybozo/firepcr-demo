import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createServiceClient } from '../_supabase'
import { createClient } from '@/lib/supabase/server'

// ── Types ────────────────────────────────────────────────────────────────────
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
  id: string; ics214_id: string; unit_name: string | null; leader_name: string | null;
  op_date: string | null; status: string | null; pdf_url: string | null;
  pdf_file_name: string | null; created_by: string | null; created_at: string; closed_at: string | null
}
type IncidentUnitRow = { id: string; unit_id: string; units: { name: string } | null }

// ── Helpers ─────────────────────────────────────────────────────────────────
function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function mapAcuity(raw: string | null): string {
  if (!raw) return 'Expectant'
  const v = raw.toLowerCase()
  if (v.includes('critical') || v.includes('red') || v.includes('immediate')) return 'Immediate'
  if (v.includes('yellow') || v.includes('delayed') || v.includes('emergent')) return 'Delayed'
  if (v.includes('green') || v.includes('minor') || v.includes('non-acute') || v.includes('routine')) return 'Minimal'
  return 'Expectant'
}

// ── GET: validate code and return incident data ────────────────────────────
async function handleGET(req: VercelRequest, res: VercelResponse) {
  const query = req.query
  const code = (query['code'] as string)
  if (!code) return res.status(400).json({ error: 'Missing code' })

  const supabase = createServiceClient()

  const { data: codeRow, error: codeErr } = await supabase
    .from('incident_access_codes')
    .select('*')
    .eq('access_code', code.toUpperCase())
    .eq('active', true)
    .single()

  if (codeErr || !codeRow) return res.status(404).json({ error: 'Invalid or inactive access code' })
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Access code has expired' })
  }

  const incidentId: string = codeRow.incident_id

  const [{ data: incident }, { data: org }, { data: encountersRaw }, { data: incidentUnitsRaw }, { data: compClaimsRaw }, { data: ics214sRaw }] =
    await Promise.all([
      supabase.from('incidents').select('id, name, location, incident_number, start_date, end_date, status, notes, agreement_number').eq('id', incidentId).single(),
      supabase.from('organizations').select('name, dba, logo_url').limit(1).single(),
      supabase.from('patient_encounters').select('id, date, unit, patient_age, patient_age_units, primary_symptom_text, initial_acuity, final_acuity, patient_disposition, created_at').eq('incident_id', incidentId).order('date', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('incident_units').select('id, unit_id, units(name)').eq('incident_id', incidentId),
      supabase.from('comp_claims').select('id, date_of_injury, status, pdf_url, encounter_id, osha_recordable, created_at').eq('incident_id', incidentId).order('created_at', { ascending: true }),
      supabase.from('ics214_headers').select('id, ics214_id, unit_name, leader_name, op_date, status, pdf_url, pdf_file_name, created_by, created_at, closed_at').eq('incident_id', incidentId).order('op_date', { ascending: true }),
    ])

  if (!incident) return res.status(404).json({ error: 'Incident not found' })

  const encList: EncounterRow[] = (encountersRaw || []) as EncounterRow[]
  const encounters = encList.map((enc, idx) => ({
    id: enc.id,
    seq_id: `PT-${String(idx + 1).padStart(3, '0')}`,
    date: enc.date,
    unit: enc.unit,
    age: enc.patient_age != null ? `${enc.patient_age}${enc.patient_age_units ? ' ' + enc.patient_age_units : ''}` : null,
    chief_complaint: enc.primary_symptom_text,
    acuity: mapAcuity(enc.initial_acuity),
    disposition: enc.patient_disposition,
  }))

  const encIdToSeq: Record<string, string> = {}
  encounters.forEach(e => { encIdToSeq[e.id] = e.seq_id })

  const iuList: IncidentUnitRow[] = (incidentUnitsRaw || []) as IncidentUnitRow[]
  const unitCount = iuList.length
  const uniqueUnits = [...new Set(iuList.map(iu => iu.units?.name).filter((n): n is string => !!n))]

  const ccList: CompClaimRow[] = (compClaimsRaw || []) as CompClaimRow[]
  const compClaims = ccList.map((cc, idx) => ({
    id: cc.id,
    claim_number: `WC-${String(idx + 1).padStart(3, '0')}`,
    date: cc.date_of_injury,
    status: cc.status,
    has_pdf: !!cc.pdf_url,
    pdf_url: cc.pdf_url,
    patient_seq_id: cc.encounter_id ? (encIdToSeq[cc.encounter_id] || null) : null,
    osha_recordable: cc.osha_recordable,
  }))

  const icsList: ICS214Row[] = (ics214sRaw || []) as ICS214Row[]
  const ics214s = icsList.map(form => ({
    id: form.id,
    ics214_id: form.ics214_id,
    unit: form.unit_name,
    prepared_by: form.leader_name || form.created_by,
    date: form.op_date,
    status: form.status,
    has_pdf: !!form.pdf_url,
    pdf_url: form.pdf_url,
    pdf_file_name: form.pdf_file_name,
    closed_at: form.closed_at,
  }))

  const complaintCounts: Record<string, number> = {}
  encounters.forEach(e => {
    if (e.chief_complaint) complaintCounts[e.chief_complaint] = (complaintCounts[e.chief_complaint] || 0) + 1
  })
  const chiefComplaints = Object.entries(complaintCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  const acuityCounts: Record<string, number> = { Immediate: 0, Delayed: 0, Minimal: 0, Expectant: 0 }
  encounters.forEach(e => { acuityCounts[e.acuity] = (acuityCounts[e.acuity] || 0) + 1 })
  const acuityBreakdown = Object.entries(acuityCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))

  const dailyCounts: Record<string, number> = {}
  encounters.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })
  const encountersByDay = Object.entries(dailyCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }))

  return res.json({
    incident,
    org: org || null,
    stats: {
      total_patients: encounters.length,
      total_encounters: encounters.length,
      units_deployed: unitCount,
      unique_units: uniqueUnits,
      comp_claims_count: compClaims.length,
      ics214_count: ics214s.length,
    },
    analytics: { chief_complaints: chiefComplaints, acuity_breakdown: acuityBreakdown, encounters_by_day: encountersByDay },
    encounters,
    comp_claims: compClaims,
    ics214s,
    code_label: codeRow.label || null,
  })
}

// ── POST: generate a new access code ─────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") return handleGET(req, res)
  if (req.method === "PATCH") return handlePATCH(req, res)
  return handlePOST(req, res)
}
async function handlePOST(req: VercelRequest, res: VercelResponse) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const body = req.body
  const { incident_id, label } = body as { incident_id?: string; label?: string }
  if (!incident_id) return res.status(400).json({ error: 'incident_id required' })

  const supabase = createServiceClient()
  const { data: emp } = await supabase.from('employees').select('name').eq('auth_user_id', user.id).single()

  let code = ''
  let tries = 0
  while (tries < 5) {
    code = generateCode()
    const { data: existing } = await supabase.from('incident_access_codes').select('id').eq('access_code', code).single()
    if (!existing) break
    tries++
  }

  const { data: newCode, error } = await supabase
    .from('incident_access_codes')
    .insert({ incident_id, access_code: code, label: label || null, created_by: (emp as { name?: string } | null)?.name || user.email || user.id, active: true })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ code: newCode })
}

// ── PATCH: toggle code active/inactive ────────────────────────────────────────
async function handlePATCH(req: VercelRequest, res: VercelResponse) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const body = req.body
  const { code_id, active } = body as { code_id?: string; active?: boolean }
  if (!code_id || typeof active !== 'boolean') return res.status(400).json({ error: 'code_id and active required' })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('incident_access_codes').update({ active }).eq('id', code_id).select().single()
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ code: data })
}
