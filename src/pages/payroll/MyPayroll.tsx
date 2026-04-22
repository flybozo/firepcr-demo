
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import OfflineGate from '@/components/OfflineGate'

// ─── Types ───────────────────────────────────────────────────────────────────

type Incident = { id: string; name: string }

type PayrollRow = {
  assignment_id: string
  unit_name: string
  incident_id: string
  incident_name: string
  daily_rate: number
  hours_per_day: number
  assigned_at: string | null
  released_at: string | null
  travel_date: string | null
  deploy_status: string
}

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MyPayrollPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [incidentFilter, setIncidentFilter] = useState('all')
  const [dateRange, setDateRange] = useState('All')

  useEffect(() => {
    if (assignment.loading) return
    if (!assignment.employee) { setLoading(false); return }

    const load = async () => {
      const empId = assignment.employee!.id

      // 0. Get employee's default rate
      const { data: empData } = await supabase
        .from('employees')
        .select('daily_rate, default_hours_per_day')
        .eq('id', empId)
        .single()
      const empRate = empData?.daily_rate ?? 0
      const empHours = empData?.default_hours_per_day ?? 16

      // 1. Load this employee's unit_assignments
      const { data: uaData } = await supabase
        .from('unit_assignments')
        .select('id, incident_unit_id, assigned_at, released_at, daily_rate_override, hours_per_day, travel_date, check_in_at, check_out_at')
        .eq('employee_id', empId)
        .order('assigned_at', { ascending: false })

      // 2. Load incident_units for mapping
      const iuIds = [...new Set((uaData || []).map((ua: any) => ua.incident_unit_id))]
      let iuData: any[] = []
      if (iuIds.length > 0) {
        const { data } = await supabase
          .from('incident_units')
          .select('id, incident_id, unit_id, released_at, units(name), incidents(name)')
          .in('id', iuIds)
        iuData = data || []
      }

      // 3. Load deployment_records for rate enrichment
      const { data: depData } = await supabase
        .from('deployment_records')
        .select('id, employee_id, daily_rate, status')
        .eq('employee_id', empId)

      // 4. Incidents for filter
      const incidentIds = [...new Set(iuData.map((iu: any) => iu.incident_id))]
      let incList: Incident[] = []
      if (incidentIds.length > 0) {
        const { data } = await supabase
          .from('incidents')
          .select('id, name')
          .in('id', incidentIds)
          .order('name')
        incList = (data as Incident[]) ?? []
      }
      setIncidents(incList)

      // Build maps
      const iuMap = new Map<string, { incidentId: string; incidentName: string; unitName: string; released: string | null }>()
      for (const iu of iuData) {
        const incName = Array.isArray(iu.incidents) ? iu.incidents[0]?.name : iu.incidents?.name
        const unitName = Array.isArray(iu.units) ? iu.units[0]?.name : iu.units?.name
        iuMap.set(iu.id, {
          incidentId: iu.incident_id,
          incidentName: incName || '?',
          unitName: unitName || '?',
          released: iu.released_at,
        })
      }

      const dep = (depData || [])[0] as any

      const merged: PayrollRow[] = ((uaData || []) as any[]).map(ua => {
        const iu = iuMap.get(ua.incident_unit_id)
        const rate = ua.daily_rate_override ?? dep?.daily_rate ?? empRate
        const hours = ua.hours_per_day ?? empHours
        return {
          assignment_id: ua.id,
          unit_name: iu?.unitName || '?',
          incident_id: iu?.incidentId || '',
          incident_name: iu?.incidentName || '?',
          daily_rate: rate,
          hours_per_day: hours,
          assigned_at: ua.assigned_at || null,
          released_at: ua.released_at || iu?.released || null,
          travel_date: ua.travel_date || null,
          deploy_status: ua.released_at ? 'Released' : 'On Scene',
        }
      })

      setRows(merged)
      setLoading(false)
    }
    load()
  }, [assignment.loading, assignment.employee?.id])

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

  if (!assignment.employee) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-xl font-bold mb-2">Not Found</h1>
          <p className="text-gray-400 text-sm">No employee record linked to your account.</p>
        </div>
      </div>
    )
  }

  // ─── Filters ─────────────────────────────────────────────────────────────

  const dateFilter = dateRange === 'All' ? null :
    new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const filtered = rows.filter(r => {
    if (incidentFilter !== 'all' && r.incident_id !== incidentFilter) return false
    if (dateFilter) {
      const start = r.travel_date || r.assigned_at
      if (!start || start < dateFilter) return false
    }
    return true
  })

  const activeRow = filtered.find(r => !r.released_at)
  const grandTotal = filtered.reduce((sum, r) => {
    const days = calcDays(r.travel_date || r.assigned_at, r.released_at)
    return sum + days * r.daily_rate
  }, 0)

  return (
    <OfflineGate page message="Payroll data requires a connection to load.">
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="mt-8 md:mt-0">
          <h1 className="text-2xl font-bold text-white">💰 My Pay</h1>
          <p className="text-gray-400 text-sm mt-1">{assignment.employee.name} · {assignment.employee.role}</p>
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
            <label className="block text-xs text-gray-500 uppercase tracking-wide font-bold mb-1.5">Date Range</label>
            <div className="flex gap-1.5">
              {(['7d', '30d', '90d', 'All'] as const).map(range => (
                <button key={range} onClick={() => setDateRange(range)}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {range === '7d' ? '7d' : range === '30d' ? '30d' : range === '90d' ? '90d' : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active Assignment */}
        {activeRow && (() => {
          const start = activeRow.travel_date || activeRow.assigned_at
          const days = calcDays(start, null)
          const pay = days * activeRow.daily_rate
          return (
            <div className="bg-gray-900 rounded-xl border border-red-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 bg-red-950/30 flex items-center gap-2">
                <span className="text-red-400">🔴</span>
                <h2 className="text-sm font-bold text-red-300 uppercase tracking-wide">Active Assignment</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">{activeRow.incident_name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Unit: <span className="text-white font-medium">{activeRow.unit_name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">{fmtCurrency(pay)}</p>
                    <p className="text-xs text-gray-500">estimated to date</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Start Date</p>
                    <p className="text-sm font-medium">{formatDate(start)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Days So Far</p>
                    <p className="text-sm font-medium">{days} days</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Daily Rate</p>
                    <p className="text-sm font-medium">{fmtCurrency(activeRow.daily_rate)}/day</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {!activeRow && (
          <div className="theme-card rounded-xl border p-6 text-center">
            <p className="text-gray-500 text-sm">No active assignment</p>
          </div>
        )}

        {/* Assignment History */}
        <div className="theme-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b theme-card-header flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Assignment History</h2>
            <span className="text-xs text-gray-500">{filtered.length} total</span>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-600 text-center">No assignments found</p>
          ) : (
            <>
              <div className="hidden sm:flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-header border-b">
                <span className="flex-1 min-w-0">Incident</span>
                <span className="w-24 shrink-0">Unit</span>
                <span className="w-24 shrink-0">Start</span>
                <span className="w-24 shrink-0">End</span>
                <span className="w-14 shrink-0 text-right">Days</span>
                <span className="w-20 shrink-0 text-right">Rate</span>
                <span className="w-24 shrink-0 text-right">Total</span>
              </div>
              <div className="divide-y divide-gray-800/60">
                {filtered.map(r => {
                  const start = r.travel_date || r.assigned_at
                  const days = calcDays(start, r.released_at)
                  const pay = days * r.daily_rate
                  const isActive = !r.released_at
                  return (
                    <div key={r.assignment_id} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
                      {/* Mobile */}
                      <div className="sm:hidden space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{r.incident_name}</span>
                          {isActive && <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">🔴 Active</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{r.unit_name}</span>
                          <span>·</span>
                          <span>{formatDate(start)} → {r.released_at ? formatDate(r.released_at) : 'ongoing'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{days}d × {fmtCurrency(r.daily_rate)}/day</span>
                          <span className="text-sm font-semibold text-green-400">{fmtCurrency(pay)}</span>
                        </div>
                      </div>
                      {/* Desktop */}
                      <div className="hidden sm:flex items-center">
                        <span className="flex-1 min-w-0 text-sm text-white truncate pr-2">
                          {r.incident_name}
                          {isActive && <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">🔴 Active</span>}
                        </span>
                        <span className="w-24 shrink-0 text-xs text-gray-400">{r.unit_name}</span>
                        <span className="w-24 shrink-0 text-xs text-gray-400">{formatDate(start)}</span>
                        <span className="w-24 shrink-0 text-xs text-gray-400">
                          {r.released_at ? formatDate(r.released_at) : <span className="text-yellow-500">ongoing</span>}
                        </span>
                        <span className="w-14 shrink-0 text-right text-sm font-medium">{days}{isActive && '+'}</span>
                        <span className="w-20 shrink-0 text-right text-xs text-gray-400">{fmtCurrency(r.daily_rate)}</span>
                        <span className="w-24 shrink-0 text-right text-sm font-semibold text-green-400">{fmtCurrency(pay)}{isActive && '+'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Grand Total */}
        {filtered.length > 0 && (
          <div className="theme-card rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Grand Total</p>
              <p className="text-xs text-gray-600 mt-0.5">{filtered.length} assignment{filtered.length !== 1 ? 's' : ''}</p>
            </div>
            <p className="text-3xl font-bold text-green-400">{fmtCurrency(grandTotal)}</p>
          </div>
        )}
      </div>
    </div>
    </OfflineGate>
  )
}
