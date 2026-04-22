import { useEffect, useState, useRef } from 'react'
import { initConnectionMonitor, onConnectionChange, getIsOnline, syncDataFromServer, getPendingWriteCount } from '@/lib/syncManager'
import { getSyncMeta } from '@/lib/offlineStore'

// Warn user if they try to close/background the app with unsynced data
function usePendingCloseWarning(pendingCount: number) {
  const pendingRef = useRef(pendingCount)
  pendingRef.current = pendingCount

  useEffect(() => {
    // Standard browser unload warning (works on desktop, limited on iOS)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingRef.current > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    // iOS PWA: fires when user switches away or goes to home screen
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && pendingRef.current > 0) {
        // Can't show a dialog here, but we can log to console and
        // attempt an emergency flush if online
        if (getIsOnline()) {
          import('@/lib/syncManager').then(({ flushPendingWrites }) => {
            flushPendingWrites().catch(() => {})
          })
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ── Separate component for cache progress (only shows during initial caching) ──
export function CacheProgress({ progress, total, label }: { progress: number; total: number; label: string }) {
  if (total === 0) return null
  const pct = Math.round((progress / total) * 100)
  return (
    <div className="w-full border-b border-blue-800 bg-blue-950 px-3 py-1 text-[11px] font-medium flex items-center justify-center gap-2"
      style={{ minHeight: '24px' }}>
      <span style={{ color: '#93c5fd' }}>{label}</span>
      <div className="w-24 bg-blue-900 rounded-full h-1.5">
        <div className="bg-blue-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span style={{ color: '#93c5fd', opacity: 0.6 }}>{progress}/{total}</span>
    </div>
  )
}

// ── Main persistent online/offline bar ──
export default function ConnectionStatus() {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const hasInited = useRef(false)

  const refresh = async () => {
    try {
      const meta = await getSyncMeta()
      if (meta) setLastSynced(meta.lastSynced)
      const count = await getPendingWriteCount()
      setPendingCount(count)
    } catch {}
  }

  useEffect(() => {
    if (hasInited.current) return
    hasInited.current = true

    initConnectionMonitor()
    setOnline(getIsOnline())
    refresh()

    // Initial sync (silent — no bar changes)
    if (getIsOnline()) {
      syncDataFromServer().then(() => refresh()).catch(() => {})
    }

    const unsub = onConnectionChange(async (nowOnline, count) => {
      setOnline(nowOnline)
      setPendingCount(count)
      if (nowOnline) {
        try {
          const { flushPendingWrites } = await import('@/lib/syncManager')
          await flushPendingWrites()
          await syncDataFromServer()
        } catch {}
        await refresh()
      }
    })

    // Refresh pending count periodically (don't re-render bar, just state)
    // Also try to flush any pending writes on mount if already online
    if (getIsOnline()) {
      import('@/lib/syncManager').then(({ flushPendingWrites }) => {
        flushPendingWrites().then(() => refresh()).catch(() => {})
      })
    }

    const interval = setInterval(refresh, 10000) // Poll every 10s so banner clears promptly

    return () => { unsub(); clearInterval(interval) }
  }, [])

  const isOffline = !online

  // Attempt flush whenever we come back online and have pending items
  usePendingCloseWarning(pendingCount)

  return (
    <div
      className={`w-full border-b px-3 text-[11px] font-medium flex items-center justify-center gap-2 ${
        isOffline
          ? 'bg-red-950 border-red-800'
          : pendingCount > 0
            ? 'bg-amber-950 border-amber-800'
            : 'bg-green-950/60 border-green-900'
      }`}
      style={{ minHeight: '24px' }}
    >
      {isOffline ? (
        <>
          <span style={{ color: '#fca5a5' }}>📶 Offline</span>
          {pendingCount > 0 && (
            <span className="bg-red-700 text-red-100 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{pendingCount} pending</span>
          )}
          {lastSynced && <span style={{ color: '#fca5a5', opacity: 0.5 }}>Last sync: {timeAgo(lastSynced)}</span>}
        </>
      ) : pendingCount > 0 ? (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span style={{ color: '#fcd34d' }}>⚠️ {pendingCount} unsynced — stay online until complete</span>
          {lastSynced && <span style={{ color: '#fcd34d', opacity: 0.5 }}>· Last sync: {timeAgo(lastSynced)}</span>}
        </>
      ) : (
        <>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span style={{ color: '#86efac' }}>Online</span>
          {lastSynced && <span style={{ color: '#86efac', opacity: 0.5 }}>· Synced {timeAgo(lastSynced)}</span>}
        </>
      )}
    </div>
  )
}
