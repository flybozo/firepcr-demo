

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'

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

export default function ICS214ListPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'MD/DO', 'Admin'].includes(assignment?.employee?.role || '')

  const [rows, setRows] = useState<ICS214Row[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState<string>('')
  const [incidentFilter, setIncidentFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [dateRange, setDateRange] = useState('7d')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])
  const [units, setUnits] = useState<string[]>([])

  useEffect(() => {
    if (assignment.loading) return
    // Default unit filter for non-admin
    if (!isAdmin && assignment.unit?.name) {
      setUnitFilter(assignment.unit.name)
    }
  }, [assignment.loading, isAdmin, assignment.unit?.name])

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 86400000).toISOString()

  useEffect(() => {
    if (assignment.loading) return
    load()
  }, [unitFilter, incidentFilter, statusFilter, dateRange, assignment.loading])

  const load = async () => {
    setLoading(true)
    try {
      if (isAdmin && activeIncidents.length === 0) {
        const { data: incs, error: incErr } = await supabase.from('incidents').select('id, name').eq('status', 'Active').order('name')
        if (incErr) throw incErr
        setActiveIncidents(incs || [])
      }
      let q = supabase
        .from('ics214_headers')
        .select('id, ics214_id, incident_name, unit_name, op_date, op_start, op_end, leader_name, status, created_at')
        .order('created_at', { ascending: false })

      const effectiveUnit = !isAdmin && assignment.unit?.name ? assignment.unit.name : unitFilter
      if (effectiveUnit) q = q.eq('unit_name', effectiveUnit)
      if (isAdmin && incidentFilter !== 'All') q = (q as any).eq('incident_id', incidentFilter)
      if (statusFilter !== 'All') q = q.eq('status', statusFilter)
      if (dateFilter) q = q.gte('created_at', dateFilter)

      const { data, error } = await q
      if (error) throw error
      const rows = (data as ICS214Row[]) || []
      rows.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
      setRows(rows)
      const allUnits = Array.from(new Set(rows.map(r => r.unit_name).filter(Boolean)))
      setUnits(allUnits)
    } catch {
      // Offline — try cached ICS 214 headers
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('ics214s')
        const sorted = [...cached].sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
        setRows(sorted as ICS214Row[])
      } catch { setRows([]) }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-4xl mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <h1 className="text-xl font-bold">ICS 214 Logs</h1>
          <Link
            to="/ics214/new"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
          >
            + New 214
          </Link>
        </div>

        {/* Date range filter pills */}
        <div className="hidden md:flex gap-1.5 mb-3">
          {(['7d', '30d', '90d', 'All'] as const).map(range => (
            <button key={range} onClick={() => setDateRange(range)}
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
          onChange={e => setDateRange(e.target.value)}
          className="md:hidden w-full mb-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="90d">90 Days</option>
          <option value="All">All Time</option>
        </select>

        {/* Filters */}
        <div className="flex flex-col gap-2 mb-4">
          {/* Incident filter — admin only */}
          {isAdmin && activeIncidents.length > 0 && (
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
          {/* Unit filter */}
          {isAdmin ? (
            <>
              {/* Desktop: unit pills */}
              <div className="hidden md:flex gap-1.5 flex-wrap">
                <button onClick={() => setUnitFilter('')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilter === '' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  All Units
                </button>
                {[...units].sort((a,b) => {
                  const order: Record<string,number> = {'MSU':1,'RAMBO':2,'REMS':3}
                  const aK = Object.keys(order).find(k => a.startsWith(k)) || 'z'
                  const bK = Object.keys(order).find(k => b.startsWith(k)) || 'z'
                  return (order[aK]||9) - (order[bK]||9) || a.localeCompare(b)
                }).map(u => {
                  const type = u.startsWith('RAMBO') ? 'Ambulance' : u.startsWith('MSU') || u === 'The Beast' ? 'Med Unit' : 'REMS'
                  const activeClass = type === 'Ambulance' ? 'bg-red-700 text-white' : type === 'Med Unit' ? 'bg-blue-700 text-white' : 'bg-green-700 text-white'
                  return (
                    <button key={u} onClick={() => setUnitFilter(u)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilter === u ? activeClass : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      {u}
                    </button>
                  )
                })}
              </div>
              {/* Mobile: unit dropdown */}
              <select
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="">All Units</option>
                {[...units].sort((a,b) => {
                  const order: Record<string,number> = {'MSU':1,'RAMBO':2,'REMS':3}
                  const aK = Object.keys(order).find(k => a.startsWith(k)) || 'z'
                  const bK = Object.keys(order).find(k => b.startsWith(k)) || 'z'
                  return (order[aK]||9) - (order[bK]||9) || a.localeCompare(b)
                }).map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </>
          ) : (
            <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit?.name || '—'}</span>
          )}

          {/* Status filter */}
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

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="theme-card rounded-xl border p-12 text-center">
            <p className="text-gray-500 text-sm mb-4">No ICS 214 logs found.</p>
            <Link to="/ics214/new" className="text-red-400 hover:text-red-300 text-sm underline">
              Create your first 214 →
            </Link>
          </div>
        ) : (
          <div className="theme-card rounded-xl border overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b theme-card-header">
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">214 ID</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Unit</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Incident</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Op Period</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Leader</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">{row.ics214_id}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{row.op_date || '—'}</td>
                      <td className="px-4 py-3 text-white font-medium">{row.unit_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-[140px]">{row.incident_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{row.op_start}–{row.op_end}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{row.leader_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          row.status === 'Open'
                            ? 'bg-green-900 text-green-300'
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/ics214/${row.ics214_id}`}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            View
                          </Link>
                          {row.status === 'Open' && (
                            <Link
                              to={`/ics214/${row.ics214_id}/activity`}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors"
                            >
                              + Activity
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-800/60">
              {rows.map(row => (
                <div key={row.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-gray-400">{row.ics214_id}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{row.unit_name}</p>
                      <p className="text-xs text-gray-500">{row.incident_name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      row.status === 'Open'
                        ? 'bg-green-900 text-green-300'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {row.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {row.op_date} • {row.op_start}–{row.op_end}
                    </div>
                    <div className="flex gap-3">
                      <Link
                        to={`/ics214/${row.ics214_id}`}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        View →
                      </Link>
                      {row.status === 'Open' && (
                        <Link
                          to={`/ics214/${row.ics214_id}/activity`}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          + Activity
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
