/**
 * Chat.tsx — FirePCR Team Chat
 *
 * Two-panel layout (channel list + message thread), built from scratch
 * since chat has unique layout needs (pinned input, custom scroll).
 *
 * Mobile: state-based "screens" — channel list vs. message thread.
 * Desktop: side-by-side panels.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch } from '@/lib/authFetch'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'
import { useChatUnread } from '@/hooks/useChatUnread'

// ─── Types ───────────────────────────────────────────────────────────────────

type Sender = { id: string; name: string; headshot_url?: string | null }

type ReplyMessage = {
  id: string
  content: string
  sender: Sender
}

type ChatMessage = {
  id: string
  channel_id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  file_url?: string | null
  file_name?: string | null
  reply_to?: string | null
  reply_message?: ReplyMessage | null
  edited_at?: string | null
  deleted_at?: string | null
  created_at: string
  sender: Sender
}

type LastMessage = {
  id: string
  content: string
  message_type: string
  created_at: string
  sender?: { name: string }
}

type ChatChannel = {
  id: string
  type: 'company' | 'incident' | 'unit' | 'direct'
  name: string
  description?: string | null
  incident_id?: string | null
  unit_id?: string | null
  created_at: string
  updated_at: string
  last_message?: LastMessage | null
  unread_count: number
  my_role: string
  last_read_at?: string | null
}

type Employee = { id: string; name: string; headshot_url?: string | null; role?: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Supabase FK joins can return {name:...} or [{name:...}]. Normalize both. */
function normalizeSender(sender: unknown): Sender {
  if (!sender) return { id: 'unknown', name: 'Unknown' }
  if (Array.isArray(sender)) return normalizeSender(sender[0])
  const s = sender as Record<string, unknown>
  return { id: (s.id as string) || 'unknown', name: (s.name as string) || 'Unknown', headshot_url: (s.headshot_url as string | null) ?? null }
}

function normalizeReply(reply: unknown): ReplyMessage | null {
  if (!reply) return null
  if (Array.isArray(reply)) return normalizeReply(reply[0])
  const r = reply as Record<string, unknown>
  return { id: (r.id as string) || '', content: (r.content as string) || '', sender: normalizeSender(r.sender) }
}

function normalizeMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    ...raw as unknown as ChatMessage,
    sender: normalizeSender(raw.sender),
    reply_message: normalizeReply(raw.reply_message),
  }
}

function relativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  if (days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' })
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function channelIcon(type: ChatChannel['type']): string {
  switch (type) {
    case 'company': return '🏢'
    case 'incident': return '🔥'
    case 'unit': return '🚑'
    case 'direct': return '👤'
  }
}

function Avatar({ person, size = 32 }: { person: { name: string; headshot_url?: string | null }; size?: number }) {
  const [imgErr, setImgErr] = useState(false)
  const initial = person.name?.charAt(0).toUpperCase() || '?'

  if (person.headshot_url && !imgErr) {
    return (
      <img
        src={person.headshot_url}
        alt={person.name}
        width={size}
        height={size}
        onError={() => setImgErr(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-white font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  )
}

// ─── Channel List Item ────────────────────────────────────────────────────────

function ChannelItem({
  channel,
  isActive,
  onClick,
  unreadCount,
}: {
  channel: ChatChannel
  isActive: boolean
  onClick: () => void
  unreadCount: number
}) {
  const lastMsg = channel.last_message
  const preview = lastMsg
    ? lastMsg.message_type === 'image'
      ? '📷 Photo'
      : lastMsg.message_type === 'file'
        ? '📎 File'
        : lastMsg.content.slice(0, 60)
    : 'No messages yet'

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-800/50 ${
        isActive ? 'bg-gray-800' : 'hover:bg-gray-900'
      }`}
    >
      <span className="text-xl mt-0.5 shrink-0">{channelIcon(channel.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium truncate ${unreadCount > 0 ? 'text-white' : 'text-gray-300'}`}>
            {channel.name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {lastMsg && (
              <span className="text-[11px] text-gray-500">{relativeTime(lastMsg.created_at)}</span>
            )}
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
        <p className={`text-xs truncate mt-0.5 ${unreadCount > 0 ? 'text-gray-300' : 'text-gray-500'}`}>
          {lastMsg?.sender?.name ? `${lastMsg.sender.name}: ` : ''}{preview}
        </p>
      </div>
    </button>
  )
}

// ─── Channel List Panel ───────────────────────────────────────────────────────

function ChannelListPanel({
  channels,
  activeChannelId,
  onSelectChannel,
  unreadByChannel,
  onNewDM,
  loading,
}: {
  channels: ChatChannel[]
  activeChannelId: string | null
  onSelectChannel: (ch: ChatChannel) => void
  unreadByChannel: Record<string, number>
  onNewDM: () => void
  loading: boolean
}) {
  const grouped = {
    company: channels.filter((c) => c.type === 'company'),
    incident: channels.filter((c) => c.type === 'incident'),
    unit: channels.filter((c) => c.type === 'unit'),
    direct: channels.filter((c) => c.type === 'direct'),
  }

  const Section = ({
    title,
    items,
  }: {
    title: string
    items: ChatChannel[]
  }) => {
    if (!items.length) return null
    return (
      <div>
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
          {title}
        </p>
        {items.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            isActive={activeChannelId === ch.id}
            onClick={() => onSelectChannel(ch)}
            unreadCount={unreadByChannel[ch.id] || 0}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-base font-bold text-white">Team Chat</h2>
        <button
          onClick={onNewDM}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <span>✏️</span>
          <span>New DM</span>
        </button>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : channels.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            <p className="text-2xl mb-2">💬</p>
            <p>No channels yet</p>
            <p className="text-xs mt-1 text-gray-600">Channels will appear when you join an incident or unit</p>
          </div>
        ) : (
          <>
            <Section title="Company" items={grouped.company} />
            <Section title="Incidents" items={grouped.incident} />
            <Section title="Units" items={grouped.unit} />
            <Section title="Direct Messages" items={grouped.direct} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  showSender,
  onReply,
}: {
  message: ChatMessage
  isOwn: boolean
  showSender: boolean
  onReply: (msg: ChatMessage) => void
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 bg-gray-800/60 rounded-full text-xs text-gray-400 italic">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group`}>
      {/* Avatar — only show for others, and only when sender changes */}
      <div className="w-8 shrink-0">
        {!isOwn && showSender && <Avatar person={message.sender} size={28} />}
      </div>

      <div className={`max-w-[75%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {/* Sender name (for others, first in a sequence) */}
        {!isOwn && showSender && (
          <span className="text-[11px] text-gray-400 px-1 ml-1">{message.sender.name}</span>
        )}

        {/* Reply-to quote */}
        {message.reply_message && (
          <div
            className={`flex gap-1.5 px-2 py-1.5 rounded-lg border-l-2 border-gray-500 bg-gray-800/60 text-xs text-gray-400 max-w-full mb-0.5 ${
              isOwn ? 'self-end' : 'self-start'
            }`}
          >
            <span className="text-gray-500">↩</span>
            <div className="min-w-0">
              <p className="text-gray-300 font-medium truncate">{message.reply_message.sender.name}</p>
              <p className="truncate">{message.reply_message.content}</p>
            </div>
          </div>
        )}

        {/* Message content */}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
              ? 'bg-red-700 text-white rounded-br-sm'
              : 'bg-gray-800 text-gray-100 rounded-bl-sm'
          }`}
        >
          {message.message_type === 'image' && message.file_url ? (
            <>
              <img
                src={message.file_url}
                alt={message.file_name || 'Image'}
                className="max-w-full rounded-lg cursor-pointer max-h-64 object-contain"
                onClick={() => setLightboxOpen(true)}
              />
              {message.content !== message.file_url && (
                <p className="mt-1">{message.content}</p>
              )}
              {/* Lightbox */}
              {lightboxOpen && (
                <div
                  className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                  onClick={() => setLightboxOpen(false)}
                >
                  <img
                    src={message.file_url!}
                    alt={message.file_name || 'Image'}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              )}
            </>
          ) : message.message_type === 'file' && message.file_url ? (
            <a
              href={message.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 underline underline-offset-2"
            >
              <span>📎</span>
              <span className="truncate">{message.file_name || 'Download file'}</span>
            </a>
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>

        {/* Timestamp + reply button */}
        <div
          className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${
            isOwn ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <span className="text-[10px] text-gray-500 px-1">
            {formatMessageTime(message.created_at)}
            {message.edited_at && <span className="ml-1 italic">(edited)</span>}
          </span>
          <button
            onClick={() => onReply(message)}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-1"
          >
            ↩ Reply
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Message Thread ───────────────────────────────────────────────────────────

function MessageThread({
  channel,
  employeeId,
  onBack,
}: {
  channel: ChatChannel
  employeeId: string
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [uploading, setUploading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const channelIdRef = useRef(channel.id)

  // Load messages
  const loadMessages = useCallback(async (before?: string) => {
    try {
      const params = new URLSearchParams({ channelId: channelIdRef.current, limit: '50' })
      if (before) params.set('before', before)
      const resp = await authFetch(`/api/chat/messages?${params}`)
      if (!resp.ok) throw new Error('Failed to load messages')
      const data = await resp.json()
      return ((data.messages || []) as Record<string, unknown>[]).map(normalizeMessage)
    } catch (e) {
      console.error('[Chat] loadMessages', e)
      return []
    }
  }, [])

  // Initial load
  useEffect(() => {
    channelIdRef.current = channel.id
    setMessages([])
    setHasMore(true)
    setLoading(true)
    setReplyTo(null)

    loadMessages().then((msgs) => {
      setMessages(msgs)
      setHasMore(msgs.length === 50)
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
    })

    // Mark channel as read
    authFetch('/api/chat/read', {
      method: 'POST',
      body: JSON.stringify({ channel_id: channel.id }),
    }).catch(() => {})
  }, [channel.id, loadMessages])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, loading])

  // Realtime subscription — unique channel name per mount to avoid Supabase collision
  const realtimeKey = useRef(`chat-msg-${channel.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`)
  useEffect(() => {
    realtimeKey.current = `chat-msg-${channel.id}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
  }, [channel.id])

  useEffect(() => {
    const supabase = createClient()
    let sub: ReturnType<typeof supabase.channel> | null = null

    try {
      sub = supabase
        .channel(realtimeKey.current)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel_id=eq.${channel.id}`,
          },
          async (payload) => {
            const newMsg = payload.new as ChatMessage & { sender_id: string }

            // Fetch full message with sender details
            const resp = await authFetch(`/api/chat/messages?channelId=${channel.id}&limit=1`)
            if (!resp.ok) return
            const data = await resp.json()
            const latest = ((data.messages || []) as Record<string, unknown>[]).map(normalizeMessage)

            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id))
              const newMsgs = latest.filter((m) => !existingIds.has(m.id))
              return [...prev, ...newMsgs]
            })

            // Auto-mark as read if this channel is active
            if (newMsg.sender_id !== employeeId) {
              authFetch('/api/chat/read', {
                method: 'POST',
                body: JSON.stringify({ channel_id: channel.id }),
              }).catch(() => {})
          }
        }
      )
      .subscribe()
    } catch (err) {
      console.warn('[Chat] Realtime subscribe failed (non-fatal):', err)
    }

    return () => {
      if (sub) supabase.removeChannel(sub)
    }
  }, [channel.id, employeeId])

  // Load more (pagination)
  const handleLoadMore = async () => {
    if (loadingMore || !messages.length) return
    setLoadingMore(true)
    const oldest = messages[0]
    const more = await loadMessages(oldest.id)
    setMessages((prev) => [...more, ...prev])
    setHasMore(more.length === 50)
    setLoadingMore(false)
  }

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  // Send message
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const replyId = replyTo?.id
    setReplyTo(null)

    try {
      await authFetch('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: channel.id,
          content: text,
          reply_to: replyId || undefined,
        }),
      })
    } catch (e) {
      console.error('[Chat] send failed', e)
      setInput(text)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // File upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setUploading(true)
    try {
      const isImage = file.type.startsWith('image/')
      const resp = await authFetch(`/api/chat/upload?channelId=${channel.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': file.name,
        },
        body: file,
      })

      if (!resp.ok) throw new Error('Upload failed')
      const { url, file_name } = await resp.json()

      await authFetch('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: channel.id,
          content: url,
          message_type: isImage ? 'image' : 'file',
          file_url: url,
          file_name,
        }),
      })
    } catch (e) {
      console.error('[Chat] upload failed', e)
    } finally {
      setUploading(false)
    }
  }

  // Group messages by date
  const groupedMessages: Array<{ date: string; messages: ChatMessage[] }> = []
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString()
    const last = groupedMessages[groupedMessages.length - 1]
    if (last && last.date === dateKey) {
      last.messages.push(msg)
    } else {
      groupedMessages.push({ date: dateKey, messages: [msg] })
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950">
        <button
          onClick={onBack}
          className="md:hidden text-gray-400 hover:text-white transition-colors p-1 -ml-1"
        >
          ←
        </button>
        <span className="text-lg">{channelIcon(channel.type)}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{channel.name}</h3>
          {channel.description && (
            <p className="text-xs text-gray-500 truncate">{channel.description}</p>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {/* Load more */}
        {hasMore && !loading && (
          <div className="flex justify-center pb-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              {loadingMore ? 'Loading...' : '↑ Load earlier messages'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1 text-gray-600">Be the first to say something!</p>
          </div>
        ) : (
          groupedMessages.map(({ date, messages: dayMsgs }) => (
            <div key={date} className="space-y-1">
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-[11px] text-gray-500 font-medium px-2">
                  {formatDateSeparator(dayMsgs[0].created_at)}
                </span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              {/* Messages in this day */}
              {dayMsgs.map((msg, idx) => {
                const prevMsg = idx > 0 ? dayMsgs[idx - 1] : null
                const showSender = !prevMsg || prevMsg.sender.id !== msg.sender.id
                return (
                  <div key={msg.id} className={showSender && idx > 0 ? 'mt-3' : 'mt-0.5'}>
                    <MessageBubble
                      message={msg}
                      isOwn={msg.sender.id === employeeId}
                      showSender={showSender}
                      onReply={setReplyTo}
                    />
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-t border-gray-800 text-sm">
          <span className="text-gray-500">↩</span>
          <div className="flex-1 min-w-0">
            <p className="text-gray-300 text-xs font-medium">{replyTo.sender.name}</p>
            <p className="text-gray-500 text-xs truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-800 bg-gray-950">
        {/* File attach */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 p-2 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-800 disabled:opacity-50"
          title="Attach file"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-lg">📎</span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 resize-none bg-gray-800 text-white placeholder-gray-500 text-sm rounded-2xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-red-600/50 border border-gray-700 focus:border-red-600/50 transition-colors"
          style={{ minHeight: 40, maxHeight: 120 }}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0 w-10 h-10 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 rotate-90">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── New DM Modal ─────────────────────────────────────────────────────────────

function NewDMModal({
  onClose,
  onChannelCreated,
}: {
  onClose: () => void
  onChannelCreated: (channel: ChatChannel) => void
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    authFetch('/api/chat/members?channelId=_roster')
      .then(() => {})
      .catch(() => {})

    // Fetch employee roster via direct Supabase query (client-side, anon key)
    const supabase = createClient()
    supabase
      .from('employees')
      .select('id, name, headshot_url, role')
      .eq('status', 'Active')
      .order('name')
      .then(({ data }) => {
        setEmployees((data || []) as Employee[])
        setLoading(false)
      })
  }, [])

  const filtered = employees.filter(
    (e) =>
      !selected.find((s) => s.id === e.id) &&
      e.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!selected.length || creating) return
    setCreating(true)
    try {
      const resp = await authFetch('/api/chat/channels', {
        method: 'POST',
        body: JSON.stringify({
          type: 'direct',
          employee_ids: selected.map((e) => e.id),
        }),
      })
      if (!resp.ok) throw new Error('Failed to create DM')
      const data = await resp.json()
      onChannelCreated(data.channel as ChatChannel)
    } catch (e) {
      console.error('[Chat] create DM failed', e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">New Direct Message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg">×</button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full bg-gray-800 text-white placeholder-gray-500 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-red-600/50 border border-gray-700"
            autoFocus
          />
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-2">
            {selected.map((e) => (
              <span
                key={e.id}
                className="flex items-center gap-1 px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full border border-red-600/30"
              >
                {e.name}
                <button
                  onClick={() => setSelected((prev) => prev.filter((s) => s.id !== e.id))}
                  className="hover:text-red-200 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Employee list */}
        <div className="max-h-56 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-4">No employees found</p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected((prev) => [...prev, e])}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <Avatar person={e} size={28} />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{e.name}</p>
                  {e.role && <p className="text-xs text-gray-500 truncate">{e.role}</p>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-800">
          <button
            onClick={handleCreate}
            disabled={!selected.length || creating}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? 'Opening...' : selected.length ? `Message ${selected.map((e) => e.name).join(', ')}` : 'Select someone'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────

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

        // Seed unread counts
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
    // Re-fetch channels to update last message previews
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

  // Merge unread counts into channels for display
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
    <>
      {showDMModal && (
        <NewDMModal
          onClose={() => setShowDMModal(false)}
          onChannelCreated={handleDMCreated}
        />
      )}

      {/* Desktop: two-panel layout */}
      <div className="hidden md:flex h-full bg-gray-950">
        {/* Left: channel list */}
        <div className="w-72 shrink-0 border-r border-gray-800 flex flex-col">
          <ChannelListPanel
            channels={channelsWithUnread}
            activeChannelId={activeChannel?.id || null}
            onSelectChannel={handleSelectChannel}
            unreadByChannel={unreadByChannel}
            onNewDM={() => setShowDMModal(true)}
            loading={channelsLoading}
          />
        </div>

        {/* Right: message thread */}
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
    </>
  )
}
