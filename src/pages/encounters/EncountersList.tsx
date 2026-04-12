
import { FieldGuard } from '@/components/FieldGuard'

import { useEffect, useState, Suspense } from 'react'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { unitFilterButtonClass, UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { getCachedData, cacheData } from '@/lib/offlineStore'

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
  if (acuity.startsWith('Green') || acuity.startsWith('Lower')) return 'Minimal'
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
  if (unitName.startsWith('RAMBO')) return 'Ambulance'
  if (unitName.startsWith('MSU') || unitName === 'The Beast') return 'Med Unit'
  if (unitName.startsWith('REMS')) return 'REMS'
  if (unitName === 'Warehouse') return 'Warehouse'
  return ''
}

// All known unit names in canonical sort order
const ALL_UNIT_NAMES = ['RAMBO 1', 'RAMBO 2', 'RAMBO 3', 'RAMBO 4', 'MSU 1', 'MSU 2', 'The Beast', 'REMS 1', 'REMS 2']

const sortedUnitNames = [...ALL_UNIT_NAMES].sort((a, b) => {
  const aOrder = UNIT_TYPE_ORDER[getUnitType(a)] ?? 99
  const bOrder = UNIT_TYPE_ORDER[getUnitType(b)] ?? 99
  if (aOrder !== bOrder) return aOrder - bOrder
  return a.localeCompare(b)
})

function EncountersInner() {
  const supabase = createClient()
  const { isField, loading: roleLoading } = useRole()
  const assignment = useUserAssignment()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const incidentId = searchParams.get('incidentId')
  const success = searchParams.get('success')

  const [encounters, setEncounters] = useState<Encounter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [unitFilter, setUnitFilter] = useState('All')
  const [incidentFilter, setIncidentFilter] = useState('All')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState('7d')
  const [isOffline, setIsOffline] = useState(false)

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 86400000).toISOString().split('T')[0]

  // Track connection state
  useEffect(() => {
    setIsOffline(!getIsOnline())
    return onConnectionChange((online) => setIsOffline(!online))
  }, [])

  // Load active incidents for admin filter pills
  useEffect(() => {
    if (isField || roleLoading) return
    supabase.from('incidents').select('id, name').eq('status', 'Active').order('name')
      .then(({ data }) => { if (data) setActiveIncidents(data) })
  }, [isField, roleLoading])

  useEffect(() => {
    // Wait for assignment to finish loading before querying, so field filters are applied
    if (roleLoading || assignment.loading) return
    const load = async () => {
      // Show cached data instantly while network loads
      try {
        const cached = await getCachedData('encounters') as any[]
        if (cached.length > 0) {
          const mapped = cached.map((e: any) => ({ ...e, incident_name: e.incident?.name || e.incident_name || null }))
          mapped.sort((a: any, b: any) => (b.date || b.created_at || '').localeCompare(a.date || a.created_at || ''))
          setEncounters(dateFilter ? mapped.filter((e: any) => (e.date || '') >= dateFilter) : mapped)
          setLoading(false)
        }
      } catch {}
      // Fetch fresh data from network (background refresh)
      try {
        let query = supabase
          .from('patient_encounters')
          .select('id, encounter_id, date, unit, patient_first_name, patient_last_name, patient_dob, primary_symptom_text, initial_acuity, patient_disposition, pcr_status, provider_of_record, incident:incidents(name)')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })

        const fieldIncidentId = incidentId || (isField ? assignment.incidentUnit?.incident_id : null)
        if (fieldIncidentId) query = query.eq('incident_id', fieldIncidentId)
        else if (!isField && incidentFilter !== 'All') query = query.eq('incident_id', incidentFilter)
        if (isField && assignment.unit?.name) query = (query as any).eq('unit', assignment.unit.name)
        if (dateFilter) query = query.gte('date', dateFilter)

        const { data, error } = await query.limit(2000)
        if (error) throw error
        if (data) {
          const mapped = data.map((e: any) => ({ ...e, incident_name: e.incident?.name || e.incident_name || null }))
          mapped.sort((a: any, b: any) => (b.date || b.created_at || '').localeCompare(a.date || a.created_at || ''))
          setEncounters(mapped)
          // Cache the unfiltered results for offline
          await cacheData('encounters', data).catch(() => {})
        }
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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">Patient Encounters</h1>
            <p className="text-gray-500 text-xs">{filtered.length} records</p>
          </div>
          <Link to="/encounters/new"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
            + New
          </Link>
        </div>

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
          <>
            {/* Desktop: unit pills */}
            <div className="hidden md:flex gap-1.5 overflow-x-auto pb-1">
              {['All', ...sortedUnitNames].map(u => (
                <button key={u} onClick={() => { setUnitFilter(u); setPage(1) }}
                  className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors
                    ${unitFilterButtonClass(getUnitType(u), unitFilter === u)}`}>
                  {u}
                </button>
              ))}
            </div>
            {/* Mobile: unit dropdown */}
            <select
              value={unitFilter}
              onChange={e => { setUnitFilter(e.target.value); setPage(1) }}
              className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {['All', ...sortedUnitNames].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </>
        )}

        {/* Date range filter pills */}
        <div className="hidden md:flex gap-1.5">
          {(['7d', '30d', '90d', 'All'] as const).map(range => (
            <button key={range} onClick={() => { setDateRange(range); setPage(1) }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>
        {/* Mobile: date range dropdown */}
        <select
          value={dateRange}
          onChange={e => { setDateRange(e.target.value); setPage(1) }}
          className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="90d">90 Days</option>
          <option value="All">All Time</option>
        </select>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, unit, complaint..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
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

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-4xl mb-4">📋</p>
            <p>{search || unitFilter !== 'All' ? 'No matches found.' : 'No encounters yet.'}</p>
          </div>
        ) : (
          <>
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              {/* Header */}
              <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700">
                <span className="w-24 shrink-0">Date</span>
                <span className="w-20 shrink-0">Patient</span>
                <span className="w-20 hidden sm:block shrink-0">DOB</span>
                <span className="w-32 hidden sm:block shrink-0">Incident</span>
                <span className="w-28 hidden md:block shrink-0">Unit</span>
                <span className="flex-1 hidden lg:block min-w-0">Chief Complaint</span>
                <span className="w-20 shrink-0 text-right">Acuity</span>
                <span className="w-24 shrink-0 text-right">Status</span>
              </div>
              {paginated.map(enc => (
                <div
                  key={enc.id}
                  onClick={() => navigate(`/encounters/${enc.id}`)}
                  className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 text-sm"
                >
                  <span className="w-24 shrink-0 text-gray-400 text-xs">{enc.date || '—'}</span>
                  <span className="w-20 shrink-0 font-medium truncate pr-2">
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
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <EncountersInner />
    </Suspense>
  )
}

export default function EncountersPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => a.incidentUnit?.incident_id ? `/encounters?incidentId=${a.incidentUnit.incident_id}` : null}>
      <EncountersPageInner />
    </FieldGuard>
  )
}
