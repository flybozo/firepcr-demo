'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getIsOnline, onConnectionChange } from './syncManager'
import { queueOfflineWrite, getPendingCount } from './offlineStore'

interface UseOfflineWriteResult {
  write: (
    table: string,
    operation: 'insert' | 'update' | 'delete',
    data: any
  ) => Promise<{ success: boolean; offline: boolean; error?: string }>
  pending: number
  isOffline: boolean
}

/**
 * Offline-aware write hook.
 *
 * Usage:
 *   const { write, pending, isOffline } = useOfflineWrite()
 *   await write('patient_encounters', 'insert', { ... })
 *
 * - When online: writes directly to Supabase
 * - When offline: queues to IndexedDB pending_sync, syncs when reconnected
 */
export function useOfflineWrite(): UseOfflineWriteResult {
  const [pending, setPending] = useState(0)
  const [isOffline, setIsOffline] = useState(!getIsOnline())

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount()
    setPending(count)
  }, [])

  useEffect(() => {
    refreshPending()
    const unsubscribe = onConnectionChange((online, count) => {
      setIsOffline(!online)
      setPending(count)
    })
    return unsubscribe
  }, [refreshPending])

  const write = useCallback(
    async (
      table: string,
      operation: 'insert' | 'update' | 'delete',
      data: any
    ): Promise<{ success: boolean; offline: boolean; error?: string }> => {
      const online = getIsOnline()

      if (online) {
        try {
          const supabase = createClient()
          let error: any

          if (operation === 'insert') {
            ;({ error } = await supabase.from(table).insert(data))
          } else if (operation === 'update') {
            const { id, ...rest } = data
            ;({ error } = await supabase.from(table).update(rest).eq('id', id))
          } else if (operation === 'delete') {
            ;({ error } = await supabase.from(table).delete().eq('id', data.id))
          }

          if (error) {
            // Online write failed — queue offline
            await queueOfflineWrite(table, operation, data)
            await refreshPending()
            return { success: true, offline: true, error: error.message }
          }

          return { success: true, offline: false }
        } catch (err: any) {
          // Network error — queue offline
          await queueOfflineWrite(table, operation, data)
          await refreshPending()
          return { success: true, offline: true, error: err?.message || 'Network error' }
        }
      } else {
        // Definitely offline — queue
        await queueOfflineWrite(table, operation, data)
        await refreshPending()
        return { success: true, offline: true }
      }
    },
    [refreshPending]
  )

  return { write, pending, isOffline }
}
