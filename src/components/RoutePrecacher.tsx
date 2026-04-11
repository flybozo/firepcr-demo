

import { useEffect, useRef, useState } from 'react'
import { PRECACHE_ROUTES } from '@/lib/precacheRoutes'
import { getCachedData } from '@/lib/offlineStore'

type PrecachePhase = 'idle' | 'routes' | 'details' | 'done'

export default function RoutePrecacher() {
  const hasStarted = useRef(false)
  const [phase, setPhase] = useState<PrecachePhase>('idle')
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (hasStarted.current) return
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return

    // Check throttle
    const lastPrecache = localStorage.getItem('firepcr-last-precache')
    if (lastPrecache && Date.now() - parseInt(lastPrecache) < 60 * 60 * 1000) return

    hasStarted.current = true

    const timer = setTimeout(async () => {
      setVisible(true)
      let completed = 0

      // ── Phase 1: Static routes ──
      setPhase('routes')
      setTotal(PRECACHE_ROUTES.length)
      setProgress(0)

      const batchSize = 5
      for (let i = 0; i < PRECACHE_ROUTES.length; i += batchSize) {
        const batch = PRECACHE_ROUTES.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(route =>
            // Fetch both the HTML page AND the RSC flight data
            Promise.all([
              fetch(route, { credentials: 'same-origin' }),
              fetch(route, { credentials: 'same-origin', headers: { 'RSC': '1', 'Next-Router-State-Tree': '%5B%22%22%5D' } }),
            ])
              .then(() => { completed++; setProgress(completed) })
              .catch(() => { completed++; setProgress(completed) })
          )
        )
        if (i + batchSize < PRECACHE_ROUTES.length) {
          await new Promise(r => setTimeout(r, 400))
        }
      }

      // ── Phase 2: Detail pages from cached IDs ──
      setPhase('details')
      completed = 0
      
      const detailPaths: string[] = []
      try {
        const encounters = await getCachedData('encounters')
        encounters.slice(0, 50).forEach((e: any) => detailPaths.push(`/encounters/${e.id}`))
        
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
      } catch { /* IndexedDB not ready yet */ }

      setTotal(detailPaths.length)
      setProgress(0)

      if (detailPaths.length > 0) {
        for (let i = 0; i < detailPaths.length; i += 3) {
          if (!navigator.onLine) break // Stop if we went offline
          const batch = detailPaths.slice(i, i + 3)
          await Promise.allSettled(
            batch.map(path =>
              Promise.all([
                fetch(path, { credentials: 'same-origin' }),
                fetch(path, { credentials: 'same-origin', headers: { 'RSC': '1', 'Next-Router-State-Tree': '%5B%22%22%5D' } }),
              ])
                .then(() => { completed++; setProgress(completed) })
                .catch(() => { completed++; setProgress(completed) })
            )
          )
          await new Promise(r => setTimeout(r, 250))
        }
      }

      // ── Done ──
      setPhase('done')
      localStorage.setItem('firepcr-last-precache', Date.now().toString())
      
      // Stay visible — user can dismiss manually
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-20 right-4 z-40 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 shadow-2xl max-w-[280px] transition-all duration-500 animate-in slide-in-from-right">
      {phase === 'routes' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Preparing for offline...</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500">Caching pages... {progress}/{total}</p>
        </div>
      )}
      {phase === 'details' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Caching records...</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-1">
            <div 
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500">Detail views... {progress}/{total}</p>
        </div>
      )}
      {phase === 'done' && (
        <div className="flex items-center gap-2">
          <span className="text-base">✅</span>
          <div>
            <p className="text-xs font-medium text-green-400">Ready for offline</p>
            <p className="text-[10px] text-gray-500">All pages & data cached</p>
          </div>
          <button onClick={() => setVisible(false)} className="ml-2 text-gray-600 hover:text-gray-400 text-xs">✕</button>
        </div>
      )}
    </div>
  )
}
