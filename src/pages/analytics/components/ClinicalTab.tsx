import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { DateRange } from './analyticsTypes'
import { C, ACUITY_COLORS, getDateFilter, mapAcuity } from './analyticsTypes'
import { axisStyle, gridStyle, tooltipStyle } from './chartStyles'
import { StatCard } from './StatCard'
import { Empty } from './Empty'
import { Skeleton } from './Skeleton'
import { SectionHeader } from './SectionHeader'
import { DatePills } from './DatePills'
import { AgencyBarChart } from '@/components/charts/AgencyBarChart'
import { UnitFilterPills } from '@/components/ui'
import { getUnitTypeName } from '@/lib/unitColors'

export function ClinicalTab({ isField = false, assignedIncidentId = null, assignedUnitNames = [] }: {
  isField?: boolean
  assignedIncidentId?: string | null
  assignedUnitNames?: string[]
}) {
  const supabase = createClient()
  const [range, setRange] = useState<DateRange>('30d')
  const [loading, setLoading] = useState(true)

  const [encounters, setEncounters] = useState<{ date: string; primary_symptom_text: string | null; initial_acuity: string | null; patient_disposition: string | null; unit: string | null; incident_id: string | null; incident_name: string | null; patient_agency: string | null }[]>([])
  const [activeIncidents, setActiveIncidents] = useState<{ id: string; name: string }[]>([])
  const [incidentFilter, setIncidentFilter] = useState<string>('All')
  const [unitFilter, setUnitFilter] = useState<string>('All')
  const [meds, setMeds] = useState<{ item_name: string; count: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dateFrom = getDateFilter(range)

      let q = supabase.from('patient_encounters')
        .select('date, primary_symptom_text, initial_acuity, patient_disposition, unit, incident_id, patient_agency, incident:incidents(name)')
        .is('deleted_at', null)
      if (dateFrom) q = (q as any).gte('date', dateFrom)
      if (isField && assignedIncidentId) q = (q as any).eq('incident_id', assignedIncidentId)
      const [{ data: enc }, { data: incs }] = await Promise.all([
        q,
        isField ? Promise.resolve({ data: [] }) : supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
      ])
      setEncounters((enc || []).map((e: any) => ({ ...e, incident_name: e.incident?.name || null, patient_agency: e.patient_agency || null })))
      setActiveIncidents(incs || [])

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
  }, [range, isField, assignedIncidentId])

  useEffect(() => {
    load()
  }, [load])

  const filteredEncounters = encounters
    .filter(e => incidentFilter === 'All' || e.incident_id === incidentFilter)
    .filter(e => unitFilter === 'All' || e.unit === unitFilter)

  const availableUnits = isField && assignedUnitNames.length > 0
    ? assignedUnitNames
    : Array.from(new Set(encounters.map(e => e.unit).filter(Boolean))) as string[]

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const weekStart = (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] })()
  const todayStr = now.toISOString().split('T')[0]

  const thisMonth = filteredEncounters.filter(e => e.date >= monthStart).length
  const thisWeek  = filteredEncounters.filter(e => e.date >= weekStart).length
  const today     = filteredEncounters.filter(e => e.date === todayStr).length

  const dailyCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })
  const dailyData = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date: date.slice(5), count }))

  const complaintCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => {
    const k = e.primary_symptom_text || null
    if (k) complaintCounts[k] = (complaintCounts[k] || 0) + 1
  })
  const complaintData = Object.entries(complaintCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  const acuityCounts: Record<string, number> = { Immediate: 0, Delayed: 0, Minor: 0, Expectant: 0 }
  filteredEncounters.forEach(e => { acuityCounts[mapAcuity(e.initial_acuity)]++ })
  const acuityData = Object.entries(acuityCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
  const acuityTotal = acuityData.reduce((s, d) => s + d.value, 0)

  const dispCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { const k = e.patient_disposition; if (k) dispCounts[k] = (dispCounts[k] || 0) + 1 })
  const dispData = Object.entries(dispCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const unitCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { const k = e.unit; if (k) unitCounts[k] = (unitCounts[k] || 0) + 1 })
  const unitData = Object.entries(unitCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const agencyCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { const k = e.patient_agency; if (k) agencyCounts[k] = (agencyCounts[k] || 0) + 1 })
  const agencyData = Object.entries(agencyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([agency, count]) => ({ agency, count }))

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
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date range</label>
          <div className="md:hidden">
            <select
              value={range}
              onChange={e => setRange(e.target.value as DateRange)}
              className="bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-red-500 w-full"
            >
              {(['7d','30d','90d','1y','all'] as DateRange[]).map(r => (
                <option key={r} value={r}>{{ '7d':'Last 7 days','30d':'Last 30 days','90d':'Last 90 days','1y':'Last year','all':'All time' }[r]}</option>
              ))}
            </select>
          </div>
          <div className="hidden md:block">
            <DatePills range={range} setRange={setRange} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isField && activeIncidents.length > 0 && (
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-gray-500 mb-1 block">Incident</label>
              <select
                value={incidentFilter}
                onChange={e => setIncidentFilter(e.target.value)}
                className="bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-red-500 w-full"
              >
                <option value="All">All incidents</option>
                {activeIncidents.map(inc => (
                  <option key={inc.id} value={inc.id}>{inc.name}</option>
                ))}
              </select>
            </div>
          )}

          {availableUnits.length > 1 && (
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-gray-500 mb-1 block">Unit</label>
              <UnitFilterPills
                units={availableUnits}
                selected={unitFilter}
                onSelect={setUnitFilter}
                unitTypeMap={Object.fromEntries(availableUnits.map(u => [u, getUnitTypeName(u)]))}
              />
            </div>
          )}
        </div>
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

      {/* ── D: Patients by Agency ── */}
      <section>
        <SectionHeader title="🏛️ Patients by Agency" />
        {loading ? <Skeleton h="h-52" /> : agencyData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <AgencyBarChart data={agencyData} />
          </div>
        )}
      </section>

      {/* ── E: Disposition Summary ── */}
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

      {/* ── F: Top Medications ── */}
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

      {/* ── G: Encounters by Unit ── */}
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
