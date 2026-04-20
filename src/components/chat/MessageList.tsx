import { useRef, useEffect } from 'react'
import { formatDateSeparator } from '@/utils/chatHelpers'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage } from '@/types/chat'

export function MessageList({
  messages,
  loading,
  hasMore,
  loadingMore,
  employeeId,
  onLoadMore,
  onReply,
  onDelete,
}: {
  messages: ChatMessage[]
  loading: boolean
  hasMore: boolean
  loadingMore: boolean
  employeeId: string
  onLoadMore: () => void
  onReply: (msg: ChatMessage) => void
  onDelete: (msgId: string) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLoadingRef = useRef(true)
  const prevLengthRef = useRef(0)

  useEffect(() => {
    const wasLoading = prevLoadingRef.current
    prevLoadingRef.current = loading

    if (!loading) {
      if (wasLoading) {
        // Initial channel load — scroll instantly after paint
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
      } else if (messages.length > prevLengthRef.current) {
        // New messages arrived — smooth scroll
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    prevLengthRef.current = messages.length
  }, [messages.length, loading])

  // Group messages by calendar date
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
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {hasMore && !loading && (
        <div className="flex justify-center pb-2">
          <button
            onClick={onLoadMore}
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
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-[11px] text-gray-500 font-medium px-2">
                {formatDateSeparator(dayMsgs[0].created_at)}
              </span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
            {dayMsgs.map((msg, idx) => {
              const prevMsg = idx > 0 ? dayMsgs[idx - 1] : null
              const showSender = !prevMsg || prevMsg.sender.id !== msg.sender.id
              return (
                <div key={msg.id} className={showSender && idx > 0 ? 'mt-3' : 'mt-0.5'}>
                  <MessageBubble
                    message={msg}
                    isOwn={msg.sender.id === employeeId}
                    showSender={showSender}
                    onReply={onReply}
                    onDelete={onDelete}
                  />
                </div>
              )
            })}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
