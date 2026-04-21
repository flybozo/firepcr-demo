/**
 * GlobalLocationPing — silent background location pinger.
 *
 * Mounts inside AppLayout so it runs for ALL users (admin + field).
 * Checks geolocation permission without prompting, and if already granted,
 * pings every 15 min. No UI — the MyUnit banner handles the prompt flow
 * for field users. Admins who have granted location get pinged automatically.
 */
import { useEffect, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

export default function GlobalLocationPing() {
  const { incidentUnit, employee } = useUser()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const incidentId = incidentUnit?.incident_id ?? null
  const unitId = incidentUnit?.unit_id ?? null

  const doPost = async (pos: GeolocationPosition) => {
    if (!incidentId || !unitId || !employee?.id) return
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) return
      await fetch('/api/location/ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          unit_id: unitId,
          incident_id: incidentId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
          source: 'auto',
        }),
      })
    } catch {
      // silent — never interrupt the user
    }
  }

  const ping = () => {
    navigator.geolocation.getCurrentPosition(doPost, () => {}, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    })
  }

  useEffect(() => {
    // Need an active assignment to ping
    if (!incidentId || !unitId || !employee?.id) return
    // Don't even try if geolocation isn't supported
    if (!('geolocation' in navigator)) return

    const start = () => {
      ping()
      intervalRef.current = setInterval(ping, 15 * 60 * 1000)
    }

    // Check permission state without triggering a prompt
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') start()
        // Listen for the user granting permission elsewhere (e.g. MyUnit banner)
        result.addEventListener('change', () => {
          if (result.state === 'granted' && !intervalRef.current) start()
          if (result.state !== 'granted' && intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        })
      }).catch(() => {
        // permissions API not available — just try silently; will fail gracefully if denied
        start()
      })
    } else {
      // Fallback: try directly (iOS Safari doesn't support permissions.query)
      start()
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [incidentId, unitId, employee?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
