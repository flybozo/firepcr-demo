import { useState, useRef } from 'react'
import { formatMessageTime } from '@/utils/chatHelpers'
import { Avatar } from './Avatar'
import type { ChatMessage } from '@/types/chat'

export function MessageBubble({
  message,
  isOwn,
  showSender,
  onReply,
  onDelete,
}: {
  message: ChatMessage
  isOwn: boolean
  showSender: boolean
  onReply: (msg: ChatMessage) => void
  onDelete?: (msgId: string) => void
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
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
    if (!isOwn || !onDelete) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dy > 30 && !swiping) return
    if (dx < -10) {
      setSwiping(true)
      setSwipeX(Math.max(dx, -100))
    }
  }
  const handleTouchEnd = () => {
    if (swipeX < -60 && !confirmed.current) {
      confirmed.current = true
      onDelete?.(message.id)
    }
    setSwipeX(0)
    setSwiping(false)
  }

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
    <div
      className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} group relative overflow-hidden`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isOwn && swipeX < -20 && (
        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-3 z-0">
          <span className={`text-xs font-semibold ${swipeX < -60 ? 'text-red-400' : 'text-gray-500'}`}>
            🗑️ Delete
          </span>
        </div>
      )}
      <div
        className={`flex items-end gap-2 w-full relative z-10 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        style={{
          transform: swiping ? `translateX(${swipeX}px)` : undefined,
          transition: swiping ? 'none' : 'transform 200ms ease-out',
        }}
      >
        <div className="w-8 shrink-0">
          {isOwn
            ? <Avatar person={message.sender} size={28} />
            : showSender ? <Avatar person={message.sender} size={28} /> : null
          }
        </div>

        <div className={`max-w-[75%] min-w-0 ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
          {!isOwn && showSender && (
            <span className="text-[11px] text-gray-400 px-1 ml-1">{message.sender.name}</span>
          )}

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

          <div
            className={`flex items-center gap-2 ${
              isOwn ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <span className="text-[10px] text-gray-500 px-1">
              {formatMessageTime(message.created_at)}
              {message.edited_at && <span className="ml-1 italic">(edited)</span>}
            </span>
            <button
              onClick={() => onReply(message)}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors px-1 opacity-0 group-hover:opacity-100"
            >
              ↩ Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
