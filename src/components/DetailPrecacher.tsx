

import { useEffect, useRef } from 'react'
import { getCachedData } from '@/lib/offlineStore'

// After the static routes are cached, this component fetches
// detail pages for all known IDs (encounters, units, incidents, MAR, etc.)
// so drill-down views work offline too.

export default function DetailPrecacher() {
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return

    hasRun.current = true

    // Check if we've done detail precache recently
    const last = localStorage.getItem('firepcr-last-detail-precache')
    if (last && Date.now() - parseInt(last) < 2 * 60 * 60 * 1000) return // 2 hours

    // Wait 15 seconds to let static precache and data sync finish first
    const timer = setTimeout(async () => {
      console.log('[DetailPrecache] Starting detail page precache...')

      let total = 0
      const fetchRoute = async (path: string) => {
        try {
          await fetch(path, { credentials: 'same-origin' })
          total++
        } catch { /* ignore */ }
      }

      // Batch fetch with small delays
      const fetchBatch = async (paths: string[]) => {
        for (let i = 0; i < paths.length; i += 3) {
          const batch = paths.slice(i, i + 3)
          await Promise.allSettled(batch.map(fetchRoute))
          await new Promise(r => setTimeout(r, 300))
        }
      }

      try {
        // Encounters
        const encounters = await getCachedData('encounters')
        if (encounters.length > 0) {
          const encPaths = encounters.slice(0, 200).map((e: any) => `/encounters/${e.id}`)
          await fetchBatch(encPaths)
        }

        // Incidents  
        const incidents = await getCachedData('incidents')
        if (incidents.length > 0) {
          const incPaths = incidents.map((i: any) => `/incidents/${i.id}`)
          await fetchBatch(incPaths)
        }

        // Units
        const units = await getCachedData('units')
        if (units.length > 0) {
          const unitPaths = units.map((u: any) => `/units/${u.id}`)
          await fetchBatch(unitPaths)
        }

        // MAR entries
        const mar = await getCachedData('mar_entries')
        if (mar.length > 0) {
          const marPaths = mar.slice(0, 50).map((m: any) => `/mar/${m.id}`)
          await fetchBatch(marPaths)
        }

        // Supply runs
        const runs = await getCachedData('supply_runs')
        if (runs.length > 0) {
          const runPaths = runs.slice(0, 30).map((r: any) => `/supply-runs/${r.id}`)
          await fetchBatch(runPaths)
        }

        // Inventory
        const inv = await getCachedData('inventory')
        if (inv.length > 0) {
          const invPaths = inv.slice(0, 50).map((i: any) => `/inventory/${i.id}`)
          await fetchBatch(invPaths)
        }

        // Roster
        const emps = await getCachedData('employees')
        if (emps.length > 0) {
          const empPaths = emps.map((e: any) => `/roster/${e.id}`)
          await fetchBatch(empPaths)
        }

        console.log(`[DetailPrecache] Done — ${total} detail pages cached`)
        localStorage.setItem('firepcr-last-detail-precache', Date.now().toString())
      } catch (err) {
        console.error('[DetailPrecache] Error:', err)
      }
    }, 5000)  // Start 5s after mount (data sync should be done by then)

    return () => clearTimeout(timer)
  }, [])

  return null
}
