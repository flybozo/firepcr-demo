#!/usr/bin/env node
/**
 * seed-demo-data.mjs — Populate the FirePCR demo database with realistic test data.
 * Uses correct column names for the demo Supabase schema.
 */

const DEMO_URL = process.env.DEMO_URL || 'https://jlqpycxguovxnqtkjhzs.supabase.co'
const DEMO_KEY = process.env.DEMO_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpscXB5Y3hndW92eG5xdGtqaHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDQ4OTEsImV4cCI6MjA5MTYyMDg5MX0.LVKcen2VKrKuRfYOrkru6uYZOOyWwa85Y31WnsRDk3o'

const headers = {
  'apikey': DEMO_KEY,
  'Authorization': `Bearer ${DEMO_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

async function api(method, table, body, extra = '') {
  const url = `${DEMO_URL}/rest/v1/${table}${extra}`
  const opts = { method, headers: { ...headers } }
  if (body) opts.body = JSON.stringify(body)
  if (method === 'POST') opts.headers['Prefer'] = 'return=representation,resolution=merge-duplicates'
  const res = await fetch(url, opts)
  if (!res.ok) {
    const text = await res.text()
    console.error(`  ✗ ${method} ${table}: ${res.status} ${text.slice(0, 120)}`)
    return null
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

function uuid() { return crypto.randomUUID() }
function pick(arr) { return Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randomDateStr(s, e) { const d = new Date(new Date(s).getTime() + Math.random() * (new Date(e).getTime() - new Date(s).getTime())); return d.toISOString().split('T')[0] }
function randomDatetime(s, e) { return new Date(new Date(s).getTime() + Math.random() * (new Date(e).getTime() - new Date(s).getTime())).toISOString() }

// ─── Existing IDs ─────────────────────────────────────────────────────────────
const EX = {
  incidents: { dixie: '1c24e7f6-3cf0-4938-bf89-ff763a2727fc', caldor: '4e9606d1-1188-42b0-9bda-12ee6e80cb16' },
  units: { amb1: '074449c9-6d1f-4d7d-9d09-c327bae0dc4d', amb2: 'b1f249ee-c57c-4f67-ab81-276d7be0d06f', med1: '61e75016-d4e4-4416-b147-9e337931c234', rescue1: 'eb3a1c16-79f6-4411-a526-bb7b397d18b6' },
  iu: { d_a1: 'de4ca021-5e30-4b49-a223-987b79106bde', d_a2: 'e477bfbe-546f-48d5-98b4-9a772ca23259', d_m1: 'e581025b-3685-4d18-81bf-3f97a9521d07', d_r1: '3b7fe054-61d5-4979-a104-dd95862df4de' },
  emps: { demo: '2d8dff4d-ec6f-4fbd-bf2a-c1ebf16edee2', aaron: 'c5e04633-397f-448f-9d45-d7f585b3f2b3', ben: 'd7cf3caa-ad2f-41ed-a476-49442df2578f' },
  org: '81ccaa1d-f8f9-47be-adc8-7785e6495840',
}

// ─── New data ─────────────────────────────────────────────────────────────────
const NEW_EMPS = [
  { name: 'Sarah Kincaid', role: 'MD', email: 'skincaid@ridgelineems.com', phone: '530-555-0101' },
  { name: 'Mike Torres', role: 'Paramedic', email: 'mtorres@ridgelineems.com', phone: '530-555-0102' },
  { name: 'Rachel Kim', role: 'Paramedic', email: 'rkim@ridgelineems.com', phone: '530-555-0103' },
  { name: 'Jake Wilson', role: 'EMT', email: 'jwilson@ridgelineems.com', phone: '530-555-0104' },
  { name: 'Lisa Chen', role: 'RN', email: 'lchen@ridgelineems.com', phone: '530-555-0105' },
  { name: 'Carlos Ramirez', role: 'Paramedic', email: 'cramirez@ridgelineems.com', phone: '530-555-0106' },
  { name: 'Amy Patterson', role: 'EMT', email: 'apatterson@ridgelineems.com', phone: '530-555-0107' },
  { name: 'Tom Nguyen', role: 'Admin', email: 'tnguyen@ridgelineems.com', phone: '530-555-0108' },
  { name: 'Jenna O\'Brien', role: 'Paramedic', email: 'jobrien@ridgelineems.com', phone: '530-555-0109' },
  { name: 'Derek Hall', role: 'EMT', email: 'dhall@ridgelineems.com', phone: '530-555-0110' },
].map(e => ({ ...e, id: uuid() }))

const NEW_INCIDENTS = [
  { id: uuid(), name: 'Thompson Fire 2026', status: 'Active', start_date: '2026-04-10', latitude: 39.85, longitude: -121.15, location: 'Butte County, CA' },
  { id: uuid(), name: 'Cascade Complex 2026', status: 'Active', start_date: '2026-04-14', latitude: 41.22, longitude: -122.38, location: 'Siskiyou County, CA' },
  { id: uuid(), name: 'Pilot Creek Fire 2026', status: 'Closed', start_date: '2026-03-20', end_date: '2026-04-05', latitude: 38.95, longitude: -120.42, location: 'El Dorado County, CA' },
]

const PATIENTS = [
  { first: 'James', last: 'Morrison', dob: '1978-03-14', gender: 'Male', cc: 'Smoke inhalation', narrative: 'Firefighter exposed to heavy smoke during structure defense. C/O shortness of breath, productive cough. SpO2 88% on RA, improved to 96% on 15L NRB. Bilateral wheezes. Transported to base camp medical.', acuity: 'Yellow - Delayed', disp: 'Transported to medical facility' },
  { first: 'Maria', last: 'Gonzalez', dob: '1992-07-22', gender: 'Female', cc: 'Heat exhaustion', narrative: 'Hotshot crew member working fireline 6+ hours in 102°F. Nausea, dizziness, profuse sweating. Temp 103.1°F. IV NS 1L bolus. Active cooling initiated. Vitals improved.', acuity: 'Yellow - Delayed', disp: 'Treated and released' },
  { first: 'Robert', last: 'Chen', dob: '1985-11-03', gender: 'Male', cc: 'Laceration - left forearm', narrative: 'Sawyer sustained 6cm laceration from chainsaw kickback. Wound irrigated, hemostasis achieved. 8 sutures placed. Tetanus current. RTC 48h.', acuity: 'Green - Minor', disp: 'Treated and released' },
  { first: 'Ashley', last: 'Thompson', dob: '2001-01-28', gender: 'Female', cc: 'Twisted ankle', narrative: 'Stepped in gopher hole. Right ankle swelling lateral malleolus. No deformity. Weight-bearing with pain. SAM splint, ice. X-ray recommended, patient declined. Light duty.', acuity: 'Green - Minor', disp: 'Treated and released' },
  { first: 'David', last: 'Patel', dob: '1970-09-15', gender: 'Male', cc: 'Chest pain', narrative: 'Division supervisor c/o substernal CP radiating to left arm. Hx HTN. 12-lead: ST depression V4-V6. ASA 324mg PO, NTG 0.4mg SL. Transported emergent.', acuity: 'Red - Immediate', disp: 'Transported to medical facility' },
  { first: 'Samantha', last: 'Wright', dob: '1995-04-07', gender: 'Female', cc: 'Allergic reaction - bee sting', narrative: 'Stung by yellowjacket. Urticaria up forearm, lip tingling. No airway compromise. Diphenhydramine 50mg IM. Hives resolving 30 min. Epi pen provided. Light duty.', acuity: 'Yellow - Delayed', disp: 'Treated and released' },
  { first: 'Marcus', last: 'Johnson', dob: '1988-12-19', gender: 'Male', cc: 'Back pain - lifting injury', narrative: 'Acute low back pain after lifting hose bundles. 7/10 lumbar. No radiculopathy. Ibuprofen 800mg PO, ice. Unable to continue fire duty. Light duty.', acuity: 'Green - Minor', disp: 'Treated and released' },
  { first: 'Emily', last: 'Martinez', dob: '1983-06-30', gender: 'Female', cc: 'Eye irritation - debris', narrative: 'Foreign body sensation right eye. Fluorescein: superficial corneal abrasion. Eye irrigated 500ml NS. Erythromycin ointment. Eye patch 24h.', acuity: 'Green - Minor', disp: 'Treated and released' },
  { first: 'William', last: 'O\'Connor', dob: '1976-02-11', gender: 'Male', cc: 'Dehydration', narrative: 'Found confused/lethargic. Not drinking in 100°F heat. GCS 14. Dry mucous membranes, skin tenting. 2L NS bolus, mental status improved. Transported for observation.', acuity: 'Yellow - Delayed', disp: 'Transported to medical facility' },
  { first: 'Jennifer', last: 'Nakamura', dob: '1990-08-25', gender: 'Female', cc: 'Burn - 2nd degree right hand', narrative: 'Partial thickness burn dorsum right hand from ember. ~3% TBSA. Cooled, silver sulfadiazine, sterile dressing. Tetanus booster. Follow up 48h.', acuity: 'Yellow - Delayed', disp: 'Treated and released' },
  { first: 'Brandon', last: 'Fischer', dob: '1999-05-16', gender: 'Male', cc: 'Respiratory distress - asthma', narrative: 'Known asthma, inhaler empty. SpO2 91%, bilateral wheezes. Albuterol 2.5mg neb x2. SpO2 improved to 97%. New inhaler provided. Base camp rest.', acuity: 'Yellow - Delayed', disp: 'Treated and released' },
  { first: 'Nicole', last: 'Bergstrom', dob: '1987-10-03', gender: 'Female', cc: 'Abdominal pain', narrative: 'RLQ pain x12h, worsening. Temp 100.4°F, guarding, rebound +. Appendicitis suspected. IV, ondansetron 4mg IV. Transported for surgical eval.', acuity: 'Red - Immediate', disp: 'Transported to medical facility' },
  { first: 'Tyler', last: 'Hawkins', dob: '1993-03-21', gender: 'Male', cc: 'Knee injury', narrative: 'Twisted right knee during steep descent. Swelling, unable to bear weight. Lachman +. ACL tear suspected. Immobilized, evacuated via ATV.', acuity: 'Yellow - Delayed', disp: 'Transported to medical facility' },
  { first: 'Olivia', last: 'Sandoval', dob: '1997-11-08', gender: 'Female', cc: 'Migraine', narrative: 'Severe headache, photophobia, nausea. Hx migraines. No focal deficits. Sumatriptan 6mg SubQ, ondansetron 4mg ODT. Resolved 90 min. Light duty.', acuity: 'Green - Minor', disp: 'Treated and released' },
  { first: 'Alejandro', last: 'Reyes', dob: '1982-04-29', gender: 'Male', cc: 'Shoulder dislocation', narrative: 'Fell 8ft from embankment. Anterior shoulder deformity. NV intact. Fentanyl 100mcg IN. Successful closed reduction. Sling immobilized. Transported for imaging.', acuity: 'Yellow - Delayed', disp: 'Transported to medical facility' },
]

const MEDS = [
  { name: 'Acetaminophen 500mg', route: 'PO', dose: '1000mg', type: 'OTC' },
  { name: 'Ibuprofen 200mg', route: 'PO', dose: '800mg', type: 'OTC' },
  { name: 'Albuterol 2.5mg/3ml', route: 'Nebulized', dose: '2.5mg', type: 'Rx' },
  { name: 'Normal Saline 1000ml', route: 'IV', dose: '1000ml', type: 'IV Fluid' },
  { name: 'Diphenhydramine 50mg/ml', route: 'IM', dose: '50mg', type: 'OTC' },
  { name: 'Ondansetron 4mg ODT', route: 'PO', dose: '4mg', type: 'Rx' },
  { name: 'Aspirin 324mg', route: 'PO', dose: '324mg', type: 'OTC' },
  { name: 'Fentanyl 100mcg/2ml', route: 'IN', dose: '100mcg', type: 'CS' },
  { name: 'Silver Sulfadiazine', route: 'Topical', dose: '1 application', type: 'Rx' },
]

const ICS_ACTIVITIES = [
  'Briefing with division supervisor — received daily assignments',
  'Equipment check complete, deployed to fireline',
  'Established medical aid point at Division Alpha',
  'Treated 2 patients for heat-related illness',
  'Resupplied from base camp medical cache',
  'Relocated aid station per IC direction',
  'Rehab monitoring for hotshot crew — 12 personnel screened',
  'Patient transport to base camp medical via ambulance',
  'Evening briefing — received updated IAP',
  'End-of-shift controlled substance count — all accounted for',
  'Vehicle maintenance check — oil, coolant, tires',
  'Radio check with dispatch — all frequencies operational',
  'MCI drill participation at spike camp',
  'Established LZ for helicopter evacuation',
  'Restocked ALS bags after multiple patient contacts',
  'Water resupply to crews on fireline',
  'Coordinated with CHP for road closure at Division B',
]

// ──────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Seeding FirePCR demo database...\n')

  // ── 1. De-identify existing employees ────────────────────────────────────
  console.log('1. De-identifying existing employees...')
  await api('PATCH', 'employees', { name: 'Dr. Sarah Kincaid', role: 'MD', email: 'admin@ridgelineems.com' }, `?id=eq.${EX.emps.aaron}`)
  await api('PATCH', 'employees', { name: 'Demo Medic', role: 'Paramedic', email: 'demo@firepcr.com' }, `?id=eq.${EX.emps.demo}`)
  await api('PATCH', 'employees', { name: 'Ben Carter', role: 'EMT', email: 'bcarter@ridgelineems.com' }, `?id=eq.${EX.emps.ben}`)
  console.log('  ✓ Done\n')

  // ── 2. Rename units ──────────────────────────────────────────────────────
  console.log('2. Renaming units...')
  await api('PATCH', 'units', { name: 'Medic 1' }, `?id=eq.${EX.units.amb1}`)
  await api('PATCH', 'units', { name: 'Medic 2' }, `?id=eq.${EX.units.amb2}`)
  await api('PATCH', 'units', { name: 'Aid 1' }, `?id=eq.${EX.units.med1}`)
  await api('PATCH', 'units', { name: 'Rescue 1' }, `?id=eq.${EX.units.rescue1}`)
  // Add new units
  const newUnits = [
    { id: uuid(), name: 'Medic 3', unit_type_id: '31c914e4-998b-48ba-834c-c2c78ccbbfc0' },
    { id: uuid(), name: 'Medic 4', unit_type_id: '31c914e4-998b-48ba-834c-c2c78ccbbfc0' },
    { id: uuid(), name: 'Aid 2', unit_type_id: '30ca32c3-3006-4ba4-97c6-692930a84963' },
    { id: uuid(), name: 'Rescue 2', unit_type_id: 'b107fd4a-8bb7-4653-a44d-50470f4dabcd' },
    { id: uuid(), name: 'Command 1', unit_type_id: '30ca32c3-3006-4ba4-97c6-692930a84963' },
  ]
  await api('POST', 'units', newUnits)
  console.log('  ✓ Done\n')

  // ── 3. Add new employees ─────────────────────────────────────────────────
  console.log('3. Adding employees...')
  const empRows = NEW_EMPS.map(e => ({
    id: e.id, name: e.name, role: e.role, email: e.email, phone: e.phone,
    org_id: EX.org, status: 'Active', rems_capable: Math.random() > 0.5,
  }))
  await api('POST', 'employees', empRows)
  console.log(`  ✓ ${empRows.length} employees added\n`)

  // ── Get all employees/units for reference ────────────────────────────────
  const allEmps = await api('GET', 'employees', null, '?select=id,name,role&status=eq.Active') || []
  const allUnits = await api('GET', 'units', null, '?select=id,name') || []
  const allStaff = allEmps.filter(e => ['Paramedic', 'EMT', 'RN', 'MD', 'MD/DO', 'Admin', 'Field Medic'].includes(e.role))
  const unitList = ['Medic 1', 'Medic 2', 'Medic 3', 'Aid 1', 'Rescue 1']

  // ── 4. Add incidents ─────────────────────────────────────────────────────
  console.log('4. Adding incidents...')
  for (const inc of NEW_INCIDENTS) await api('POST', 'incidents', [inc])
  console.log(`  ✓ ${NEW_INCIDENTS.length} incidents\n`)

  const allIncidents = await api('GET', 'incidents', null, '?select=id,name,status,start_date') || []

  // ── 5. Assign units to incidents ─────────────────────────────────────────
  console.log('5. Assigning units to incidents...')
  const existingIUs = await api('GET', 'incident_units', null, '?select=id,incident_id,unit_id') || []
  const existingIncidentIds = new Set(existingIUs.map(iu => iu.incident_id))
  const newIUs = []
  for (const inc of allIncidents) {
    if (existingIncidentIds.has(inc.id)) continue
    const shuffled = [...allUnits].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(randInt(3, 5), shuffled.length); i++) {
      newIUs.push({
        id: uuid(), incident_id: inc.id, unit_id: shuffled[i].id,
        assigned_at: randomDatetime(inc.start_date || '2026-04-10', '2026-04-16'),
      })
    }
  }
  if (newIUs.length > 0) await api('POST', 'incident_units', newIUs)
  console.log(`  ✓ ${newIUs.length} incident-unit assignments\n`)

  const allIUs = await api('GET', 'incident_units', null, '?select=id,incident_id,unit_id') || []

  // ── 6. Assign crew to units ──────────────────────────────────────────────
  console.log('6. Assigning crew...')
  const existingUA = await api('GET', 'unit_assignments', null, '?select=id,employee_id,incident_unit_id') || []
  const assignedEmpIds = new Set(existingUA.map(ua => ua.employee_id))
  const newUA = []
  for (const iu of allIUs) {
    const crewCount = randInt(2, 3)
    const available = allStaff.filter(e => !assignedEmpIds.has(e.id))
    for (let i = 0; i < Math.min(crewCount, available.length); i++) {
      const emp = available[i]
      assignedEmpIds.add(emp.id)
      newUA.push({
        id: uuid(), incident_unit_id: iu.id, employee_id: emp.id,
        role_on_unit: emp.role === 'MD' ? 'Medical Director' : emp.role === 'Paramedic' ? 'Unit Leader' : 'Crew Member',
        assigned_at: randomDatetime('2026-04-10', '2026-04-16'),
      })
    }
  }
  if (newUA.length > 0) await api('POST', 'unit_assignments', newUA)
  console.log(`  ✓ ${newUA.length} crew assignments\n`)

  // ── 7. Deployment records ────────────────────────────────────────────────
  console.log('7. Creating deployments...')
  const allUA = await api('GET', 'unit_assignments', null, '?select=id,employee_id,incident_unit_id') || []
  const deployments = []
  for (const ua of allUA) {
    const incId = allIUs.find(iu => iu.id === ua.incident_unit_id)?.incident_id
    if (!incId) continue
    deployments.push({
      id: uuid(), incident_id: incId, employee_id: ua.employee_id,
      daily_rate: pick([400, 500, 600, 750, 850, 1000, 1200, 1500, 1800]),
      travel_date: randomDateStr('2026-04-08', '2026-04-12'),
      status: pick(['On Scene', 'On Scene', 'On Scene', 'Traveling']),
    })
  }
  if (deployments.length > 0) await api('POST', 'deployment_records', deployments)
  console.log(`  ✓ ${deployments.length} deployments\n`)

  // ── 8. Patient encounters ────────────────────────────────────────────────
  console.log('8. Updating/creating patient encounters...')
  const existingEncs = await api('GET', 'patient_encounters', null, '?select=id&order=created_at.asc&limit=15') || []
  const incIds = allIncidents.map(i => i.id)
  let updated = 0

  for (let i = 0; i < Math.min(existingEncs.length, PATIENTS.length); i++) {
    const p = PATIENTS[i]
    const provider = pick(allStaff)
    const result = await api('PATCH', 'patient_encounters', {
      patient_first_name: p.first, patient_last_name: p.last,
      patient_dob: p.dob, patient_gender: p.gender,
      primary_symptom_text: p.cc, notes: p.narrative,
      initial_acuity: p.acuity, patient_disposition: p.disp,
      unit: pick(unitList), incident_id: pick(incIds),
      provider_of_record: provider.name,
      date: randomDateStr('2026-04-10', '2026-04-18'),
    }, `?id=eq.${existingEncs[i].id}`)
    if (result) updated++
  }

  // Create remaining encounters
  const remaining = PATIENTS.slice(existingEncs.length)
  if (remaining.length > 0) {
    const newEncs = remaining.map(p => {
      const provider = pick(allStaff)
      return {
        id: uuid(), patient_first_name: p.first, patient_last_name: p.last,
        patient_dob: p.dob, patient_gender: p.gender,
        primary_symptom_text: p.cc, notes: p.narrative,
        initial_acuity: p.acuity, patient_disposition: p.disp,
        unit: pick(unitList), incident_id: pick(incIds),
        provider_of_record: provider.name, created_by: provider.name,
        date: randomDateStr('2026-04-10', '2026-04-18'),
      }
    })
    await api('POST', 'patient_encounters', newEncs)
  }
  console.log(`  ✓ ${updated} updated, ${remaining.length} created\n`)

  // ── 9. Medication administrations (dispense_admin_log) ───────────────────
  console.log('9. Creating MAR entries...')
  const allEncs = await api('GET', 'patient_encounters', null, '?select=id,unit,incident_id,patient_first_name,patient_last_name,patient_dob,date&limit=20') || []
  const marEntries = []
  for (const enc of allEncs) {
    const medCount = randInt(1, 3)
    for (let i = 0; i < medCount; i++) {
      const med = pick(MEDS)
      const provider = pick(allStaff)
      marEntries.push({
        id: uuid(),
        encounter_id: enc.id,
        item_name: med.name,
        medication_route: med.route,
        qty_used: 1,
        dispensed_by: provider.name,
        prescribing_provider: pick(allEmps.filter(e => e.role === 'MD'))?.name || provider.name,
        date: enc.date || randomDateStr('2026-04-10', '2026-04-18'),
        time: `${String(randInt(6, 22)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`,
        med_unit: enc.unit,
        incident: allIncidents.find(i => i.id === enc.incident_id)?.name || 'Unknown',
        patient_name: `${enc.patient_last_name}, ${enc.patient_first_name}`,
        dob: enc.patient_dob,
        type: med.type,
        item_type: med.type,
        indication: pick(['Pain', 'Nausea', 'Allergic reaction', 'Respiratory distress', 'Cardiac', 'Hydration', 'Wound care', 'Fever']),
        entry_type: 'administration',
      })
    }
  }
  if (marEntries.length > 0) await api('POST', 'dispense_admin_log', marEntries)
  console.log(`  ✓ ${marEntries.length} MAR entries\n`)

  // ── 10. Supply runs ──────────────────────────────────────────────────────
  console.log('10. Creating supply runs...')
  const SUPPLY_ITEMS = [
    'Gauze 4x4', 'Trauma Dressing', 'SAM Splint', 'Cervical Collar', 'Oxygen Mask NRB',
    'IV Start Kit', 'Normal Saline 1000ml', 'Nasal Cannula', 'Band-Aids Assorted',
    'Ace Bandage 4"', 'Cold Pack', 'Eye Wash 500ml', 'Tegaderm', 'Steri-Strips',
    'Burn Sheet', 'Pulse Oximeter Probe', 'BP Cuff Disposable', 'Gloves Nitrile M',
  ]
  const runs = []
  const runItems = []
  for (let i = 0; i < 8; i++) {
    const iu = pick(allIUs)
    const inc = allIncidents.find(x => x.id === iu.incident_id)
    const srId = uuid()
    runs.push({
      id: srId, incident_unit_id: iu.id, incident_id: iu.incident_id,
      run_date: randomDateStr('2026-04-10', '2026-04-18'),
      crew_member: pick(allStaff).name,
      notes: pick([null, 'Urgent restock needed', 'Routine resupply', 'Post-MCI restock']),
    })
    for (let j = 0; j < randInt(3, 8); j++) {
      runItems.push({
        id: uuid(), supply_run_id: srId,
        item_name: pick(SUPPLY_ITEMS),
        quantity: randInt(2, 20),
        category: pick(['Supply', 'Med', 'Equipment']),
      })
    }
  }
  await api('POST', 'supply_runs', runs)
  await api('POST', 'supply_run_items', runItems)
  console.log(`  ✓ ${runs.length} runs, ${runItems.length} items\n`)

  // ── 11. ICS 214 activity logs ────────────────────────────────────────────
  console.log('11. Creating ICS 214 logs...')
  const ics214s = []
  const ics214Acts = []
  for (const iu of allIUs.slice(0, 8)) {
    const inc = allIncidents.find(i => i.id === iu.incident_id)
    const unit = allUnits.find(u => u.id === iu.unit_id)
    if (!inc || !unit) continue
    
    const icsId = `RDG-ICS214-${randomDateStr('2026-04-10', '2026-04-18').replace(/-/g, '')}-${unit.name.replace(/\s/g, '')}`
    const headerId = uuid()
    ics214s.push({
      id: headerId, ics214_id: icsId,
      incident_id: inc.id, incident_name: inc.name,
      unit_name: unit.name, unit_id: iu.unit_id,
      op_date: randomDateStr('2026-04-10', '2026-04-18'),
      leader_name: pick(allStaff).name,
      leader_position: 'Unit Leader',
      status: pick(['Open', 'Open', 'Closed']),
      created_by: pick(allStaff).name,
    })
    
    for (let j = 0; j < randInt(4, 10); j++) {
      ics214Acts.push({
        id: uuid(), ics214_id: icsId,
        log_datetime: randomDatetime('2026-04-10', '2026-04-18'),
        description: pick(ICS_ACTIVITIES),
        logged_by: pick(allStaff).name,
        activity_type: pick(['Operations', 'Medical', 'Logistics', 'Admin']),
      })
    }
  }
  if (ics214s.length > 0) await api('POST', 'ics214_headers', ics214s)
  if (ics214Acts.length > 0) await api('POST', 'ics214_activities', ics214Acts)
  console.log(`  ✓ ${ics214s.length} headers, ${ics214Acts.length} activities\n`)

  // ── 12. Update unit type descriptions ────────────────────────────────────
  console.log('12. De-identifying unit type descriptions...')
  await api('PATCH', 'unit_types', { description: 'ALS ambulance unit — NEMSIS PCR, full formulary' }, '?id=eq.31c914e4-998b-48ba-834c-c2c78ccbbfc0')
  await api('PATCH', 'unit_types', { description: 'Medical support unit — simple EHR, OTC/Rx formulary' }, '?id=eq.30ca32c3-3006-4ba4-97c6-692930a84963')
  await api('PATCH', 'unit_types', { description: 'Remote emergency medical support — simple EHR, basic formulary' }, '?id=eq.b107fd4a-8bb7-4653-a44d-50470f4dabcd')
  console.log('  ✓ Done\n')

  console.log('🎉 Demo seeded!')
  console.log(`   ${allIncidents.length} incidents, ${allEmps.length} employees`)
  console.log(`   ${PATIENTS.length} patient encounters, ${marEntries.length} MAR entries`)
  console.log(`   ${runs.length} supply runs, ${ics214s.length} ICS 214 logs, ${deployments.length} deployments`)
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
