import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { fmtCurrency, calcDays } from '@/utils/incidentFormatters'

// ─── Types ───────────────────────────────────────────────────────────────────

type IncidentFinancial = {
  id: string
  name: string
  status: string
  start_date: string | null
  location: string | null
  grossRevenue: number
  payroll: number
  expenses: number
  netRevenue: number
  dailyRevenue: number
  dailyPayroll: number
  dailyExpenses: number
  dailyNet: number
  unitCount: number
  crewCount: number
  days: number
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, accent = '#dc2626', sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Financial() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<IncidentFinancial[]>([])
  const [includeCompleted, setIncludeCompleted] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch incidents
      let q = supabase
        .from('incidents')
        .select('id, name, status, start_date, location')
        .order('start_date', { ascending: false })

      if (!includeCompleted) {
        q = q.eq('status', 'Active')
      } else {
        q = q.in('status', ['Active', 'Closed', 'Completed'])
      }

      const { data: incidentsData } = await q
      if (!incidentsData || incidentsData.length === 0) {
        setIncidents([])
        setLoading(false)
        return
      }

      const incidentIds = incidentsData.map(i => i.id)

      // 2. Fetch all incident_units for these incidents (include unit_type default rate)
      const { data: iuData } = await supabase
        .from('incident_units')
        .select('id, incident_id, assigned_at, released_at, daily_contract_rate, unit:units(id, name, unit_type:unit_types(default_contract_rate))')
        .in('incident_id', incidentIds)

      // 3. Fetch all unit_assignments for those incident_units
      const iuIds = (iuData || []).map((iu: any) => iu.id)
      const { data: uaData } = iuIds.length > 0
        ? await supabase
            .from('unit_assignments')
            .select('id, employee_id, incident_unit_id, assigned_at, released_at, daily_rate_override, travel_date, check_in_at, check_out_at, employees(id, daily_rate)')
            .in('incident_unit_id', iuIds)
        : { data: [] }

      // 4. Fetch deployment_records for payroll
      const { data: depData } = await supabase
        .from('deployment_records')
        .select('id, employee_id, incident_id, travel_date, check_in_date, check_out_date, daily_rate')
        .in('incident_id', incidentIds)

      // 5. Fetch expenses
      const { data: expData } = await supabase
        .from('incident_expenses')
        .select('id, incident_id, amount')
        .in('incident_id', incidentIds)

      // 6. Build financial data per incident
      const iuByIncident = new Map<string, any[]>()
      for (const iu of (iuData || [])) {
        const list = iuByIncident.get((iu as any).incident_id) || []
        list.push(iu)
        iuByIncident.set((iu as any).incident_id, list)
      }

      const uaByIU = new Map<string, any[]>()
      for (const ua of (uaData || [])) {
        const list = uaByIU.get((ua as any).incident_unit_id) || []
        list.push(ua)
        uaByIU.set((ua as any).incident_unit_id, list)
      }

      const depByIncident = new Map<string, any[]>()
      for (const dep of (depData || [])) {
        const list = depByIncident.get((dep as any).incident_id) || []
        list.push(dep)
        depByIncident.set((dep as any).incident_id, list)
      }

      const expByIncident = new Map<string, any[]>()
      for (const exp of (expData || [])) {
        const list = expByIncident.get((exp as any).incident_id) || []
        list.push(exp)
        expByIncident.set((exp as any).incident_id, list)
      }

      const results: IncidentFinancial[] = incidentsData.map(inc => {
        const incIUs = iuByIncident.get(inc.id) || []

        // Revenue: days × daily_contract_rate per incident_unit (fallback to unit_type default)
        let grossRevenue = 0
        for (const iu of incIUs) {
          const rawType = iu.unit?.unit_type
          const unitType = Array.isArray(rawType) ? rawType[0] : rawType
          const defaultRate = unitType?.default_contract_rate ?? 0
          const rate = iu.daily_contract_rate ?? defaultRate
          const start = iu.assigned_at || inc.start_date || null
          const end = iu.released_at || null
          const days = start ? calcDays(start.split('T')[0], end ? end.split('T')[0] : null) : 0
          grossRevenue += days * rate
        }

        // Payroll: from unit_assignments (same logic as IncidentDetail)
        // Build deployment_records lookup by employee for this incident
        const incDeps = depByIncident.get(inc.id) || []
        const depByEmployee = new Map<string, any>()
        for (const dep of incDeps) {
          depByEmployee.set(dep.employee_id, dep)
        }
        let payroll = 0
        let crewCount = 0
        const seenEmployees = new Set<string>()
        for (const iu of incIUs) {
          const uas = uaByIU.get(iu.id) || []
          for (const ua of uas) {
            const emp = Array.isArray(ua.employees) ? ua.employees[0] : ua.employees
            const dep = depByEmployee.get(ua.employee_id)
            const rate = ua.daily_rate_override ?? dep?.daily_rate ?? emp?.daily_rate ?? 0
            const start = ua.travel_date || (ua.assigned_at ? ua.assigned_at.split('T')[0] : null) || inc.start_date || null
            const end = ua.released_at ? ua.released_at.split('T')[0] : null
            const d = start ? calcDays(start, end) : 0
            payroll += d * rate
            if (!seenEmployees.has(ua.employee_id)) {
              seenEmployees.add(ua.employee_id)
              if (!ua.released_at) crewCount++
            }
          }
        }

        // Expenses
        const incExps = expByIncident.get(inc.id) || []
        const expenses = incExps.reduce((s: number, e: any) => s + (e.amount || 0), 0)

        const netRevenue = grossRevenue - payroll - expenses

        // Days on incident (from start_date to now or end)
        const incDays = inc.start_date ? calcDays(inc.start_date, inc.status === 'Active' ? null : null) : 1

        return {
          id: inc.id,
          name: inc.name,
          status: inc.status,
          start_date: inc.start_date,
          location: inc.location,
          grossRevenue,
          payroll,
          expenses,
          netRevenue,
          dailyRevenue: incDays > 0 ? grossRevenue / incDays : 0,
          dailyPayroll: incDays > 0 ? payroll / incDays : 0,
          dailyExpenses: incDays > 0 ? expenses / incDays : 0,
          dailyNet: incDays > 0 ? netRevenue / incDays : 0,
          unitCount: incIUs.filter((iu: any) => !iu.released_at).length,
          crewCount,
          days: incDays,
        }
      })

      setIncidents(results)
    } catch (err) {
      console.error('Financial load error:', err)
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }, [includeCompleted])

  useEffect(() => { load() }, [load])

  // Aggregates
  const totals = incidents.reduce((acc, inc) => ({
    grossRevenue: acc.grossRevenue + inc.grossRevenue,
    payroll: acc.payroll + inc.payroll,
    expenses: acc.expenses + inc.expenses,
    netRevenue: acc.netRevenue + inc.netRevenue,
    dailyRevenue: acc.dailyRevenue + inc.dailyRevenue,
    dailyPayroll: acc.dailyPayroll + inc.dailyPayroll,
    dailyExpenses: acc.dailyExpenses + inc.dailyExpenses,
    dailyNet: acc.dailyNet + inc.dailyNet,
    unitCount: acc.unitCount + inc.unitCount,
    crewCount: acc.crewCount + inc.crewCount,
  }), { grossRevenue: 0, payroll: 0, expenses: 0, netRevenue: 0, dailyRevenue: 0, dailyPayroll: 0, dailyExpenses: 0, dailyNet: 0, unitCount: 0, crewCount: 0 })

  // Chart data: per-incident breakdown
  const chartData = incidents.map(inc => ({
    name: inc.name.length > 20 ? inc.name.slice(0, 18) + '…' : inc.name,
    fullName: inc.name,
    Revenue: Math.round(inc.grossRevenue),
    Payroll: Math.round(inc.payroll),
    Expenses: Math.round(inc.expenses),
    Net: Math.round(inc.netRevenue),
  }))

  // Daily chart data
  const dailyChartData = incidents.map(inc => ({
    name: inc.name.length > 20 ? inc.name.slice(0, 18) + '…' : inc.name,
    fullName: inc.name,
    'Daily Revenue': Math.round(inc.dailyRevenue),
    'Daily Payroll': Math.round(inc.dailyPayroll),
    'Daily Expenses': Math.round(inc.dailyExpenses),
    'Daily Net': Math.round(inc.dailyNet),
  }))

  const axisStyle = { fill: '#9ca3af', fontSize: 11 }
  const gridStyle = { stroke: '#1f2937' }
  const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 12 }

  const tooltipFormatter = (value: number) => fmtCurrency(value)

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">💵 Financial Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Aggregated P&L across {includeCompleted ? 'all' : 'active'} incidents</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={e => setIncludeCompleted(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-red-600 focus:ring-red-500"
            />
            Include completed
          </label>
          <button onClick={load} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-800/50 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-64 bg-gray-800/50 rounded-xl animate-pulse" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-600">
          <p className="text-lg">No {includeCompleted ? '' : 'active '}incidents</p>
          <p className="text-sm mt-1">Financial data will appear when incidents are running</p>
        </div>
      ) : (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Gross Revenue" value={fmtCurrency(totals.grossRevenue)} accent="#16a34a" />
            <StatCard label="Net Revenue" value={fmtCurrency(totals.netRevenue)} accent={totals.netRevenue >= 0 ? '#16a34a' : '#dc2626'} />
            <StatCard label="Total Payroll" value={fmtCurrency(totals.payroll)} accent="#d97706" />
            <StatCard label="Total Expenses" value={fmtCurrency(totals.expenses)} accent="#7c3aed" />
          </div>

          {/* ── Daily Rate Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Daily Revenue" value={fmtCurrency(totals.dailyRevenue)} accent="#16a34a" sub="avg across incidents" />
            <StatCard label="Daily Net" value={fmtCurrency(totals.dailyNet)} accent={totals.dailyNet >= 0 ? '#16a34a' : '#dc2626'} sub="avg across incidents" />
            <StatCard label="Active Units" value={totals.unitCount} accent="#2563eb" sub={`${incidents.filter(i => i.status === 'Active').length} incidents`} />
            <StatCard label="Active Crew" value={totals.crewCount} accent="#0d9488" sub="deployed personnel" />
          </div>

          {/* ── Cumulative P&L Chart ── */}
          {chartData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-base font-semibold text-white mb-3">Cumulative P&L by Incident</h2>
              <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 50 + 80)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={axisStyle} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={axisStyle} width={130} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                  <Bar dataKey="Revenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Payroll" fill="#d97706" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Expenses" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-600 inline-block" /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" /> Payroll</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-violet-600 inline-block" /> Expenses</span>
              </div>
            </div>
          )}

          {/* ── Daily P&L Chart ── */}
          {dailyChartData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-base font-semibold text-white mb-3">Daily P&L Rate by Incident</h2>
              <ResponsiveContainer width="100%" height={Math.max(250, dailyChartData.length * 50 + 80)}>
                <BarChart data={dailyChartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid {...gridStyle} horizontal={false} />
                  <XAxis type="number" tick={axisStyle} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={axisStyle} width={130} />
                  <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} />
                  <Bar dataKey="Daily Revenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Daily Payroll" fill="#d97706" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Daily Net" fill={totals.dailyNet >= 0 ? '#22c55e' : '#ef4444'} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 justify-center mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-600 inline-block" /> Daily Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" /> Daily Payroll</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Daily Net</span>
              </div>
            </div>
          )}

          {/* ── Incident Breakdown Table ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-base font-semibold text-white">Incident Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-500 font-semibold uppercase">Incident</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-semibold uppercase">Days</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-semibold uppercase">Units</th>
                    <th className="text-center px-3 py-3 text-gray-500 font-semibold uppercase">Crew</th>
                    <th className="text-right px-3 py-3 text-gray-500 font-semibold uppercase">Revenue</th>
                    <th className="text-right px-3 py-3 text-gray-500 font-semibold uppercase">Payroll</th>
                    <th className="text-right px-3 py-3 text-gray-500 font-semibold uppercase">Expenses</th>
                    <th className="text-right px-3 py-3 text-gray-500 font-semibold uppercase">Net</th>
                    <th className="text-right px-3 py-3 text-gray-500 font-semibold uppercase">$/day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {incidents.map(inc => (
                    <tr key={inc.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/incidents/${inc.id}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                          {inc.name}
                        </Link>
                        <div className="text-gray-600 mt-0.5">
                          {inc.location && <span>{inc.location} · </span>}
                          <span className={inc.status === 'Active' ? 'text-green-500' : 'text-gray-600'}>{inc.status}</span>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-gray-300 font-medium">
                        {inc.days}{inc.status === 'Active' && <span className="text-gray-500">+</span>}
                      </td>
                      <td className="text-center px-3 py-3 text-gray-300">{inc.unitCount}</td>
                      <td className="text-center px-3 py-3 text-gray-300">{inc.crewCount}</td>
                      <td className="text-right px-3 py-3 text-green-400 font-medium">{fmtCurrency(inc.grossRevenue)}</td>
                      <td className="text-right px-3 py-3 text-amber-400">{fmtCurrency(inc.payroll)}</td>
                      <td className="text-right px-3 py-3 text-violet-400">{fmtCurrency(inc.expenses)}</td>
                      <td className={`text-right px-3 py-3 font-bold ${inc.netRevenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtCurrency(inc.netRevenue)}
                      </td>
                      <td className={`text-right px-3 py-3 font-medium ${inc.dailyNet >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                        {fmtCurrency(inc.dailyNet)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-700 bg-gray-950/50">
                    <td className="px-4 py-3 text-white font-bold uppercase text-xs">Totals</td>
                    <td className="text-center px-3 py-3 text-gray-400">—</td>
                    <td className="text-center px-3 py-3 text-white font-bold">{totals.unitCount}</td>
                    <td className="text-center px-3 py-3 text-white font-bold">{totals.crewCount}</td>
                    <td className="text-right px-3 py-3 text-green-400 font-bold">{fmtCurrency(totals.grossRevenue)}</td>
                    <td className="text-right px-3 py-3 text-amber-400 font-bold">{fmtCurrency(totals.payroll)}</td>
                    <td className="text-right px-3 py-3 text-violet-400 font-bold">{fmtCurrency(totals.expenses)}</td>
                    <td className={`text-right px-3 py-3 font-bold text-lg ${totals.netRevenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtCurrency(totals.netRevenue)}
                    </td>
                    <td className={`text-right px-3 py-3 font-bold ${totals.dailyNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtCurrency(totals.dailyNet)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Margin Analysis ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-base font-semibold text-white mb-3">Margin Analysis</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {totals.grossRevenue > 0 ? `${((totals.netRevenue / totals.grossRevenue) * 100).toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-gray-500 uppercase mt-1">Net Margin</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {totals.grossRevenue > 0 ? `${((totals.payroll / totals.grossRevenue) * 100).toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-gray-500 uppercase mt-1">Payroll % of Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {totals.grossRevenue > 0 ? `${((totals.expenses / totals.grossRevenue) * 100).toFixed(1)}%` : '—'}
                </div>
                <div className="text-xs text-gray-500 uppercase mt-1">Expense % of Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {totals.crewCount > 0 ? fmtCurrency(totals.netRevenue / totals.crewCount) : '—'}
                </div>
                <div className="text-xs text-gray-500 uppercase mt-1">Net / Active Crew</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
