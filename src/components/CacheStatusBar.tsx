import { useEffect, useState, useRef } from 'react'
import { getIsOnline, syncDataFromServer } from '@/lib/syncManager'
import { getCachedData } from '@/lib/offlineStore'
import { PRECACHE_ROUTES } from '@/lib/precacheRoutes'

type Phase = 'idle' | 'syncing' | 'pages' | 'details' | 'done'

export default function CacheStatusBar() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    if (!getIsOnline()) return
    hasRun.current = true

    // Check throttle
    const last = localStorage.getItem('firepcr-last-precache')
    if (last && Date.now() - parseInt(last) < 60 * 60 * 1000) return

    const run = async () => {
      // Phase 1: Sync data
      setPhase('syncing')
      try { await syncDataFromServer() } catch {}

      // Phase 2: Cache pages
      setPhase('pages')
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
        if (i + 5 < PRECACHE_ROUTES.length) await new Promise(r => setTimeout(r, 400))
      }

      // Phase 3: Cache detail pages
      setPhase('details')
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
      setPhase('done')
      // Hide after 3 seconds
      setTimeout(() => setPhase('idle'), 3000)
    }

    setTimeout(run, 2000)
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

  if (phase === 'pages') {
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0
    return (
      <div className="w-full border-b border-blue-800 bg-blue-950 px-3 py-1 text-[11px] font-medium flex items-center justify-center gap-2" style={{ minHeight: '24px' }}>
        <span style={{ color: '#93c5fd' }}>Caching pages</span>
        <div className="w-24 bg-blue-900 rounded-full h-1.5">
          <div className="bg-blue-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span style={{ color: '#93c5fd', opacity: 0.6 }}>{progress}/{total}</span>
      </div>
    )
  }

  if (phase === 'details') {
    const pct = total > 0 ? Math.round((progress / total) * 100) : 0
    return (
      <div className="w-full border-b border-amber-800 bg-amber-950 px-3 py-1 text-[11px] font-medium flex items-center justify-center gap-2" style={{ minHeight: '24px' }}>
        <span style={{ color: '#fcd34d' }}>Caching records</span>
        <div className="w-24 bg-amber-900 rounded-full h-1.5">
          <div className="bg-amber-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span style={{ color: '#fcd34d', opacity: 0.6 }}>{progress}/{total}</span>
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
