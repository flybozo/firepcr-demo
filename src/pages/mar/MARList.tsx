
import { FieldGuard } from '@/components/FieldGuard'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { unitFilterButtonClass, UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { getCachedData, cacheData } from '@/lib/offlineStore'
import { loadList } from '@/lib/offlineFirst'

type MAREntry = {
  id: string
  date: string
  time: string | null
  patient_name: string | null
  item_name: string | null
  qty_used: number | null
  medication_route: string | null
  dosage_units: string | null
  med_unit: string | null
  incident: string | null
  dispensed_by: string | null
  item_type: string | null
  entry_type: string | null
  requires_cosign: boolean | null
  provider_signature_url: string | null
}

const TYPE_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
}

function getUnitType(name: string): string {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.startsWith('rambo')) return 'Ambulance'
  if (n.startsWith('msu') || n === 'the beast') return 'Med Unit'
  if (n.startsWith('rems')) return 'REMS'
  return 'Warehouse'
}

function getStatusBadge(entry: MAREntry) {
  if (entry.requires_cosign && !entry.provider_signature_url) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 whitespace-nowrap">
        ⚠ Unsigned
      </span>
    )
  }
  if (entry.provider_signature_url?.startsWith('digital:')) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 whitespace-nowrap">
        ✓ Signed (digital)
      </span>
    )
  }
  if (entry.provider_signature_url) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 whitespace-nowrap">
        ✓ Signed
      </span>
    )
  }
  return null
}

function getRouteAbbr(route: string | null): string | null {
  if (!route) return null
  const abbrs: Record<string, string> = {
    'Intravenous (IV)': 'IV',
    'Intramuscular (IM)': 'IM',
    'Oral': 'PO',
    'Intranasal': 'IN',
    'Subcutaneous': 'SQ',
    'Intraosseous (IO)': 'IO',
    'Inhalation': 'Inh',
    'Nebulizer': 'Neb',
    'Sublingual': 'SL',
    'Topical': 'Top',
    'Endotracheal Tube (ET)': 'ET',
    'CPAP': 'CPAP',
    'BVM': 'BVM',
    'Auto Injector': 'Auto',
    'Other/miscellaneous': 'Other',
  }
  return abbrs[route] || route
}

function MARListInner() {
  const supabase = createClient()
  const { isField, loading: roleLoading } = useRole()
  const assignment = useUserAssignment()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const unitParam = searchParams.get('unit')
  const success = searchParams.get('success')

  const [entries, setEntries] = useState<MAREntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [unitFilter, setUnitFilter] = useState('All')
  const [incidentFilter, setIncidentFilter] = useState('All')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])

  useEffect(() => {
    setIsOffline(!getIsOnline())
    return onConnectionChange((online) => setIsOffline(!online))
  }, [])

  useEffect(() => {
    if (roleLoading || assignment.loading) return
    const load = async () => {
      // Load incidents for filter
      if (!isField) {
        const incResult = await loadList(
          async () => supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
          'incidents'
        )
        setActiveIncidents(incResult.data as any[])
      }
      // Load MAR entries
      const { data, offline } = await loadList(
        async () => {
          let query = supabase
            .from('dispense_admin_log')
            .select('id, date, time, patient_name, dob, item_name, qty_used, medication_route, dosage_units, med_unit, dispensed_by, item_type, entry_type, requires_cosign, provider_signature_url, incident')
            .order('date', { ascending: false })
          const effectiveUnit = unitParam || (isField ? assignment.unit?.name : null)
          if (effectiveUnit) query = query.eq('med_unit', effectiveUnit)
          return query.limit(200)
        },
        'mar_entries'
      )
      setEntries(data as MAREntry[])
      if (offline) setIsOffline(true)
      setLoading(false)
    }
    load()
  }, [isField, assignment.loading, assignment.unit?.name, unitParam, incidentFilter])

  // Distinct unit names sorted by type order
  const unitNames = Array.from(
    new Set(entries.map(e => e.med_unit).filter(Boolean) as string[])
  ).sort((a, b) => {
    const aOrder = UNIT_TYPE_ORDER[getUnitType(a)] ?? 99
    const bOrder = UNIT_TYPE_ORDER[getUnitType(b)] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })

  const filtered = entries.filter(e => {
    if (unitFilter !== 'All' && e.med_unit !== unitFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      e.patient_name?.toLowerCase().includes(s) ||
      e.item_name?.toLowerCase().includes(s) ||
      e.dispensed_by?.toLowerCase().includes(s)
    )
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">💊 MAR</h1>
            <p className="text-gray-500 text-xs">Medication Administration Record · {entries.length} entries</p>
          </div>
          <Link to="/mar/new"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
            + New
          </Link>
        </div>

        {isOffline && (
          <div className="bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
            📶 <span>Offline — showing cached data. New entries will sync when you reconnect.</span>
          </div>
        )}

        {success && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm">
            ✅ Medication administration recorded successfully.
          </div>
        )}

        <input
          type="text"
          placeholder="Search patient or medication..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-gray-500">Date:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
          <span className="text-xs text-gray-500">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }}
              className="text-xs text-gray-500 hover:text-gray-300">✕ Clear</button>
          )}
        </div>

        {/* Unit filter buttons — hidden/locked for field users */}
        {/* Incident filter pills — admin only */}
        {!isField && activeIncidents.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setIncidentFilter('All')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${incidentFilter === 'All' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              All Incidents
            </button>
            {activeIncidents.map((inc, i) => (
              <button key={inc.id} onClick={() => setIncidentFilter(inc.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  incidentFilter === inc.id
                    ? ['bg-teal-700 text-white','bg-amber-700 text-white','bg-indigo-700 text-white'][i % 3]
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                🔥 {inc.name}
              </button>
            ))}
          </div>
        )}
        {unitNames.length > 0 && !isField && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setUnitFilter('All')}
              className={'px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ' + unitFilterButtonClass('All', unitFilter === 'All')}
            >
              All
            </button>
            {unitNames.map(u => (
              <button
                key={u}
                onClick={() => setUnitFilter(u)}
                className={'px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ' + unitFilterButtonClass(getUnitType(u), unitFilter === u)}
              >
                {u}
              </button>
            ))}
          </div>
        )}
        {isField && assignment.unit?.name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Showing:</span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit.name}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? 'No results found.' : 'No entries recorded yet.'}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            {/* Header */}
            <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700">
              <span className="w-24 shrink-0">Date</span>
              <span className="w-16 shrink-0">Patient</span>
              <span className="w-20 shrink-0 hidden sm:block">DOB</span>
              <span className="flex-1 min-w-0">Medication · Route</span>
              <span className="w-16 shrink-0 text-center">Qty</span>
              <span className="w-32 shrink-0 hidden md:block">Incident</span>
              <span className="w-20 shrink-0 hidden sm:block">Unit</span>
              <span className="w-16 shrink-0 hidden md:block">Type</span>
              <span className="w-32 shrink-0 text-right">Status</span>
            </div>
            {filtered.map(entry => (
              <div
                key={entry.id}
                onClick={() => navigate(`/mar/${entry.id}`)}
                className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 text-sm"
              >
                <span className="w-24 shrink-0 text-gray-400 text-xs">{entry.date || '—'}</span>
                <span className="w-16 shrink-0 font-medium pr-1">
                  {entry.patient_name
                    ? entry.patient_name.split(/[, ]+/).filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    : '—'}
                </span>
                <span className="w-20 shrink-0 hidden sm:block text-gray-400 text-xs pr-2">{(entry as any).dob || '—'}</span>
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-gray-300 text-xs">
                    {entry.item_name || '—'}
                    {entry.medication_route && (
                      <span className="text-gray-500"> — {getRouteAbbr(entry.medication_route)}</span>
                    )}
                  </span>
                </div>
                <span className="w-16 shrink-0 text-center font-mono text-white text-xs">
                  {entry.qty_used !== null
                    ? `×${entry.qty_used}${entry.dosage_units ? ' ' + entry.dosage_units : ''}`
                    : '—'}
                </span>
                <span className="w-32 shrink-0 text-gray-400 text-xs truncate hidden md:block">{entry.incident || '—'}</span>
                <span className="w-20 shrink-0 text-gray-400 text-xs truncate hidden sm:block">{entry.med_unit || '—'}</span>
                <span className="w-16 shrink-0 hidden md:block">
                  {entry.item_type ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[entry.item_type] || 'bg-gray-700 text-gray-300'}`}>
                      {entry.item_type}
                    </span>
                  ) : <span className="text-gray-600">—</span>}
                </span>
                <span className="w-32 shrink-0 text-right">
                  {getStatusBadge(entry)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && filtered.length < entries.length && (
          <p className="text-center text-gray-600 text-xs">Showing {filtered.length} of {entries.length}</p>
        )}

        <Link to="/" className="block text-center text-gray-600 text-sm">← Home</Link>
      </div>
    </div>
  )
}

function MARPageInner() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading MAR...</p>
      </div>
    }>
      <MARListInner />
    </Suspense>
  )
}

export default function MARPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => a.unit?.name ? `/mar?unit=${encodeURIComponent(a.unit.name)}` : null}>
      <MARPageInner />
    </FieldGuard>
  )
}
