

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
  Legend,
} from 'recharts'

// ─── Color palette ───────────────────────────────────────────────────────────
const C = {
  red:    '#dc2626',
  blue:   '#2563eb',
  green:  '#16a34a',
  amber:  '#d97706',
  violet: '#7c3aed',
  gray:   '#6b7280',
  teal:   '#0d9488',
  pink:   '#db2777',
}

const ACUITY_COLORS: Record<string, string> = {
  'Immediate': C.red,
  'Delayed':   C.amber,
  'Minimal':   C.green,
  'Expectant': C.gray,
}

const PIE_COLORS = [C.red, C.blue, C.green, C.amber, C.violet, C.teal, C.pink, C.gray]

type DateRange = '7d' | '30d' | '90d' | 'all'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDateFilter(range: DateRange): string | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function mapAcuity(raw: string | null): string {
  if (!raw) return 'Expectant'
  const v = raw.toLowerCase()
  if (v.includes('critical') || v.includes('red') || v.includes('immediate')) return 'Immediate'
  if (v.includes('yellow') || v.includes('delayed') || v.includes('emergent')) return 'Delayed'
  if (v.includes('green') || v.includes('minor') || v.includes('non-acute') || v.includes('routine')) return 'Minimal'
  return 'Expectant'
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent = C.red, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-xs text-gray-600">{sub}</span>}
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function Empty({ text = 'No data yet' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-gray-600 text-sm">{text}</div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ h = 'h-40' }: { h?: string }) {
  return <div className={`${h} bg-gray-800/50 rounded-xl animate-pulse`} />
}

// ─── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

// ─── Chart wrappers ──────────────────────────────────────────────────────────
const axisStyle = { fill: '#9ca3af', fontSize: 11 }
const gridStyle = { stroke: '#1f2937' }
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 12 }

// ─── Date range pills ────────────────────────────────────────────────────────
function DatePills({ range, setRange }: { range: DateRange; setRange: (r: DateRange) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            range === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {r === 'all' ? 'All Time' : `Last ${r.replace('d', 'd')}`}
        </button>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CLINICAL TAB
// ════════════════════════════════════════════════════════════════════════════
function ClinicalTab() {
  const supabase = createClient()
  const [range, setRange] = useState<DateRange>('30d')
  const [loading, setLoading] = useState(true)

  // raw encounter rows
  const [encounters, setEncounters] = useState<{ date: string; primary_symptom_text: string | null; initial_acuity: string | null; patient_disposition: string | null; unit: string | null; incident_id: string | null; incident_name: string | null }[]>([])
  const [activeIncidents, setActiveIncidents] = useState<{ id: string; name: string }[]>([])
  const [incidentFilter, setIncidentFilter] = useState<string>('All')
  // medications
  const [meds, setMeds] = useState<{ item_name: string; count: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dateFrom = getDateFilter(range)

      let q = supabase.from('patient_encounters')
        .select('date, primary_symptom_text, initial_acuity, patient_disposition, unit, incident_id, incident:incidents(name)')
        .is('deleted_at', null)
      if (dateFrom) q = (q as any).gte('date', dateFrom)
      const [{ data: enc }, { data: incs }] = await Promise.all([
        q,
        supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
      ])
      setEncounters((enc || []).map((e: any) => ({ ...e, incident_name: e.incident?.name || null })))
      setActiveIncidents(incs || [])

      // Medications — all time (no date filter on dispense_admin_log.date text field is tricky; filter by created_at)
      let mq = supabase
        .from('dispense_admin_log')
        .select('item_name')
        .not('item_name', 'is', null)
      if (dateFrom) mq = mq.gte('date', dateFrom)
      const { data: medData } = await mq

      if (medData) {
        const counts: Record<string, number> = {}
        medData.forEach(m => {
          const k = m.item_name || 'Unknown'
          counts[k] = (counts[k] || 0) + 1
        })
        setMeds(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([item_name, count]) => ({ item_name, count }))
        )
      }
    } catch {
      // Offline — analytics require connectivity; show empty state
    }
    setLoading(false)
  }, [range])

  useEffect(() => { load() }, [load])

  // ── Incident-filtered encounter slice (client-side, instant) ───────────────
  const filteredEncounters = incidentFilter === 'All'
    ? encounters
    : encounters.filter(e => e.incident_id === incidentFilter)

  // ── Derived stats ──────────────────────────────────────────────────────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const weekStart = (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] })()
  const todayStr = now.toISOString().split('T')[0]

  const thisMonth = filteredEncounters.filter(e => e.date >= monthStart).length
  const thisWeek  = filteredEncounters.filter(e => e.date >= weekStart).length
  const today     = filteredEncounters.filter(e => e.date === todayStr).length

  // ── Daily encounters line chart (last 30 days of the selected range) ───────
  const dailyCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })
  const dailyData = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: date.slice(5), count })) // MM-DD

  // ── Chief complaints ──────────────────────────────────────────────────────
  const complaintCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => {
    const k = e.primary_symptom_text || null
    if (k) complaintCounts[k] = (complaintCounts[k] || 0) + 1
  })
  const complaintData = Object.entries(complaintCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  // ── Acuity breakdown ──────────────────────────────────────────────────────
  const acuityCounts: Record<string, number> = { Immediate: 0, Delayed: 0, Minimal: 0, Expectant: 0 }
  filteredEncounters.forEach(e => { acuityCounts[mapAcuity(e.initial_acuity)]++ })
  const acuityData = Object.entries(acuityCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
  const acuityTotal = acuityData.reduce((s, d) => s + d.value, 0)

  // ── Disposition ───────────────────────────────────────────────────────────
  const dispCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { const k = e.patient_disposition; if (k) dispCounts[k] = (dispCounts[k] || 0) + 1 })
  const dispData = Object.entries(dispCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  // ── Encounters by unit ────────────────────────────────────────────────────
  const unitCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { const k = e.unit; if (k) unitCounts[k] = (unitCounts[k] || 0) + 1 })
  const unitData = Object.entries(unitCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number; name?: string
  }) => {
    if ((percent ?? 0) < 0.05) return null
    const RADIAN = Math.PI / 180
    const cxN = cx ?? 0; const cyN = cy ?? 0
    const maN = midAngle ?? 0
    const r = (innerRadius ?? 0) + ((outerRadius ?? 0) - (innerRadius ?? 0)) * 0.6
    const x = cxN + r * Math.cos(-maN * RADIAN)
    const y = cyN + r * Math.sin(-maN * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {`${((percent ?? 0) * 100).toFixed(0)}%`}
      </text>
    )
  }

  return (
    <div className="space-y-8">
      {/* Date + Incident filters */}
      <div className="flex flex-col gap-2">
        <DatePills range={range} setRange={setRange} />
        {activeIncidents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-500">Incident:</span>
            <button
              onClick={() => setIncidentFilter('All')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                incidentFilter === 'All' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >All</button>
            {activeIncidents.map(inc => (
              <button
                key={inc.id}
                onClick={() => setIncidentFilter(inc.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  incidentFilter === inc.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >{inc.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── A: Encounter Volume ── */}
      <section>
        <SectionHeader title="📊 Encounter Volume" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Encounters" value={loading ? '—' : filteredEncounters.length} accent={C.red} />
          <StatCard label="This Month" value={loading ? '—' : thisMonth} accent={C.blue} />
          <StatCard label="This Week" value={loading ? '—' : thisWeek} accent={C.green} />
          <StatCard label="Today" value={loading ? '—' : today} accent={C.amber} />
        </div>
        {loading ? <Skeleton h="h-52" /> : dailyData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="date" tick={axisStyle} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke={C.red} strokeWidth={2} dot={false} name="Encounters" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── B: Chief Complaints ── */}
      <section>
        <SectionHeader title="🩺 Chief Complaints" sub="Top 15 by frequency" />
        {loading ? <Skeleton h="h-64" /> : complaintData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={complaintData} margin={{ top: 5, right: 10, left: 10, bottom: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.red} radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── C: Acuity Breakdown ── */}
      <section>
        <SectionHeader title="🚨 Acuity Breakdown" />
        {loading ? <Skeleton h="h-52" /> : acuityData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-64 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={acuityData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" labelLine={false} label={renderPieLabel}>
                    {acuityData.map((entry) => (
                      <Cell key={entry.name} fill={ACUITY_COLORS[entry.name] ?? C.gray} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => { const n = typeof v === 'number' ? v : 0; return [`${n} (${acuityTotal > 0 ? ((n / acuityTotal) * 100).toFixed(1) : 0}%)`, ''] as [string, string] }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {acuityData.map(d => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ACUITY_COLORS[d.name] ?? C.gray }} />
                  <span className="text-sm text-gray-300 flex-1">{d.name}</span>
                  <span className="text-sm font-bold text-white">{d.value}</span>
                  <span className="text-xs text-gray-500 w-10 text-right">
                    {acuityTotal > 0 ? `${((d.value / acuityTotal) * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── D: Disposition Summary ── */}
      <section>
        <SectionHeader title="📋 Disposition Summary" />
        {loading ? <Skeleton h="h-52" /> : dispData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dispData} margin={{ top: 5, right: 10, left: 10, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.blue} radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── E: Top Medications ── */}
      <section>
        <SectionHeader title="💊 Top Medications Administered" sub="Top 10 by frequency" />
        {loading ? <Skeleton h="h-52" /> : meds.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={meds} margin={{ top: 5, right: 10, left: 10, bottom: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="item_name" tick={{ ...axisStyle, fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.violet} radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── F: Encounters by Unit ── */}
      <section>
        <SectionHeader title="🚑 Encounters by Unit" />
        {loading ? <Skeleton h="h-44" /> : unitData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={Math.max(160, unitData.length * 40)}>
              <BarChart data={unitData} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.teal} radius={[4, 4, 0, 0]} name="Encounters" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// OPERATIONS TAB
// ════════════════════════════════════════════════════════════════════════════
type IncidentRow = {
  id: string
  name: string
  status: string
  start_date: string | null
  closed_at: string | null
  incident_units: { id: string }[]
}

function OperationsTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [encByIncident, setEncByIncident] = useState<{ incident_id: string; count: number }[]>([])
  const [unitsByType, setUnitsByType] = useState<{ name: string; value: number }[]>([])
  const [supplyItems, setSupplyItems] = useState<{ name: string; qty: number; category: string; incident_id?: string | null }[]>([])
  const [supplyIncidentFilter, setSupplyIncidentFilter] = useState<string>('All')

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: inc }, { data: enc }, { data: units }, { data: runItems }] = await Promise.all([
          supabase.from('incidents').select('id, name, status, start_date, closed_at, incident_units(id)'),
          supabase.from('patient_encounters').select('incident_id').not('incident_id', 'is', null),
          supabase.from('units').select('unit_type_id, unit_types!units_unit_type_id_fkey(name)') as unknown as Promise<{ data: { unit_type_id: string; unit_types: { name: string } | null }[] | null; error: unknown }>,
          supabase.from('supply_run_items').select('item_name, quantity, category, supply_run:supply_runs(incident_id)'),
        ])

        setIncidents((inc || []) as IncidentRow[])

        // encounters per incident
        const counts: Record<string, number> = {}
        ;(enc || []).forEach((e: { incident_id: string | null }) => {
          if (e.incident_id) counts[e.incident_id] = (counts[e.incident_id] || 0) + 1
        })
        setEncByIncident(Object.entries(counts).map(([incident_id, count]) => ({ incident_id, count })))

        // units by type
        const typeCounts: Record<string, number> = {}
        const unitsData = (units || []) as { unit_type_id: string; unit_types: { name: string } | null }[]
        unitsData.forEach((u) => {
          const t = u.unit_types?.name || 'Unknown'
          typeCounts[t] = (typeCounts[t] || 0) + 1
        })
        setUnitsByType(Object.entries(typeCounts).map(([name, value]) => ({ name, value })))

        // supply run items — keyed with incident_id for filtering
        const itemMap: Record<string, { qty: number; category: string; incident_id: string | null }> = {}
        ;(runItems || []).forEach((r: { item_name: string | null; quantity: number | null; category: string | null; supply_run: { incident_id: string | null }[] | { incident_id: string | null } | null }) => {
          if (!r.item_name) return
          // Supabase may return the join as an array or object depending on schema
          const sr = Array.isArray(r.supply_run) ? r.supply_run[0] : r.supply_run
          if (!itemMap[r.item_name]) itemMap[r.item_name] = { qty: 0, category: r.category || '', incident_id: sr?.incident_id || null }
          itemMap[r.item_name].qty += (r.quantity || 0)
        })
        setSupplyItems(
          Object.entries(itemMap)
            .sort((a, b) => b[1].qty - a[1].qty)
            .map(([name, { qty, category, incident_id }]) => ({ name, qty, category, incident_id }))
        )
      } catch {
        // Offline — analytics require connectivity; show empty state
      }
      setLoading(false)
    }
    load()
  }, [])

  const active = incidents.filter(i => i.status === 'Active')
  const totalUnitsDeployed = active.reduce((s, i) => s + (i.incident_units?.length || 0), 0)

  // avg duration of closed incidents
  const closedWithDuration = incidents.filter(i => i.status === 'Closed' && i.start_date && i.closed_at)
  const avgDuration = closedWithDuration.length > 0
    ? (closedWithDuration.reduce((s, i) => {
        const diff = new Date(i.closed_at!).getTime() - new Date(i.start_date!).getTime()
        return s + diff / (1000 * 60 * 60 * 24)
      }, 0) / closedWithDuration.length).toFixed(1)
    : '—'

  // top incidents by encounter count
  const incidentMap: Record<string, string> = {}
  incidents.forEach(i => { incidentMap[i.id] = i.name })

  const topIncidents = encByIncident
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(e => ({ name: incidentMap[e.incident_id] || e.incident_id.slice(0, 8), count: e.count }))

  return (
    <div className="space-y-8">
      {/* ── A: Stats ── */}
      <section>
        <SectionHeader title="🔥 Incident Summary" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Incidents" value={loading ? '—' : incidents.length} accent={C.red} />
          <StatCard label="Active Now" value={loading ? '—' : active.length} accent={C.green} />
          <StatCard label="Avg Duration (days)" value={loading ? '—' : avgDuration} accent={C.amber} />
          <StatCard label="Units Deployed" value={loading ? '—' : totalUnitsDeployed} accent={C.blue} />
        </div>
      </section>

      {/* ── B: Incidents Table ── */}
      <section>
        <SectionHeader title="📋 All Incidents" />
        {loading ? <Skeleton h="h-52" /> : incidents.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
              <span className="flex-1 min-w-0">Incident</span>
              <span className="w-20 shrink-0 hidden sm:block">Status</span>
              <span className="w-24 shrink-0 hidden md:block">Start Date</span>
              <span className="w-16 shrink-0 text-center">Units</span>
              <span className="w-20 shrink-0 text-center hidden sm:block">Encounters</span>
            </div>
            {incidents.slice(0, 20).map(inc => {
              const encCount = encByIncident.find(e => e.incident_id === inc.id)?.count || 0
              return (
                <div key={inc.id} className="flex items-center px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/40 transition-colors">
                  <span className="flex-1 min-w-0 font-medium truncate pr-2">{inc.name}</span>
                  <span className="w-20 shrink-0 hidden sm:block">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inc.status === 'Active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {inc.status}
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-gray-400 text-xs hidden md:block">
                    {inc.start_date ? new Date(inc.start_date).toLocaleDateString() : '—'}
                  </span>
                  <span className="w-16 shrink-0 text-center text-gray-400 text-xs">
                    {inc.incident_units?.length || 0}
                  </span>
                  <span className="w-20 shrink-0 text-center text-gray-400 text-xs hidden sm:block">
                    {encCount}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── C: Units by Type ── */}
      <section>
        <SectionHeader title="🚑 Units by Type" />
        {loading ? <Skeleton h="h-52" /> : unitsByType.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-full md:w-64 shrink-0">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={unitsByType} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                      dataKey="value" nameKey="name" labelLine={false}>
                      {unitsByType.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1">
                {unitsByType.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm text-gray-300 flex-1">{d.name}</span>
                    <span className="text-sm font-bold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── D: Encounters per Incident ── */}
      <section>
        <SectionHeader title="📊 Encounters per Incident" sub="Top 10" />
        {loading ? <Skeleton h="h-52" /> : topIncidents.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={Math.max(180, topIncidents.length * 35)}>
              <BarChart data={topIncidents} layout="vertical" margin={{ top: 5, right: 30, left: 160, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} horizontal={false} />
                <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} width={155} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.amber} radius={[0, 4, 4, 0]} name="Encounters" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── E: Supply Run Items Dispensed ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="🧰 Consumables Used" sub={supplyIncidentFilter === 'All' ? 'All incidents — top 20 by quantity' : 'Filtered by selected incident'} />
          <select value={supplyIncidentFilter} onChange={e => setSupplyIncidentFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1 focus:outline-none ml-3 shrink-0">
            <option value="All">All incidents</option>
            {incidents.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        {loading ? <Skeleton h="h-52" /> : (() => {
          const BAR_COLORS = [C.blue, C.teal, C.violet, C.pink, C.red, C.green, C.amber, C.gray]
          const CATEGORY_COLORS: Record<string, string> = {
            'CS': C.red, 'Medication': C.violet, 'IV': C.blue,
            'Airway': C.teal, 'Wound Care': C.pink, 'OTC': C.green, 'Supply': C.amber,
          }
          const filteredSupply = (supplyIncidentFilter === 'All'
            ? supplyItems
            : supplyItems.filter(i => i.incident_id === supplyIncidentFilter)
          ).slice(0, 20)
          if (filteredSupply.length === 0) return <Empty />
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={Math.max(240, filteredSupply.length * 28)}>
                <BarChart data={filteredSupply} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={gridStyle.stroke} />
                  <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={150} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Qty'] as [number, string]} />
                  <Bar dataKey="qty" radius={[0, 4, 4, 0]} name="Qty Used">
                    {filteredSupply.map((item, i) => (
                      <Cell key={item.name} fill={CATEGORY_COLORS[item.category] || BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-3 px-1">
                {Object.entries(CATEGORY_COLORS).filter(([cat]) =>
                  filteredSupply.some(i => i.category === cat)
                ).map(([cat, color]) => (
                  <span key={cat} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )
        })()}
      </section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// WORKFORCE TAB
// ════════════════════════════════════════════════════════════════════════════
const CERT_FIELDS: { key: string; label: string }[] = [
  { key: 'bls', label: 'BLS' },
  { key: 'acls', label: 'ACLS' },
  { key: 'pals', label: 'PALS' },
  { key: 'itls', label: 'ITLS' },
  { key: 'paramedic_license', label: 'Paramedic License' },
  { key: 'ambulance_driver_cert', label: 'Ambulance Driver' },
  { key: 's130', label: 'S-130' },
  { key: 's190', label: 'S-190' },
  { key: 'l180', label: 'L-180' },
  { key: 'ics100', label: 'ICS-100' },
  { key: 'ics200', label: 'ICS-200' },
  { key: 'ics700', label: 'ICS-700' },
  { key: 'ics800', label: 'ICS-800' },
]

type Employee = Record<string, string | number | null | boolean>

function WorkforceTab() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const certKeys = CERT_FIELDS.map(f => f.key).join(', ')
        const { data } = await supabase
          .from('employees')
          .select(`id, role, experience_level, status, ${certKeys}`)
          .eq('status', 'Active') as unknown as { data: Employee[] | null }
        setEmployees(data || [])
      } catch {
        // Offline — workforce analytics require connectivity
      }
      setLoading(false)
    }
    load()
  }, [])

  // ── Staffing breakdown ────────────────────────────────────────────────────
  const roleCounts: Record<string, number> = {}
  employees.forEach(e => {
    const r = (e.role as string) || 'Other'
    roleCounts[r] = (roleCounts[r] || 0) + 1
  })

  const roleData = Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  const countByRole = (roles: string[]) => employees.filter(e => roles.includes(e.role as string)).length

  // ── Credential compliance ─────────────────────────────────────────────────
  const isExpiringSoon = (val: string | null | undefined): boolean => {
    if (!val || typeof val !== 'string') return false
    const match = val.match(/(\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/)
    if (!match) return false
    const date = new Date(match[0])
    if (isNaN(date.getTime())) return false
    const daysUntil = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntil > 0 && daysUntil <= 90
  }

  const certData = CERT_FIELDS.map(({ key, label }) => {
    let complete = 0, expiring = 0, missing = 0
    employees.forEach(e => {
      const val = e[key]
      if (!val || val === '' || val === null) {
        missing++
      } else if (isExpiringSoon(val as string)) {
        expiring++
      } else {
        complete++
      }
    })
    return { name: label, complete, expiring, missing }
  })

  const totalCertSlots = certData.reduce((s, d) => s + d.complete + d.expiring + d.missing, 0)
  const totalComplete = certData.reduce((s, d) => s + d.complete, 0)
  const overallCompliance = totalCertSlots > 0 ? ((totalComplete / totalCertSlots) * 100).toFixed(1) : '—'

  // ── Experience distribution ───────────────────────────────────────────────
  const expCounts = { 'Junior ⭐': 0, 'Mid ⭐⭐': 0, 'Senior ⭐⭐⭐': 0 }
  employees.forEach(e => {
    const lvl = e.experience_level as number
    if (lvl === 1) expCounts['Junior ⭐']++
    else if (lvl === 2) expCounts['Mid ⭐⭐']++
    else if (lvl === 3) expCounts['Senior ⭐⭐⭐']++
  })
  const expData = Object.entries(expCounts).map(([name, count]) => ({ name, count }))

  return (
    <div className="space-y-8">
      {/* ── A: Staffing Summary ── */}
      <section>
        <SectionHeader title="👥 Staffing Summary" sub="Active employees" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <StatCard label="Total Staff" value={loading ? '—' : employees.length} accent={C.red} />
          <StatCard label="MDs / DOs" value={loading ? '—' : countByRole(['MD', 'DO', 'MD/DO'])} accent={C.blue} />
          <StatCard label="Paramedics" value={loading ? '—' : countByRole(['Paramedic', 'FP-C'])} accent={C.green} />
          <StatCard label="EMTs" value={loading ? '—' : countByRole(['EMT', 'EMT-B', 'AEMT'])} accent={C.amber} />
          <StatCard label="RNs" value={loading ? '—' : countByRole(['RN', 'CEN', 'CCRN'])} accent={C.violet} />
          <StatCard label="Other" value={loading ? '—' : employees.filter(e => !['MD', 'DO', 'MD/DO', 'Paramedic', 'FP-C', 'EMT', 'EMT-B', 'AEMT', 'RN', 'CEN', 'CCRN'].includes(e.role as string)).length} accent={C.gray} />
        </div>
        {loading ? <Skeleton h="h-52" /> : roleData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-64 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={roleData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" nameKey="name" labelLine={false}>
                    {roleData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {roleData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm text-gray-300 flex-1">{d.name}</span>
                  <span className="text-sm font-bold text-white">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── B: Credential Compliance ── */}
      <section>
        <SectionHeader title="✅ Credential Compliance" sub="Active employees · Based on cert field presence" />
        {loading ? <Skeleton h="h-64" /> : (
          <>
            {/* Big compliance number */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 flex items-center gap-6"
              style={{ borderLeftColor: parseFloat(overallCompliance) >= 80 ? C.green : parseFloat(overallCompliance) >= 60 ? C.amber : C.red, borderLeftWidth: 3 }}>
              <div>
                <div className="text-4xl font-bold text-white">{overallCompliance}%</div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">Overall Compliance</div>
              </div>
              <div className="flex gap-6 text-sm ml-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-400">Complete</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-gray-400">Expiring Soon (≤90d)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="text-gray-400">Missing</span>
                </div>
              </div>
            </div>

            {employees.length === 0 ? <Empty /> : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(260, certData.length * 28)}>
                  <BarChart data={certData} layout="vertical" margin={{ top: 5, right: 30, left: 115, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} width={110} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                    <Bar dataKey="complete" stackId="a" fill={C.green} name="Complete" />
                    <Bar dataKey="expiring" stackId="a" fill={C.amber} name="Expiring Soon" />
                    <Bar dataKey="missing" stackId="a" fill={C.red} name="Missing" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── C: Experience Distribution ── */}
      <section>
        <SectionHeader title="⭐ Experience Distribution" />
        {loading ? <Skeleton h="h-44" /> : employees.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={expData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.amber} radius={[4, 4, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════
type Tab = 'clinical' | 'operations' | 'workforce'

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('clinical')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'clinical',   label: 'Clinical',    icon: '🩺' },
    { id: 'operations', label: 'Operations',  icon: '🔥' },
    { id: 'workforce',  label: 'Workforce',   icon: '👥' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">Analytics</h1>
            <p className="text-gray-500 text-xs">Field ops intelligence dashboard</p>
          </div>
          <span className="text-2xl select-none">📊</span>
        </div>

        {/* Tab pills */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'clinical'   && <ClinicalTab />}
        {tab === 'operations' && <OperationsTab />}
        {tab === 'workforce'  && <WorkforceTab />}
      </div>
    </div>
  )
}
