// Offline-first data loading helper
// Checks navigator.onLine first — if offline, goes straight to IndexedDB
// If online, fetches from Supabase and caches the result

import { getCachedData, getCachedById, cacheData } from './offlineStore'

/**
 * Load a list from Supabase with IndexedDB fallback
 * @param queryFn Function that returns supabase query result
 * @param cacheName IndexedDB store name
 * @returns { data, offline }
 */
export async function loadList<T = any>(
  queryFn: () => Promise<{ data: T[] | null; error: any }>,
  cacheName: string,
  filter?: (items: T[]) => T[]
): Promise<{ data: T[]; offline: boolean }> {
  // If offline, go straight to cache
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      let cached = await getCachedData(cacheName) as T[]
      if (filter) cached = filter(cached)
      return { data: cached, offline: true }
    } catch {
      return { data: [], offline: true }
    }
  }

  // Online — try Supabase
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    const result = (data || []) as T[]
    if (result.length > 0) {
      try { await cacheData(cacheName, result as any[]) } catch {}
    }
    return { data: result, offline: false }
  } catch {
    // Supabase failed even though we thought we were online — try cache
    try {
      let cached = await getCachedData(cacheName) as T[]
      if (filter) cached = filter(cached)
      return { data: cached, offline: true }
    } catch {
      return { data: [], offline: true }
    }
  }
}

/**
 * Load a single item from Supabase with IndexedDB fallback
 */
export async function loadSingle<T = any>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheName: string,
  id: string
): Promise<{ data: T | null; offline: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const cached = await getCachedById(cacheName, id) as T | undefined
      return { data: cached || null, offline: true }
    } catch {
      return { data: null, offline: true }
    }
  }

  try {
    const { data, error } = await queryFn()
    if (error) throw error
    if (data) {
      try { await cacheData(cacheName, [data as any]) } catch {}
    }
    return { data, offline: false }
  } catch {
    try {
      const cached = await getCachedById(cacheName, id) as T | undefined
      return { data: cached || null, offline: true }
    } catch {
      return { data: null, offline: true }
    }
  }
}
