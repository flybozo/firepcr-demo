// Plain JS — avoids TypeScript compilation issues in Vercel serverless
const { createClient } = require('@supabase/supabase-js')

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kfkpvazkikpuwatthtow.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')
  return createClient(url, key)
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method === 'GET') return handleGET(req, res)
  if (req.method === 'POST') return handlePOST(req, res)
  if (req.method === 'PATCH') return handlePATCH(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGET(req, res) {
  try {
    const code = req.query['code']
    if (!code) return res.status(400).json({ error: 'Missing code' })

    const supabase = getSupabase()

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

    // Log access
    supabase.from('incident_access_log').insert({
      access_code_id: codeRow.id,
      incident_id: codeRow.incident_id,
      access_code: code.toUpperCase(),
      label: codeRow.label,
      accessed_at: new Date().toISOString(),
      user_agent: req.headers['user-agent'] || null,
    }).then(() => {}).catch(() => {})

    const incidentId = codeRow.incident_id

    const [incResult, orgResult, encResult, iuResult, compResult, ics214Result] = await Promise.all([
      supabase.from('incidents').select('*').eq('id', incidentId).single(),
      supabase.from('organizations').select('name, dba, logo_url').limit(1).single(),
      supabase.from('patient_encounters').select('id, date, unit, patient_age, patient_age_units, primary_symptom_text, initial_acuity, final_acuity, patient_disposition, created_at').eq('incident_id', incidentId).order('date', { ascending: false }),
      supabase.from('incident_units').select('id, unit:units(name)').eq('incident_id', incidentId),
      supabase.from('comp_claims').select('id, date_of_injury, status, pdf_url, encounter_id, osha_recordable, created_at').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      supabase.from('ics214_headers').select('id, ics214_id, unit_name, op_date, status, pdf_url, created_at').eq('incident_id', incidentId).order('op_date', { ascending: false }),
    ])

    if (!incResult.data) return res.status(404).json({ error: 'Incident not found' })

    const encounters = (encResult.data || []).map((enc, i) => ({
      ...enc,
      seq_id: `PT-${String(i + 1).padStart(3, '0')}`,
      chief_complaint: enc.primary_symptom_text,
      acuity: enc.initial_acuity || 'Unknown',
      age: enc.patient_age ? `${enc.patient_age} ${enc.patient_age_units || 'yrs'}` : null,
      disposition: enc.patient_disposition,
    }))

    const dailyCounts = {}
    encounters.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })

    const chiefComplaintCounts = {}
    encounters.forEach(e => { if (e.chief_complaint) chiefComplaintCounts[e.chief_complaint] = (chiefComplaintCounts[e.chief_complaint] || 0) + 1 })

    const acuityCounts = {}
    encounters.forEach(e => { if (e.acuity) acuityCounts[e.acuity] = (acuityCounts[e.acuity] || 0) + 1 })

    return res.json({
      incident: incResult.data,
      org: orgResult.data || null,
      stats: {
        total_patients: encounters.length,
        total_encounters: encounters.length,
        units_deployed: (iuResult.data || []).length,
        unique_units: [...new Set(encounters.map(e => e.unit).filter(Boolean))],
      },
      encounters,
      encountersByDay: Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      analytics: {
        chief_complaints: Object.entries(chiefComplaintCounts).sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, count]) => ({ name, count })),
        acuity_breakdown: Object.entries(acuityCounts).map(([name, value]) => ({ name, value })),
        encounters_by_day: Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      },
      compClaims: (compResult.data || []).map((c, i) => ({ ...c, seq_id: `WC-${String(i + 1).padStart(3, '0')}`, has_pdf: !!c.pdf_url })),
      ics214s: (ics214Result.data || []).map(f => ({ ...f, date: f.op_date, unit: f.unit_name, prepared_by: null, has_pdf: !!f.pdf_url })),
      codeLabel: codeRow.label,
    })
  } catch (err) {
    console.error('GET error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

async function handlePOST(req, res) {
  try {
    const { incident_id, label } = req.body || {}
    if (!incident_id) return res.status(400).json({ error: 'incident_id required' })

    const supabase = getSupabase()
    let code = ''
    for (let tries = 0; tries < 5; tries++) {
      code = generateCode()
      const { data: existing } = await supabase.from('incident_access_codes').select('id').eq('access_code', code).single()
      if (!existing) break
    }

    const { data: newCode, error } = await supabase
      .from('incident_access_codes')
      .insert({ incident_id, access_code: code, label: label || null, created_by: 'Admin', active: true })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ code: newCode })
  } catch (err) {
    console.error('POST error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

async function handlePATCH(req, res) {
  try {
    const { code_id, active } = req.body || {}
    if (!code_id || typeof active !== 'boolean') return res.status(400).json({ error: 'code_id and active required' })

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('incident_access_codes')
      .update({ active })
      .eq('id', code_id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ code: data })
  } catch (err) {
    console.error('PATCH error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
