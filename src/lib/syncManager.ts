import { createClient } from '@/lib/supabase/client'
import {
  cacheData,
  getPendingWrites,
  markSynced,
  updateSyncMeta,
  getPendingCount,
} from './offlineStore'

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
let syncInProgress = false
let listeners: ((online: boolean, pendingCount: number) => void)[] = []
let monitorInitialized = false

// ── Connection monitoring ─────────────────────────────────────────────────────

export function initConnectionMonitor() {
  if (typeof window === 'undefined') return
  if (monitorInitialized) return
  monitorInitialized = true

  window.addEventListener('online', () => {
    isOnline = true
    notifyListeners()
    flushPendingWrites()
    syncDataFromServer()
  })

  window.addEventListener('offline', () => {
    isOnline = false
    notifyListeners()
  })
}

export function onConnectionChange(fn: (online: boolean, pendingCount: number) => void) {
  listeners.push(fn)
  return () => {
    listeners = listeners.filter(l => l !== fn)
  }
}

async function notifyListeners() {
  const count = await getPendingCount()
  listeners.forEach(fn => fn(isOnline, count))
}

export function getIsOnline(): boolean {
  // Always check navigator directly — cached value can be stale on iOS
  if (typeof navigator !== 'undefined') return navigator.onLine
  return isOnline
}

// ── Pull fresh data from Supabase ─────────────────────────────────────────────

export async function syncDataFromServer(): Promise<void> {
  if (!isOnline) return

  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data: emp } = await supabase
      .from('employees')
      .select('id, name, role, app_role, auth_user_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!emp) return

    // AGGRESSIVE PRELOAD — cache ALL data for offline field operations
    // No limits on critical tables — field crews need everything
    console.log('[Sync] Starting aggressive data preload...')

    // Phase 1: Core reference data (small, fast)
    const [incidents, units, employees, formulary, incidentUnits] = await Promise.all([
      supabase.from('incidents').select('*, incident_units(id, released_at)'),  // ALL incidents with unit counts
      supabase.from('units').select('*, unit_type:unit_types(name), incident_units(id, released_at, incident:incidents(name, status), unit_assignments(id, released_at, employee:employees(id, name, role)))'),  // ALL units with assignments
      supabase.from('employees_sync').select('*'),  // Safe view — strips signing_pin_hash, DOB, home_address, emergency_contact, personal_email, personal_phone, daily_rate
      supabase.from('formulary_templates').select('id, item_name, category, unit_type, barcode, upc, controlled, route, concentration, unit_of_measure, default_dose, max_dose, notes, active'),  // ALL formulary items
      supabase.from('incident_units').select('id, incident_id, released_at, unit:units(id, name, unit_type:unit_types(name))'),  // For CS/unit mapping
    ])

    console.log('[Sync] Phase 1:', { incidents: incidents.data?.length, units: units.data?.length, employees: employees.data?.length, formulary: formulary.data?.length, incidentUnits: incidentUnits.data?.length })
    if (incidents.data) await cacheData('incidents', incidents.data)
    if (units.data) await cacheData('units', units.data)
    if (employees.data) await cacheData('employees', employees.data)
    if (formulary.data) await cacheData('formulary', formulary.data)
    if (incidentUnits.data) await cacheData('incident_units', incidentUnits.data)
    console.log('[Sync] Phase 1 done — reference data cached')

    // Phase 2: Patient data (larger, but critical)
    const [encounters, mar, vitals] = await Promise.all([
      supabase.from('patient_encounters').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
      supabase.from('dispense_admin_log').select('id, date, time, patient_name, item_name, qty_used, qty_wasted, med_unit, dispensed_by, category, route, medication_route, indication, dose_mg, concentration, lot_number, expiration_date, exp_date, witness_name, witness_signature_url, encounter_id, unit, incident, notes, prescribing_provider, entry_type, provider_signature_url, provider_signed_at, provider_signed_by, requires_cosign, cosigned_at, cosigned_by, cosign_signature_url, dosage_units, item_type, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('encounter_vitals').select('id, encounter_id, recorded_at, recorded_by, hr, rr, spo2, bp_systolic, bp_diastolic, gcs_eye, gcs_verbal, gcs_motor, gcs_total, pain_scale, blood_glucose, temp_f, skin, cardiac_rhythm, etco2, pupils').order('recorded_at', { ascending: false }).limit(1000),
    ])

    console.log('[Sync] Phase 2:', { encounters: encounters.data?.length, mar: mar.data?.length, vitals: vitals.data?.length })
    if (encounters.data) await cacheData('encounters', encounters.data)
    if (mar.data) await cacheData('mar_entries', mar.data)
    if (vitals.data) await cacheData('vitals', vitals.data)
    console.log('[Sync] Phase 2 done — patient data cached')

    // Phase 3: Operations data
    const [inventory, supplyRuns, ics214s, ics214Activities, ics214Personnel] = await Promise.all([
      supabase.from('unit_inventory').select('id, item_name, category, quantity, par_qty, lot_number, expiration_date, unit_id, incident_unit_id, barcode, upc').order('item_name').limit(2000),
      supabase.from('supply_runs').select('*, incident:incidents(name), supply_run_items(*)').order('run_date', { ascending: false }).limit(200),
      supabase.from('ics214_headers').select('id, ics214_id, incident_id, incident_name, unit_id, unit_name, op_date, op_start, op_end, leader_name, leader_position, status, pdf_url, pdf_file_name, notes, created_by, created_at, closed_at, closed_by').order('created_at', { ascending: false }).limit(100),
      supabase.from('ics214_activities').select('id, ics214_id, log_datetime, description, logged_by, activity_type').order('log_datetime', { ascending: false }).limit(500),
      supabase.from('ics214_personnel').select('id, ics214_id, employee_name, ics_position, home_agency').limit(500),
    ])

    console.log('[Sync] Phase 3:', { inventory: inventory.data?.length, supplyRuns: supplyRuns.data?.length, ics214s: ics214s.data?.length })
    if (inventory.data) await cacheData('inventory', inventory.data)
    if (supplyRuns.data) await cacheData('supply_runs', supplyRuns.data)
    // ICS 214 headers — no dedicated store, but cache attempt won't crash
    try { if (ics214s.data) await cacheData('ics214s' as any, ics214s.data) } catch {}
    try { if (ics214Activities.data) await cacheData('ics214_activities' as any, ics214Activities.data) } catch {}
    try { if (ics214Personnel.data) await cacheData('ics214_personnel' as any, ics214Personnel.data) } catch {}
    console.log('[Sync] Phase 3 done — operations data cached')

    // Phase 4: Progress notes + procedures (for encounter detail views)
    const [progressNotes, procedures] = await Promise.all([
      supabase.from('progress_notes').select('*').is('deleted_at', null).order('note_datetime', { ascending: false }).limit(500),
      supabase.from('encounter_procedures').select('id, encounter_id, procedure_name, performed_at, performed_by, body_site, outcome, complications, notes').order('performed_at', { ascending: false }).limit(500),
    ])

    // Cache these into encounters store as sub-collections
    // (detail pages will look them up by encounter_id)
    if (progressNotes.data) {
      try { await cacheData('progress_notes' as any, progressNotes.data) } catch { /* store may not exist */ }
    }
    if (procedures.data) {
      try { await cacheData('procedures' as any, procedures.data) } catch { /* store may not exist */ }
    }

    await updateSyncMeta('global', new Date().toISOString())
    await notifyListeners()

    console.log('[Sync] Complete — all data preloaded for offline use')
  } catch (err) {
    console.error('[Sync] Sync from server failed:', err)
  }
}

// ── Flush pending offline writes to Supabase ──────────────────────────────────

export async function flushPendingWrites(): Promise<void> {
  if (!isOnline || syncInProgress) return
  syncInProgress = true

  const supabase = createClient()
  const pending = await getPendingWrites()

  if (pending.length === 0) {
    syncInProgress = false
    return
  }

  console.log('[Sync] Flushing', pending.length, 'pending writes...')

  // Process in chronological order
  pending.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  for (const item of pending) {
    try {
      if (item.operation === 'insert') {
        const { error } = await supabase.from(item.table).insert(item.data)
        if (error) {
          // 23505 = unique_violation — record already exists (idempotent duplicate)
          // Treat as success so offline retries don't loop forever
          const idempotentTables = ['dispense_admin_log', 'patient_encounters', 'supply_runs', 'encounter_procedures']
          if (error.code === '23505' && idempotentTables.includes(item.table)) {
            console.warn(`[Sync] Duplicate ${item.table} entry (client_request_id collision) — marking synced:`, item.id)
            await markSynced(item.id)
            continue
          }
          throw error
        }
      } else if (item.operation === 'update') {
        const { id, ...rest } = item.data
        const { error } = await supabase.from(item.table).update(rest).eq('id', id)
        if (error) throw error
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.data.id)
        if (error) throw error
      }
      await markSynced(item.id)
    } catch (err: any) {
      console.error('[Sync] Failed for', item.table, item.operation, ':', err?.message || err)
      // Don't mark synced — retry next time
    }
  }

  syncInProgress = false
  await updateSyncMeta('global', new Date().toISOString())
  await notifyListeners()
}
