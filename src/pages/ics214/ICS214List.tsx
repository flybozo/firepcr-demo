
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { queryActiveIncidentsForEncounters } from '@/lib/services/encounters'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { PageHeader, LoadingSkeleton, EmptyState, UnitFilterPills, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { getUnitTypeName } from '@/lib/unitColors'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type ICS214Row = {
  id: string
  ics214_id: string
  incident_name: string
  unit_name: string
  op_date: string
  op_start: string
  op_end: string
  leader_name: string
  status: 'Open' | 'Closed'
  created_at: string
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function ICS214DetailPanel({ row }: { row: ICS214Row }) {
  const supabase = createClient()
  const [activityCount, setActivityCount] = useState<number | null>(null)
  const [personnelCount, setPersonnelCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [actResult, persResult] = await Promise.all([
        supabase
          .from('ics214_activities')
          .select('id', { count: 'exact', head: true })
          .eq('ics214_id', row.ics214_id),
        supabase
          .from('ics214_personnel')
          .select('id', { count: 'exact', head: true })
          .eq('ics214_id', row.ics214_id),
      ])
      if (cancelled) return
      setActivityCount(actResult.count ?? 0)
      setPersonnelCount(persResult.count ?? 0)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [row.ics214_id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-mono text-gray-500 mb-1">{row.ics214_id}</p>
          <h2 className="text-lg font-bold text-white">{row.unit_name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{row.incident_name || '—'}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
          row.status === 'Open' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
        }`}>
          {row.status}
        </span>
      </div>

      {/* Summary card */}
      <div className="theme-card rounded-xl border p-4 mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">214 Summary</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ['Incident', row.incident_name],
            ['Unit', row.unit_name],
            ['Op Date', row.op_date],
            ['Op Period', `${row.op_start || '—'}–${row.op_end || '—'}`],
            ['Leader', row.leader_name],
            ['Status', row.status],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <span className="text-xs text-gray-500">{label}</span>
              <p className="text-sm text-white">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Counts */}
      {loading ? (
        <div className="mb-5"><LoadingSkeleton rows={2} /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="theme-card rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-white">{activityCount ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Activities</p>
          </div>
          <div className="theme-card rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-white">{personnelCount ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Personnel</p>
          </div>
        </div>
      )}

      {/* Action links */}
      <div className="space-y-2">
        <Link
          to={`/ics214/${row.ics214_id}`}
          className="block w-full text-center py-2.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-colors"
        >
          View Full 214 →
        </Link>
        {row.status === 'Open' && (
          <Link
            to={`/ics214/${row.ics214_id}/activity`}
            className="block w-full text-center py-2.5 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-semibold transition-colors"
          >
            + Activity
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ICS214ListPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment?.employee?.role || '')

  const [rows, setRows] = useState<ICS214Row[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  type ICS214SortKey = 'op_date' | 'unit_name' | 'incident_name'
  const { sortKey: icsSortKey, sortDir: icsSortDir, toggleSort: icsToggleSort, sortFn: icsSortFn } = useSortable<ICS214SortKey>('op_date', 'desc')
  const [unitFilter, setUnitFilter] = useState<string>('All')
  const [incidentFilter, setIncidentFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [dateRange, setDateRange] = useState('7d')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])
  const [units, setUnits] = useState<string[]>([])
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)

  useEffect(() => {
    if (assignment.loading) return
    if (!isAdmin && assignment.unit?.name) {
      setUnitFilter(assignment.unit.name)
    }
  }, [assignment.loading, isAdmin, assignment.unit?.name])

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 86400000).toISOString()

  useEffect(() => {
    if (assignment.loading) return
    load()
  }, [unitFilter, incidentFilter, statusFilter, dateRange, assignment.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true)
    try {
      if (isAdmin && activeIncidents.length === 0) {
        const { data: incs, error: incErr } = await queryActiveIncidentsForEncounters()
        if (incErr) throw incErr
        setActiveIncidents(incs || [])
      }
      let q = supabase
        .from('ics214_headers')
        .select('id, ics214_id, incident_name, unit_name, op_date, op_start, op_end, leader_name, status, created_at')
        .order('created_at', { ascending: false })

      const effectiveUnit = !isAdmin && assignment.unit?.name ? assignment.unit.name : unitFilter
      if (effectiveUnit && effectiveUnit !== 'All') q = q.eq('unit_name', effectiveUnit)
      if (isAdmin && incidentFilter !== 'All') q = (q as any).eq('incident_id', incidentFilter)
      if (statusFilter !== 'All') q = q.eq('status', statusFilter)
      if (dateFilter) q = q.gte('created_at', dateFilter)

      const { data, error } = await q
      if (error) throw error
      const fetchedRows = (data as ICS214Row[]) || []
      fetchedRows.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
      setRows(fetchedRows)
      const allUnits = Array.from(new Set(fetchedRows.map(r => r.unit_name).filter(Boolean)))
      setUnits(allUnits)
    } catch {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('ics214s')
        const sorted = [...cached].sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
        setRows(sorted as ICS214Row[])
      } catch { setRows([]) }
    }
    setLoading(false)
  }

  const sortedRows = icsSortFn(rows, (r, key) => {
    if (key === 'op_date') return r.op_date ?? ''
    if (key === 'unit_name') return r.unit_name ?? ''
    if (key === 'incident_name') return r.incident_name ?? ''
    return ''
  })

  const selectedRow = selectedId ? rows.find(r => r.id === selectedId) ?? null : null

  return (
    <div className="bg-gray-950 text-white h-full flex flex-col">

      {/* Header + filters — full width, flex-shrink-0 */}
      <div className="flex-shrink-0 p-4 md:px-6 md:pt-6 space-y-3">
        <PageHeader
          title="ICS 214 Logs"
          actions={
            <Link
              to="/ics214/new"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
            >
              + New 214
            </Link>
          }
        />

        {/* Date range */}
        <div className="hidden md:flex gap-1.5">
          {(['7d', '30d', '90d', 'All'] as const).map(range => (
            <button key={range} onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
            </button>
          ))}
        </div>
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="90d">90 Days</option>
          <option value="All">All Time</option>
        </select>

        {/* Incident + unit + status filters */}
        <div className="flex flex-col gap-2">
          {isAdmin && activeIncidents.length > 0 && (
            <>
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
          {isAdmin ? (
            <UnitFilterPills
              units={units}
              selected={unitFilter}
              onSelect={setUnitFilter}
              unitTypeMap={Object.fromEntries(units.map(u => [u, getUnitTypeName(u)]))}
            />
          ) : (
            <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit?.name || '—'}</span>
          )}
          <div className="flex flex-wrap gap-2">
            {(['All', 'Open', 'Closed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? s === 'Open' ? 'bg-green-700 text-white' : s === 'Closed' ? 'bg-gray-600 text-white' : 'bg-red-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split panel */}
      <div className="flex-1 flex min-h-0 border-t border-gray-800">

        {/* Left: compact list (40%) */}
        <div className="w-full md:w-[40%] md:border-r border-gray-800 overflow-y-auto">
          {loading ? (
            <div className="p-4"><LoadingSkeleton rows={6} /></div>
          ) : sortedRows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="📋"
                message="No ICS 214 logs found."
                actionHref="/ics214/new"
                actionLabel="Create your first 214 →"
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {sortedRows.map(row => {
                const isSelected = row.id === selectedId
                return (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`w-full text-left px-3 py-3 flex items-start gap-2 ${lc.rowCls(isSelected)}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-gray-500 mb-0.5">{row.ics214_id}</p>
                      <p className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {row.unit_name || '—'}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{row.op_date || '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 mt-1 ${
                      row.status === 'Open' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {row.status}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: detail (60%) — desktop only */}
        <div className="hidden md:flex md:w-[60%] overflow-y-auto">
          {selectedRow ? (
            <ICS214DetailPanel row={selectedRow} />
          ) : (
            <div className="flex items-center justify-center w-full text-gray-600">
              <div className="text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">Select an item to view details</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Mobile overlay */}
      {selectedRow && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-950 flex flex-col">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-bold text-white">ICS 214 Detail</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-white text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ICS214DetailPanel row={selectedRow} />
          </div>
        </div>
      )}

    </div>
  )
}
