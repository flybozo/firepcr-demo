import { ChannelItem } from './ChannelItem'
import type { ChatChannel } from '@/types/chat'

function Section({ title, items, activeChannelId, onSelectChannel, unreadByChannel, onDeleteDM }: {
  title: string
  items: ChatChannel[]
  activeChannelId: string | null
  onSelectChannel: (ch: ChatChannel) => void
  unreadByChannel: Record<string, number>
  onDeleteDM: (channelId: string) => void
}) {
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
          onDelete={ch.type === 'direct' ? onDeleteDM : undefined}
        />
      ))}
    </div>
  )
}

export function ChannelListPanel({
  channels,
  activeChannelId,
  onSelectChannel,
  unreadByChannel,
  onNewDM,
  onDeleteDM,
  loading,
}: {
  channels: ChatChannel[]
  activeChannelId: string | null
  onSelectChannel: (ch: ChatChannel) => void
  unreadByChannel: Record<string, number>
  onNewDM: () => void
  onDeleteDM: (channelId: string) => void
  loading: boolean
}) {
  const grouped = {
    company: channels.filter((c) => c.type === 'company'),
    incident: channels.filter((c) => c.type === 'incident'),
    unit: channels.filter((c) => c.type === 'unit'),
    direct: channels.filter((c) => c.type === 'direct'),
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
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
            <Section title="Company" items={grouped.company} activeChannelId={activeChannelId} onSelectChannel={onSelectChannel} unreadByChannel={unreadByChannel} onDeleteDM={onDeleteDM} />
            <Section title="Incidents" items={grouped.incident} activeChannelId={activeChannelId} onSelectChannel={onSelectChannel} unreadByChannel={unreadByChannel} onDeleteDM={onDeleteDM} />
            <Section title="Units" items={grouped.unit} activeChannelId={activeChannelId} onSelectChannel={onSelectChannel} unreadByChannel={unreadByChannel} onDeleteDM={onDeleteDM} />
            <Section title="Direct Messages" items={grouped.direct} activeChannelId={activeChannelId} onSelectChannel={onSelectChannel} unreadByChannel={unreadByChannel} onDeleteDM={onDeleteDM} />
          </>
        )}
      </div>
    </div>
  )
}
