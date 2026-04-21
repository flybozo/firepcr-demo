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

export { relativeTime, formatMessageTime, formatDateSeparator } from './dateFormatters'

export function channelIcon(type: ChatChannel['type']): string {
  switch (type) {
    case 'company': return '🏢'
    case 'incident': return '🔥'
    case 'unit': return '🚑'
    case 'direct': return '👤'
  }
}
