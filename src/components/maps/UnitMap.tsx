import { useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip, Popup, GeoJSON, useMap } from 'react-leaflet'
import { createClient } from '@/lib/supabase/client'

// Fix Leaflet default marker icon (not used directly but prevents console errors)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const MT_SHASTA: [number, number] = [41.3098, -122.3108]

const UNIT_TYPE_COLORS: Record<string, string> = {
  'Ambulance': '#ef4444',
  'Med Unit': '#3b82f6',
  'REMS': '#22c55e',
  'Warehouse': '#a855f7',
}

const UNIT_TYPE_EMOJI: Record<string, string> = {
  'Ambulance': '🚑',
  'Med Unit': '🚐',
  'REMS': '👷',
  'Warehouse': '🏚️',
}

function createUnitIcon(unitType: string) {
  const color = UNIT_TYPE_COLORS[unitType] ?? '#6b7280'
  const emoji = UNIT_TYPE_EMOJI[unitType] ?? '🚗'
  return L.divIcon({
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:36px;height:36px;border-radius:50%;
      background:${color};border:3px solid rgba(255,255,255,0.95);
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      font-size:18px;line-height:1;
    ">${emoji}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

type UnitLocation = {
  unit_id: string
  unit_name: string
  unit_type: string
  latitude: number
  longitude: number
  accuracy_meters: number | null
  heading: number | null
  last_seen: string
  reporter_name: string | null
}

type IncidentLocation = {
  incident_id: string
  incident_name: string
  unit_id: string
  unit_name: string
  unit_type: string
  latitude: number
  longitude: number
  last_seen: string
}

// Module-level NIFC perimeter cache
let nifcCache: { geojson: any; ts: number } | null = null
const NIFC_CACHE_MS = 15 * 60 * 1000
const NIFC_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?where=1%3D1&outFields=poly_IncidentName,poly_GISAcres,poly_DateCurrent&f=geojson&resultRecordCount=500'

async function fetchNIFCPerimeters(): Promise<any | null> {
  if (nifcCache && Date.now() - nifcCache.ts < NIFC_CACHE_MS) return nifcCache.geojson
  try {
    const res = await fetch(NIFC_URL)
    if (!res.ok) return nifcCache?.geojson ?? null
    const data = await res.json()
    nifcCache = { geojson: data, ts: Date.now() }
    return data
  } catch {
    return nifcCache?.geojson ?? null
  }
}

function FitBoundsToLocations({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 13)
      return
    }
    try {
      map.fitBounds(L.latLngBounds(positions), { padding: [50, 50], maxZoom: 15 })
    } catch {}
  }, [positions, map]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function formatLastSeen(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export interface UnitMapProps {
  incidentId?: string
  prefetchedLocations?: UnitLocation[]
  accessCode?: string
  height?: string
  className?: string
}

export default function UnitMap({ incidentId, prefetchedLocations, accessCode, height = '400px', className }: UnitMapProps) {
  const [unitLocations, setUnitLocations] = useState<UnitLocation[]>(prefetchedLocations ?? [])
  const [globalLocations, setGlobalLocations] = useState<IncidentLocation[]>([])
  const [nifcData, setNifcData] = useState<any | null>(null)
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (accessCode) {
        // External dashboard — poll via access-code-authenticated endpoint
        try {
          const res = await fetch(`/api/incident-access/locations?code=${encodeURIComponent(accessCode)}`)
          if (res.ok) {
            const json = await res.json()
            if (mounted) setUnitLocations(json.locations ?? [])
          }
        } catch {}
      } else if (incidentId) {
        const { data } = await supabase.rpc('get_unit_locations', { p_incident_id: incidentId })
        if (mounted) setUnitLocations((data as UnitLocation[]) ?? [])
      } else {
        const { data } = await supabase.rpc('get_all_incident_locations')
        if (mounted) setGlobalLocations((data as IncidentLocation[]) ?? [])
      }

      const nifc = await fetchNIFCPerimeters()
      if (mounted && nifc) setNifcData(nifc)
    }

    load()
    const interval = setInterval(load, 30_000) // 30s refresh on map
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [incidentId, accessCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const markers = incidentId ? unitLocations : globalLocations
  const positions: [number, number][] = markers.map(m => [m.latitude, m.longitude] as [number, number])

  return (
    <div style={{ height, position: 'relative' }} className={className}>
      <MapContainer
        center={MT_SHASTA}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"
          attribution='Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
          maxZoom={16}
          errorTileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {nifcData && (
          <GeoJSON
            key={nifcData.features?.length ?? 0}
            data={nifcData}
            style={{
              color: '#ff4500',
              fillColor: '#ff6b35',
              fillOpacity: 0.15,
              weight: 2,
              opacity: 0.8,
            }}
            onEachFeature={(feature, layer) => {
              const p = feature.properties
              if (p?.poly_IncidentName) {
                layer.bindTooltip(
                  `${p.poly_IncidentName}${p.poly_GISAcres ? ` — ${Math.round(p.poly_GISAcres).toLocaleString()} ac` : ''}`,
                  { sticky: true }
                )
              }
            }}
          />
        )}

        <FitBoundsToLocations positions={positions} />

        {incidentId
          ? unitLocations.map(loc => (
              <Marker
                key={loc.unit_id}
                position={[loc.latitude, loc.longitude]}
                icon={createUnitIcon(loc.unit_type)}
              >
                <Tooltip permanent direction="top" offset={[0, -20]}>
                  <div style={{fontSize:'13px',lineHeight:'1.5'}}>
                    <strong>{loc.unit_name}</strong><br/>
                    <span style={{color:'#888',fontSize:'11px'}}>Last ping: {formatLastSeen(loc.last_seen)}</span><br/>
                    <span style={{color:'#aaa',fontSize:'11px'}}>{new Date(loc.last_seen).toLocaleString()}</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="text-sm space-y-0.5 min-w-[160px]">
                    <div className="font-semibold text-gray-900">{loc.unit_name}</div>
                    <div className="text-gray-500">{loc.unit_type}</div>
                    <div className="text-gray-500">Last seen: {formatLastSeen(loc.last_seen)}</div>
                    {loc.reporter_name && (
                      <div className="text-gray-500">Reporter: {loc.reporter_name}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))
          : globalLocations.map(loc => (
              <Marker
                key={`${loc.incident_id}-${loc.unit_id}`}
                position={[loc.latitude, loc.longitude]}
                icon={createUnitIcon(loc.unit_type)}
              >
                <Tooltip permanent direction="top" offset={[0, -20]}>
                  <div style={{fontSize:'13px',lineHeight:'1.5'}}>
                    <strong>{loc.unit_name}</strong><br/>
                    <span style={{color:'#666',fontSize:'11px'}}>{loc.incident_name}</span><br/>
                    <span style={{color:'#888',fontSize:'11px'}}>Last ping: {formatLastSeen(loc.last_seen)}</span><br/>
                    <span style={{color:'#aaa',fontSize:'11px'}}>{new Date(loc.last_seen).toLocaleString()}</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="text-sm space-y-0.5 min-w-[160px]">
                    <div className="font-semibold text-gray-900">{loc.unit_name}</div>
                    <div className="text-gray-500">{loc.unit_type}</div>
                    <div className="text-gray-400 text-xs">{loc.incident_name}</div>
                    <div className="text-gray-500">Last seen: {formatLastSeen(loc.last_seen)}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white border border-gray-700 shadow-lg">
        <div className="font-semibold text-gray-300 mb-1.5">Unit Types</div>
        {Object.entries(UNIT_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 mb-0.5">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1.5px solid rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <span className="text-gray-400">{type}</span>
          </div>
        ))}
      </div>

      {/* NIFC fire perimeter indicator */}
      {nifcData && (
        <div className="absolute bottom-6 right-3 z-[1000] bg-gray-900/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs text-orange-300 border border-orange-800/60 shadow-lg">
          <div className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, background: '#ff6b35', opacity: 0.7, border: '1.5px solid #ff4500', flexShrink: 0 }} />
            <span>NIFC Fire Perimeters</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {positions.length === 0 && (
        <div className="absolute inset-0 z-[900] flex items-end justify-center pb-20 pointer-events-none">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl px-5 py-3 border border-gray-700 text-center">
            <p className="text-gray-400 text-sm">No units have reported locations yet.</p>
            <p className="text-gray-600 text-xs mt-0.5">Map centered on Mt. Shasta</p>
          </div>
        </div>
      )}
    </div>
  )
}
