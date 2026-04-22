/**
 * Chat.tsx — Team Chat
 *
 * Two-panel layout (channel list + message thread), built from scratch
 * since chat has unique layout needs (pinned input, custom scroll).
 *
 * Mobile: state-based "screens" — channel list vs. message thread.
 * Desktop: side-by-side panels.
 */

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { useUser } from '@/contexts/UserContext'
import { useChatUnread } from '@/hooks/useChatUnread'
import { ChannelListPanel } from '@/components/chat/ChannelListPanel'
import { MessageThread } from '@/components/chat/MessageThread'
import { NewDMModal } from '@/components/chat/NewDMModal'
import type { ChatChannel } from '@/types/chat'
import OfflineGate from '@/components/OfflineGate'

export default function ChatPage() {
  const { employee, incident, unit } = useUser()
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [showDMModal, setShowDMModal] = useState(false)

  // Mobile: 'list' | 'messages'
  const [mobileView, setMobileView] = useState<'list' | 'messages'>('list')

  const { unreadByChannel, markRead, seedUnread } = useChatUnread(activeChannel?.id)

  // Load channels on mount
  useEffect(() => {
    if (!employee?.id) return

    const fetchChannels = async () => {
      try {
        const resp = await authFetch('/api/chat/ensure-channels', {
          method: 'POST',
          body: JSON.stringify({
            incident_id: incident?.id || null,
            unit_id: unit?.id || null,
          }),
        })
        if (!resp.ok) throw new Error('Failed to load channels')
        const data = await resp.json()
        const chs = (data.channels || []) as ChatChannel[]
        setChannels(chs)

        const unreadMap: Record<string, number> = {}
        for (const ch of chs) {
          if (ch.unread_count > 0) unreadMap[ch.id] = ch.unread_count
        }
        seedUnread(unreadMap)
      } catch (e) {
        console.error('[Chat] fetchChannels', e)
      } finally {
        setChannelsLoading(false)
      }
    }

    fetchChannels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id, incident?.id, unit?.id])

  const handleSelectChannel = (ch: ChatChannel) => {
    setActiveChannel(ch)
    markRead(ch.id)
    setMobileView('messages')
  }

  const handleBack = () => {
    setMobileView('list')
    authFetch('/api/chat/channels')
      .then((r) => r.json())
      .then((data) => setChannels(data.channels || []))
      .catch(() => {})
  }

  const handleDMCreated = (channel: ChatChannel) => {
    setShowDMModal(false)
    setChannels((prev) => {
      if (prev.find((c) => c.id === channel.id)) return prev
      return [channel, ...prev]
    })
    handleSelectChannel(channel)
  }

  const handleDeleteDM = async (channelId: string) => {
    try {
      const resp = await authFetch(`/api/chat/channels?channelId=${channelId}`, { method: 'DELETE' })
      if (resp.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== channelId))
        if (activeChannel?.id === channelId) {
          setActiveChannel(null)
          setMobileView('list')
        }
      }
    } catch (e) {
      console.error('[Chat] delete DM failed', e)
    }
  }

  const handleArchive = async (channelId: string, action: 'archive' | 'unarchive') => {
    try {
      const resp = await authFetch('/api/chat/archive', {
        method: 'POST',
        body: JSON.stringify({ channel_id: channelId, action }),
      })
      if (resp.ok) {
        const json = await resp.json()
        setChannels((prev) =>
          prev.map((c) =>
            c.id === channelId ? { ...c, archived_at: json.archived_at ?? null } : c
          )
        )
      }
    } catch (e) {
      console.error('[Chat] archive failed', e)
    }
  }

  const channelsWithUnread = channels.map((ch) => ({
    ...ch,
    unread_count: unreadByChannel[ch.id] ?? ch.unread_count,
  }))

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <OfflineGate page message="Team Chat requires a connection to send and receive messages.">
      {showDMModal && (
        <NewDMModal
          onClose={() => setShowDMModal(false)}
          onChannelCreated={handleDMCreated}
        />
      )}

      {/* Desktop: two-panel layout */}
      <div className="hidden md:flex h-full bg-gray-950">
        <div className="w-72 shrink-0 border-r border-gray-800 flex flex-col">
          <ChannelListPanel
            channels={channelsWithUnread}
            activeChannelId={activeChannel?.id || null}
            onSelectChannel={handleSelectChannel}
            unreadByChannel={unreadByChannel}
            onNewDM={() => setShowDMModal(true)}
            onDeleteDM={handleDeleteDM}
            onArchive={handleArchive}
            loading={channelsLoading}
          />
        </div>

        <div className="flex-1 min-w-0">
          {activeChannel ? (
            <MessageThread
              key={activeChannel.id}
              channel={activeChannel}
              employeeId={employee.id}
              onBack={() => setActiveChannel(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-5xl mb-4">💬</span>
              <p className="text-base font-medium text-gray-400">Select a channel to start chatting</p>
              <p className="text-sm mt-1 text-gray-600">or start a new direct message</p>
              <button
                onClick={() => setShowDMModal(true)}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ✏️ New DM
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: state-based screens */}
      <div className="md:hidden flex flex-col h-full bg-gray-950">
        {mobileView === 'list' ? (
          <ChannelListPanel
            channels={channelsWithUnread}
            activeChannelId={activeChannel?.id || null}
            onSelectChannel={handleSelectChannel}
            unreadByChannel={unreadByChannel}
            onNewDM={() => setShowDMModal(true)}
            onDeleteDM={handleDeleteDM}
            onArchive={handleArchive}
            loading={channelsLoading}
          />
        ) : activeChannel ? (
          <MessageThread
            key={activeChannel.id}
            channel={activeChannel}
            employeeId={employee.id}
            onBack={handleBack}
          />
        ) : null}
      </div>
    </OfflineGate>
  )
}
