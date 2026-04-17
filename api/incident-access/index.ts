
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { HttpError, requireEmployee } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'

function setCors(req: VercelRequest, res: VercelResponse) {
  const allowedOrigins = new Set([
    process.env.APP_BASE_URL,
    process.env.VITE_APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    'https://ram-field-ops.vercel.app',
    'https://firepcr-demo.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ].filter(Boolean) as string[])

  const origin = req.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    if (req.method === 'GET') {
      const code = req.query['code'] as string
      if (!code) return res.status(400).json({ error: 'Missing code' })
      const supabase = createServiceClient()
      const { data: codeRow, error: codeErr } = await supabase
        .from('incident_access_codes').select('*').eq('access_code', code.toUpperCase()).single()
      if (codeErr || !codeRow || !codeRow.active) return res.status(404).json({ error: 'Invalid or inactive access code' })
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) return res.status(410).json({ error: 'Expired' })

      void supabase.from('incident_access_log').insert({ access_code_id: codeRow.id, incident_id: codeRow.incident_id, access_code: code.toUpperCase(), label: codeRow.label, accessed_at: new Date().toISOString(), user_agent: req.headers['user-agent'] || null })

      const incidentId = codeRow.incident_id
      const [incR, orgR, encR, iuR, compR, ics214R, amaR] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', incidentId).single(),
        supabase.from('organizations').select('name, dba, logo_url').limit(1).single(),
        supabase.from('patient_encounters').select('id, encounter_id, date, unit, patient_agency, patient_age, patient_age_units, primary_symptom_text, initial_acuity, final_acuity, patient_disposition, created_at').eq('incident_id', incidentId).order('date', { ascending: false }),
        supabase.from('incident_units').select('id, unit:units(name)').eq('incident_id', incidentId),
        supabase.from('comp_claims').select('id, date_of_injury, status, pdf_url, osha_recordable, created_at, encounter_id, patient_name, employee_supervisor_name').eq('incident_id', incidentId).order('created_at', { ascending: false }),
        supabase.from('ics214_headers').select('id, ics214_id, unit_name, op_date, status, pdf_url, created_at, created_by').eq('incident_id', incidentId).order('op_date', { ascending: false }),
        supabase.from('consent_forms').select('id, encounter_id, form_type, created_at').eq('incident_id', incidentId).eq('form_type', 'AMA'),
      ])
      if (!incR.data) return res.status(404).json({ error: 'Incident not found' })

      // comp_claims.encounter_id stores the text encounter_id (e.g. 'ENC-123') — match on both UUID and text
      const compClaimEncounterIds = new Set((compR.data || []).map((c: any) => c.encounter_id).filter(Boolean))
      const amaEncounterIds = new Set((amaR.data || []).map((a: any) => a.encounter_id).filter(Boolean))

      const mapAcuity = (raw: string | null): string => {
        if (!raw) return 'Unknown'
        const v = raw.toLowerCase()
        if (v.includes('immediate') || v.includes('critical') || v.includes('red') || v.startsWith('1')) return 'Immediate'
        if (v.includes('delayed') || v.includes('yellow') || v.includes('emergent') || v.startsWith('2')) return 'Delayed'
        if (v.includes('minimal') || v.includes('minor') || v.includes('green') || v.includes('routine') || v.startsWith('3')) return 'Minimal'
        if (v.includes('expectant') || v.includes('black') || v.startsWith('4')) return 'Expectant'
        return raw
      }

      const encounters = (encR.data || []).map((enc: any, i: number) => ({
        id: enc.id, encounter_id: enc.encounter_id, seq_id: `PT-${String(i + 1).padStart(3, '0')}`, date: enc.date, unit: enc.unit,
        patient_agency: enc.patient_agency || null,
        age: enc.patient_age ? `${enc.patient_age} ${enc.patient_age_units || 'yrs'}` : null,
        chief_complaint: enc.primary_symptom_text, acuity: mapAcuity(enc.initial_acuity),
        disposition: enc.patient_disposition, created_at: enc.created_at,
        has_comp_claim: compClaimEncounterIds.has(enc.id) || compClaimEncounterIds.has(enc.encounter_id),
        has_ama: amaEncounterIds.has(enc.id) || amaEncounterIds.has(enc.encounter_id),
      }))

      const dailyCounts: Record<string, number> = {}
      encounters.forEach((e: any) => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })
      const ccCounts: Record<string, number> = {}
      encounters.forEach((e: any) => { if (e.chief_complaint) ccCounts[e.chief_complaint] = (ccCounts[e.chief_complaint] || 0) + 1 })
      const acCounts: Record<string, number> = {}
      encounters.forEach((e: any) => { if (e.acuity) acCounts[e.acuity] = (acCounts[e.acuity] || 0) + 1 })

      // Fetch supply runs + aggregate items
      const { data: supplyRunsData } = await supabase
        .from('supply_runs')
        .select('id')
        .eq('incident_id', incidentId)
      const runIds = (supplyRunsData || []).map((r: any) => r.id)
      let supplyAggregated: { item_name: string; total_qty: number; unit: string; category: string }[] = []
      if (runIds.length > 0) {
        const { data: supplyItems } = await supabase
          .from('supply_run_items')
          .select('item_name, quantity, unit_of_measure, category')
          .in('supply_run_id', runIds)
          .is('deleted_at', null)
        const totals: Record<string, { qty: number; unit: string; category: string }> = {}
        ;(supplyItems || []).forEach((i: any) => {
          if (!i.item_name) return
          if (!totals[i.item_name]) totals[i.item_name] = { qty: 0, unit: i.unit_of_measure || '', category: i.category || '' }
          totals[i.item_name].qty += Number(i.quantity) || 0
        })
        supplyAggregated = Object.entries(totals)
          .map(([item_name, { qty, unit, category }]) => ({ item_name, total_qty: qty, unit, category }))
          .sort((a, b) => b.total_qty - a.total_qty)
      }

      return res.json({
        incident: incR.data, org: orgR.data || null,
        stats: { total_patients: encounters.length, total_encounters: encounters.length, units_deployed: (iuR.data || []).length, unique_units: [...new Set(encounters.map((e: any) => e.unit).filter(Boolean))], comp_claims_count: (compR.data || []).length, ics214_count: (ics214R.data || []).length, supply_runs_count: runIds.length },
        encounters,
        encountersByDay: Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
        analytics: {
          chief_complaints: Object.entries(ccCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, count]) => ({ name, count })),
          acuity_breakdown: Object.entries(acCounts).map(([name, value]) => ({ name, value })),
          encounters_by_day: Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
        },
        supply_aggregated: supplyAggregated,
        comp_claims: (compR.data || []).map((c: any, i: number) => {
          const name = c.patient_name || ''
          const parts = name.trim().split(/\s+/)
          const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0] ? parts[0][0].toUpperCase() : '—'
          // Map encounter_id (text like ENC-123 or UUID) to the PT-NNN seq_id
          const encSeqId = encounters.find((e: any) =>
            e.encounter_id === c.encounter_id || e.id === c.encounter_id
          )?.seq_id || null
          return { ...c, seq_id: `WC-${String(i + 1).padStart(3, '0')}`, has_pdf: !!c.pdf_url, patient_initials: initials, patient_seq_id: encSeqId, supervisor_name: c.employee_supervisor_name || null }
        }),
        ics214s: (ics214R.data || []).map((f: any) => ({ ...f, date: f.op_date, unit: f.unit_name, prepared_by: f.created_by || null, has_pdf: !!f.pdf_url })),
        code_label: codeRow.label,
      })
    }

    if (req.method === 'POST') {
      const { incident_id, label, expires_at } = req.body as { incident_id?: string; label?: string; expires_at?: string | null }
      if (!incident_id || typeof incident_id !== 'string') return res.status(400).json({ error: 'incident_id required' })
      const { employee, supabase } = await requireEmployee(req, { admin: true })
      // Rate limit code generation
      const rl = rateLimit(`access-code:${employee.id}`, 10, 60_000)
      if (!rl.ok) return res.status(429).json({ error: 'Too many requests' })
      let code = ''
      for (let i = 0; i < 5; i++) {
        code = generateCode()
        const { data: ex } = await supabase.from('incident_access_codes').select('id').eq('access_code', code).single()
        if (!ex) break
      }
      const { data, error } = await supabase.from('incident_access_codes').insert({ incident_id, access_code: code, label: label || null, created_by: employee.name, active: true, expires_at: expires_at || null }).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ code: data })
    }

    if (req.method === 'PATCH') {
      const { code_id, active, expires_at } = req.body as { code_id?: string; active?: boolean; expires_at?: string | null }
      if (!code_id) return res.status(400).json({ error: 'code_id required' })
      const { supabase } = await requireEmployee(req, { admin: true })
      const updates: Record<string, unknown> = {}
      if (typeof active === 'boolean') updates.active = active
      if (expires_at !== undefined) updates.expires_at = expires_at
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' })
      const { data, error } = await supabase.from('incident_access_codes').update(updates).eq('id', code_id).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json({ code: data })
    }

    if (req.method === 'DELETE') {
      const { code_id } = req.body as { code_id?: string }
      if (!code_id) return res.status(400).json({ error: 'code_id required' })
      const { supabase } = await requireEmployee(req, { admin: true })
      const { error } = await supabase.from('incident_access_codes').delete().eq('id', code_id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' }
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('API error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
