/**
 * useLoadList — stale-while-revalidate hook for list pages.
 *
 * Phase 1: Renders immediately with cached IndexedDB data (no spinner).
 * Phase 2: Fetches from Supabase in background, updates when done.
 *
 * Usage:
 *   const { data, loading, stale } = useLoadList('cs_inventory', () =>
 *     supabase.from('cs_inventory').select('*').order('drug_name')
 *   )
 *
 * `loading` is only true when there is NO cached data yet (first ever load).
 * `stale` is true while fresh data is being fetched (cached data is showing).
 */

import { useEffect, useRef, useState } from 'react'
import { getCachedData, cacheData } from './offlineStore'

type QueryFn<T> = () => PromiseLike<{ data: T[] | null; error: any }>

export function useLoadList<T = any>(
  cacheName: string,
  queryFn: QueryFn<T>,
  filter?: (items: T[]) => T[],
  deps: any[] = []
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)   // true only when no cache exists
  const [stale, setStale] = useState(false)       // true while fetching fresh over cache
  const [offline, setOffline] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    const run = async () => {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

      // ── Phase 1: serve cache instantly ──
      try {
        const cached = (await getCachedData(cacheName)) as T[]
        const filtered = filter ? filter(cached) : cached
        if (filtered.length > 0 && !cancelled) {
          setData(filtered)
          setLoading(false)   // stop spinner — we have something to show
          setStale(!isOffline) // mark as stale if we'll fetch fresh
        }
      } catch {}

      if (isOffline) {
        if (!cancelled) { setLoading(false); setOffline(true) }
        return
      }

      // ── Phase 2: fetch fresh from network ──
      try {
        const { data: fresh, error } = await queryFn()
        if (error) throw error
        const result = (fresh ?? []) as T[]
        if (result.length > 0) {
          try { await cacheData(cacheName, result as any[]) } catch {}
        }
        if (!cancelled) {
          const filtered = filter ? filter(result) : result
          setData(filtered)
          setLoading(false)
          setStale(false)
          setOffline(false)
        }
      } catch {
        // Network failed — keep whatever we have
        if (!cancelled) { setLoading(false); setStale(false); setOffline(true) }
      }
    }

    run()
    return () => { cancelled = true; mountedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheName, ...deps])

  return { data, loading, stale, offline }
}
