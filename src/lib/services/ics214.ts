/**
 * ICS 214 service — queries and mutations for ICS 214 activity logs.
 */
import { createClient } from '@/lib/supabase/client'

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
