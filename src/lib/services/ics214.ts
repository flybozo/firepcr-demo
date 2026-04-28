/**
 * ICS 214 service — queries and mutations for ICS 214 activity logs.
 */
import { createClient } from '@/lib/supabase/client'
import { brand } from '@/lib/branding.config'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get a single ICS 214 header with activities and personnel */
export function queryICS214(id: string) {
  return createClient()
    .from('ics214_headers')
    .select('*, ics214_activities(*), ics214_personnel(*)')
    .eq('id', id)
    .single()
}

/** Get ICS 214 headers for an incident */
export function queryICS214ByIncident(incidentId: string) {
  return createClient()
    .from('ics214_headers')
    .select('id, unit_name, op_period_start, op_period_end, created_at, signed_at, signed_by')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
}

/** Get all ICS 214 headers */
export function queryICS214List() {
  return createClient()
    .from('ics214_headers')
    .select('id, unit_name, op_period_start, op_period_end, created_at, signed_at, signed_by, incident:incidents(id, name)')
    .order('created_at', { ascending: false })
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Create an ICS 214 header */
export function insertICS214Header(data: Record<string, unknown>) {
  return createClient()
    .from('ics214_headers')
    .insert(data)
    .select('id')
    .single()
}

/** Update ICS 214 header */
export function updateICS214Header(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('ics214_headers')
    .update(data)
    .eq('id', id)
}

/** Insert ICS 214 activity */
export function insertActivity(data: Record<string, unknown>) {
  return createClient()
    .from('ics214_activities')
    .insert(data)
}

/** Delete ICS 214 activity */
export function deleteActivity(id: string) {
  return createClient()
    .from('ics214_activities')
    .delete()
    .eq('id', id)
}

/** Insert ICS 214 personnel */
export function insertPersonnel(data: Record<string, unknown>) {
  return createClient()
    .from('ics214_personnel')
    .insert(data)
}

/** Delete ICS 214 personnel */
export function deletePersonnel(id: string) {
  return createClient()
    .from('ics214_personnel')
    .delete()
    .eq('id', id)
}

/** Create a full ICS 214 log (header + personnel snapshot + initial activity). Returns the ics214_id string. */
export async function createICS214(params: {
  unitId: string
  unitName: string
  incidentId: string
  incidentName: string
  opDate: string
  opStart: string
  opEnd: string
  leaderName: string
  leaderPosition: string
  notes: string
  initialActivity: string
  initialActivityTime?: string
  crew: Array<{ id: string; name: string; role?: string }>
  createdBy: string
  isAdmin: boolean
}): Promise<string> {
  const supabase = createClient()
  const { unitId, unitName, incidentId, incidentName, opDate, opStart, opEnd,
    leaderName, leaderPosition, notes, initialActivity, initialActivityTime, crew, createdBy, isAdmin } = params

  const dateStr = opDate.replace(/-/g, '')
  const unitClean = unitName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const { count } = await supabase
    .from('ics214_headers')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${opDate}T00:00:00`)
    .lte('created_at', `${opDate}T23:59:59`)
  const seq = String((count ?? 0) + 1).padStart(3, '0')
  const ics214Id = `ICS214-${dateStr}-${unitClean}-${seq}`

  let incidentUnitId: string | null = null
  const { data: iuData } = await supabase
    .from('incident_units')
    .select('id')
    .eq('unit_id', unitId)
    .eq('incident_id', incidentId)
    .limit(1)
  if (iuData && iuData.length > 0) incidentUnitId = iuData[0].id

  const { error: headerError } = await supabase.from('ics214_headers').insert({
    ics214_id: ics214Id,
    incident_id: incidentId,
    incident_name: incidentName,
    unit_id: unitId,
    unit_name: unitName,
    op_date: opDate,
    op_start: opStart,
    op_end: opEnd,
    leader_name: leaderName,
    leader_position: leaderPosition,
    status: 'Open',
    notes: notes || null,
    created_by: createdBy,
  })
  if (headerError) throw headerError

  if (crew.length > 0) {
    await supabase.from('ics214_personnel').insert(
      crew.map(emp => ({
        ics214_id: ics214Id,
        employee_name: emp.name,
        ics_position: emp.role || '',
        home_agency: brand.companyName,
      }))
    )
  }

  await supabase.from('ics214_activities').insert({
    ics214_id: ics214Id,
    log_datetime: initialActivityTime ? new Date(initialActivityTime).toISOString() : new Date().toISOString(),
    description: initialActivity.trim(),
    logged_by: createdBy,
    activity_type: 'activity',
  })

  if (!isAdmin && incidentUnitId) {
    await supabase
      .from('patient_encounters')
      .update({ ics214_id: ics214Id } as any)
      .eq('incident_id', incidentId)
      .eq('unit', unitName)
      .gte('date', opDate)
      .lte('date', opDate)
  }

  return ics214Id
}
