import { useEffect, useState } from 'react'

export function LocationEditField({
  value,
  latitude,
  longitude,
  onSave,
  onSaveCoords,
  readOnly = false,
}: {
  value: string | null | undefined
  latitude: number | null | undefined
  longitude: number | null | undefined
  onSave: (key: string, val: string) => void
  onSaveCoords: (lat: number, lng: number, label: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(value ?? '') }, [value])

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave('location', draft)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }

  const useGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported on this device')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lng = parseFloat(pos.coords.longitude.toFixed(6))
        const label = `${lat}, ${lng}`
        setDraft(label)
        setGpsLoading(false)
        onSave('location', label)
        onSave('latitude', String(lat))
        onSave('longitude', String(lng))
        setEditing(false)
      },
      (err) => {
        setGpsLoading(false)
        setGpsError(
          err.code === 1 ? 'Location access denied — check browser permissions' :
          err.code === 2 ? 'Position unavailable — try again' :
          'GPS timed out — try again'
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  // onSaveCoords kept for interface compatibility but GPS saves via onSave directly
  void onSaveCoords

  const hasCoords = latitude != null && longitude != null

  if (readOnly) {
    return (
      <div className="flex flex-col gap-0.5 px-1.5 py-1">
        <span className="text-xs text-gray-500">Location</span>
        <span className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>{value || '—'}</span>
        {hasCoords && (
          <a href={`https://maps.google.com/?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
            📍 {latitude}, {longitude} — Open in Maps
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 px-1.5 py-1">
      <span className="text-xs text-gray-500">Location</span>
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
            placeholder="Type a location or use GPS below"
            className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 min-w-[220px]"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={useGPS}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 rounded-lg text-xs font-semibold transition-colors"
            >
              {gpsLoading ? (
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : '📍'}
              {gpsLoading ? 'Getting GPS...' : 'Use My Location'}
            </button>
            <button type="button" onClick={commit}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold">
              Save
            </button>
            <button type="button" onClick={() => { setDraft(value ?? ''); setEditing(false); setGpsError(null) }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold">
              Cancel
            </button>
          </div>
          {gpsError && <p className="text-xs text-red-400">{gpsError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-white text-left hover:text-red-400 transition-colors group flex items-center gap-1"
        >
          <span>{value || <span className="text-gray-600 italic">Click to add location</span>}</span>
          <span className="text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
        </button>
      )}
      {hasCoords && !editing && (
        <a
          href={`https://maps.google.com/?q=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
        >
          📍 {latitude}, {longitude} — Open in Maps
        </a>
      )}
    </div>
  )
}
