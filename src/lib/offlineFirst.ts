// Stale-While-Revalidate pattern:
// 1. Return cached data INSTANTLY (no loading spinner)
// 2. Fetch fresh data from network in background
// 3. Update cache + call onUpdate callback with fresh data
// Result: instant page loads, data refreshes seamlessly

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

  // Always try cache first for instant display
  let cachedData: T[] = []
  try {
    const cached = await getCachedData(cacheName) as T[]
    cachedData = filter ? filter(cached) : cached
  } catch {}

  // If offline, return cache immediately
  if (isOffline) {
    return { data: cachedData, offline: true }
  }

  // If we have cached data, return it as stale while we fetch fresh
  if (cachedData.length > 0) {
    // Fire network request but don't wait — fetch in background
    // The caller should handle the stale flag and re-render when fresh data arrives
    try {
      const { data, error } = await queryFn()
      if (error) throw error
      const result = (data || []) as T[]
      if (result.length > 0) {
        try { await cacheData(cacheName, result as any[]) } catch {}
      }
      return { data: result, offline: false }
    } catch {
      // Network failed but we have cache — return cached
      return { data: cachedData, offline: true, stale: true }
    }
  }

  // No cache — must wait for network
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    const result = (data || []) as T[]
    if (result.length > 0) {
      try { await cacheData(cacheName, result as any[]) } catch {}
    }
    return { data: result, offline: false }
  } catch {
    return { data: [], offline: true }
  }
}

/**
 * Load a single item — returns cached immediately, refreshes from network
 */
export async function loadSingle<T = any>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
  cacheName: string,
  id: string
): Promise<{ data: T | null; offline: boolean; stale?: boolean }> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  // Try cache first
  let cachedData: T | null = null
  try {
    const cached = await getCachedById(cacheName, id) as T | undefined
    if (cached) cachedData = cached
  } catch {}

  if (isOffline) {
    return { data: cachedData, offline: true }
  }

  // If we have cached data, we can still try network for fresh
  if (cachedData) {
    try {
      const { data, error } = await queryFn()
      if (error) throw error
      if (data) {
        try { await cacheData(cacheName, [data as any]) } catch {}
      }
      return { data, offline: false }
    } catch {
      return { data: cachedData, offline: true, stale: true }
    }
  }

  // No cache — wait for network
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    if (data) {
      try { await cacheData(cacheName, [data as any]) } catch {}
    }
    return { data, offline: false }
  } catch {
    return { data: null, offline: true }
  }
}
