

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { authFetch } from '@/lib/authFetch'

type MessageStatus = 'complete' | 'pending' | 'error'

type Message = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  status?: MessageStatus
  created_at?: string
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120000 // 2 minutes

export default function ChatBubble() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [requestBanner, setRequestBanner] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Track active polling intervals so we can clean up
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const pollTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Poll a pending message until complete/error or timeout ───────────────
  const startPolling = useCallback((pendingMessageId: string) => {
    // Clear any existing interval for this message
    const existing = pollIntervalsRef.current.get(pendingMessageId)
    if (existing) clearInterval(existing)

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('employee_chats')
          .select('id, content, status')
          .eq('id', pendingMessageId)
          .single()

        if (!data) return

        if (data.status === 'complete' || data.status === 'error') {
          // Stop polling
          clearInterval(interval)
          clearTimeout(pollTimeoutsRef.current.get(pendingMessageId))
          pollIntervalsRef.current.delete(pendingMessageId)
          pollTimeoutsRef.current.delete(pendingMessageId)

          // Update message in state
          setMessages(prev =>
            prev.map(m =>
              m.id === pendingMessageId
                ? { ...m, content: data.content, status: data.status as MessageStatus }
                : m
            )
          )
        }
      } catch (err) {
        console.error('[poll] Error checking pending message:', err)
      }
    }, POLL_INTERVAL_MS)

    pollIntervalsRef.current.set(pendingMessageId, interval)

    // Timeout: stop polling after 2 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollIntervalsRef.current.get(pendingMessageId))
      pollIntervalsRef.current.delete(pendingMessageId)
      pollTimeoutsRef.current.delete(pendingMessageId)

      // Mark as timed out in UI
      setMessages(prev =>
        prev.map(m =>
          m.id === pendingMessageId && m.status === 'pending'
            ? {
                ...m,
                content: '⏱️ Request timed out, but AI Assistant may still be working on it. Check back in a moment.',
                status: 'error' as MessageStatus,
              }
            : m
        )
      )
    }, POLL_TIMEOUT_MS)

    pollTimeoutsRef.current.set(pendingMessageId, timeout)
  }, [supabase])

  // Cleanup all polling on unmount
  useEffect(() => {
    return () => {
      pollIntervalsRef.current.forEach(interval => clearInterval(interval))
      pollTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    }
  }, [])

  // Speech recognition setup — iOS Safari compatible
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const manualStopRef = useRef(false)

  const startRecording = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Try Chrome or Safari.')
      return
    }
    // Request mic permission explicitly first (iOS requires this)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Got permission — stop the stream immediately (we just needed the grant)
      stream.getTracks().forEach(t => t.stop())
    } catch (e) {
      alert(`Microphone access denied. Please allow microphone access in Settings > Safari > ${window.location.hostname}`)
      return
    }
    manualStopRef.current = false
    const recognition = new SpeechRecognition()
    // iOS Safari: continuous mode is unreliable, use single-shot and auto-restart
    recognition.continuous = !isIOS
    recognition.interimResults = true
    recognition.lang = 'en-US'
    let fullTranscript = input // preserve existing text
    recognition.onresult = (event: any) => {
      let sessionFinal = ''
      let sessionInterim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          sessionFinal += event.results[i][0].transcript + ' '
        } else {
          sessionInterim += event.results[i][0].transcript
        }
      }
      const prefix = fullTranscript ? fullTranscript.trimEnd() + ' ' : ''
      setInput(prefix + sessionFinal + sessionInterim)
      if (sessionFinal) {
        fullTranscript = prefix + sessionFinal
      }
    }
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error, event)
      // These errors are non-fatal on iOS — silence or user stopped
      const nonFatal = ['no-speech', 'aborted']
      if (!nonFatal.includes(event.error)) {
        if (event.error === 'not-allowed') {
          alert('Microphone permission was denied. Go to Settings > Safari and allow microphone access for this site.')
        }
        setIsRecording(false)
      }
    }
    recognition.onend = () => {
      // iOS Safari fires onend after each phrase. Auto-restart unless manually stopped.
      if (!manualStopRef.current && isIOS) {
        try {
          recognition.start()
        } catch (e) {
          // Already started or other error — just stop
          setIsRecording(false)
        }
      } else {
        setIsRecording(false)
      }
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsRecording(true)
    } catch (e) {
      console.error('Failed to start speech recognition:', e)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    manualStopRef.current = true
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) { /* ignore */ }
      recognitionRef.current = null
    }
    setIsRecording(false)
  }

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Load last 50 messages when chat opens for the first time
  useEffect(() => {
    if (!open || !assignment.employee?.id || !initialLoading) return

    const loadHistory = async () => {
      const { data } = await supabase
        .from('employee_chats')
        .select('id, role, content, status, created_at')
        .eq('employee_id', assignment.employee!.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const msgs = (data || []).reverse() as Message[]
      setMessages(msgs)
      setInitialLoading(false)

      // Resume polling for any pending messages still in history
      msgs.forEach(m => {
        if (m.id && m.status === 'pending') {
          startPolling(m.id)
        }
      })
    }

    loadHistory()
  }, [open, assignment.employee?.id])

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, open])

  // Focus input when opened
  useEffect(() => {
    if (open && !initialLoading) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, initialLoading])

  // ── Retry a failed message ───────────────────────────────────────────────
  const retryMessage = async (failedMsg: Message) => {
    if (!assignment.employee?.id || loading) return

    // Find the user message just before this one
    const msgIndex = messages.findIndex(m => m.id === failedMsg.id)
    const userMsg = msgIndex > 0 ? messages[msgIndex - 1] : null
    if (!userMsg || userMsg.role !== 'user') return

    // Remove the failed message from local state and re-send
    setMessages(prev => prev.filter(m => m.id !== failedMsg.id))
    setInput(userMsg.content)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || !assignment.employee?.id) return

    setInput('')
    setRequestBanner(false)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    // Optimistic: add user message immediately
    const userMsg: Message = { role: 'user', content: text, status: 'complete' }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await authFetch('/api/employee-chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.pending && data.pendingMessageId) {
          // ── ASYNC path: add pending placeholder, start polling ──
          const pendingMsg: Message = {
            id: data.pendingMessageId,
            role: 'assistant',
            content: '...',
            status: 'pending',
          }
          setMessages(prev => [...prev, pendingMsg])
          startPolling(data.pendingMessageId)
        } else {
          // ── SYNC path: add reply directly ──
          const assistantMsg: Message = {
            role: 'assistant',
            content: data.reply,
            status: 'complete',
          }
          setMessages(prev => [...prev, assistantMsg])
        }

        if (data.requestLogged) {
          setRequestBanner(true)
          setTimeout(() => setRequestBanner(false), 6000)
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '⚠️ Sorry, something went wrong. Please try again.',
          status: 'error',
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not reach the server. Check your connection.',
        status: 'error',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render a single message bubble ──────────────────────────────────────
  const renderMessage = (msg: Message, i: number) => {
    const isPending = msg.status === 'pending'
    const isError = msg.status === 'error'

    return (
      <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        {msg.role === 'assistant' && (
          <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">
            🏴‍☠️
          </div>
        )}
        <div className="flex flex-col gap-1 max-w-[80%]">
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-red-700 text-white rounded-br-sm'
                : isError
                  ? 'bg-red-950/60 border border-red-700/40 text-red-200 rounded-bl-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
            }`}
          >
            {isPending ? (
              /* 3-dot typing indicator */
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
              </div>
            ) : (
              msg.content
            )}
          </div>

          {/* Pending sub-label */}
          {isPending && (
            <p className="text-xs text-gray-500 pl-1">AI Assistant is working on this…</p>
          )}

          {/* Error retry button */}
          {isError && msg.role === 'assistant' && msg.id && (
            <button
              onClick={() => retryMessage(msg)}
              className="self-start ml-1 text-xs text-red-400 hover:text-red-300 underline transition-colors"
            >
              ↺ Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Assistant chat"
        className={`fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] md:bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 shadow-lg hover:shadow-red-600/30 flex items-center justify-center transition-all duration-300 ${
          mounted ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        } ${open ? 'pointer-events-none opacity-0 scale-75' : ''}`}
      >
        {/* Speech bubble SVG */}
        <svg
          className="w-6 h-6 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
          <circle cx="8" cy="10" r="1.2"/>
          <circle cx="12" cy="10" r="1.2"/>
          <circle cx="16" cy="10" r="1.2"/>
        </svg>
      </button>

      {/* Full-screen overlay */}
      <div
        className={`fixed inset-0 z-50 bg-gray-950 flex flex-col transition-all duration-300 ease-out ${
          open
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-full pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="px-4 pb-0 bg-gray-900 border-b border-gray-800 shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 8px, 20px)' }}>
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-lg shrink-0">
                🏴‍☠️
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white">AI Assistant</h1>
                <p className="text-xs text-gray-500">RAM AI Assistant · always on</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors text-gray-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* PHI disclaimer banner */}
          <div className="mx-0 mb-3 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-300 text-xs text-center">
            ⚠️ No personally identifiable patient information please
          </div>
        </div>

        {/* Request logged banner */}
        {requestBanner && (
          <div className="mx-4 mt-3 px-4 py-2 bg-green-900/40 border border-green-700/50 rounded-lg text-green-300 text-sm flex items-center gap-2 shrink-0">
            <span>✅</span>
            <span>Your request has been logged for admin review.</span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Loading state */}
          {(assignment.loading || initialLoading) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-sm">Loading chat…</div>
            </div>
          )}

          {/* No employee record */}
          {!assignment.loading && !assignment.employee && (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-sm">Employee record not found.</div>
            </div>
          )}

          {/* Empty state */}
          {!assignment.loading && !initialLoading && assignment.employee && messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="text-4xl mb-3">🏴‍☠️</div>
              <p className="text-white font-semibold">
                Hey {assignment.employee.name?.split(' ')[0]}!
              </p>
              <p className="text-gray-400 text-sm mt-1 max-w-xs">
                I&apos;m AI Assistant, your RAM assistant. Ask me about protocols, credentials, the app, or anything else I can help with.
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => renderMessage(msg, i))}

          {/* Typing indicator (sync path only — shown while awaiting Haiku) */}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">
                🏴‍☠️
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-end gap-2">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading || !assignment.employee}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                isRecording
                  ? 'bg-red-600 animate-pulse shadow-lg shadow-red-600/50'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
              }`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? (
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              )}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message AI Assistant…"
              rows={1}
              disabled={loading || !assignment.employee}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
              onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 128) + 'px'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || !assignment.employee}
              className="w-10 h-10 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}
