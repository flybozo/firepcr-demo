// Safe Supabase query wrapper — catches network errors and falls back to IndexedDB
// Use this instead of raw supabase.from() calls to prevent offline crashes

import { getCachedData, getCachedById, cacheData } from './offlineStore'

type QueryResult<T> = {
  data: T[]
  offline: boolean
  error?: string
}

type SingleResult<T> = {
  data: T | null
  offline: boolean
  error?: string
}

/**
 * Safe list query with IndexedDB fallback
 * Usage: const { data, offline } = await safeQuery(() => supabase.from('table').select('*'), 'storeName')
 */
export async function safeQuery<T = any>(
  queryFn: () => Promise<{ data: T[] | null; error: any }>,
  cacheName?: string,
  cacheFilter?: (item: any) => boolean
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    const result = (data || []) as T[]
    // Cache for offline use
    if (cacheName && result.length > 0) {
      try { await cacheData(cacheName, result as any[]) } catch {}
    }
    return { data: result, offline: false }
  } catch (err) {
    // Network error or Supabase error — try IndexedDB
    if (cacheName) {
      try {
        let cached = await getCachedData(cacheName) as T[]
        if (cacheFilter) cached = cached.filter(cacheFilter)
        return { data: cached, offline: true }
      } catch {}
    }
    return { data: [], offline: true, error: String(err) }
  }
}

/**
 * Safe single-item query with IndexedDB fallback
 * Usage: const { data, offline } = await safeSingle(() => supabase.from('table').select('*').eq('id', x).single(), 'storeName', id)
 */
export async function safeSingle<T = any>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheName?: string,
  cacheId?: string
): Promise<SingleResult<T>> {
  try {
    const { data, error } = await queryFn()
    if (error) throw error
    // Cache for offline
    if (cacheName && data) {
      try { await cacheData(cacheName, [data as any]) } catch {}
    }
    return { data, offline: false }
  } catch (err) {
    if (cacheName && cacheId) {
      try {
        const cached = await getCachedById(cacheName, cacheId) as T | undefined
        if (cached) return { data: cached, offline: true }
      } catch {}
    }
    return { data: null, offline: true, error: String(err) }
  }
}

/**
 * Safe multi-query (Promise.all replacement)
 * Catches errors and returns partial results
 */
export async function safeAll<T extends any[]>(
  ...queries: (() => Promise<any>)[]
): Promise<{ results: any[]; offline: boolean }> {
  try {
    const results = await Promise.all(queries.map(q => q()))
    return { results, offline: false }
  } catch {
    // If Promise.all fails, try each individually
    const results = await Promise.allSettled(queries.map(q => q().catch(() => ({ data: null, error: 'offline' }))))
    return {
      results: results.map(r => r.status === 'fulfilled' ? r.value : { data: null, error: 'offline' }),
      offline: true
    }
  }
}
