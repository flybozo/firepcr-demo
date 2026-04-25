
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { PageHeader } from '@/components/ui'
import OfflineGate from '@/components/OfflineGate'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

// ─── Types ───────────────────────────────────────────────────────────────────

type Incident = { id: string; name: string }

type PayrollRow = {
  assignment_id: string
  employee_id: string
  employee_name: string
  employee_role: string
  employee_headshot_url: string | null
  unit_name: string
  incident_id: string
  incident_name: string
  daily_rate: number
  hours_per_day: number
  assigned_at: string | null
  released_at: string | null
  travel_date: string | null
  check_in_at: string | null
  check_out_at: string | null
  deploy_status: string
}

type SortKey = 'employee' | 'unit' | 'incident' | 'days' | 'pay'
type SortDir = 'asc' | 'desc'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDays(startDate: string | null, endDate: string | null): number {
  if (!startDate) return 0
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : new Date()
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endMs = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function SortIcon({ k, sortKey, sortDir }: { k: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  return (
    <span className="ml-1 text-gray-600">
      {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AdminPayrollPage() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const assignment = useUserAssignment()
  const navigate = useNavigate()

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [dateRange, setDateRange] = useState('30d')
  const [sortKey, setSortKey] = useState<SortKey>('employee')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Redirect non-admins
  useEffect(() => {
    if (assignment.loading) return
    const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment?.employee?.role || '')
    if (!isAdmin && assignment.employee) navigate('/payroll/my')
  }, [assignment.loading, assignment.employee?.role])

  const load = useCallback(async () => {
    try {
      // 1. Load all unit_assignments with employee + incident_unit joins
      const { data: uaData } = await supabase
        .from('unit_assignments')
        .select('id, employee_id, incident_unit_id, assigned_at, released_at, daily_rate_override, hours_per_day, travel_date, check_in_at, check_out_at, notes, employees(id, name, role, daily_rate, default_hours_per_day, headshot_url)')
        .order('assigned_at', { ascending: false })

      // 2. Load incident_units to map assignment → incident + unit
      const { data: iuData } = await supabase
        .from('incident_units')
        .select('id, incident_id, unit_id, released_at, units(name), incidents(name)')

      // 3. Load deployment_records for enrichment (rate overrides)
      const { data: depData } = await supabase
        .from('deployment_records')
        .select('id, employee_id, incident_id, daily_rate, status')

      // 4. Load incidents for filter dropdown
      const { data: incData } = await supabase
        .from('incidents')
        .select('id, name')
        .order('name')

      setIncidents((incData as Incident[]) ?? [])

      // Build maps
      const iuMap = new Map<string, { incidentId: string; incidentName: string; unitName: string; released: string | null }>()
      for (const iu of (iuData || []) as any[]) {
        const incName = Array.isArray(iu.incidents) ? iu.incidents[0]?.name : iu.incidents?.name
        const unitName = Array.isArray(iu.units) ? iu.units[0]?.name : iu.units?.name
        iuMap.set(iu.id, {
          incidentId: iu.incident_id,
          incidentName: incName || '?',
          unitName: unitName || '?',
          released: iu.released_at,
        })
      }

      const depByEmployee = new Map<string, any>()
      for (const dep of (depData || [])) {
        depByEmployee.set((dep as any).employee_id, dep)
      }

      // Merge into payroll rows (same logic as IncidentDetail deployments card)
      const merged: PayrollRow[] = ((uaData || []) as any[]).map(ua => {
        const emp = ua.employees || {}
        const iu = iuMap.get(ua.incident_unit_id)
        const dep = depByEmployee.get(ua.employee_id)
        const rate = ua.daily_rate_override ?? dep?.daily_rate ?? emp.daily_rate ?? 0
        const hours = ua.hours_per_day ?? emp.default_hours_per_day ?? 16
        return {
          assignment_id: ua.id,
          employee_id: ua.employee_id,
          employee_name: emp.name || '?',
          employee_role: emp.role || '?',
          employee_headshot_url: emp.headshot_url || null,
          unit_name: iu?.unitName || '?',
          incident_id: iu?.incidentId || '',
          incident_name: iu?.incidentName || '?',
          daily_rate: rate,
          hours_per_day: hours,
          assigned_at: ua.assigned_at || null,
          released_at: ua.released_at || iu?.released || null,
          travel_date: ua.travel_date || dep?.travel_date || null,
          check_in_at: ua.check_in_at || null,
          check_out_at: ua.check_out_at || null,
          deploy_status: ua.released_at ? 'Released' : (dep?.status || 'On Scene'),
        }
      })

      setRows(merged)
    } catch (e) {
      console.error('[Payroll] load error', e)
      setRows([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment?.employee?.role || '')
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
  if (!isAdmin) return null

  // ─── Filters ─────────────────────────────────────────────────────────────

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const filtered = rows.filter(r => {
    if (incidentFilter !== 'all' && r.incident_id !== incidentFilter) return false
    if (employeeSearch && !r.employee_name.toLowerCase().includes(employeeSearch.toLowerCase())) return false
    if (dateFilter) {
      const start = r.travel_date || r.assigned_at
      if (!start || start < dateFilter) return false
    }
    return true
  })

  // ─── Sort ────────────────────────────────────────────────────────────────

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    const aDays = calcDays(a.travel_date || a.assigned_at, a.released_at)
    const bDays = calcDays(b.travel_date || b.assigned_at, b.released_at)
    if (sortKey === 'employee') cmp = a.employee_name.localeCompare(b.employee_name)
    else if (sortKey === 'unit') cmp = a.unit_name.localeCompare(b.unit_name)
    else if (sortKey === 'incident') cmp = a.incident_name.localeCompare(b.incident_name)
    else if (sortKey === 'days') cmp = aDays - bDays
    else if (sortKey === 'pay') cmp = (aDays * a.daily_rate) - (bDays * b.daily_rate)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // ─── Grouping & Totals ──────────────────────────────────────────────────

  const incidentTotals: Record<string, number> = {}
  for (const r of sorted) {
    const days = calcDays(r.travel_date || r.assigned_at, r.released_at)
    incidentTotals[r.incident_id] = (incidentTotals[r.incident_id] ?? 0) + days * r.daily_rate
  }
  const grandTotal = Object.values(incidentTotals).reduce((s, v) => s + v, 0)

  const incidentOrder: string[] = []
  const byIncident: Record<string, PayrollRow[]> = {}
  for (const r of sorted) {
    if (!byIncident[r.incident_id]) {
      byIncident[r.incident_id] = []
      incidentOrder.push(r.incident_id)
    }
    byIncident[r.incident_id].push(r)
  }

  // ─── CSV Export ──────────────────────────────────────────────────────────

  const exportCSV = () => {
    const csvRows = [
      ['Employee', 'Role', 'Unit', 'Incident', 'Start Date', 'End Date', 'Days', 'Daily Rate', 'Total Pay', 'Status'],
      ...sorted.map(r => {
        const start = r.travel_date || r.assigned_at || ''
        const days = calcDays(start, r.released_at)
        return [
          r.employee_name, r.employee_role, r.unit_name, r.incident_name,
          start.split('T')[0], r.released_at?.split('T')[0] ?? '',
          String(days), String(r.daily_rate), String(days * r.daily_rate), r.deploy_status,
        ]
      }),
    ]
    const csv = csvRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <OfflineGate page message="Payroll data requires a connection to load.">
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="mt-8 md:mt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <PageHeader
            title="💰 Payroll Summary"
            subtitle={`${sorted.length} assignments · ${incidentOrder.length} incident${incidentOrder.length !== 1 ? 's' : ''}`}
          />
          <div className="flex items-center gap-2">
            {/* Date range pills */}
            <div className="hidden md:flex gap-1.5">
              {(['7d', '30d', '90d', 'All'] as const).map(range => (
                <button key={range} onClick={() => setDateRange(range)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
                </button>
              ))}
            </div>
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              className="md:hidden bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
              <option value="All">All Time</option>
            </select>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg text-sm font-semibold transition-colors">
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 uppercase tracking-wide font-bold mb-1.5">Incident</label>
            <select value={incidentFilter} onChange={e => setIncidentFilter(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="all">All Incidents</option>
              {incidents.map(inc => <option key={inc.id} value={inc.id}>{inc.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 uppercase tracking-wide font-bold mb-1.5">Employee</label>
            <input value={employeeSearch} onChange={e => setEmployeeSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600" />
          </div>
        </div>

        {/* Table */}
        <div className="theme-card rounded-xl border overflow-x-auto">
          <div className="hidden lg:flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 theme-card-header border-b min-w-[800px]">
            <button className="flex-1 min-w-0 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('employee')}>
              Employee <SortIcon k="employee" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <span className="w-20 shrink-0">Role</span>
            <button className="w-28 shrink-0 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('unit')}>
              Unit <SortIcon k="unit" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <button className="w-36 shrink-0 text-left flex items-center hover:text-gray-300 transition-colors" onClick={() => toggleSort('incident')}>
              Incident <SortIcon k="incident" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <span className="w-24 shrink-0">Start</span>
            <span className="w-24 shrink-0">End</span>
            <button className="w-14 shrink-0 text-right flex items-center justify-end hover:text-gray-300 transition-colors" onClick={() => toggleSort('days')}>
              Days <SortIcon k="days" sortKey={sortKey} sortDir={sortDir} />
            </button>
            <span className="w-20 shrink-0 text-right">Rate</span>
            <button className="w-24 shrink-0 text-right flex items-center justify-end hover:text-gray-300 transition-colors" onClick={() => toggleSort('pay')}>
              Pay <SortIcon k="pay" sortKey={sortKey} sortDir={sortDir} />
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-600 text-center">No assignments found</p>
          ) : incidentFilter === 'all' ? (
            <>
              {incidentOrder.map(incId => {
                const group = byIncident[incId]
                const subtotal = group.reduce((s, r) => s + calcDays(r.travel_date || r.assigned_at, r.released_at) * r.daily_rate, 0)
                return (
                  <div key={incId}>
                    <div className="px-4 py-2 bg-gray-800/50 border-y border-gray-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">🔥 {group[0].incident_name}</span>
                      <span className="text-sm font-semibold text-yellow-400">{fmtCurrency(subtotal)}</span>
                    </div>
                    <div className="divide-y divide-gray-800/60">
                      {group.map(r => <PayrollTableRow key={r.assignment_id} row={r} showIncident={false} navigate={navigate} />)}
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {sorted.map(r => <PayrollTableRow key={r.assignment_id} row={r} showIncident navigate={navigate} />)}
            </div>
          )}
        </div>

        {/* Grand Total */}
        {sorted.length > 0 && (
          <div className="theme-card rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Grand Total</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {sorted.length} assignment{sorted.length !== 1 ? 's' : ''} · {incidentOrder.length} incident{incidentOrder.length !== 1 ? 's' : ''}
              </p>
            </div>
            <p className="text-3xl font-bold text-green-400">{fmtCurrency(grandTotal)}</p>
          </div>
        )}
      </div>
    </div>
    </OfflineGate>
  )
}

// ─── Table Row ───────────────────────────────────────────────────────────────

function PayrollTableRow({ row: r, showIncident, navigate }: { row: PayrollRow; showIncident: boolean; navigate: (path: string) => void }) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const startDate = r.travel_date || r.assigned_at
  const days = calcDays(startDate, r.released_at)
  const pay = days * r.daily_rate
  const isActive = !r.released_at

  return (
    <div className={`px-4 py-2 cursor-pointer min-w-[800px] ${lc.row}`}
      onClick={() => navigate(`/roster/${r.employee_id}`)}>
      {/* Mobile */}
      <div className="lg:hidden space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
              {r.employee_headshot_url ? (
                <img src={r.employee_headshot_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-[10px] font-bold">{r.employee_name.charAt(0)}</span>
              )}
            </div>
            <span className="text-sm font-medium text-white">{r.employee_name}</span>
          </div>
          {isActive && <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">🔴 Active</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{r.employee_role}</span>
          <span>·</span>
          <span>{r.unit_name}</span>
          {showIncident && <><span>·</span><span>{r.incident_name}</span></>}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatDate(startDate)} → {r.released_at ? formatDate(r.released_at) : 'ongoing'} ({days}d)</span>
          <span className="text-sm font-semibold text-green-400">{fmtCurrency(pay)}</span>
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden lg:flex items-center text-sm">
        <span className="flex-1 min-w-0 font-medium text-white truncate pr-2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
            {r.employee_headshot_url ? (
              <img src={r.employee_headshot_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-400 text-[10px] font-bold">{r.employee_name.charAt(0)}</span>
            )}
          </div>
          <span className="truncate">{r.employee_name}</span>
          {isActive && <span className="ml-1 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">🔴</span>}
        </span>
        <span className="w-20 shrink-0 text-xs text-gray-400">{r.employee_role}</span>
        <span className="w-28 shrink-0 text-xs text-gray-400 truncate pr-1">{r.unit_name}</span>
        <span className="w-36 shrink-0 text-xs text-gray-400 truncate pr-1">{showIncident ? r.incident_name : ''}</span>
        <span className="w-24 shrink-0 text-xs text-gray-400">{formatDate(startDate)}</span>
        <span className="w-24 shrink-0 text-xs text-gray-400">
          {r.released_at ? formatDate(r.released_at) : <span className="text-yellow-500">ongoing</span>}
        </span>
        <span className="w-14 shrink-0 text-right font-medium">{days}{isActive && '+'}</span>
        <span className="w-20 shrink-0 text-right text-xs text-gray-400">{fmtCurrency(r.daily_rate)}</span>
        <span className="w-24 shrink-0 text-right font-semibold text-green-400">{fmtCurrency(pay)}{isActive && '+'}</span>
      </div>
    </div>
  )
}
