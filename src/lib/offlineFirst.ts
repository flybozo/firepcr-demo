// Offline-first data loading — shows cached data INSTANTLY, refreshes from network in background

import { getCachedData, getCachedById, cacheData } from './offlineStore'

/**
 * Load a list — cache-first for speed, network refresh in background
 */
export async function loadList<T = any>(
  queryFn: () => PromiseLike<{ data: T[] | null; error: any }>,
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

  // Online — try cache first for instant display, then fetch fresh
  let cachedData: T[] | null = null
  try {
    const cached = await getCachedData(cacheName) as T[]
    if (cached.length > 0) {
      cachedData = filter ? filter(cached) : cached
    }
  } catch {}

  // Fetch fresh from network
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    const result = (data || []) as T[]
    if (result.length > 0) {
      try { await cacheData(cacheName, result as any[]) } catch {}
    }
    return { data: result, offline: false }
  } catch {
    // Network failed — return cached data if we have it
    if (cachedData && cachedData.length > 0) {
      return { data: cachedData, offline: true }
    }
    return { data: [], offline: true }
  }
}

/**
 * Load a single item — cache-first, network refresh
 */
export async function loadSingle<T = any>(
  queryFn: () => PromiseLike<{ data: T | null; error: any }>,
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

  // Try cache first
  let cachedData: T | null = null
  try {
    const cached = await getCachedById(cacheName, id) as T | undefined
    if (cached) cachedData = cached
  } catch {}

  // Fetch fresh
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    if (data) {
      try { await cacheData(cacheName, [data as any]) } catch {}
    }
    return { data, offline: false }
  } catch {
    if (cachedData) return { data: cachedData, offline: true }
    return { data: null, offline: true }
  }
}
