/**
 * Incident service — all Supabase queries and mutations for incidents.
 * Pages should call these functions instead of using supabase.from() directly.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** List all incidents with their unit counts */
export function queryIncidentsList() {
  return createClient()
    .from('incidents')
    .select('id, name, location, incident_number, start_date, closed_at, status, incident_units(id, released_at)')
    .order('created_at', { ascending: false })
}

/** Get a single incident by ID */
export function queryIncident(id: string) {
  return createClient()
    .from('incidents')
    .select('*')
    .eq('id', id)
    .single()
}

/** Get active (non-released) incident_units with crew counts */
export function queryActiveIncidentUnits(incidentId: string) {
  return createClient()
    .from('incident_units')
    .select(`
      id,
      assigned_at,
      released_at,
      daily_contract_rate,
      unit:units(id, name, photo_url, unit_type:unit_types(name, default_contract_rate)),
      unit_assignments(id)
    `)
    .eq('incident_id', incidentId)
    .is('released_at', null)
}

/** Get ALL incident_units (including released) — for revenue tracking */
export function queryAllIncidentUnits(incidentId: string) {
  return createClient()
    .from('incident_units')
    .select(`
      id,
      assigned_at,
      released_at,
      daily_contract_rate,
      unit:units(id, name, photo_url, unit_type:unit_types(name, default_contract_rate)),
      unit_assignments(id)
    `)
    .eq('incident_id', incidentId)
}

/** Get available units (non-storage) for assignment */
export function queryAvailableUnits() {
  return createClient()
    .from('units')
    .select('id, name, unit_type:unit_types(name, default_contract_rate)')
    .eq('is_storage', false)
    .order('name')
}

/** Get recent encounters for an incident */
export function queryIncidentEncounters(incidentId: string, limit = 5) {
  return createClient()
    .from('patient_encounters')
    .select('id, patient_name, acuity, disposition, unit, created_at, locked_at, is_deleted, encounter_type')
    .eq('incident_id', incidentId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit)
}

/** Count all encounters for an incident */
export function queryIncidentEncounterCount(incidentId: string) {
  return createClient()
    .from('patient_encounters')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
    .eq('is_deleted', false)
}

/** Get recent MAR entries for an incident */
export function queryIncidentMAR(incidentId: string, limit = 3) {
  return createClient()
    .from('dispense_admin_log')
    .select('id, drug_name, dose, route, unit, employee_name, administered_at, is_voided')
    .eq('incident_id', incidentId)
    .order('administered_at', { ascending: false })
    .limit(limit)
}

/** Count MAR entries for an incident */
export function queryIncidentMARCount(incidentId: string) {
  return createClient()
    .from('dispense_admin_log')
    .select('id', { count: 'exact', head: true })
    .eq('incident_id', incidentId)
}

/** Get supply runs for an incident */
export function queryIncidentSupplyRuns(incidentId: string, limit = 3) {
  return createClient()
    .from('supply_runs')
    .select(`
      id,
      run_date,
      time,
      resource_number,
      dispensed_by,
      notes,
      created_at,
      incident_id,
      incident:incidents(name),
      incident_unit:incident_units(unit:units(name)),
      supply_run_items(id)
    `)
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(limit)
}

/** Get ICS 214 logs for an incident */
export function queryIncidentICS214(incidentId: string, limit = 3) {
  return createClient()
    .from('ics214_headers')
    .select('id, unit_name, op_period_start, op_period_end, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(limit)
}

/** Get deployment records for an incident */
export function queryDeploymentRecords(incidentId: string) {
  return createClient()
    .from('deployment_records')
    .select(`
      id, employee_id, incident_unit_id, start_date, end_date, daily_rate,
      hours_per_day, role_on_unit, notes, status,
      employee:employees(id, name, role, headshot_url),
      incident_unit:incident_units(id, unit:units(id, name))
    `)
    .eq('incident_id', incidentId)
    .order('start_date', { ascending: false })
}

/** Get comp claims for an incident */
export function queryIncidentCompClaims(incidentId: string) {
  return createClient()
    .from('comp_claims')
    .select('id, employee_name, injury_date, injury_type, pdf_url, created_at')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
}

/** Get incident expenses */
export function queryIncidentExpenses(incidentId: string) {
  return createClient()
    .from('incident_expenses')
    .select('id, expense_type, amount, description, expense_date, receipt_url, no_receipt_reason, employee:employees(id, name)')
    .eq('incident_id', incidentId)
    .order('expense_date', { ascending: false })
}

/** Get user preferences (default fire, card order, etc.) */
export function queryUserPreferences(userId: string) {
  return createClient()
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
}

/** Get reorder alerts for an incident's units */
export function queryReorderAlerts(incidentId: string) {
  return createClient()
    .from('unit_inventory')
    .select('id, item_name, quantity, par_qty, unit:units!inner(id, name, incident_units!inner(incident_id))')
    .lt('quantity', createClient().rpc ? 0 : 999) // will be refined per-page
}

/** Incident + units for shift ticket */
export function queryShiftTicketData(incidentId: string) {
  const supabase = createClient()
  return Promise.all([
    supabase.from('incidents').select('*').eq('id', incidentId).single(),
    supabase.from('incident_units')
      .select('id, unit:units(id, name, make_model, vin, license_plate, unit_type)')
      .eq('incident_id', incidentId)
      .is('released_at', null),
  ])
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Create a new incident */
export async function createIncident(data: {
  name: string
  location?: string
  incident_number?: string
  agreement_number?: string
  resource_order_number?: string
  start_date?: string
  status?: string
}) {
  return createClient()
    .from('incidents')
    .insert({ ...data, status: data.status || 'Active' })
    .select('id')
    .single()
}

/** Update incident fields */
export async function updateIncident(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('incidents')
    .update(data)
    .eq('id', id)
}

/** Upload incident logo and update incident record */
export async function uploadIncidentLogo(incidentId: string, file: File) {
  const supabase = createClient()
  const path = `incident-logos/${incidentId}/${file.name}`
  const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (error) throw error
  const url = supabase.storage.from('documents').getPublicUrl(data.path).data.publicUrl
  await supabase.from('incidents').update({ logo_url: url }).eq('id', incidentId)
  return url
}

/** Assign a unit to an incident */
export async function assignUnitToIncident(incidentId: string, unitId: string) {
  const supabase = createClient()
  const { data } = await supabase.from('incident_units').insert({
    incident_id: incidentId,
    unit_id: unitId,
  }).select('id').single()
  await supabase.from('units').update({ unit_status: 'in_service' }).eq('id', unitId)
  return data
}

/** Release a unit (demobilize) from an incident */
export async function releaseUnit(incidentUnitId: string) {
  const supabase = createClient()
  const now = new Date().toISOString()
  await supabase.from('unit_assignments').update({ released_at: now }).eq('incident_unit_id', incidentUnitId)
  await supabase.from('incident_units').update({ released_at: now }).eq('id', incidentUnitId)
}

/** Move a unit from one incident to another */
export async function moveUnit(incidentUnitId: string, unitId: string, targetIncidentId: string) {
  const supabase = createClient()
  const now = new Date().toISOString()
  // Release from current
  await supabase.from('unit_assignments').update({ released_at: now }).eq('incident_unit_id', incidentUnitId)
  await supabase.from('incident_units').update({ released_at: now }).eq('id', incidentUnitId)
  // Assign to target
  await supabase.from('incident_units').insert({ incident_id: targetIncidentId, unit_id: unitId })
  await supabase.from('units').update({ unit_status: 'in_service' }).eq('id', unitId)
}

/** Update incident unit contract rate */
export async function updateIncidentUnitRate(incidentUnitId: string, rate: number) {
  return createClient()
    .from('incident_units')
    .update({ daily_contract_rate: rate })
    .eq('id', incidentUnitId)
}

/** Create a deployment record */
export async function createDeploymentRecord(data: {
  incident_id: string
  incident_unit_id: string
  employee_id: string
  start_date: string
  end_date?: string
  daily_rate?: number
  hours_per_day?: number
  role_on_unit?: string
  notes?: string
}) {
  return createClient()
    .from('deployment_records')
    .insert(data)
    .select('id')
    .single()
}

/** Assign crew member to a unit */
export async function assignCrewToUnit(incidentUnitId: string, employeeId: string, roleOnUnit?: string) {
  return createClient()
    .from('unit_assignments')
    .insert({
      incident_unit_id: incidentUnitId,
      employee_id: employeeId,
      role_on_unit: roleOnUnit || 'crew',
    })
}

/** Delete a deployment record */
export async function deleteDeploymentRecord(id: string) {
  return createClient()
    .from('deployment_records')
    .delete()
    .eq('id', id)
}

/** Update a deployment record */
export async function updateDeploymentRecord(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('deployment_records')
    .update(data)
    .eq('id', id)
}

/** Save user preferences (card order, default fire, etc.) */
export async function upsertUserPreferences(userId: string, prefs: Record<string, unknown>) {
  return createClient()
    .from('user_preferences')
    .upsert({ user_id: userId, ...prefs })
}

/** Add an expense to an incident */
export async function addIncidentExpense(data: {
  incident_id: string
  expense_type: string
  amount: number
  description?: string
  expense_date: string
  receipt_url?: string
  no_receipt_reason?: string
  employee_id?: string
}) {
  return createClient()
    .from('incident_expenses')
    .insert(data)
    .select('id')
    .single()
}

/** Upload expense receipt */
export async function uploadExpenseReceipt(incidentId: string, file: File, fileName: string) {
  const supabase = createClient()
  const storagePath = `expenses/${incidentId}/${fileName}`
  const { error } = await supabase.storage.from('documents').upload(storagePath, file, { upsert: false })
  if (error) throw error
  return storagePath
}

/** Delete an incident expense */
export async function deleteIncidentExpense(id: string) {
  return createClient()
    .from('incident_expenses')
    .delete()
    .eq('id', id)
}

/** Get a signed URL for a storage path */
export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
  const { data } = await createClient().storage.from(bucket).createSignedUrl(path, expiresIn)
  return data?.signedUrl || null
}

/** Close an incident */
export async function closeIncident(id: string, closedAt: string, notes?: string) {
  return createClient()
    .from('incidents')
    .update({ status: 'Closed', closed_at: closedAt, notes: notes || null })
    .eq('id', id)
}
