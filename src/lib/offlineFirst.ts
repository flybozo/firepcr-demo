// Online-first, offline-fallback pattern:
// 1. When ONLINE: fetch live data, update cache, return fresh result
//    - If live fetch fails, fall back to cache with stale flag
// 2. When OFFLINE: return cached data immediately
// Result: always-fresh data when connected, seamless offline fallback

import { getCachedData, getCachedById, cacheData } from './offlineStore'

/**
 * Load a list — returns cached data immediately, refreshes from network
 */
export async function loadList<T = any>(
  queryFn: () => PromiseLike<{ data: T[] | null; error: any }>,
  cacheName: string,
  filter?: (items: T[]) => T[]
): Promise<{ data: T[]; offline: boolean; stale?: boolean }> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  // If offline, return cache immediately
  if (isOffline) {
    let cachedData: T[] = []
    try {
      const cached = await getCachedData(cacheName) as T[]
      cachedData = filter ? filter(cached) : cached
    } catch {}
    return { data: cachedData, offline: true }
  }

  // Online: fetch live data, update cache
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    const result = (data || []) as T[]
    if (result.length > 0) {
      try { await cacheData(cacheName, result as any[]) } catch {}
    }
    return { data: result, offline: false }
  } catch {
    // Live fetch failed — fall back to cache
    let cachedData: T[] = []
    try {
      const cached = await getCachedData(cacheName) as T[]
      cachedData = filter ? filter(cached) : cached
    } catch {}
    const actuallyOffline = typeof navigator !== 'undefined' && !navigator.onLine
    return { data: cachedData, offline: actuallyOffline, stale: true }
  }
}

/**
 * Load a single item — live-first, cache fallback
 */
export async function loadSingle<T = any>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  cacheName: string,
  id: string
): Promise<{ data: T | null; offline: boolean; stale?: boolean }> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  // If offline, return cache immediately
  if (isOffline) {
    let cachedData: T | null = null
    try {
      const cached = await getCachedById(cacheName, id) as T | undefined
      if (cached) cachedData = cached
    } catch {}
    return { data: cachedData, offline: true }
  }

  // Online: fetch live data
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    if (data) {
      try { await cacheData(cacheName, [data as any]) } catch {}
    }
    return { data, offline: false }
  } catch {
    // Live fetch failed — fall back to cache
    let cachedData: T | null = null
    try {
      const cached = await getCachedById(cacheName, id) as T | undefined
      if (cached) cachedData = cached
    } catch {}
    const actuallyOffline = typeof navigator !== 'undefined' && !navigator.onLine
    return { data: cachedData, offline: actuallyOffline, stale: true }
  }
}
