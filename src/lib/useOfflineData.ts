'use client'

import { useState, useEffect, useCallback } from 'react'
import { getIsOnline, onConnectionChange } from './syncManager'
import { getCachedData, cacheData, getSyncMeta } from './offlineStore'

interface UseOfflineDataResult<T> {
  data: T[]
  loading: boolean
  isOffline: boolean
  lastSynced: string | null
  refetch: () => void
}

/**
 * Offline-aware data hook.
 *
 * Usage:
 *   const { data, loading, isOffline } = useOfflineData(
 *     'encounters',
 *     () => supabase.from('patient_encounters').select('*').order('created_at', { ascending: false }),
 *   )
 *
 * - When online: fetches from Supabase, caches result to IndexedDB
 * - When offline: returns cached data from IndexedDB
 */
export function useOfflineData<T = any>(
  storeName: string,
  queryFn: () => PromiseLike<{ data: T[] | null; error: any }>,
  enabled = true
): UseOfflineDataResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!getIsOnline())
  const [lastSynced, setLastSynced] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)

    const online = getIsOnline()
    setIsOffline(!online)

    if (online) {
      try {
        const { data: fetched, error } = await queryFn()
        if (!error && fetched && fetched.length > 0) {
          setData(fetched)
          await cacheData(storeName, fetched as any[])
          setLastSynced(new Date().toISOString())
          setLoading(false)
          return
        }
      } catch {
        // Fall through to cache
      }
    }

    // Offline or query failed — use cache
    try {
      const cached = await getCachedData(storeName)
      setData(cached as T[])
      const meta = await getSyncMeta()
      if (meta) setLastSynced(meta.lastSynced)
    } catch {
      setData([])
    }
    setLoading(false)
  }, [storeName, queryFn, enabled])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Re-fetch when connection is restored
  useEffect(() => {
    const unsubscribe = onConnectionChange((online) => {
      setIsOffline(!online)
      if (online) load()
    })
    return unsubscribe
  }, [load])

  return { data, loading, isOffline, lastSynced, refetch: load }
}
