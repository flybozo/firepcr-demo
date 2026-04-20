/**
 * Encounters service — queries and mutations for patient encounters,
 * progress notes, photos, procedures, and related clinical data.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get a single encounter by ID */
export function queryEncounter(id: string) {
  return createClient()
    .from('patient_encounters')
    .select('*')
    .eq('id', id)
    .single()
}

/** Get encounters list — used in encounter search/detail loaders */
export function queryEncountersByPatient(search: string) {
  return createClient()
    .from('patient_encounters')
    .select('id, patient_name, acuity, unit, incident_id, created_at, encounter_type')
    .eq('is_deleted', false)
    .ilike('patient_name', `%${search}%`)
    .order('created_at', { ascending: false })
    .limit(50)
}

/** Get active incidents for encounter creation */
export function queryActiveIncidentsForEncounters() {
  return createClient()
    .from('incidents')
    .select('id, name')
    .eq('status', 'Active')
    .order('name')
}

/** Get all incidents (active + closed) */
export function queryAllIncidents() {
  return createClient()
    .from('incidents')
    .select('id, name')
    .in('status', ['Active', 'Closed'])
    .order('name')
}

/** Get incident name by ID */
export function queryIncidentName(id: string) {
  return createClient()
    .from('incidents')
    .select('name')
    .eq('id', id)
    .single()
}

/** Get units with incident assignments (for encounter creation) */
export function queryUnitsWithIncidents() {
  return createClient()
    .from('units')
    .select('id, name, unit_type:unit_types(name), incident_units(id, released_at, incident:incidents(id, name, status))')
    .eq('active', true)
    .neq('name', 'Warehouse')
    .order('name')
}

/** Get clinical staff for encounter forms */
export function queryClinicalStaff(roles = ['MD', 'DO', 'NP', 'PA', 'RN', 'Paramedic', 'EMT']) {
  return createClient()
    .from('employees')
    .select('id, name, role')
    .in('role', roles)
    .eq('status', 'Active')
    .order('role')
}

/** Get MDs/DOs for encounter assignment */
export function queryPhysicians() {
  return createClient()
    .from('employees')
    .select('id, full_name, role')
    .in('role', ['MD', 'DO'])
    .eq('status', 'Active')
    .order('full_name')
}

/** Get progress notes for an encounter */
export function queryProgressNotes(encounterId: string) {
  return createClient()
    .from('progress_notes')
    .select('*')
    .eq('encounter_id', encounterId)
    .is('deleted_at', null)
    .order('note_datetime', { ascending: false })
}

/** Get encounters for photo/procedure lookups */
export function queryEncounterLookup(filters: { incidentId?: string; unitName?: string }) {
  let q = createClient()
    .from('patient_encounters')
    .select('id, patient_name, unit, acuity, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
  if (filters.incidentId) q = q.eq('incident_id', filters.incidentId)
  if (filters.unitName) q = q.eq('unit', filters.unitName)
  return q
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Create a new patient encounter */
export async function createEncounter(data: Record<string, unknown>) {
  return createClient()
    .from('patient_encounters')
    .insert(data)
    .select('id')
    .single()
}

/** Update encounter fields — returns the query builder so callers can chain .select() */
export function updateEncounter(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('patient_encounters')
    .update(data)
    .eq('id', id)
}

/** Log a clinical audit trail entry */
export async function logClinicalAudit(data: {
  table_name?: string
  record_id: string
  action?: string
  field_name: string
  old_value?: string | null
  new_value?: string | null
  performed_by: string
  performed_by_employee_id?: string | null
}) {
  return createClient()
    .from('clinical_audit_log')
    .insert({
      table_name: data.table_name || 'patient_encounters',
      record_id: data.record_id,
      action: data.action || 'field_edit',
      field_name: data.field_name,
      old_value: data.old_value,
      new_value: data.new_value,
      performed_by: data.performed_by,
      performed_by_employee_id: data.performed_by_employee_id,
    })
}

/** Create a progress note */
export async function createProgressNote(data: Record<string, unknown>) {
  return createClient()
    .from('progress_notes')
    .insert(data)
}

/** Update a progress note */
export async function updateProgressNote(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('progress_notes')
    .update(data)
    .eq('id', id)
}

/** Soft-delete a progress note */
export async function deleteProgressNote(id: string, deletedBy: string) {
  return createClient()
    .from('progress_notes')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('id', id)
}

/** Upload a patient photo */
export async function uploadPatientPhoto(file: File, path: string) {
  return createClient()
    .storage.from('patient-photos')
    .upload(path, file, { upsert: false })
}

/** Insert patient photo record */
export async function insertPatientPhoto(data: {
  encounter_id: string
  photo_url: string
  caption?: string | null
  taken_by?: string
  taken_at?: string
}) {
  return createClient()
    .from('patient_photos')
    .insert(data)
}

/** Insert encounter procedure */
export async function insertProcedure(data: Record<string, unknown>) {
  return createClient()
    .from('encounter_procedures')
    .insert(data)
}

/** Get signed URL for patient photo */
export async function getPatientPhotoUrl(path: string, expiresIn = 3600) {
  const { data } = await createClient().storage.from('patient-photos').createSignedUrl(path, expiresIn)
  return data?.signedUrl || null
}

/** Get signed URL from documents bucket */
export async function getDocumentUrl(path: string, expiresIn = 3600) {
  const { data } = await createClient().storage.from('documents').createSignedUrl(path, expiresIn)
  return data?.signedUrl || null
}

/** Update MAR entry quantity */
export async function updateMARQuantity(id: string, qty: number) {
  return createClient()
    .from('dispense_admin_log')
    .update({ qty_used: qty })
    .eq('id', id)
}

/** Update unit inventory quantity */
export async function updateInventoryQuantity(id: string, qty: number) {
  return createClient()
    .from('unit_inventory')
    .update({ quantity: qty })
    .eq('id', id)
}
