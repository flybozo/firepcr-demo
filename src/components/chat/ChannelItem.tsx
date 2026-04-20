import { useState, useRef } from 'react'
import { relativeTime, channelIcon } from '@/utils/chatHelpers'
import { Avatar } from './Avatar'
import type { ChatChannel } from '@/types/chat'

export function ChannelItem({
  channel,
  isActive,
  onClick,
  unreadCount,
  onDelete,
}: {
  channel: ChatChannel
  isActive: boolean
  onClick: () => void
  unreadCount: number
  onDelete?: (channelId: string) => void
}) {
  const lastMsg = channel.last_message
  const preview = lastMsg
    ? lastMsg.message_type === 'image'
      ? '📷 Photo'
      : lastMsg.message_type === 'file'
        ? '📎 File'
        : lastMsg.content.slice(0, 60)
    : 'No messages yet'

  const canDelete = channel.type === 'direct' && !!onDelete
  const [swipeX, setSwipeX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const confirmed = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    confirmed.current = false
    setSwiping(false)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canDelete) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dy > 30 && !swiping) return
    if (dx < -10) {
      setSwiping(true)
      setSwipeX(Math.max(dx, -100))
    }
  }
  const [showDelete, setShowDelete] = useState(false)

  const handleTouchEnd = () => {
    if (swipeX < -60) {
      // Reveal the delete button instead of auto-deleting
      setShowDelete(true)
    }
    setSwipeX(0)
    setSwiping(false)
  }

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={canDelete ? handleTouchStart : undefined}
      onTouchMove={canDelete ? handleTouchMove : undefined}
      onTouchEnd={canDelete ? handleTouchEnd : undefined}
    >
      {/* Swipe hint */}
      {canDelete && swipeX < -20 && !showDelete && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 z-0">
          <span className={`text-xs font-semibold ${swipeX < -60 ? 'text-red-400' : 'text-gray-500'}`}>
            🗑️ Delete
          </span>
        </div>
      )}
      {/* Revealed delete button */}
      {showDelete && canDelete && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center z-20">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(channel.id); setShowDelete(false) }}
            className="h-full px-5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
          >
            Delete
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDelete(false) }}
            className="h-full px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      )}
      <button
        onClick={() => { if (showDelete) { setShowDelete(false); return } onClick() }}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-800/50 relative z-10 ${
          isActive ? 'bg-gray-800' : 'hover:bg-gray-900'
        } ${canDelete ? 'bg-gray-950' : ''}`}
        style={{
          transform: swiping ? `translateX(${swipeX}px)` : showDelete ? 'translateX(-100px)' : undefined,
          transition: swiping ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {/* Avatar for DMs, icon for channels */}
        {channel.type === 'direct' ? (
          <div className="mt-0.5 shrink-0">
            <Avatar person={{ name: channel.name }} size={32} />
          </div>
        ) : (
          <span className="text-xl mt-0.5 shrink-0">{channelIcon(channel.type)}</span>
        )}
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
    </div>
  )
}
