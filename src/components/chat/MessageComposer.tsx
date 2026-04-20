import { useState, useRef } from 'react'
import type { ChatMessage } from '@/types/chat'

export function MessageComposer({
  onSend,
  onFileSelect,
  uploading,
  sending,
  replyTo,
  onClearReply,
}: {
  onSend: (text: string, replyId?: string) => Promise<void>
  onFileSelect: (file: File) => Promise<void>
  uploading: boolean
  sending: boolean
  replyTo: ChatMessage | null
  onClearReply: () => void
}) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const replyId = replyTo?.id
    onClearReply()
    try {
      await onSend(text, replyId)
    } catch {
      setInput(text)
    } finally {
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    await onFileSelect(file)
  }

  return (
    <>
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-t border-gray-800 text-sm">
          <span className="text-gray-500">↩</span>
          <div className="flex-1 min-w-0">
            <p className="text-gray-300 text-xs font-medium">{replyTo.sender.name}</p>
            <p className="text-gray-500 text-xs truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={onClearReply}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-3 border-t border-gray-800 bg-gray-950">
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
          onChange={handleFileChange}
        />

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
    </>
  )
}
