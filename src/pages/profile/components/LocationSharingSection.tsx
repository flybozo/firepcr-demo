import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

type PermState = 'unknown' | 'granted' | 'denied' | 'prompt' | 'unsupported'

export function LocationSharingSection() {
  const { incidentUnit, employee } = useUser()
  const [permState, setPermState] = useState<PermState>('unknown')
  const [pinging, setPinging] = useState(false)
  const [lastPing, setLastPing] = useState<string | null>(null)

  const hasAssignment = !!(incidentUnit?.unit_id && incidentUnit?.incident_id)

  // Check current permission state on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) { setPermState('unsupported'); return }
    if (!('permissions' in navigator)) { setPermState('prompt'); return }
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      setPermState(result.state as PermState)
      result.addEventListener('change', () => setPermState(result.state as PermState))
    }).catch(() => setPermState('prompt'))
  }, [])

  // Load last ping time
  useEffect(() => {
    if (!incidentUnit?.unit_id) return
    const supabase = createClient()
    supabase
      .from('unit_location_pings')
      .select('created_at')
      .eq('unit_id', incidentUnit.unit_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setLastPing(data.created_at) })
  }, [incidentUnit?.unit_id])

  const doPost = async (pos: GeolocationPosition) => {
    if (!incidentUnit?.unit_id || !incidentUnit?.incident_id || !employee?.id) return
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) return
    await fetch('/api/location/ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        unit_id: incidentUnit.unit_id,
        incident_id: incidentUnit.incident_id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
        heading: pos.coords.heading ?? undefined,
        speed: pos.coords.speed ?? undefined,
        source: 'manual',
      }),
    })
    setLastPing(new Date().toISOString())
  }

  const requestAndPing = () => {
    setPinging(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPermState('granted')
        await doPost(pos)
        setPinging(false)
      },
      (err) => {
        if (err.code === 1) setPermState('denied')
        setPinging(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const pingNow = () => {
    setPinging(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await doPost(pos); setPinging(false) },
      () => setPinging(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  if (permState === 'unsupported') return null

  return (
    <section className="bg-gray-800/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📍</span>
        <h2 className="text-base font-semibold text-white">Location Sharing</h2>
      </div>

      {!hasAssignment ? (
        <p className="text-sm text-gray-500">No active unit assignment — location sharing is only available when assigned to an incident.</p>
      ) : permState === 'denied' ? (
        <div className="space-y-2">
          <p className="text-sm text-red-400">Location access is blocked. To enable it, go to your browser or device settings and allow location for this site.</p>
        </div>
      ) : permState === 'granted' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Location sharing is <span className="text-green-400 font-medium">active</span></p>
              {lastPing && (
                <p className="text-xs text-gray-500 mt-0.5">Last ping: {relativeTime(lastPing)}</p>
              )}
            </div>
            <button
              onClick={pingNow}
              disabled={pinging}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
            >
              {pinging ? 'Pinging…' : 'Ping now'}
            </button>
          </div>
          <p className="text-xs text-gray-600">Your location is shared with incident commanders every 15 minutes while you have an active assignment.</p>
        </div>
      ) : (
        // prompt state — permission not yet requested
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Share your location so incident commanders can see your unit on the live map.</p>
          <button
            onClick={requestAndPing}
            disabled={pinging}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pinging ? 'Getting location…' : 'Enable Location Sharing'}
          </button>
        </div>
      )}
    </section>
  )
}
