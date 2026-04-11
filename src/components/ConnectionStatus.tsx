

import { useEffect, useState, useRef } from 'react'
import { initConnectionMonitor, onConnectionChange, getIsOnline, syncDataFromServer } from '@/lib/syncManager'
import { getSyncMeta, getPendingCount, getCachedData } from '@/lib/offlineStore'
import { PRECACHE_ROUTES } from '@/lib/precacheRoutes'

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

type Phase = 'idle' | 'syncing-data' | 'caching-pages' | 'caching-details' | 'ready' | 'offline'

export default function ConnectionStatus() {
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const hasInited = useRef(false)

  const refresh = async () => {
    try {
      const meta = await getSyncMeta()
      if (meta) setLastSynced(meta.lastSynced)
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {}
  }

  useEffect(() => {
    if (hasInited.current) return
    hasInited.current = true

    initConnectionMonitor()
    const nowOnline = getIsOnline()
    setOnline(nowOnline)
    refresh()

    if (!nowOnline) {
      setPhase('offline')
      return
    }

    // ── Full startup sequence: data sync → page cache → detail cache ──
    const runStartup = async () => {
      // Phase 1: Sync data to IndexedDB
      setPhase('syncing-data')
      try {
        await syncDataFromServer()
        await refresh()
      } catch {}

      // Check precache throttle
      const lastPrecache = localStorage.getItem('firepcr-last-precache')
      if (lastPrecache && Date.now() - parseInt(lastPrecache) < 60 * 60 * 1000) {
        setPhase('ready')
        return
      }

      // Phase 2: Cache all static routes
      setPhase('caching-pages')
      setTotal(PRECACHE_ROUTES.length)
      setProgress(0)
      let completed = 0

      for (let i = 0; i < PRECACHE_ROUTES.length; i += 5) {
        if (!navigator.onLine) break
        const batch = PRECACHE_ROUTES.slice(i, i + 5)
        await Promise.allSettled(
          batch.map(route =>
            fetch(route, { credentials: 'same-origin' })
              .then(() => { completed++; setProgress(completed) })
              .catch(() => { completed++; setProgress(completed) })
          )
        )
        if (i + 5 < PRECACHE_ROUTES.length) {
          await new Promise(r => setTimeout(r, 400))
        }
      }

      // Phase 3: Cache detail pages
      setPhase('caching-details')
      completed = 0
      const detailPaths: string[] = []

      try {
        const encounters = await getCachedData('encounters')
        encounters.slice(0, 200).forEach((e: any) => detailPaths.push(`/encounters/${e.id}`))
        const incidents = await getCachedData('incidents')
        incidents.forEach((i: any) => detailPaths.push(`/incidents/${i.id}`))
        const units = await getCachedData('units')
        units.forEach((u: any) => detailPaths.push(`/units/${u.id}`))
        const mar = await getCachedData('mar_entries')
        mar.slice(0, 50).forEach((m: any) => detailPaths.push(`/mar/${m.id}`))
        const runs = await getCachedData('supply_runs')
        runs.slice(0, 30).forEach((r: any) => detailPaths.push(`/supply-runs/${r.id}`))
        const inv = await getCachedData('inventory')
        inv.slice(0, 50).forEach((i: any) => detailPaths.push(`/inventory/${i.id}`))
        const emps = await getCachedData('employees')
        emps.forEach((e: any) => detailPaths.push(`/roster/${e.id}`))
      } catch {}

      setTotal(detailPaths.length)
      setProgress(0)

      for (let i = 0; i < detailPaths.length; i += 3) {
        if (!navigator.onLine) break
        const batch = detailPaths.slice(i, i + 3)
        await Promise.allSettled(
          batch.map(path =>
            fetch(path, { credentials: 'same-origin' })
              .then(() => { completed++; setProgress(completed) })
              .catch(() => { completed++; setProgress(completed) })
          )
        )
        await new Promise(r => setTimeout(r, 250))
      }

      localStorage.setItem('firepcr-last-precache', Date.now().toString())
      setPhase('ready')
    }

    // Start after 2 second delay
    const timer = setTimeout(runStartup, 2000)

    const unsub = onConnectionChange(async (nowOnline, count) => {
      setOnline(nowOnline)
      setPendingCount(count)
      if (!nowOnline) {
        setPhase('offline')
      } else {
        // Back online — always sync + flush pending writes
        console.log('[ConnectionStatus] Back online, syncing...', { pendingWrites: count })
        setPhase('syncing-data')
        try {
          const { flushPendingWrites } = await import('@/lib/syncManager')
          await flushPendingWrites()
          await syncDataFromServer()
        } catch (err) {
          console.error('[ConnectionStatus] Sync on reconnect failed:', err)
        }
        await refresh()
        setPhase('ready')
      }
    })

    const interval = setInterval(refresh, 30000)
    return () => { clearTimeout(timer); unsub(); clearInterval(interval) }
  }, [])

  // ── Render: thin bar at top ──
  const barHeight = '24px'

  if (phase === 'idle' || phase === 'ready') return null
  // Don't show syncing bar for background reconnection syncs — only show during initial startup or offline
  if (phase === 'syncing-data' && online && pendingCount === 0) return null

  // Colors & content by phase
  let bgColor = ''
  let content = null

  switch (phase) {
    case 'offline':
      bgColor = 'bg-red-950 border-red-800'
      content = (
        <div className="flex items-center justify-center gap-2">
          <span>📶</span>
          <span>Offline — changes saved locally</span>
          {pendingCount > 0 && (
            <span className="bg-red-700 text-red-100 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{pendingCount}</span>
          )}
          {lastSynced && <span className="opacity-50 ml-1">Last sync: {timeAgo(lastSynced)}</span>}
        </div>
      )
      break

    case 'syncing-data':
      bgColor = 'bg-blue-950 border-blue-800'
      content = (
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span>Syncing data...</span>
        </div>
      )
      break

    case 'caching-pages':
      bgColor = 'bg-blue-950 border-blue-800'
      const pctPages = total > 0 ? Math.round((progress / total) * 100) : 0
      content = (
        <div className="flex items-center justify-center gap-2 w-full">
          <span>Caching pages for offline</span>
          <div className="w-24 bg-blue-900 rounded-full h-1.5">
            <div className="bg-blue-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pctPages}%` }} />
          </div>
          <span className="opacity-60">{progress}/{total}</span>
        </div>
      )
      break

    case 'caching-details':
      bgColor = 'bg-amber-950 border-amber-800'
      const pctDetails = total > 0 ? Math.round((progress / total) * 100) : 0
      content = (
        <div className="flex items-center justify-center gap-2 w-full">
          <span>Caching patient records & details</span>
          <div className="w-24 bg-amber-900 rounded-full h-1.5">
            <div className="bg-amber-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pctDetails}%` }} />
          </div>
          <span className="opacity-60">{progress}/{total}</span>
        </div>
      )
      break


  }

  return (
    <div
      className={`w-full border-b px-3 text-[11px] font-medium flex items-center transition-all duration-500 ${bgColor}`}
      style={{ minHeight: barHeight, paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="w-full text-center" style={{ color: 'var(--color-text, #e5e7eb)' }}>
        {content}
      </div>
    </div>
  )
}
