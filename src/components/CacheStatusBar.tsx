import { useEffect, useState, useRef } from 'react'
import { getIsOnline, syncDataFromServer } from '@/lib/syncManager'

// Session-scoped throttle: sync once per browser session (tab), not once per 4 hours.
// sessionStorage clears when the tab closes, so every fresh login gets a sync.
// This prevents hammering on SPA navigation while ensuring fresh data on login.
const SESSION_KEY = 'firepcr-synced-this-session'

type Phase = 'idle' | 'syncing' | 'done'

export default function CacheStatusBar() {
  const [phase, setPhase] = useState<Phase>('idle')
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    if (!getIsOnline()) return
    hasRun.current = true

    // Skip if already synced in this browser session (tab)
    if (sessionStorage.getItem(SESSION_KEY)) return

    const run = async () => {
      setPhase('syncing')
      try { await syncDataFromServer() } catch {}

      sessionStorage.setItem(SESSION_KEY, '1')
      setPhase('done')
      setTimeout(() => setPhase('idle'), 3000)
    }

    // Delay 5s so initial render and auth complete first
    setTimeout(run, 5000)
  }, [])

  if (phase === 'idle') return null

  if (phase === 'syncing') {
    return (
      <div className="w-full border-b border-blue-800 bg-blue-950 px-3 py-1 text-[11px] font-medium flex items-center justify-center gap-2" style={{ minHeight: '24px' }}>
        <svg className="animate-spin h-3 w-3" style={{ color: '#93c5fd' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span style={{ color: '#93c5fd' }}>Syncing data for offline use...</span>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="w-full border-b border-green-800 bg-green-950 px-3 py-1 text-[11px] font-medium flex items-center justify-center gap-2" style={{ minHeight: '24px' }}>
        <span style={{ color: '#86efac' }}>✅ Ready for offline</span>
      </div>
    )
  }

  return null
}
