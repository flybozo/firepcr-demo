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
    syncHotData()
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
  if (typeof navigator !== 'undefined') return navigator.onLine
  return isOnline
}

export async function getPendingWriteCount(): Promise<number> {
  return getPendingCount()
}

// ── Sync guards ───────────────────────────────────────────────────────────────

let coldSyncDone = false   // Once per session (tab)
let hotSyncInProgress = false
let coldSyncInProgress = false

// Session key — sessionStorage clears on tab close
const COLD_SYNC_KEY = 'firepcr-cold-synced'

function isColdSyncDone(): boolean {
  if (coldSyncDone) return true
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(COLD_SYNC_KEY)) {
    coldSyncDone = true
    return true
  }
  return false
}

function markColdSyncDone() {
  coldSyncDone = true
  try { sessionStorage.setItem(COLD_SYNC_KEY, '1') } catch {}
}

// ── Helper: 48-hour cutoff ISO string ─────────────────────────────────────────

function cutoff48h(): string {
  return new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
}

// ── Helper: paginate large Supabase queries ───────────────────────────────────

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

// ── Cold sync: reference data (once per session) ──────────────────────────────

export async function syncColdData(): Promise<void> {
  if (!getIsOnline() || coldSyncInProgress || isColdSyncDone()) return
  coldSyncInProgress = true

  const supabase = createClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single()
    if (!emp) return

    console.log('[Sync] Cold sync — loading reference data (once per session)...')

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

    console.log('[Sync] Cold:', {
      incidents: incidents.data?.length,
      units: units.data?.length,
      employees: employees.data?.length,
      formulary: formulary.data?.length,
      catalog: catalogRows.length,
      incidentUnits: incidentUnits.data?.length,
    })

    if (incidents.data) await cacheData('incidents', incidents.data)
    if (units.data) await cacheData('units', units.data)
    if (employees.data) await cacheData('employees', employees.data)
    if (formulary.data) await cacheData('formulary', formulary.data)
    if (catalogRows.length) await cacheData('item_catalog', catalogRows)
    if (incidentUnits.data) await cacheData('incident_units', incidentUnits.data)

    markColdSyncDone()
    console.log('[Sync] Cold sync complete — reference data cached')
  } catch (err) {
    console.error('[Sync] Cold sync failed:', err)
  } finally {
    coldSyncInProgress = false
  }
}

// ── Hot sync: operational data (every login + offline→online, 48h window) ─────

export async function syncHotData(): Promise<void> {
  if (!getIsOnline() || hotSyncInProgress) return
  hotSyncInProgress = true

  const supabase = createClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const since = cutoff48h()
    console.log('[Sync] Hot sync — loading operational data (last 48h)...')

    // Patient data — last 48 hours
    const [encounters, mar, vitals, progressNotes, procedures] = await Promise.all([
      supabase.from('patient_encounters').select('*')
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('dispense_admin_log').select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('encounter_vitals').select('*')
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false }),
      supabase.from('progress_notes').select('*')
        .is('deleted_at', null)
        .gte('note_datetime', since)
        .order('note_datetime', { ascending: false }),
      supabase.from('encounter_procedures').select('*')
        .gte('performed_at', since)
        .order('performed_at', { ascending: false }),
    ])

    console.log('[Sync] Hot (patient):', {
      encounters: encounters.data?.length,
      mar: mar.data?.length,
      vitals: vitals.data?.length,
      progressNotes: progressNotes.data?.length,
      procedures: procedures.data?.length,
    })

    if (encounters.data) await cacheData('encounters', encounters.data)
    if (mar.data) await cacheData('mar_entries', mar.data)
    if (vitals.data) await cacheData('vitals', vitals.data)
    if (progressNotes.data) {
      try { await cacheData('progress_notes' as any, progressNotes.data) } catch {}
    }
    if (procedures.data) {
      try { await cacheData('procedures' as any, procedures.data) } catch {}
    }

    // Operations data — supply runs (48h) + current inventory snapshot
    const [supplyRuns, supplyRunItems, invRows] = await Promise.all([
      supabase.from('supply_runs').select('*, incident:incidents(name), supply_run_items(*)')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      supabase.from('supply_run_items').select('*')
        .gte('created_at', since)
        .order('id', { ascending: false }),
      paginate((from, to) => supabase.from('unit_inventory')
        .select('id, item_name, category, quantity, par_qty, lot_number, expiration_date, unit_id, incident_unit_id, barcode, upc, catalog_item_id')
        .order('id').range(from, to)),
    ])

    console.log('[Sync] Hot (ops):', {
      supplyRuns: supplyRuns.data?.length,
      supplyRunItems: supplyRunItems.data?.length,
      inventory: invRows.length,
    })

    if (supplyRuns.data) await cacheData('supply_runs', supplyRuns.data)
    if (supplyRunItems.data) await cacheData('supply_run_items', supplyRunItems.data)
    if (invRows.length) await cacheData('inventory', invRows)

    await updateSyncMeta('global', new Date().toISOString())
    console.log('[Sync] Hot sync complete — operational data cached (48h window)')
  } catch (err) {
    console.error('[Sync] Hot sync failed:', err)
  } finally {
    hotSyncInProgress = false
  }
}

// ── Full sync: cold + hot (called on initial login) ───────────────────────────

export async function syncDataFromServer(): Promise<void> {
  // Cold runs once per session, hot runs every time
  await syncColdData()
  await syncHotData()
}

// ── Flush pending offline writes to Supabase ──────────────────────────────────

export async function flushPendingWrites(): Promise<void> {
  if (!getIsOnline() || syncInProgress) return
  syncInProgress = true

  const idempotentTables = ['dispense_admin_log', 'patient_encounters', 'supply_runs', 'supply_run_items', 'encounter_procedures', 'mar_entries']
  const permanentErrorCodes = [
    '42703', // column does not exist
    '42P01', // table does not exist
    '23502', // NOT NULL violation
    '22P02', // invalid input syntax
    '42501', // insufficient privilege (RLS)
  ]

  try {
    const supabase = createClient()
    const pending = await getPendingWrites()

    if (pending.length === 0) return

    console.log('[Sync] Flushing', pending.length, 'pending writes...')

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
