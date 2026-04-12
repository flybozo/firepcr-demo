
import { FieldGuard } from '@/components/FieldGuard'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { getCachedData } from '@/lib/offlineStore'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

type SupplyRun = {
  id: string
  run_date: string
  time: string | null
  resource_number: string | null
  dispensed_by: string | null
  notes: string | null
  incident_id: string | null
  incident_unit: { unit: { name: string } | null } | null
  incident: { name: string } | null
}

function SupplyRunsPageInner() {
  const supabase = createClient()
  const { isField, loading: roleLoading } = useRole()
  const [incidentFilter, setIncidentFilter] = useState('All')
  const [activeIncidents, setActiveIncidents] = useState<{id:string;name:string}[]>([])
  const assignment = useUserAssignment()
  const incidentIdParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('incidentId') : null
  const navigate = useNavigate()
  const [runs, setRuns] = useState<SupplyRun[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [unitFilter, setUnitFilter] = useState('All')
  const [dateRange, setDateRange] = useState('7d')

  // Load active incidents for admin filter pills
  useEffect(() => {
    if (isField) return
    const loadIncidents = async () => {
      const { data } = await loadList<{id:string;name:string}>(
        () => supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
        'incidents'
      )
      if (data.length > 0) setActiveIncidents(data)
    }
    loadIncidents()
  }, [isField])

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    const load = async () => {
      try {
        let query = supabase
          .from('supply_runs')
          .select(`
            id, run_date, time, resource_number, dispensed_by, notes, incident_id,
            incident_unit:incident_units(unit:units(name)),
            incident:incidents(name)
          `)
          .order('run_date', { ascending: false })
        const effectiveIncident = incidentIdParam || (isField ? assignment.incidentUnit?.incident_id : null)
        if (effectiveIncident) query = (query as any).eq('incident_id', effectiveIncident)
        else if (!isField && incidentFilter !== 'All') query = (query as any).eq('incident_id', incidentFilter)
        if (dateFilter) query = (query as any).gte('run_date', dateFilter)
        const { data, offline } = await loadList<SupplyRun>(
          () => (query as any).limit(200),
          'supply_runs'
        )
        const sorted = [...data].sort((a: any, b: any) => (b.run_date || b.created_at || '').localeCompare(a.run_date || a.created_at || ''))
        const dateFiltered = dateFilter ? sorted.filter((r: any) => (r.run_date || '') >= dateFilter) : sorted
        setRuns(dateFiltered)
        if (offline) setIsOfflineData(true)
      } catch {
        const cached = await getCachedData('supply_runs')
        if (cached.length > 0) {
          setRuns(cached as SupplyRun[])
          setIsOfflineData(true)
        }
      }
      setLoading(false)
    }
    if (roleLoading || assignment.loading) return
    load()
  }, [isField, assignment.loading, assignment.incidentUnit?.incident_id, incidentIdParam, incidentFilter, dateRange])

  const units = ['All', ...Array.from(new Set(
    runs.map(r => (r.incident_unit as any)?.unit?.name).filter(Boolean)
  )).sort()]

  const filtered = runs.filter(r => {
    const unitName = (r.incident_unit as any)?.unit?.name
    // Field users: also restrict to their unit's runs
    if (isField && assignment.unit?.name && unitName !== assignment.unit.name) return false
    if (!isField && unitFilter !== 'All' && unitName !== unitFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        r.run_date?.includes(s) ||
        r.resource_number?.toLowerCase().includes(s) ||
        r.dispensed_by?.toLowerCase().includes(s) ||
        (r.incident as any)?.name?.toLowerCase().includes(s) ||
        unitName?.toLowerCase().includes(s)
      )
    }
    return true
  })

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-4 flex items-center gap-2">
          📶 Showing cached data — changes will sync when back online
        </div>
      )}
      <div className="flex items-center justify-between mb-4 mt-8 md:mt-0">
        <div>
          <h1 className="text-xl font-bold">Supply Runs</h1>
          <p className="text-gray-500 text-xs mt-0.5">{filtered.length} of {runs.length} runs</p>
        </div>
        <Link to="/supply-runs/new"
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
          + New Run
        </Link>
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        {/* Date range filter pills */}
        <div className="flex gap-1.5">
          {(['7d', '30d', '90d', 'All'] as const).map(range => (
            <button key={range} onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by date, crew, incident..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600" />
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
        {/* Incident filter pills — admin only */}
        {!isField && activeIncidents.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setIncidentFilter('All')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${incidentFilter === 'All' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              All Incidents
            </button>
            {activeIncidents.map((inc, i) => (
              <button key={inc.id} onClick={() => setIncidentFilter(inc.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${incidentFilter === inc.id ? ['bg-teal-700 text-white','bg-amber-700 text-white','bg-indigo-700 text-white'][i%3] : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                🔥 {inc.name}
              </button>
            ))}
          </div>
        )}
        {!isField && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {units.map(u => (
              <button key={u} onClick={() => setUnitFilter(u)}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                  unitFilter === u ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>{u}</button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🚚</p>
          <p className="text-gray-500 text-sm">{search || unitFilter !== 'All' ? 'No matching supply runs.' : 'No supply runs yet.'}</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800">
            <span className="w-24 shrink-0">Date</span>
            <span className="w-28 shrink-0 hidden sm:block">Unit</span>
            <span className="flex-1 min-w-0">Incident</span>
            <span className="w-32 shrink-0 hidden md:block">Crew Resource #</span>
            <span className="w-28 shrink-0 hidden md:block">Dispensed By</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {filtered.map(run => {
              const unitName = (run.incident_unit as any)?.unit?.name
              const incName = (run.incident as any)?.name
              return (
                <div key={run.id}
                  onClick={() => navigate(`/supply-runs/${run.id}`)}
                  className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer transition-colors text-sm">
                  <span className="w-24 shrink-0 text-xs text-gray-300 font-mono">{run.run_date}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-400 hidden sm:block truncate">{unitName || '—'}</span>
                  <span className="flex-1 min-w-0 text-xs text-white truncate">{incName || '—'}</span>
                  <span className="w-32 shrink-0 text-xs text-gray-500 hidden md:block truncate">{run.resource_number || '—'}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-500 hidden md:block truncate">{run.dispensed_by || '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SupplyRunsPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => a.incidentUnit?.incident_id ? `/supply-runs?incidentId=${a.incidentUnit.incident_id}` : null}>
      <SupplyRunsPageInner />
    </FieldGuard>
  )
}
