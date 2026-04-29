
import { FieldGuard } from '@/components/FieldGuard'

import { useEffect, useState, Suspense } from 'react'
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { queryActiveIncidentsForEncounters } from '@/lib/services/encounters'
import { PageHeader, EmptyState, LoadingSkeleton, UnitFilterPills, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { fmtDateCompact } from '@/utils/dateFormatters'
import { useNavigate, useSearchParams, useMatch, useLocation } from 'react-router-dom'
import { UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { getCachedData, cacheData } from '@/lib/offlineStore'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

const PAGE_SIZE = 50

type Encounter = {
  id: string
  encounter_id: string
  date: string
  unit: string
  patient_first_name: string | null
  patient_last_name: string | null
  primary_symptom_text: string | null
  initial_acuity: string | null
  patient_disposition: string | null
  pcr_status: string | null
  provider_of_record: string | null
  incident_name: string | null
}

function acuityColor(acuity: string | null) {
  if (!acuity) return 'bg-gray-700 text-gray-400'
  if (acuity.startsWith('Green')) return 'bg-green-900 text-green-300'
  if (acuity.startsWith('Yellow')) return 'bg-yellow-900 text-yellow-300'
  if (acuity.startsWith('Red') || acuity.startsWith('Critical')) return 'bg-red-900 text-red-300'
  if (acuity.startsWith('Emergent')) return 'bg-yellow-900 text-yellow-300'
  if (acuity.startsWith('Lower')) return 'bg-green-900 text-green-300'
  if (acuity.startsWith('Dead') || acuity.startsWith('Black')) return 'bg-gray-700 text-gray-300'
  return 'bg-blue-900 text-blue-300'
}
function acuityLabel(acuity: string | null) {
  if (!acuity) return '—'
  if (acuity.startsWith('Red') || acuity.startsWith('Critical')) return 'Immediate'
  if (acuity.startsWith('Yellow') || acuity.startsWith('Emergent')) return 'Delayed'
  if (acuity.startsWith('Green') || acuity.startsWith('Lower')) return 'Minor'
  if (acuity.startsWith('Black') || acuity.startsWith('Dead')) return 'Expectant'
  return 'Routine'
}

function statusColor(status: string | null) {
  if (!status) return 'bg-gray-700 text-gray-400'
  if (status === 'Complete') return 'bg-green-900 text-green-300'
  if (status === 'In Progress') return 'bg-yellow-900 text-yellow-300'
  return 'bg-gray-700 text-gray-400'
}

function getUnitType(unitName: string): string {
  if (!unitName) return ''
  if (unitName.startsWith('Medic')) return 'Ambulance'
  if (unitName.startsWith('Aid') || unitName === 'Command 1') return 'Med Unit'
  if (unitName.startsWith('Rescue')) return 'Rescue'
  if (unitName === 'Warehouse') return 'Warehouse'
  return ''
}

// All known unit names in canonical sort order
const ALL_UNIT_NAMES = ['Medic 1', 'Medic 2', 'Medic 3', 'Medic 4', 'Aid 1', 'Aid 2', 'Command 1', 'Rescue 1', 'Rescue 2']

const sortedUnitNames = [...ALL_UNIT_NAMES].sort((a, b) => {
  const aOrder = UNIT_TYPE_ORDER[getUnitType(a)] ?? 99
  const bOrder = UNIT_TYPE_ORDER[getUnitType(b)] ?? 99
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.localeCompare(b)
})
const UNIT_TYPE_MAP = Object.fromEntries(ALL_UNIT_NAMES.map(u => [u, getUnitType(u)]))

function EncountersInner() {
  const supabase = createClient()
  const roleLoading = usePermissionLoading()
  const isField = !usePermission('incidents.manage')
  const assignment = useUserAssignment()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const detailMatch = useMatch('/encounters/:id')
  const incidentId = searchParams.get('incidentId')
  const success = searchParams.get('success') || (location.state as any)?.success

  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState('All')
  const [incidentFilter, setIncidentFilter] = useState('All')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState('7d')
  const [isOffline, setIsOffline] = useState(false)
  // Full-history search
  const [historySearch, setHistorySearch] = useState('')
  const [historyResults, setHistoryResults] = useState<Encounter[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  type EncSortKey = 'date' | 'patient' | 'unit' | 'incident' | 'acuity'
  const { sortKey: encSortKey, sortDir: encSortDir, toggleSort: encToggleSort, sortFn: encSortFn } = useSortable<EncSortKey>('date', 'desc')
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)

  const DATE_RANGES = ['2d', '7d', '14d', '30d'] as const
  const dateRangeDays: Record<string, number> = { '2d': 2, '7d': 7, '14d': 14, '30d': 30 }
  const dateFilter = new Date(Date.now() - (dateRangeDays[dateRange] ?? 7) * 86400000).toISOString().split('T')[0]

  // Track connection state
  useEffect(() => {
    setIsOffline(!getIsOnline())
    return onConnectionChange((online) => setIsOffline(!online))
  }, [])

  // Belt-and-suspenders: Phase 1 cache load should be near-instant, but if
  // IndexedDB somehow hangs, force unblock after 3 s.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000)
    return () => clearTimeout(t)
  }, [])

  // Load active incidents for admin filter pills
  useEffect(() => {
    if (isField || roleLoading) return
    queryActiveIncidentsForEncounters()
      .then(({ data }) => { if (data) setActiveIncidents(data) })
  }, [isField, roleLoading])

  // ── Phase 1: show cache only when offline ──
  useEffect(() => {
    if (!navigator.onLine) {
      const preload = async () => {
        try {
          const cached = await getCachedData('encounters') as any[]
          if (cached.length > 0) {
            const mapped = cached.map((e: any) => ({ ...e, incident_name: e.incident?.name || e.incident_name || null }))
            mapped.sort((a: any, b: any) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''))
            setEncounters(mapped)
          }
        } catch {}
        setLoading(false)
      }
      preload()
    }
  }, [])

  useEffect(() => {
    // Wait for assignment to finish loading before querying, so field filters are applied
    if (roleLoading || assignment.loading) return
    const load = async () => {
      // Fetch fresh data from network (phase 1 already showed cache)
      try {
        let query = supabase
          .from('patient_encounters')
          .select('id, encounter_id, date, created_at, unit, patient_first_name, patient_last_name, patient_dob, primary_symptom_text, initial_acuity, patient_disposition, pcr_status, provider_of_record, incident:incidents(name)')
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        const fieldIncidentId = incidentId || (isField ? assignment.incidentUnit?.incident_id : null)
        if (fieldIncidentId) query = query.eq('incident_id', fieldIncidentId)
        else if (!isField && incidentFilter !== 'All') query = query.eq('incident_id', incidentFilter)
        if (isField && assignment.unit?.name) query = (query as any).eq('unit', assignment.unit.name)
        if (dateFilter) query = query.gte('date', dateFilter)

        const { data, error } = await query.limit(2000)
        if (error) throw error
        // Update encounters — use whatever the network returned (empty is valid for filtered queries)
        const mapped = (data || []).map((e: any) => ({ ...e, incident_name: e.incident?.name || e.incident_name || null }))
        mapped.sort((a: any, b: any) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''))
        setEncounters(mapped)
        if (data && data.length > 0) await cacheData('encounters', data).catch(() => {})
      } catch {
        // Network failed — keep showing cached data (already set above)
        setIsOffline(true)
      }
      setLoading(false)
    }
    load()
  }, [incidentId, isField, assignment.loading, assignment.incidentUnit?.incident_id, incidentFilter, dateRange])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [unitFilter, search, dateRange])

    const filtered = encounters.filter(e => {
    if (unitFilter !== 'All' && e.unit !== unitFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      e.patient_last_name?.toLowerCase().includes(s) ||
      e.patient_first_name?.toLowerCase().includes(s) ||
      e.unit?.toLowerCase().includes(s) ||
      e.primary_symptom_text?.toLowerCase().includes(s) ||
      e.encounter_id?.toLowerCase().includes(s)
    )
  })

  // When full-history search is active, use those results instead of filtered local data
  const displayList = historyResults ?? filtered

  const sorted = encSortFn(displayList, (e, key) => {
    if (key === 'date') return e.date ?? ''
    if (key === 'patient') return `${e.patient_last_name ?? ''}${e.patient_first_name ?? ''}`
    if (key === 'unit') return e.unit ?? ''
    if (key === 'incident') return e.incident_name ?? ''
    if (key === 'acuity') return e.initial_acuity ?? ''
    return ''
  })
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="p-4 md:p-6 space-y-4">
        <PageHeader
          title="Patient Encounters"
          subtitle={`${filtered.length} records`}
          actions={
            <Link to="/encounters/new" className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">+ New</Link>
          }
        />

        {isOffline && (
          <div className="bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
            📶 <span>Offline — showing cached data. New encounters will sync when you reconnect.</span>
          </div>
        )}

        {success && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm">
            ✅ Encounter saved successfully.
          </div>
        )}

        {/* Unit filter buttons — admin only for cross-incident view; field users see all units on their incident */}
        {/* Incident filter pills — admin only */}
        {!isField && activeIncidents.length > 0 && (
          <>
            {/* Desktop: incident pills */}
            <div className="hidden md:flex gap-1.5 flex-wrap">
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
            {/* Mobile: incident dropdown */}
            <select
              value={incidentFilter}
              onChange={e => setIncidentFilter(e.target.value)}
              className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="All">All Incidents</option>
              {activeIncidents.map(inc => (
                <option key={inc.id} value={inc.id}>🔥 {inc.name}</option>
              ))}
            </select>
          </>
        )}
        {!isField && (
          <UnitFilterPills
            units={['All', ...sortedUnitNames]}
            selected={unitFilter}
            onSelect={u => { setUnitFilter(u); setPage(1) }}
            unitTypeMap={UNIT_TYPE_MAP}
          />
        )}

        {/* Date range pills */}
        <div className="hidden md:flex gap-1.5 items-center">
          {DATE_RANGES.map(range => (
            <button key={range} onClick={() => { setDateRange(range); setPage(1) }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '2d' ? '2 Days' : range === '7d' ? '7 Days' : range === '14d' ? '14 Days' : '30 Days'}
            </button>
          ))}
        </div>
        <select
          value={dateRange}
          onChange={e => { setDateRange(e.target.value); setPage(1) }}
          className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="2d">2 Days</option>
          <option value="7d">7 Days</option>
          <option value="14d">14 Days</option>
          <option value="30d">30 Days</option>
        </select>

        {/* Search bar — filters loaded data or searches all history */}
        <div className="relative">
          <input
            value={historySearch || search}
            onChange={e => {
              const v = e.target.value
              setSearch(v); setPage(1)
              // Clear history results when input changes
              if (historyResults) { setHistoryResults(null); setHistorySearch('') }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && search.trim()) {
                // Server-side search across all history
                setHistorySearch(search.trim())
                setHistoryLoading(true)
                const q = search.trim()
                supabase
                  .from('patient_encounters')
                  .select('id, encounter_id, date, unit, patient_first_name, patient_last_name, primary_symptom_text, initial_acuity, pcr_status, provider_of_record, incident:incidents(name)')
                  .is('deleted_at', null)
                  .or(`patient_last_name.ilike.%${q}%,patient_first_name.ilike.%${q}%,primary_symptom_text.ilike.%${q}%,encounter_id.ilike.%${q}%,provider_of_record.ilike.%${q}%`)
                  .order('date', { ascending: false })
                  .limit(200)
                  .then(({ data }) => {
                    setHistoryResults((data || []).map((r: any) => ({ ...r, incident_name: r.incident?.name || null })) as any)
                    setHistoryLoading(false)
                  })
              }
            }}
            placeholder="Filter current view — or press Enter to search all history…"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 pr-20"
          />
          {(search || historySearch) && (
            <button onClick={() => { setSearch(''); setHistorySearch(''); setHistoryResults(null); setPage(1) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">✕</button>
          )}
          {historyResults && (
            <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-blue-400">🔍 {historyResults.length} across all time</span>
          )}
        </div>

        {(loading || historyLoading) ? (
          <LoadingSkeleton rows={5} header />
        ) : displayList.length === 0 ? (
          <EmptyState
            icon="📋"
            message={historyResults ? 'No records found across all history.' : search || unitFilter !== 'All' ? 'No matches found.' : 'No encounters yet.'}
          />
        ) : (
          <>
            <div className={lc.container}>
              {/* Header */}
              <div className={`flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide ${lc.header}`}>
                <SortableHeader label="Date" sortKey="date" currentKey={encSortKey} currentDir={encSortDir} onToggle={encToggleSort} className="w-24 shrink-0" />
                <SortableHeader label="Patient" sortKey="patient" currentKey={encSortKey} currentDir={encSortDir} onToggle={encToggleSort} className="w-20 shrink-0 justify-center" />
                <span className="w-20 hidden sm:block shrink-0 text-gray-500">DOB</span>
                <SortableHeader label="Incident" sortKey="incident" currentKey={encSortKey} currentDir={encSortDir} onToggle={encToggleSort} className="w-32 hidden sm:flex shrink-0" />
                <SortableHeader label="Unit" sortKey="unit" currentKey={encSortKey} currentDir={encSortDir} onToggle={encToggleSort} className="w-28 hidden md:flex shrink-0" />
                <span className="flex-1 hidden lg:block min-w-0 text-gray-500">Chief Complaint</span>
                <SortableHeader label="Acuity" sortKey="acuity" currentKey={encSortKey} currentDir={encSortDir} onToggle={encToggleSort} className="w-20 shrink-0 justify-end" />
                <span className="w-24 shrink-0 text-right text-gray-500">Status</span>
              </div>
              {paginated.map(enc => (
                <div
                  key={enc.id}
                  onClick={() => navigate(`/encounters/${enc.id}`)}
                  className={`flex items-center px-4 py-2.5 cursor-pointer text-sm ${lc.rowCls(detailMatch?.params?.id === enc.id)}`}
                >
                  <span className="w-24 shrink-0 text-gray-400 text-xs">
                    {fmtDateCompact(enc.date)}
                    {(enc as any).created_at && <span className="text-gray-600 ml-1">{new Date((enc as any).created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                  </span>
                  <span className="w-20 shrink-0 font-medium truncate pr-2 text-center">
                    {enc.patient_last_name
                      ? `${(enc.patient_last_name || '')[0] || '?'}${(enc.patient_first_name || '')[0] || '?'}`.toUpperCase()
                      : '—'}
                  </span>
                  <span className="w-20 hidden sm:block shrink-0 text-gray-400 text-xs pr-2">{(enc as any).patient_dob || '—'}</span>
                  <span className="w-32 hidden sm:block shrink-0 text-gray-400 text-xs truncate pr-2">{enc.incident_name || '—'}</span>
                  <span className="w-28 hidden md:block shrink-0 text-gray-400 text-xs truncate pr-2">{enc.unit || '—'}</span>
                  <span className="flex-1 hidden lg:block min-w-0 text-gray-400 text-xs truncate pr-2">
                    {enc.primary_symptom_text || '—'}
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    {enc.initial_acuity ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${acuityColor(enc.initial_acuity)}`}>
                        {acuityLabel(enc.initial_acuity)}
                      </span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </span>
                  <span className="w-24 shrink-0 text-right">
                    {enc.pcr_status ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(enc.pcr_status)}`}>
                        {enc.pcr_status}
                      </span>
                    ) : <span className="text-gray-600 text-xs">—</span>}
                  </span>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {filtered.length} encounters
                </span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">‹ Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                    const pg = start + i
                    return pg <= totalPages ? (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={'px-2 py-1 rounded text-xs transition-colors ' + (pg === page ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
                        {pg}
                      </button>
                    ) : null
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">Next ›</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">»</button>
                </div>
              </div>
            )}
          </>
        )}

        <Link to="/" className="block text-center text-gray-600 text-sm">← Home</Link>
      </div>
    </div>
  )
}

function EncountersPageInner() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <EncountersInner />
    </Suspense>
  )
}

export default function EncountersPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => {
      if (window.location.pathname.match(/\/encounters\/.+/)) return null
      return a.incidentUnit?.incident_id ? `/encounters?incidentId=${a.incidentUnit.incident_id}` : null
    }}>
      <EncountersPageInner />
    </FieldGuard>
  )
}
