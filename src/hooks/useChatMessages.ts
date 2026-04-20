import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { authFetch } from '@/lib/authFetch'
import { createClient } from '@/lib/supabase/client'
import { normalizeMessage } from '@/utils/chatHelpers'
import type { ChatMessage } from '@/types/chat'

export function useChatMessages(channelId: string, employeeId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)

  const channelIdRef = useRef(channelId)
  const realtimeKey = useRef(`chat-msg-${channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  const realtimeActive = useRef(false)

  const loadMessages = useCallback(async (before?: string): Promise<ChatMessage[]> => {
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

  // Initial load + reset on channel switch
  useEffect(() => {
    channelIdRef.current = channelId
    realtimeKey.current = `chat-msg-${channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages([])
    setHasMore(true)
    setLoading(true)

    loadMessages().then((msgs) => {
      setMessages(msgs)
      setHasMore(msgs.length === 50)
      setLoading(false)
    })

    authFetch('/api/chat/read', {
      method: 'POST',
      body: JSON.stringify({ channel_id: channelId }),
    }).catch(() => {})
  }, [channelId, loadMessages])

  const fetchAndMergeNew = useCallback(async (senderId?: string) => {
    try {
      const resp = await authFetch(`/api/chat/messages?channelId=${channelId}&limit=5`)
      if (!resp.ok) return
      const data = await resp.json()
      const latest = ((data.messages || []) as Record<string, unknown>[]).map(normalizeMessage)

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const newMsgs = latest.filter((m) => !existingIds.has(m.id))
        if (newMsgs.length === 0) return prev
        return [...prev, ...newMsgs]
      })

      if (senderId && senderId !== employeeId) {
        authFetch('/api/chat/read', {
          method: 'POST',
          body: JSON.stringify({ channel_id: channelId }),
        }).catch(() => {})
      }
    } catch {
      // Non-fatal
    }
  }, [channelId, employeeId])

  // Realtime subscription — cleanup on channel switch is CRITICAL to prevent leaks
  useEffect(() => {
    const supabase = createClient()
    let sub: ReturnType<typeof supabase.channel> | null = null
    realtimeActive.current = false

    try {
      sub = supabase
        .channel(realtimeKey.current)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            const newMsg = payload.new as { sender_id: string }
            fetchAndMergeNew(newMsg.sender_id)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            realtimeActive.current = true
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Chat] Realtime ${status} — falling back to polling`)
            realtimeActive.current = false
          }
        })
    } catch (err) {
      console.warn('[Chat] Realtime subscribe failed (non-fatal):', err)
      realtimeActive.current = false
    }

    return () => {
      if (sub) supabase.removeChannel(sub)
      realtimeActive.current = false
    }
  }, [channelId, fetchAndMergeNew])

  // 3s polling fallback — cleanup on channel switch
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAndMergeNew()
    }, 3000)
    return () => clearInterval(interval)
  }, [fetchAndMergeNew])

  const handleLoadMore = async () => {
    if (loadingMore || !messages.length) return
    setLoadingMore(true)
    const oldest = messages[0]
    const more = await loadMessages(oldest.id)
    setMessages((prev) => [...more, ...prev])
    setHasMore(more.length === 50)
    setLoadingMore(false)
  }

  const handleSend = async (text: string, replyId?: string): Promise<void> => {
    if (!text || sending) return
    setSending(true)
    try {
      const resp = await authFetch('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: channelId,
          content: text,
          reply_to: replyId || undefined,
        }),
      })
      if (resp.ok) {
        const data = await resp.json()
        if (data.message) {
          const sent = normalizeMessage(data.message as Record<string, unknown>)
          setMessages((prev) => {
            if (prev.some((m) => m.id === sent.id)) return prev
            return [...prev, sent]
          })
        }
      }
    } catch (e) {
      console.error('[Chat] send failed', e)
      throw e
    } finally {
      setSending(false)
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
    try {
      const resp = await authFetch(`/api/chat/messages?messageId=${msgId}`, { method: 'DELETE' })
      if (resp.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId))
      }
    } catch (e) {
      console.error('[Chat] delete failed', e)
    }
  }

  const handleFileSelect = async (file: File) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      toast.warning(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`)
      return
    }

    setUploading(true)
    try {
      const isImage = file.type.startsWith('image/')
      const supabase = createClient()
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${channelId}/${timestamp}_${safeName}`

      const { error: uploadErr } = await supabase.storage
        .from('chat-files')
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadErr) {
        console.error('[Chat] Supabase storage upload error:', uploadErr)
        throw new Error(uploadErr.message || 'Upload failed')
      }

      const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(storagePath)
      const fileUrl = urlData.publicUrl

      const msgResp = await authFetch('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: channelId,
          content: isImage ? file.name : fileUrl,
          message_type: isImage ? 'image' : 'file',
          file_url: fileUrl,
          file_name: file.name,
        }),
      })

      if (msgResp.ok) {
        const msgData = await msgResp.json()
        if (msgData.message) {
          const sent = normalizeMessage(msgData.message as Record<string, unknown>)
          setMessages((prev) => {
            if (prev.some((m) => m.id === sent.id)) return prev
            return [...prev, sent]
          })
        }
      }
    } catch (e) {
      console.error('[Chat] upload failed', e)
    } finally {
      setUploading(false)
    }
  }

  return {
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
  }
}
