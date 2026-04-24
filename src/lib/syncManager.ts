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

export async function getPendingWriteCount(): Promise<number> {
  return getPendingCount()
}

// ── Pull fresh data from Supabase ─────────────────────────────────────────────

let syncFromServerInProgress = false

export async function syncDataFromServer(): Promise<void> {
  if (!getIsOnline() || syncFromServerInProgress) return
  syncFromServerInProgress = true

  const supabase = createClient()

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
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

    // Paginate large tables — PostgREST caps single responses at 1000 rows server-side
    const paginate = async (fetch: (from: number, to: number) => any): Promise<any[]> => {
      const rows: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data } = await fetch(from, from + 999)
        if (!data || data.length === 0) break
        rows.push(...data)
        if (data.length < 1000) break
      }
      return rows
    }

    // Phase 1: Core reference data (small, fast) + paginated formulary + item_catalog in parallel
    const [[incidents, units, employees, incidentUnits], formularyRows, catalogRows] = await Promise.all([
      Promise.all([
        supabase.from('incidents').select('*, incident_units(id, released_at)'),
        supabase.from('units').select('*, unit_type:unit_types(name), incident_units(id, released_at, incident:incidents(name, status), unit_assignments(id, released_at, employee:employees(id, name, role)))'),
        supabase.from('employees_sync').select('*'),
        supabase.from('incident_units').select('id, incident_id, released_at, unit:units(id, name, unit_type:unit_types(name))'),
      ]),
      paginate((from, to) => supabase.from('formulary_templates').select('*, catalog_item:item_catalog(category, sku, is_als)').order('id').range(from, to)),
      paginate((from, to) => supabase.from('item_catalog').select('*').order('id').range(from, to)),
    ])
    const formulary = { data: formularyRows }

    console.log('[Sync] Phase 1:', { incidents: incidents.data?.length, units: units.data?.length, employees: employees.data?.length, formulary: formulary.data?.length, catalog: catalogRows.length, incidentUnits: incidentUnits.data?.length })
    if (incidents.data) await cacheData('incidents', incidents.data)
    if (units.data) await cacheData('units', units.data)
    if (employees.data) await cacheData('employees', employees.data)
    if (formulary.data) await cacheData('formulary', formulary.data)
    if (catalogRows.length) await cacheData('item_catalog', catalogRows)
    if (incidentUnits.data) await cacheData('incident_units', incidentUnits.data)
    console.log('[Sync] Phase 1 done — reference data cached')

    // Phase 2: Patient data (larger, but critical)
    const [encounters, mar, vitals] = await Promise.all([
      supabase.from('patient_encounters').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
      supabase.from('dispense_admin_log').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('encounter_vitals').select('*').order('recorded_at', { ascending: false }).limit(1000),
    ])

    console.log('[Sync] Phase 2:', { encounters: encounters.data?.length, mar: mar.data?.length, vitals: vitals.data?.length })
    if (encounters.data) await cacheData('encounters', encounters.data)
    if (mar.data) await cacheData('mar_entries', mar.data)
    if (vitals.data) await cacheData('vitals', vitals.data)
    console.log('[Sync] Phase 2 done — patient data cached')

    // Phase 3: Operations data — paginate inventory in parallel with supply runs
    const [invRows, supplyRuns, supplyRunItems] = await Promise.all([
      paginate((from, to) => supabase.from('unit_inventory').select('id, item_name, category, quantity, par_qty, lot_number, expiration_date, unit_id, incident_unit_id, barcode, upc, catalog_item_id').order('id').range(from, to)),
      supabase.from('supply_runs').select('*, incident:incidents(name), supply_run_items(*)').order('run_date', { ascending: false }).limit(200),
      supabase.from('supply_run_items').select('*').order('id', { ascending: false }).limit(200),
    ])

    console.log('[Sync] Phase 3:', { inventory: invRows.length, supplyRuns: supplyRuns.data?.length, supplyRunItems: supplyRunItems.data?.length })
    if (invRows.length) await cacheData('inventory', invRows)
    if (supplyRuns.data) await cacheData('supply_runs', supplyRuns.data)
    if (supplyRunItems.data) await cacheData('supply_run_items', supplyRunItems.data)
    console.log('[Sync] Phase 3 done — operations data cached')

    // Phase 4: Progress notes + procedures (for encounter detail views)
    const [progressNotes, procedures] = await Promise.all([
      supabase.from('progress_notes').select('*').is('deleted_at', null).order('note_datetime', { ascending: false }).limit(500),
      supabase.from('encounter_procedures').select('*').order('performed_at', { ascending: false }).limit(500),
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
  } finally {
    syncFromServerInProgress = false
  }
}

// ── Flush pending offline writes to Supabase ──────────────────────────────────

export async function flushPendingWrites(): Promise<void> {
  // Use getIsOnline() (reads navigator.onLine directly) instead of the module-level
  // isOnline flag, which can be stale if the browser 'online' event was missed.
  if (!getIsOnline() || syncInProgress) return
  syncInProgress = true

  // Idempotent tables: a 23505 unique-violation means the row already exists — treat as success
  const idempotentTables = ['dispense_admin_log', 'patient_encounters', 'supply_runs', 'supply_run_items', 'encounter_procedures', 'mar_entries']
  // Permanent errors: remove from queue immediately so they don't block future syncs
  const permanentErrorCodes = [
    '42703', // column does not exist
    '42P01', // table does not exist
    '23502', // NOT NULL violation (payload missing a required column)
    // 23503 (FK violation) removed — child rows may sync before parent; retry instead of dropping
    '22P02', // invalid input syntax
    '42501', // insufficient privilege (RLS blocked the write)
  ]

  try {
    const supabase = createClient()
    const pending = await getPendingWrites()

    if (pending.length === 0) return

    console.log('[Sync] Flushing', pending.length, 'pending writes...')

    // Process in chronological order (ensures supply_runs before supply_run_items)
    // Fall back to auto-increment id for entries with identical timestamps
    pending.sort((a, b) => {
      const cmp = a.timestamp.localeCompare(b.timestamp)
      if (cmp !== 0) return cmp
      return (a.id as number) - (b.id as number)
    })

    for (const item of pending) {
      try {
        console.log('[Sync] Processing pending write:', {
          id: item.id,
          table: item.table,
          operation: item.operation,
          timestamp: item.timestamp,
          data: item.data,
        })

        if (item.operation === 'insert') {
          const { error } = await supabase.from(item.table).insert(item.data)
          if (error) {
            if (error.code === '23505' && idempotentTables.includes(item.table)) {
              console.warn(`[Sync] Duplicate ${item.table} — already exists, marking synced:`, item.id)
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

        console.log(`[Sync] ✓ Synced ${item.table} ${item.operation} queue-id=${item.id}`)
        await markSynced(item.id)
      } catch (err: any) {
        const errCode: string = err?.code || ''
        const msg: string = err?.message || String(err)
        console.error('[Sync] Pending write failed:', {
          queueId: item.id,
          table: item.table,
          operation: item.operation,
          timestamp: item.timestamp,
          message: msg,
          code: errCode,
          details: err?.details,
          hint: err?.hint,
          payload: item.data,
        })
        const isPermanent = permanentErrorCodes.some(code => msg.includes(code) || errCode === code)
        if (isPermanent) {
          console.warn('[Sync] Permanent error — removing from queue:', item.id, errCode, msg)
          await markSynced(item.id)
        } else {
          console.warn('[Sync] Transient error — will retry next flush:', item.id)
        }
      }
    }
  } finally {
    syncInProgress = false
    await updateSyncMeta('global', new Date().toISOString())
    await notifyListeners()
  }
}
