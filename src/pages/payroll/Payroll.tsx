

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'

type Incident = {
  id: string
  name: string
}

type DeploymentRow = {
  id: string
  employee_id: string
  incident_id: string
  travel_date: string
  check_in_date: string | null
  check_out_date: string | null
  daily_rate: number
  status: string
  employees: { name: string; role: string } | null
  incidents: { name: string } | null
}

type SortKey = 'employee' | 'incident' | 'days' | 'pay'
type SortDir = 'asc' | 'desc'

function calcDays(travelDate: string, checkOutDate: string | null): number {
  const start = new Date(travelDate)
  const end = checkOutDate ? new Date(checkOutDate) : new Date()
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endMs = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function AdminPayrollPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const navigate = useNavigate()

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [deployments, setDeployments] = useState<DeploymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [incidentFilter, setIncidentFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('employee')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Redirect non-admins
  useEffect(() => {
    if (assignment.loading) return
    const isAdmin = ['MD', 'MD/DO', 'Admin'].includes(assignment?.employee?.role || '')
    if (!isAdmin && assignment.employee) {
      navigate('/payroll/my')
    }
  }, [assignment.loading, assignment.employee?.role])

  const load = useCallback(async () => {
    const [{ data: incData }, { data: depData }] = await Promise.all([
      supabase.from('incidents').select('id, name').order('name'),
      supabase
        .from('deployment_records')
        .select('id, employee_id, incident_id, travel_date, check_in_date, check_out_date, daily_rate, status, employees(name, role), incidents(name)')
        .order('travel_date', { ascending: false }),
    ])

    setIncidents((incData as Incident[]) ?? [])
    setDeployments((depData as unknown as DeploymentRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const isAdmin = ['MD', 'MD/DO', 'Admin'].includes(assignment?.employee?.role || '')

  if (assignment.loading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading payroll...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) return null // redirecting

  // Filter
  const filtered = incidentFilter === 'all'
    ? deployments
    : deployments.filter(d => d.incident_id === incidentFilter)

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'employee') cmp = (a.employees?.name ?? '').localeCompare(b.employees?.name ?? '')
    else if (sortKey === 'incident') cmp = (a.incidents?.name ?? '').localeCompare(b.incidents?.name ?? '')
    else if (sortKey === 'days') cmp = calcDays(a.travel_date, a.check_out_date) - calcDays(b.travel_date, b.check_out_date)
    else if (sortKey === 'pay') cmp = (calcDays(a.travel_date, a.check_out_date) * a.daily_rate) - (calcDays(b.travel_date, b.check_out_date) * b.daily_rate)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className="ml-1 text-gray-600">
      {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  // Subtotals per incident
  const incidentTotals: Record<string, number> = {}
  for (const d of sorted) {
    const pay = calcDays(d.travel_date, d.check_out_date) * d.daily_rate
    incidentTotals[d.incident_id] = (incidentTotals[d.incident_id] ?? 0) + pay
  }
  const grandTotal = Object.values(incidentTotals).reduce((s, v) => s + v, 0)

  // Group by incident for subtotal rendering (only when "All")
  const incidentOrder: string[] = []
  const byIncident: Record<string, DeploymentRow[]> = {}
  for (const d of sorted) {
    if (!byIncident[d.incident_id]) {
      byIncident[d.incident_id] = []
      incidentOrder.push(d.incident_id)
    }
    byIncident[d.incident_id].push(d)
  }

  // CSV export
  const exportCSV = () => {
    const rows = [
      ['Employee', 'Role', 'Incident', 'Travel Date', 'Check-Out', 'Days', 'Daily Rate', 'Total Pay'],
      ...sorted.map(d => {
        const days = calcDays(d.travel_date, d.check_out_date)
        return [
          d.employees?.name ?? '',
          d.employees?.role ?? '',
          d.incidents?.name ?? '',
          d.travel_date,
          d.check_out_date ?? '',
          String(days),
          String(d.daily_rate),
          String(days * d.daily_rate),
        ]
      }),
    ]
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${incidentFilter === 'all' ? 'all' : incidents.find(i => i.id === incidentFilter)?.name ?? 'filtered'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="mt-8 md:mt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">💰 Payroll Summary</h1>
            <p className="text-gray-400 text-sm mt-1">All deployments · Admin view</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-semibold transition-colors self-start sm:self-auto"
          >
            📥 Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 uppercase tracking-wide font-bold mb-1.5">Filter by Incident</label>
            <select
              value={incidentFilter}
              onChange={e => setIncidentFilter(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Incidents</option>
              {incidents.map(inc => (
                <option key={inc.id} value={inc.id}>{inc.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 text-sm text-gray-400">
            <span>{sorted.length} deployment{sorted.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {/* Table header */}
          <div className="hidden lg:flex items-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-800 border-b border-gray-700">
            <button className="flex-1 min-w-0 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('employee')}>
              Employee <SortIcon k="employee" />
            </button>
            <span className="w-28 shrink-0">Role</span>
            <button className="w-40 shrink-0 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('incident')}>
              Incident <SortIcon k="incident" />
            </button>
            <span className="w-24 shrink-0">Travel Date</span>
            <span className="w-24 shrink-0">Check-Out</span>
            <button className="w-16 shrink-0 text-right flex items-center justify-end hover:text-gray-300 transition-colors" onClick={() => toggleSort('days')}>
              Days <SortIcon k="days" />
            </button>
            <span className="w-24 shrink-0 text-right">Rate/Day</span>
            <button className="w-28 shrink-0 text-right flex items-center justify-end hover:text-gray-300 transition-colors" onClick={() => toggleSort('pay')}>
              Total Pay <SortIcon k="pay" />
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-600 text-center">No deployments found</p>
          ) : incidentFilter === 'all' ? (
            // Grouped by incident with subtotals
            <>
              {incidentOrder.map(incId => {
                const rows = byIncident[incId]
                const subtotal = rows.reduce((s, d) => s + calcDays(d.travel_date, d.check_out_date) * d.daily_rate, 0)
                const incName = rows[0].incidents?.name ?? 'Unknown'
                return (
                  <div key={incId}>
                    {/* Incident group header */}
                    <div className="px-4 py-2 bg-gray-800/50 border-y border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔥 {incName}</span>
                      <span className="text-sm font-semibold text-yellow-400">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="divide-y divide-gray-800/60">
                      {rows.map(dep => <DeploymentTableRow key={dep.id} dep={dep} showIncident={false} />)}
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {sorted.map(dep => <DeploymentTableRow key={dep.id} dep={dep} showIncident={true} />)}
            </div>
          )}
        </div>

        {/* Grand Total */}
        {sorted.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Grand Total</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {sorted.length} deployment{sorted.length !== 1 ? 's' : ''} · {incidentFilter === 'all' ? `${incidentOrder.length} incident${incidentOrder.length !== 1 ? 's' : ''}` : incidents.find(i => i.id === incidentFilter)?.name}
              </p>
            </div>
            <p className="text-3xl font-bold text-green-400">{formatCurrency(grandTotal)}</p>
          </div>
        )}

      </div>
    </div>
  )
}

function DeploymentTableRow({ dep, showIncident }: { dep: DeploymentRow; showIncident: boolean }) {
  const days = calcDays(dep.travel_date, dep.check_out_date)
  const pay = days * dep.daily_rate
  const isActive = dep.status === 'Traveling' || dep.status === 'On Scene'

  return (
    <div className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
      {/* Mobile */}
      <div className="lg:hidden space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">{dep.employees?.name ?? '—'}</span>
          {isActive && <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">🔴 Active</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{dep.employees?.role ?? '—'}</span>
          {showIncident && <><span>·</span><span>{dep.incidents?.name ?? '—'}</span></>}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatDate(dep.travel_date)} → {dep.check_out_date ? formatDate(dep.check_out_date) : 'ongoing'} ({days} days)</span>
          <span className="text-sm font-semibold text-green-400">{formatCurrency(pay)}</span>
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden lg:flex items-center text-sm">
        <span className="flex-1 min-w-0 font-medium text-white truncate pr-2">
          {dep.employees?.name ?? '—'}
          {isActive && <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">🔴 Active</span>}
        </span>
        <span className="w-28 shrink-0 text-xs text-gray-400">{dep.employees?.role ?? '—'}</span>
        <span className="w-40 shrink-0 text-xs text-gray-400 truncate pr-1">
          {showIncident ? (dep.incidents?.name ?? '—') : ''}
        </span>
        <span className="w-24 shrink-0 text-xs text-gray-400">{formatDate(dep.travel_date)}</span>
        <span className="w-24 shrink-0 text-xs text-gray-400">
          {dep.check_out_date ? formatDate(dep.check_out_date) : <span className="text-yellow-500">ongoing</span>}
        </span>
        <span className="w-16 shrink-0 text-right font-medium">{days}</span>
        <span className="w-24 shrink-0 text-right text-xs text-gray-400">{formatCurrency(dep.daily_rate)}</span>
        <span className="w-28 shrink-0 text-right font-semibold text-green-400">{formatCurrency(pay)}</span>
      </div>
    </div>
  )
}
