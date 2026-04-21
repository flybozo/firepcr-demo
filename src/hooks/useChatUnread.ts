import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

export type UnreadMap = Record<string, number>

export interface UseChatUnreadResult {
  /** Total unread count across all channels */
  totalUnread: number
  /** Per-channel unread counts */
  unreadByChannel: UnreadMap
  /** Update local unread state (call after marking a channel as read) */
  markRead: (channelId: string) => void
  /** Seed initial unread counts from channel list data */
  seedUnread: (counts: UnreadMap) => void
}

// ── Shared global store so all hook instances stay in sync ──────────────────
let globalUnread: UnreadMap = {}
let listeners = new Set<() => void>()
let seeded = false
let realtimeSetup = false

function getSnapshot(): UnreadMap {
  return globalUnread
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setGlobalUnread(updater: (prev: UnreadMap) => UnreadMap) {
  const next = updater(globalUnread)
  if (next !== globalUnread) {
    globalUnread = next
    listeners.forEach((l) => l())
  }
}

function globalMarkRead(channelId: string) {
  setGlobalUnread((prev) => {
    if (!prev[channelId]) return prev
    const next = { ...prev }
    delete next[channelId]
    return next
  })
}

function globalSeedUnread(counts: UnreadMap) {
  globalUnread = counts
  listeners.forEach((l) => l())
}

/**
 * useChatUnread
 *
 * Maintains a **shared global** map of channelId → unread count.
 * All hook instances (Sidebar, BottomTabBar, Chat page) read from the same store
 * so marking a channel as read in one place immediately clears the badge everywhere.
 *
 * Uses a single RPC call to seed unread counts on mount.
 * Real-time inserts increment the count for channels you're not currently viewing.
 */
export function useChatUnread(activeChannelId?: string): UseChatUnreadResult {
  const { employee } = useUser()
  const activeChannelRef = useRef<string | undefined>(activeChannelId)
  const unreadByChannel = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Keep ref in sync
  useEffect(() => {
    activeChannelRef.current = activeChannelId
  }, [activeChannelId])

  // Auto-seed initial unread counts (runs once globally)
  useEffect(() => {
    if (!employee?.id || seeded) return
    seeded = true

    const supabase = createClient()
    ;(async () => {
      try {
        // Try RPC first (single query, efficient)
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_unread_counts', {
          p_employee_id: employee.id,
        })

        if (!rpcErr && rpcData) {
          const counts: UnreadMap = {}
          for (const row of rpcData as { channel_id: string; unread: number }[]) {
            if (row.unread > 0) counts[row.channel_id] = row.unread
          }
          if (Object.keys(counts).length > 0) {
            setGlobalUnread(() => counts)
          }
          return
        }

        // Fallback: per-channel queries
        const { data: memberships } = await supabase
          .from('chat_members')
          .select('channel_id, last_read_at')
          .eq('employee_id', employee.id)

        if (!memberships?.length) return

        const counts: UnreadMap = {}
        for (let i = 0; i < memberships.length; i += 5) {
          const batch = memberships.slice(i, i + 5)
          const results = await Promise.all(
            batch.map(async (m) => {
              let query = supabase
                .from('chat_messages')
                .select('id', { count: 'exact', head: true })
                .eq('channel_id', m.channel_id)
                .is('deleted_at', null)
                .or(`sender_id.neq.${employee.id},sender_id.is.null`)

              if (m.last_read_at) {
                query = query.gt('created_at', m.last_read_at)
              }

              const { count } = await query
              return { channel_id: m.channel_id, count: count || 0 }
            })
          )
          for (const r of results) {
            if (r.count > 0) counts[r.channel_id] = r.count
          }
        }

        if (Object.keys(counts).length > 0) {
          setGlobalUnread(() => counts)
        }
      } catch (err) {
        console.warn('[useChatUnread] Auto-seed failed (non-fatal):', err)
      }
    })()
  }, [employee?.id])

  // Subscribe to new messages via Realtime (runs once globally)
  useEffect(() => {
    if (!employee?.id || realtimeSetup) return
    realtimeSetup = true

    const supabase = createClient()
    const channelName = `chat-unread-global-${Date.now()}`

    try {
      supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
          },
          (payload) => {
            const msg = payload.new as {
              channel_id: string
              sender_id: string | null
              created_at: string
            }

            // Don't count own messages
            if (msg.sender_id === employee.id) return

            // Don't count messages in any hook's active channel
            // (we can't easily know this from the global store, but
            // markRead is called when selecting a channel, which clears it)

            setGlobalUnread((prev) => ({
              ...prev,
              [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
            }))
          }
        )
        .subscribe()
    } catch (err) {
      console.warn('[useChatUnread] Realtime subscribe failed (non-fatal):', err)
    }

    // Don't cleanup — this is a global subscription that lives for the app lifetime
  }, [employee?.id])

  // When activeChannelId changes (user selects a channel), mark it read
  useEffect(() => {
    if (activeChannelId) {
      globalMarkRead(activeChannelId)
    }
  }, [activeChannelId])

  const totalUnread = Object.values(unreadByChannel).reduce((sum, n) => sum + n, 0)

  const markRead = useCallback((channelId: string) => {
    globalMarkRead(channelId)
  }, [])

  const seedUnread = useCallback((counts: UnreadMap) => {
    globalSeedUnread(counts)
  }, [])

  return { totalUnread, unreadByChannel, markRead, seedUnread }
}
