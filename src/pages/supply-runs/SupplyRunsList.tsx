
import { FieldGuard } from '@/components/FieldGuard'
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState, useMemo } from 'react'
import { PageHeader, EmptyState, LoadingSkeleton, UnitFilterPills, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { fmtDateCompact } from '@/utils/dateFormatters'
import { getUnitTypeName } from '@/lib/unitColors'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { getCachedData } from '@/lib/offlineStore'
import { Link } from 'react-router-dom'
import { useNavigate, useMatch } from 'react-router-dom'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

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
  const roleLoading = usePermissionLoading()
  const isField = !usePermission('supply_runs.view')
  const [incidentFilter, setIncidentFilter] = useState('All')
  const [activeIncidents, setActiveIncidents] = useState<{id:string;name:string}[]>([])
  const assignment = useUserAssignment()
  const incidentIdParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('incidentId') : null
  const navigate = useNavigate()
  const detailMatch = useMatch('/supply-runs/:id')
  const [runs, setRuns] = useState<SupplyRun[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [unitFilter, setUnitFilter] = useState('All')
  const [search, setSearch] = useState('')
  // Full-history search
  const [historySearch, setHistorySearch] = useState('')
  const [historyResults, setHistoryResults] = useState<SupplyRun[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [dateRange, setDateRange] = useState('7d')
  type SRSortKey = 'run_date' | 'unit' | 'incident'
  const { sortKey: srSortKey, sortDir: srSortDir, toggleSort: srToggleSort, sortFn: srSortFn } = useSortable<SRSortKey>('run_date', 'desc')
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const DATE_RANGES = ['2d', '7d', '14d', '30d'] as const
  const dateRangeDays: Record<string, number> = { '2d': 2, '7d': 7, '14d': 14, '30d': 30 }

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

  // eslint-disable-next-line react-hooks/purity
  const dateFilterNow = useMemo(() => Date.now(), [dateRange])
  const dateFilter = new Date(dateFilterNow - (dateRangeDays[dateRange] ?? 7) * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    const load = async () => {
      // Show cached data only when offline
      if (!navigator.onLine) {
        try {
          const cached = await getCachedData('supply_runs') as any[]
          if (cached.length > 0) {
            setRuns(cached as SupplyRun[])
            setIsOfflineData(true)
            setLoading(false)
            return
          }
        } catch {}
        setLoading(false)
        return
      }
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
        setRuns(sorted)
        setIsOfflineData(offline)
      } catch {
        const cached = await getCachedData('supply_runs')
        if (cached.length > 0) {
          setRuns(cached as SupplyRun[])
          // Only show offline banner if actually offline — don't show for query errors
          setIsOfflineData(typeof navigator !== 'undefined' && !navigator.onLine)
        }
      }
      setLoading(false)
    }
    if (roleLoading || assignment.loading) return
    load()

    // Re-fetch when coming back online to clear stale banner
    const handleOnline = () => { load() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [isField, assignment.loading, assignment.incidentUnit?.incident_id, incidentIdParam, incidentFilter, dateRange])

  const units = ['All', ...Array.from(new Set(
    runs.map(r => (r.incident_unit as any)?.unit?.name).filter(Boolean)
  )).sort()]

  const baseFiltered = runs.filter(r => {
    const unitName = (r.incident_unit as any)?.unit?.name
    if (isField && assignment.unit?.name && unitName !== assignment.unit.name) return false
    if (!isField && unitFilter !== 'All' && unitName !== unitFilter) return false
    if (search && !historyResults) {
      const q = search.toLowerCase()
      const matchUnit = unitName?.toLowerCase().includes(q)
      const matchInc = (r.incident as any)?.name?.toLowerCase().includes(q)
      const matchRes = r.resource_number?.toLowerCase().includes(q)
      const matchBy = r.dispensed_by?.toLowerCase().includes(q)
      if (!matchUnit && !matchInc && !matchRes && !matchBy) return false
    }
    return true
  })

  const displayList = historyResults ?? baseFiltered

  const filtered = srSortFn(displayList, (r, key) => {
    if (key === 'run_date') return r.run_date ?? ''
    if (key === 'unit') return (r.incident_unit as any)?.unit?.name ?? ''
    if (key === 'incident') return (r.incident as any)?.name ?? ''
    return ''
  })

  return (
    <div className="p-4 md:p-6">
      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-4 flex items-center gap-2">
          📶 Showing cached data — changes will sync when back online
        </div>
      )}
      <PageHeader
        title="Supply Runs"
        subtitle={historyResults ? `🔍 ${historyResults.length} across all time` : `${filtered.length} of ${runs.length} runs`}
        actions={
          <Link to="/supply-runs/new" className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">+ New Run</Link>
        }
        className="mb-4 mt-8 md:mt-0"
      />

      {/* Inline search bar */}
      <div className="relative mb-3">
        <input
          value={historySearch || search}
          onChange={e => {
            const v = e.target.value
            setSearch(v)
            if (historyResults) { setHistoryResults(null); setHistorySearch('') }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && search.trim()) {
              setHistorySearch(search.trim())
              setHistoryLoading(true)
              const q = search.trim()
              supabase
                .from('supply_runs')
                .select(`
                  id, run_date, time, resource_number, dispensed_by, notes, incident_id,
                  incident_unit:incident_units(unit:units(name)),
                  incident:incidents(name)
                `)
                .or(`resource_number.ilike.%${q}%,dispensed_by.ilike.%${q}%`)
                .order('run_date', { ascending: false })
                .limit(200)
                .then(({ data }) => {
                  setHistoryResults((data || []) as unknown as SupplyRun[])
                  setHistoryLoading(false)
                })
            }
          }}
          placeholder="Filter current view — or press Enter to search all history…"
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 pr-20"
        />
        {(search || historySearch) && (
          <button onClick={() => { setSearch(''); setHistorySearch(''); setHistoryResults(null) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">✕</button>
        )}
        {historyLoading && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-gray-500">Searching…</span>
        )}
        {historyResults && !historyLoading && (
          <span className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-blue-400">🔍 {historyResults.length} results</span>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-2 mb-4">
        {/* Date range pills */}
        <div className="hidden md:flex gap-1.5">
          {DATE_RANGES.map(range => (
            <button key={range} onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '2d' ? '2 Days' : range === '7d' ? '7 Days' : range === '14d' ? '14 Days' : '30 Days'}
            </button>
          ))}
        </div>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)}
          className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500">
          <option value="2d">2 Days</option>
          <option value="7d">7 Days</option>
          <option value="14d">14 Days</option>
          <option value="30d">30 Days</option>
        </select>
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
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${incidentFilter === inc.id ? ['bg-teal-700 text-white','bg-amber-700 text-white','bg-indigo-700 text-white'][i%3] : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
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
            units={units}
            selected={unitFilter}
            onSelect={setUnitFilter}
            unitTypeMap={Object.fromEntries(units.filter(u => u !== 'All').map(u => [u, getUnitTypeName(u)]))}
          />
        )}
      </div>

      {(loading || historyLoading) ? (
        <LoadingSkeleton rows={5} header />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🚚" message={historyResults ? 'No supply runs found across all history.' : search || unitFilter !== 'All' ? 'No matching supply runs.' : 'No supply runs yet.'} />
      ) : (
        <div className={`${lc.container} overflow-x-auto`}>
          {/* Header */}
          <div className={`flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide ${lc.header} min-w-[540px]`}>
            <SortableHeader label="Date" sortKey="run_date" currentKey={srSortKey} currentDir={srSortDir} onToggle={srToggleSort} className="w-24 shrink-0" />
            <SortableHeader label="Unit" sortKey="unit" currentKey={srSortKey} currentDir={srSortDir} onToggle={srToggleSort} className="w-28 shrink-0" />
            <SortableHeader label="Incident" sortKey="incident" currentKey={srSortKey} currentDir={srSortDir} onToggle={srToggleSort} className="flex-1 min-w-[100px]" />
            <span className="w-28 shrink-0 text-gray-500">Resource #</span>
            <span className="w-28 shrink-0 text-gray-500">Dispensed By</span>
          </div>
          <div>
            {filtered.map(run => {
              const unitName = (run.incident_unit as any)?.unit?.name
              const incName = (run.incident as any)?.name
              return (
                <div key={run.id}
                  onClick={() => navigate(`/supply-runs/${run.id}`)}
                  className={`flex items-center px-4 py-2 cursor-pointer text-sm min-w-[540px] ${lc.rowCls(detailMatch?.params?.id === run.id)}`}>
                  <span className="w-24 shrink-0 text-xs text-gray-300 font-mono">{fmtDateCompact(run.run_date)}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-400 truncate pr-2">{unitName || '—'}</span>
                  <span className="flex-1 min-w-[100px] text-xs text-white truncate pr-2">{incName || '—'}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-500 truncate pr-2">{run.resource_number || '—'}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-500 truncate">{run.dispensed_by || '—'}</span>
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
    <FieldGuard redirectFn={(a) => {
      if (window.location.pathname.match(/\/supply-runs\/.+/)) return null
      return a.incidentUnit?.incident_id ? `/supply-runs?incidentId=${a.incidentUnit.incident_id}` : null
    }}>
      <SupplyRunsPageInner />
    </FieldGuard>
  )
}
