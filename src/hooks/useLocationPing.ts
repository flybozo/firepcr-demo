import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PermissionState = 'unknown' | 'prompt' | 'granted' | 'denied'

export function useLocationPing(incidentId: string | null, unitId: string | null) {
  const [permState, setPermState] = useState<PermissionState>('unknown')
  const [sharing, setSharing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check current permission state on mount (without triggering a prompt)
  useEffect(() => {
    if (!navigator.permissions) {
      setPermState('prompt') // can't check, assume we need to ask
      return
    }
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      setPermState(result.state as PermissionState)
      setSharing(result.state === 'granted')
      result.addEventListener('change', () => {
        setPermState(result.state as PermissionState)
        setSharing(result.state === 'granted')
      })
    }).catch(() => setPermState('prompt'))
  }, [])

  const doPost = async (pos: GeolocationPosition) => {
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session || !incidentId || !unitId) return
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
    } catch {}
  }

  // Auto-ping loop — only runs when permission is granted
  useEffect(() => {
    if (!incidentId || !unitId || !sharing) return

    const ping = () => {
      navigator.geolocation.getCurrentPosition(doPost, () => {}, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      })
    }

    ping() // immediate ping on grant
    intervalRef.current = setInterval(ping, 15 * 60 * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [incidentId, unitId, sharing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Called when user taps the banner — triggers the iOS permission prompt
  const requestPermission = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPermState('granted')
        setSharing(true)
        doPost(pos) // immediate ping on grant
      },
      (err) => {
        if (err.code === 1) setPermState('denied')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  return { permState, sharing, requestPermission }
}
