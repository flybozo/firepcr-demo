import type { Sender, ReplyMessage, ChatMessage, ChatChannel } from '@/types/chat'

/** Supabase FK joins can return {name:...} or [{name:...}]. Normalize both. */
export function normalizeSender(sender: unknown): Sender {
  if (!sender) return { id: 'unknown', name: 'Unknown' }
  if (Array.isArray(sender)) return normalizeSender(sender[0])
  const s = sender as Record<string, unknown>
  return { id: (s.id as string) || 'unknown', name: (s.name as string) || 'Unknown', headshot_url: (s.headshot_url as string | null) ?? null }
}

export function normalizeReply(reply: unknown): ReplyMessage | null {
  if (!reply) return null
  if (Array.isArray(reply)) return normalizeReply(reply[0])
  const r = reply as Record<string, unknown>
  return { id: (r.id as string) || '', content: (r.content as string) || '', sender: normalizeSender(r.sender) }
}

export function normalizeMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    ...raw as unknown as ChatMessage,
    sender: normalizeSender(raw.sender),
    reply_message: normalizeReply(raw.reply_message),
  }
}

export function relativeTime(isoString: string): string {
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

export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  if (days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDateSeparator(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' })
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export function channelIcon(type: ChatChannel['type']): string {
  switch (type) {
    case 'company': return '🏢'
    case 'incident': return '🔥'
    case 'unit': return '🚑'
    case 'direct': return '👤'
  }
}
