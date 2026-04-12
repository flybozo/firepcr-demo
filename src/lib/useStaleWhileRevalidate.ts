// Hook: shows cached data instantly, refreshes from Supabase in background
// Usage: const { data, loading, offline } = useSWR('encounters', () => supabase.from(...).select(...))

import { useState, useEffect, useRef } from 'react'
import { getCachedData, getCachedById, cacheData } from './offlineStore'

/**
 * Stale-While-Revalidate for lists
 * Shows cached data IMMEDIATELY (no loading state), then refreshes from network
 */
export function useSWRList<T = any>(
  cacheName: string,
  queryFn: () => PromiseLike<{ data: T[] | null; error: any }> | null,
  options?: {
    filter?: (items: T[]) => T[]
    deps?: any[]
    enabled?: boolean
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const hasLoadedCache = useRef(false)

  const deps = options?.deps || []
  const enabled = options?.enabled !== false

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const load = async () => {
      // Step 1: Show cached data instantly (no loading spinner after first load)
      if (!hasLoadedCache.current) {
        try {
          let cached = await getCachedData(cacheName) as T[]
          if (options?.filter) cached = options.filter(cached)
          if (cached.length > 0 && !cancelled) {
            setData(cached)
            setLoading(false) // Stop loading as soon as cache loads
            hasLoadedCache.current = true
          }
        } catch {}
      }

      // Step 2: If offline, we're done
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOffline(true)
        setLoading(false)
        return
      }

      // Step 3: Fetch fresh from network (background refresh)
      const qFn = queryFn()
      if (!qFn) { setLoading(false); return }

      try {
        const { data: freshData, error } = await qFn
        if (error) throw error
        if (cancelled) return
        const result = (freshData || []) as T[]
        setData(result)
        setOffline(false)
        if (result.length > 0) {
          try { await cacheData(cacheName, result as any[]) } catch {}
        }
      } catch {
        if (!cancelled) setOffline(true)
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [enabled, ...deps])

  return { data, loading, offline, setData }
}

/**
 * Stale-While-Revalidate for single items
 */
export function useSWRSingle<T = any>(
  cacheName: string,
  id: string | undefined,
  queryFn: () => PromiseLike<{ data: T | null; error: any }> | null,
  options?: { deps?: any[]; enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  const deps = options?.deps || []
  const enabled = options?.enabled !== false && !!id

  useEffect(() => {
    if (!enabled || !id) return

    let cancelled = false

    const load = async () => {
      // Step 1: Show cached data instantly
      try {
        const cached = await getCachedById(cacheName, id) as T | undefined
        if (cached && !cancelled) {
          setData(cached)
          setLoading(false)
        }
      } catch {}

      // Step 2: Offline check
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOffline(true)
        setLoading(false)
        return
      }

      // Step 3: Fetch fresh
      const qFn = queryFn()
      if (!qFn) { setLoading(false); return }

      try {
        const { data: fresh, error } = await qFn
        if (error) throw error
        if (cancelled) return
        if (fresh) {
          setData(fresh)
          try { await cacheData(cacheName, [fresh as any]) } catch {}
        }
        setOffline(false)
      } catch {
        if (!cancelled) setOffline(true)
      }
      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [enabled, id, ...deps])

  return { data, loading, offline, setData }
}
