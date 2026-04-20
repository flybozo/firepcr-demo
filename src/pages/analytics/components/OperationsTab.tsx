import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { C, PIE_COLORS } from './analyticsTypes'
import { axisStyle, gridStyle, tooltipStyle } from './chartStyles'
import { StatCard } from './StatCard'
import { Empty } from './Empty'
import { Skeleton } from './Skeleton'
import { SectionHeader } from './SectionHeader'

type IncidentRow = {
  id: string
  name: string
  status: string
  start_date: string | null
  closed_at: string | null
  incident_units: { id: string }[]
}

export function OperationsTab() {
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

        const counts: Record<string, number> = {}
        ;(enc || []).forEach((e: { incident_id: string | null }) => {
          if (e.incident_id) counts[e.incident_id] = (counts[e.incident_id] || 0) + 1
        })
        setEncByIncident(Object.entries(counts).map(([incident_id, count]) => ({ incident_id, count })))

        const typeCounts: Record<string, number> = {}
        const unitsData = (units || []) as { unit_type_id: string; unit_types: { name: string } | null }[]
        unitsData.forEach((u) => {
          const t = u.unit_types?.name || 'Unknown'
          typeCounts[t] = (typeCounts[t] || 0) + 1
        })
        setUnitsByType(Object.entries(typeCounts).map(([name, value]) => ({ name, value })))

        const itemMap: Record<string, { qty: number; category: string; incident_id: string | null }> = {}
        ;(runItems || []).forEach((r: { item_name: string | null; quantity: number | null; category: string | null; supply_run: { incident_id: string | null }[] | { incident_id: string | null } | null }) => {
          if (!r.item_name) return
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

  const closedWithDuration = incidents.filter(i => i.status === 'Closed' && i.start_date && i.closed_at)
  const avgDuration = closedWithDuration.length > 0
    ? (closedWithDuration.reduce((s, i) => {
        const diff = new Date(i.closed_at!).getTime() - new Date(i.start_date!).getTime()
        return s + diff / (1000 * 60 * 60 * 24)
      }, 0) / closedWithDuration.length).toFixed(1)
    : '—'

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
            <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
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
