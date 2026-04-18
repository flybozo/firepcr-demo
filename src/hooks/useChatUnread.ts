import { useEffect, useState, useRef, useId } from 'react'
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

/**
 * useChatUnread
 *
 * Subscribes to Supabase Realtime for new chat_messages, maintains an in-memory
 * map of channelId → unread count, and returns the total badge count.
 *
 * Unread counts are seeded from the channels API response on mount.
 * Real-time inserts increment the count for channels you're not currently viewing.
 */
export function useChatUnread(activeChannelId?: string): UseChatUnreadResult {
  const { employee } = useUser()
  const [unreadByChannel, setUnreadByChannel] = useState<UnreadMap>({})
  const activeChannelRef = useRef<string | undefined>(activeChannelId)

  // Keep ref in sync so the realtime callback can read it without stale closures
  useEffect(() => {
    activeChannelRef.current = activeChannelId
  }, [activeChannelId])

  // Unique channel name per hook instance to avoid Supabase "already subscribed" errors
  const instanceId = useRef(`chat-unread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)

  // Subscribe to new messages via Realtime
  useEffect(() => {
    if (!employee?.id) return

    const supabase = createClient()
    const channelName = instanceId.current
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

    try {
      realtimeChannel = supabase
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
              sender_id: string
              created_at: string
            }

            // Don't count own messages
            if (msg.sender_id === employee.id) return

            // Don't count messages in the currently active channel
            // (those are auto-marked as read by the Chat component)
            if (msg.channel_id === activeChannelRef.current) return

            setUnreadByChannel((prev) => ({
              ...prev,
              [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
            }))
          }
        )
        .subscribe()
    } catch (err) {
      console.warn('[useChatUnread] Realtime subscribe failed (non-fatal):', err)
    }

    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel)
      }
    }
  }, [employee?.id])

  const totalUnread = Object.values(unreadByChannel).reduce((sum, n) => sum + n, 0)

  const markRead = (channelId: string) => {
    setUnreadByChannel((prev) => {
      if (!prev[channelId]) return prev
      const next = { ...prev }
      delete next[channelId]
      return next
    })
  }

  const seedUnread = (counts: UnreadMap) => {
    setUnreadByChannel(counts)
  }

  return { totalUnread, unreadByChannel, markRead, seedUnread }
}
