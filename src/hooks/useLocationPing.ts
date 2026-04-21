import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useLocationPing(incidentId: string | null, unitId: string | null) {
  useEffect(() => {
    if (!incidentId || !unitId) return

    const ping = async () => {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        if (!session) return

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
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
          },
          () => {}
        )
      } catch {}
    }

    ping()
    const interval = setInterval(ping, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [incidentId, unitId])
}
