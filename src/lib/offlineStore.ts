import { openDB, type DBSchema } from 'idb'

interface FirePCRDB extends DBSchema {
  encounters: { key: string; value: any; indexes: { 'by-incident': string } }
  mar_entries: { key: string; value: any; indexes: { 'by-incident': string } }
  incidents: { key: string; value: any }
  units: { key: string; value: any }
  employees: { key: string; value: any }
  formulary: { key: string; value: any }
  inventory: { key: string; value: any }
  supply_runs: { key: string; value: any }
  incident_units: { key: string; value: any }
  ics214s: { key: string; value: any }
  ics214_activities: { key: string; value: any }
  ics214_personnel: { key: string; value: any }
  vitals: { key: string; value: any; indexes: { 'by-encounter': string } }
  progress_notes: { key: string; value: any; indexes: { 'by-encounter': string } }
  procedures: { key: string; value: any; indexes: { 'by-encounter': string } }
  pending_sync: {
    key: number
    value: {
      id: number
      table: string
      operation: 'insert' | 'update' | 'delete'
      data: any
      timestamp: string
      synced: boolean
      error?: string
    }
  }
  sync_meta: { key: string; value: { key: string; lastSynced: string; pendingCount: number } }
}

let dbPromise: ReturnType<typeof openDB<FirePCRDB>> | null = null

function getDB() {
  if (typeof window === 'undefined') return null as any
  if (!dbPromise) {
    dbPromise = openDB<FirePCRDB>('firepcr-offline', 6, {
      upgrade(db, oldVersion) {
        // Version 1 stores (always create if missing)
        if (!db.objectStoreNames.contains('encounters')) {
          const encStore = db.createObjectStore('encounters', { keyPath: 'id' })
          encStore.createIndex('by-incident', 'incident_id')
        }
        if (!db.objectStoreNames.contains('mar_entries')) {
          const marStore = db.createObjectStore('mar_entries', { keyPath: 'id' })
          marStore.createIndex('by-incident', 'incident_id')
        }
        if (!db.objectStoreNames.contains('incidents')) db.createObjectStore('incidents', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('units')) db.createObjectStore('units', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('employees')) db.createObjectStore('employees', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('formulary')) db.createObjectStore('formulary', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('pending_sync')) db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true })
        if (!db.objectStoreNames.contains('sync_meta')) db.createObjectStore('sync_meta', { keyPath: 'key' })

        // Version 2 stores (new)
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('supply_runs')) {
          db.createObjectStore('supply_runs', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('incident_units')) {
          db.createObjectStore('incident_units', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('ics214s')) {
          db.createObjectStore('ics214s', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('ics214_activities')) {
          db.createObjectStore('ics214_activities', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('ics214_personnel')) {
          db.createObjectStore('ics214_personnel', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('vitals')) {
          const vitalsStore = db.createObjectStore('vitals', { keyPath: 'id' })
          vitalsStore.createIndex('by-encounter', 'encounter_id')
        }

        // Version 3 stores
        if (!db.objectStoreNames.contains('progress_notes')) {
          const pnStore = db.createObjectStore('progress_notes', { keyPath: 'id' })
          pnStore.createIndex('by-encounter', 'encounter_id')
        }
        if (!db.objectStoreNames.contains('procedures')) {
          const procStore = db.createObjectStore('procedures', { keyPath: 'id' })
          procStore.createIndex('by-encounter', 'encounter_id')
        }
      },
    })
  }
  return dbPromise
}

// ── Cache functions ───────────────────────────────────────────────────────────

export async function cacheData(storeName: string, data: any[]): Promise<void> {
  const db = await getDB()
  if (!db) return
  const tx = db.transaction(storeName as any, 'readwrite')
  for (const item of data) {
    await tx.store.put(item)
  }
  await tx.done
}

export async function getCachedData(storeName: string): Promise<any[]> {
  const db = await getDB()
  if (!db) return []
  return db.getAll(storeName as any)
}

export async function getCachedById(storeName: string, id: string): Promise<any> {
  const db = await getDB()
  if (!db) return null
  return db.get(storeName as any, id)
}

// ── Pending sync queue ────────────────────────────────────────────────────────

export async function queueOfflineWrite(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: any
): Promise<void> {
  const db = await getDB()
  if (!db) return
  await db.add('pending_sync', {
    table,
    operation,
    data,
    timestamp: new Date().toISOString(),
    synced: false,
  } as any)
}

export async function getPendingWrites(): Promise<any[]> {
  const db = await getDB()
  if (!db) return []
  const all = await db.getAll('pending_sync')
  return all.filter((item: any) => !item.synced)
}

export async function markSynced(id: number): Promise<void> {
  const db = await getDB()
  if (!db) return
  // Delete the synced entry instead of just marking it
  try { await db.delete('pending_sync', id) } catch {}
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingWrites()
  return pending.length
}

// ── Sync metadata ─────────────────────────────────────────────────────────────

export async function updateSyncMeta(key: string, lastSynced: string): Promise<void> {
  const db = await getDB()
  if (!db) return
  const pending = await getPendingCount()
  await db.put('sync_meta', { key, lastSynced, pendingCount: pending })
}

export async function getSyncMeta(): Promise<{ lastSynced: string; pendingCount: number } | null> {
  const db = await getDB()
  if (!db) return null
  return (await db.get('sync_meta', 'global')) ?? null
}
