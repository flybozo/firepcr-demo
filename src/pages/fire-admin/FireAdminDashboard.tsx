

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// ── Color palette (same as analytics page) ───────────────────────────────────
const C = {
  red: '#dc2626', blue: '#2563eb', green: '#16a34a',
  amber: '#d97706', violet: '#7c3aed', gray: '#6b7280',
  teal: '#0d9488', orange: '#ea580c',
}
const ACUITY_COLORS: Record<string, string> = {
  'Immediate': C.red, 'Delayed': C.amber, 'Minimal': C.green, 'Expectant': C.gray,
}
// Tailwind acuity pill classes matching the rest of the app
const ACUITY_PILL: Record<string, string> = {
  'Immediate': 'bg-red-900/60 text-red-300 border border-red-700/40',
  'Red': 'bg-red-900/60 text-red-300 border border-red-700/40',
  'Delayed': 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
  'Yellow': 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
  'Minimal': 'bg-green-900/60 text-green-300 border border-green-700/40',
  'Green': 'bg-green-900/60 text-green-300 border border-green-700/40',
  'Expectant': 'bg-gray-800 text-gray-400 border border-gray-700',
  'Black': 'bg-gray-900 text-gray-500 border border-gray-700',
}
const PIE_COLORS = [C.red, C.blue, C.green, C.amber, C.violet, C.teal, C.orange, C.gray]

const axisStyle = { fill: '#9ca3af', fontSize: 11 }
const gridStyle = { stroke: '#1f2937' }
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 12 }

// ── Types ────────────────────────────────────────────────────────────────────
type DashboardData = {
  incident: {
    id: string; name: string; location: string | null; incident_number: string | null
    start_date: string | null; end_date: string | null; status: string; notes: string | null
    agreement_number: string | null
  }
  org: { name: string; dba: string | null; logo_url: string | null } | null
  stats: {
    total_patients: number; total_encounters: number; units_deployed: number
    unique_units: string[]; comp_claims_count: number; ics214_count: number
  }
  analytics: {
    chief_complaints: { name: string; count: number }[]
    acuity_breakdown: { name: string; value: number }[]
    encounters_by_day: { date: string; count: number }[]
  }
  encounters: {
    id: string; encounter_id?: string | null; seq_id: string; date: string | null; unit: string | null
    patient_agency: string | null
    age: string | null; chief_complaint: string | null; acuity: string; disposition: string | null
    has_comp_claim: boolean; has_ama: boolean; created_at?: string | null
  }[]
  comp_claims: {
    id: string; seq_id: string; date_of_injury: string | null; status: string | null
    has_pdf: boolean; patient_seq_id: string | null; osha_recordable: boolean | null; created_at?: string | null
    supervisor_name?: string | null
  }[]
  ics214s: {
    id: string; ics214_id: string; unit: string | null; prepared_by: string | null
    date: string | null; status: string | null; has_pdf: boolean; pdf_file_name: string | null
    closed_at: string | null
  }[]
  code_label: string | null
  codeLabel?: string | null  // backward compat
  supply_aggregated?: { item_name: string; total_qty: number; unit: string; category: string }[]
}

// ── Shared helpers ────────────────────────────────────────────────────────────
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
function Empty({ text = 'No data' }: { text?: string }) {
  return <div className="flex items-center justify-center h-36 text-gray-600 text-sm">{text}</div>
}
function Skeleton({ h = 'h-40' }: { h?: string }) {
  return <div className={`${h} bg-gray-800/50 rounded-xl animate-pulse`} />
}
function Badge({ color, label }: { color: string; label: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '30', color }}>{label}</span>
}

const STATUS_COLOR: Record<string, string> = {
  'Active': C.green, 'Closed': C.gray, 'Open': C.green,
  'Pending': C.amber, 'Submitted': C.blue, 'Approved': C.green,
  'Denied': C.red, 'Under Review': C.violet,
}

// ── Tab 1: Overview ──────────────────────────────────────────────────────────
function OverviewTab({ data, filteredEncounters }: {
  data: DashboardData
  filteredEncounters: DashboardData['encounters']
}) {
  const { stats } = data

  // Recompute analytics from filtered encounters
  const filteredSeqIds = new Set(filteredEncounters.map(e => e.seq_id))
  const filteredCompClaimsCount = data.comp_claims.filter(
    cc => cc.patient_seq_id && filteredSeqIds.has(cc.patient_seq_id)
  ).length

  const chiefComplaintsMap: Record<string, number> = {}
  filteredEncounters.forEach(e => {
    if (e.chief_complaint) chiefComplaintsMap[e.chief_complaint] = (chiefComplaintsMap[e.chief_complaint] || 0) + 1
  })
  const filteredChiefComplaints = Object.entries(chiefComplaintsMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  const acuityCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { acuityCounts[e.acuity] = (acuityCounts[e.acuity] || 0) + 1 })
  const filteredAcuityBreakdown = Object.entries(acuityCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  const dailyCounts: Record<string, number> = {}
  filteredEncounters.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })
  const filteredEncountersByDay = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  const acuityTotal = filteredAcuityBreakdown.reduce((s, d) => s + d.value, 0)

  const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>
  }

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Total Patients" value={filteredEncounters.length} accent={C.red} />
        <StatCard label="Total Encounters" value={filteredEncounters.length} accent={C.blue} />
        <StatCard label="Units Deployed" value={stats.units_deployed} accent={C.green}
          sub={stats.unique_units.slice(0, 3).join(', ')} />
        <StatCard label="Comp Claims" value={filteredCompClaimsCount} accent={C.amber} />
        <StatCard label="ICS 214s" value={stats.ics214_count} accent={C.violet} />
        <StatCard label="Incident Status" value={data.incident.status || '—'} accent={STATUS_COLOR[data.incident.status] ?? C.gray} />
      </div>

      {/* Chief complaints bar chart */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">🩺 Chief Complaints (Top 10)</h3>
        {filteredChiefComplaints.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            {/* Vertical bar chart — works better on mobile */}
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filteredChiefComplaints} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="name" tick={{ ...axisStyle, fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.red} radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Acuity pie chart */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">🚨 Acuity Breakdown</h3>
        {filteredAcuityBreakdown.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-64 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={filteredAcuityBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" labelLine={false} label={renderPieLabel}>
                    {filteredAcuityBreakdown.map(entry => (
                      <Cell key={entry.name} fill={ACUITY_COLORS[entry.name] ?? C.gray} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => { const n = typeof v === 'number' ? v : 0; return [`${n} (${acuityTotal > 0 ? ((n / acuityTotal) * 100).toFixed(1) : 0}%)`, ''] as [string, string] }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {filteredAcuityBreakdown.map(d => (
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

      {/* Encounter volume line chart */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">📈 Encounter Volume by Day</h3>
        {filteredEncountersByDay.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={filteredEncountersByDay.map(d => ({ ...d, date: d.date.slice(5) }))} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="date" tick={axisStyle} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} dot={false} name="Encounters" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Tab 2: Patient Log ────────────────────────────────────────────────────────
function PatientLogTab({ data, code, logEvent }: { data: DashboardData; code: string; logEvent: (e: { event_type: string; tab?: string; document_type?: string; document_id?: string }) => void }) {
  const [unitFilter, setUnitFilter] = useState('All')
  const [selected, setSelected] = useState<typeof data.encounters[0] | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  // Build lookup: encounter seq_id → comp_claim
  const claimBySeqId = Object.fromEntries(
    data.comp_claims.map(cc => [cc.patient_seq_id, cc]).filter(([k]) => k)
  )

  const handleDownload = async (claimId: string) => {
    setDownloading(claimId)
    logEvent({ event_type: 'pdf_download', tab: 'patients', document_type: 'comp_claim', document_id: claimId })
    try {
      const res = await fetch(`/api/incident-access/download?code=${code}&type=comp_claim&id=${claimId}`)
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } finally {
      setDownloading(null)
    }
  }

  // Use units assigned to this incident (from incident_units), falling back to encounter units
  const assignedUnits = data.stats.unique_units && data.stats.unique_units.length > 0
    ? data.stats.unique_units
    : Array.from(new Set(data.encounters.map(e => e.unit).filter(Boolean)))
  const units = ['All', ...[...assignedUnits].sort()]
  const filtered = unitFilter === 'All' ? data.encounters : data.encounters.filter(e => e.unit === unitFilter)
  const byUnit: Record<string, typeof data.encounters> = {}
  filtered.forEach(e => {
    const u = e.unit || 'Unassigned'
    if (!byUnit[u]) byUnit[u] = []
    byUnit[u].push(e)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-gray-500 flex-1">{filtered.length} encounters · de-identified · tap to view</p>
        <div className="flex gap-1.5 flex-wrap">
          {units.map(u => (
            <button key={u} onClick={() => setUnitFilter(u)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilter === u ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(byUnit).map(([unitName, encs]) => (
        <div key={unitName} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-800 bg-gray-800/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">🚑 {unitName} — {encs.length} patient{encs.length !== 1 ? 's' : ''}</h3>
          </div>
          <div className="overflow-x-auto">
          {/* Column headers: ID | Date | Age | Agency | Chief Complaint | Disposition | CC/OSHA | Supervisor | Acuity */}
          <div className="grid grid-cols-[60px_60px_44px_90px_1fr_100px_110px_110px_72px] gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60 min-w-[760px]">
            <span>ID</span><span>Date</span><span>Age</span><span>Agency</span><span>Chief Complaint</span><span>Disposition</span><span>CC / OSHA</span><span>Supervisor</span><span>Acuity</span>
          </div>
          <div className="divide-y divide-gray-800/50 min-w-[760px]">
            {encs.map(enc => {
              const claim = claimBySeqId[enc.seq_id]
              return (
                <button key={enc.id} onClick={() => setSelected(enc === selected ? null : enc)}
                  className="w-full text-left grid grid-cols-[60px_60px_44px_90px_1fr_100px_110px_110px_72px] gap-2 px-4 py-2.5 text-sm hover:bg-gray-800/50 transition-colors items-center">
                  <span className="font-mono text-blue-400 text-xs font-semibold">{enc.seq_id}</span>
                  <span className="text-gray-400 text-xs">{enc.date ? new Date(enc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <span className="text-gray-400 text-xs">{enc.age || '—'}</span>
                  <span className="text-gray-300 text-xs truncate">{enc.patient_agency || <span className="text-gray-600">—</span>}</span>
                  <span className="text-white text-xs truncate">{enc.chief_complaint || <span className="text-gray-600 italic">Not recorded</span>}</span>
                  {/* Disposition */}
                  <span className="text-xs text-gray-300 truncate">{enc.disposition || <span className="text-gray-600 italic">In Process</span>}</span>
                  {/* CC / OSHA column */}
                  <span className="flex flex-col gap-1">
                    {enc.has_comp_claim && claim && (
                      <>
                        <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded leading-none">📋 CC Filed</span>
                        {claim.has_pdf && (
                          <button onClick={e => { e.stopPropagation(); handleDownload(claim.id) }}
                            disabled={downloading === claim.id}
                            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-1.5 py-0.5 rounded transition-colors leading-none w-fit">
                            {downloading === claim.id ? '...' : '⬇ CC PDF'}
                          </button>
                        )}
                      </>
                    )}
                    {enc.has_ama && <span className="text-xs bg-orange-900/50 text-orange-300 border border-orange-700/40 px-1.5 py-0.5 rounded leading-none">⚠️ AMA</span>}
                    {!enc.has_comp_claim && !enc.has_ama && <span className="text-gray-700 text-xs">—</span>}
                  </span>
                  {/* Supervisor from comp claim */}
                  <span className="text-xs text-gray-400 truncate">{(claim as any)?.supervisor_name || '—'}</span>
                  {/* Acuity — last column */}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium text-center ${ACUITY_PILL[enc.acuity] ?? 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                    {enc.acuity?.split(' ')[0] || '—'}
                  </span>
                </button>
              )
            })}
          </div>
          </div>{/* end overflow-x-auto */}
        </div>
      ))}

      {filtered.length === 0 && <Empty text="No encounters for this unit" />}

      {/* Patient detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{selected.seq_id}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="text-xs text-amber-400 bg-amber-900/20 px-3 py-1.5 rounded-lg">De-identified — no PHI shown</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Unit</span><span>{selected.unit || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{selected.date ? new Date(selected.date + 'T00:00:00').toLocaleDateString() : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Age</span><span>{selected.age || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Chief Complaint</span><span className="text-right max-w-[200px]">{selected.chief_complaint || '—'}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-500">Acuity</span><span className={`text-xs px-2 py-0.5 rounded font-medium ${ACUITY_PILL[selected.acuity] ?? 'bg-gray-800 text-gray-400 border border-gray-700'}`}>{selected.acuity}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Disposition</span><span>{selected.disposition || '—'}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 4: ICS 214s ──────────────────────────────────────────────────────────
function ICS214Tab({ data, code, logEvent }: { data: DashboardData; code: string; logEvent: (e: { event_type: string; tab?: string; document_type?: string; document_id?: string }) => void }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (formId: string) => {
    setDownloading(formId)
    logEvent({ event_type: 'pdf_download', tab: 'ics214', document_type: 'ics214', document_id: formId })
    try {
      const res = await fetch(`/api/incident-access/download?code=${code}&type=ics214&id=${formId}`)
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } finally {
      setDownloading(null)
    }
  }

  // Group by unit
  const byUnit: Record<string, typeof data.ics214s> = {}
  data.ics214s.forEach(f => {
    const k = f.unit || 'Unknown Unit'
    if (!byUnit[k]) byUnit[k] = []
    byUnit[k].push(f)
  })

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        {data.ics214s.length} ICS 214 Unit Activity Logs — grouped by unit.
      </p>

      {data.ics214s.length === 0 ? <Empty text="No ICS 214s on file for this incident" /> : (
        Object.entries(byUnit).map(([unit, forms]) => (
          <section key={unit}>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              🚑 {unit}
              <span className="text-xs text-gray-600 font-normal">{forms.length} log{forms.length !== 1 ? 's' : ''}</span>
            </h3>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[90px_1fr_100px_100px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
                <span>Date</span>
                <span>Prepared By</span>
                <span>Status</span>
                <span className="text-right">PDF</span>
              </div>
              {forms.map(form => (
                <div key={form.id} className="grid grid-cols-[90px_1fr_100px_100px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 transition-colors items-center">
                  <span className="text-gray-400 text-xs">{form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}</span>
                  <span className="text-white text-sm truncate">{form.prepared_by || '—'}</span>
                  <span>
                    <Badge color={form.status === 'Closed' ? C.gray : C.green} label={form.status || 'Open'} />
                  </span>
                  <div className="flex justify-end">
                    {form.has_pdf ? (
                      <button
                        onClick={() => handleDownload(form.id)}
                        disabled={downloading === form.id}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg transition-colors"
                      >
                        {downloading === form.id ? '...' : '⬇ PDF'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-700">No PDF</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
// ── Tab 5: Supply ────────────────────────────────────────────────────────────
function SupplyTab({ data }: { data: DashboardData }) {
  const items = data.supply_aggregated || []
  if (items.length === 0) return <Empty text="No supply run data for this incident" />

  const BAR_COLORS = [C.blue, C.teal, C.violet, C.orange, C.red, C.green, C.amber]
  const chartItems = items.slice(0, 20)

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-1">🧰 Consumables Used — All Units Combined</h3>
        <p className="text-xs text-gray-500 mb-4">Full incident totals — not affected by date filter</p>
        <ResponsiveContainer width="100%" height={Math.max(200, chartItems.length * 28)}>
          <BarChart data={chartItems} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis type="number" tick={axisStyle} />
            <YAxis type="category" dataKey="item_name" tick={{ ...axisStyle, fontSize: 10 }} width={140} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, _: unknown, entry: { payload?: { unit?: string } }) => [`${v} ${entry.payload?.unit || ''}`.trim(), 'Qty']} />
            <Bar dataKey="total_qty" radius={[0, 4, 4, 0]}>
              {chartItems.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
          <span>Item</span><span className="text-right">Total Qty</span><span className="text-right">Unit</span>
        </div>
        {items.map(item => (
          <div key={item.item_name} className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 border-b border-gray-800/50 text-sm items-center hover:bg-gray-800/30">
            <span className="text-xs text-white truncate">{item.item_name}</span>
            <span className="text-right text-xs font-mono text-blue-300">{item.total_qty}</span>
            <span className="text-right text-xs text-gray-400">{item.unit || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type Tab = 'overview' | 'patients' | 'ics214' | 'supply'
type DateFilter = 'all' | '24h' | '48h' | '7d'

export default function FireAdminPage() {
  const params = useParams()
  const code = params.code as string
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  // Fire-and-forget event logger — records tab views + PDF downloads
  const logEvent = (event: { event_type: string; tab?: string; document_type?: string; document_id?: string }) => {
    if (!code) return
    fetch('/api/incident-access/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase(), ...event }),
    }).catch(() => {/* silent */})
  }

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab)
    logEvent({ event_type: 'tab_view', tab: newTab })
  }

  useEffect(() => {
    if (!code) return
    fetch(`/api/incident-access?code=${code.toUpperCase()}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [code])

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'patients', label: 'Patient Log', icon: '📋' },
    { id: 'ics214', label: 'ICS 214s', icon: '📝' },
    { id: 'supply', label: 'Supply', icon: '🧰' },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyDateFilter = (items: any[]): any[] => {
    if (dateFilter === 'all') return items
    const now = Date.now()
    const ms = dateFilter === '24h' ? 86400000 : dateFilter === '48h' ? 172800000 : 604800000
    return items.filter((i: { created_at?: string | null }) => i.created_at && now - new Date(i.created_at).getTime() <= ms)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
        <p className="text-gray-500 text-sm">Loading incident dashboard...</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="bg-gray-900 border border-red-900 rounded-2xl p-8 max-w-md w-full text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-lg font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm mb-4">{error || 'Invalid access code'}</p>
          <p className="text-xs text-gray-600">
            Contact your Medical Unit Leader or the medical team for a valid access code.
          </p>
        </div>
      </div>
    )
  }

  const org = data.org
  const orgName = org?.dba || org?.name || 'Remote Area Medicine'
  const inc = data.incident

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ── */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {org?.logo_url ? (
            <img src={org.logo_url} alt={orgName} className="w-9 h-9 rounded-full object-contain bg-white p-0.5 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm shrink-0">🔥</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white leading-tight truncate">{orgName}</h1>
            <p className="text-xs text-gray-500 truncate">Incident Medical Dashboard</p>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <p className="text-xs text-gray-500">Access Code</p>
            <p className="text-sm font-mono font-bold text-amber-400">{code.toUpperCase()}</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-6">
        {/* ── Incident info card ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-500 text-sm">🔥</span>
                <h2 className="text-xl font-bold text-white">{inc.name}</h2>
                <Badge color={STATUS_COLOR[inc.status] ?? C.gray} label={inc.status || 'Unknown'} />
              </div>
              <div className="text-sm text-gray-400 space-y-0.5">
                {inc.location && <p>📍 {inc.location}</p>}
                {inc.incident_number && <p>🔢 Incident #{inc.incident_number}</p>}
                {inc.agreement_number && <p>📋 Agreement #{inc.agreement_number}</p>}
              </div>
            </div>
            <div className="text-right text-xs text-gray-500 space-y-0.5">
              {inc.start_date && <p>Start: {new Date(inc.start_date + 'T00:00:00').toLocaleDateString()}</p>}
              {inc.end_date && <p>End: {new Date(inc.end_date + 'T00:00:00').toLocaleDateString()}</p>}
              {data.code_label && <p className="text-amber-500 font-medium">{data.code_label}</p>}
            </div>
          </div>
        </div>

        {/* ── Tab pills + date filter ── */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)}
            className="ml-auto bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500">
            <option value="all">All time</option>
            <option value="24h">Last 24h</option>
            <option value="48h">Last 48h</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>

        {/* ── Tab content ── */}
        {tab === 'overview' && <OverviewTab data={data} filteredEncounters={applyDateFilter(data.encounters)} />}
        {tab === 'patients' && <PatientLogTab data={{ ...data, encounters: applyDateFilter(data.encounters) }} code={code} logEvent={logEvent} />}
        {tab === 'ics214' && <ICS214Tab data={data} code={code} logEvent={logEvent} />}
        {tab === 'supply' && <SupplyTab data={data} />}

        {/* ── Footer ── */}
        <footer className="pt-4 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-700">
            {orgName} — Confidential Medical Data — Authorized Personnel Only
          </p>
          <p className="text-xs text-gray-800 mt-1">
            This dashboard contains de-identified medical information. Do not share or distribute.
          </p>
        </footer>
      </div>
    </div>
  )
}
