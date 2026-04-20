import { useState } from 'react'
import { useChatMessages } from '@/hooks/useChatMessages'
import { channelIcon } from '@/utils/chatHelpers'
import { MessageList } from './MessageList'
import { MessageComposer } from './MessageComposer'
import type { ChatChannel, ChatMessage } from '@/types/chat'

export function MessageThread({
  channel,
  employeeId,
  onBack,
}: {
  channel: ChatChannel
  employeeId: string
  onBack: () => void
}) {
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    sending,
    uploading,
    handleLoadMore,
    handleSend,
    handleDeleteMessage,
    handleFileSelect,
  } = useChatMessages(channel.id, employeeId)

  return (
    <div className="flex flex-col h-full bg-gray-950">
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

      <MessageList
        messages={messages}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        employeeId={employeeId}
        onLoadMore={handleLoadMore}
        onReply={setReplyTo}
        onDelete={handleDeleteMessage}
      />

      <MessageComposer
        onSend={handleSend}
        onFileSelect={handleFileSelect}
        uploading={uploading}
        sending={sending}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
    </div>
  )
}
