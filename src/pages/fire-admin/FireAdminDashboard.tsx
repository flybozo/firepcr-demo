

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { UnitFilterPills } from '@/components/ui'
import { getUnitTypeName } from '@/lib/unitColors'
import { AgencyBarChart } from '@/components/charts/AgencyBarChart'
import { AgencyLogo } from '@/components/AgencyLogo'
import { Avatar } from '@/components/chat/Avatar'
import { brand } from '@/lib/branding.config'
import { useParams } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { ContactCards } from '@/components/ContactCards'
import { TimelineTab } from '@/components/timeline/TimelineTab'
import { generateOpsReportPdf } from '@/lib/generateOpsReportPdf'
import { lazy, Suspense } from 'react'
const LazyUnitMap = lazy(() => import('@/components/maps/UnitMap'))
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
  'Immediate': C.red, 'Delayed': C.amber, 'Minor': C.green, 'Expectant': C.gray,
}
// Tailwind acuity pill classes matching the rest of the app
const ACUITY_PILL: Record<string, string> = {
  'Immediate': 'bg-red-900/60 text-red-300 border border-red-700/40',
  'Red': 'bg-red-900/60 text-red-300 border border-red-700/40',
  'Delayed': 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
  'Yellow': 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
  'Minor': 'bg-green-900/60 text-green-300 border border-green-700/40',
  'Green': 'bg-green-900/60 text-green-300 border border-green-700/40',
  'Expectant': 'bg-gray-800 text-gray-400 border border-gray-700',
  'Black': 'bg-gray-900 text-gray-500 border border-gray-700',
}
const PIE_COLORS = [C.red, C.blue, C.green, C.amber, C.violet, C.teal, C.orange, C.gray]

const axisStyle = { fill: '#9ca3af', fontSize: 11 }
const gridStyle = { stroke: '#1f2937' }
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 12 }

// ── Types ────────────────────────────────────────────────────────────────────
export type DashboardData = {
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
  code_avatar_url?: string | null
  channel_id?: string | null
  codeLabel?: string | null  // backward compat
  supply_aggregated?: { item_name: string; total_qty: number; unit: string; category: string }[]
  supply_items?: { item_name: string; quantity: number; unit_of_measure: string; category: string; created_at: string }[]
  medical_directors?: { id: string; name: string; role: string; phone: string | null; email: string | null; headshot_url: string | null }[]
  deployed_units?: { unit_name: string; crew: { name: string; role: string; role_on_unit: string; phone: string | null; email: string | null; headshot_url: string | null }[] }[]
  unit_locations?: { unit_id: string; unit_name: string; unit_type: string; latitude: number; longitude: number; accuracy_meters: number | null; heading: number | null; last_seen: string; reporter_name: string | null }[]
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
  const [generatingPdf, setGeneratingPdf] = React.useState(false)

  const handleGenerateReport = async () => {
    setGeneratingPdf(true)
    try {
      generateOpsReportPdf(data)
    } finally {
      setGeneratingPdf(false)
    }
  }
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

  const agencyCountsMap: Record<string, number> = {}
  filteredEncounters.forEach(e => { if (e.patient_agency) agencyCountsMap[e.patient_agency] = (agencyCountsMap[e.patient_agency] || 0) + 1 })
  const filteredAgencyData = Object.entries(agencyCountsMap)
    .sort((a, b) => b[1] - a[1])
    .map(([agency, count]) => ({ agency, count }))

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
      {/* 24hr Report button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerateReport}
          disabled={generatingPdf}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {generatingPdf ? 'Generating…' : '📄 24hr Report'}
        </button>
      </div>

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

      {/* Patients by Agency */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">🏛️ Patients by Agency</h3>
        {filteredAgencyData.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <AgencyBarChart data={filteredAgencyData} />
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
function PatientLogTab({ data, code, logEvent, isPreview }: { data: DashboardData; code: string; logEvent: (e: { event_type: string; tab?: string; document_type?: string; document_id?: string }) => void; isPreview?: boolean }) {
  const [unitFilter, setUnitFilter] = useState('All')
  const [selected, setSelected] = useState<typeof data.encounters[0] | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleExportCsv = () => {
    import('@/lib/exportCsv').then(({ exportPatientLogCsv }) => {
      exportPatientLogCsv(filtered, data.incident.name)
    })
  }

  // Build lookup: encounter seq_id → comp_claim
  const claimBySeqId = Object.fromEntries(
    data.comp_claims.map(cc => [cc.patient_seq_id, cc]).filter(([k]) => k)
  )

  const handleDownload = async (claimId: string) => {
    setDownloading(claimId)
    logEvent({ event_type: 'pdf_download', tab: 'patients', document_type: 'comp_claim', document_id: claimId })
    try {
      const res = await fetch(isPreview
            ? `/api/incident-access/download?incidentId=${code}&type=comp_claim&id=${claimId}`
            : `/api/incident-access/download?code=${code}&type=comp_claim&id=${claimId}`,
          isPreview ? { headers: { Authorization: `Bearer ${(await createClient().auth.getSession()).data?.session?.access_token ?? ''}` } } : undefined)
      const { url } = await res.json()
      if (url) {
        // Use anchor click instead of window.open — mobile browsers block popups from async callbacks
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } finally {
      setDownloading(null)
    }
  }

  // Only show units that were actually deployed to this incident (from incident_units)
  const assignedUnits = data.stats.unique_units?.filter(Boolean) || []
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
      <UnitFilterPills
        units={units}
        selected={unitFilter}
        onSelect={setUnitFilter}
        unitTypeMap={Object.fromEntries(assignedUnits.map(u => [u, getUnitTypeName(u)]))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-gray-500 flex-1">{filtered.length} encounters · de-identified · tap to view</p>
        <button
          onClick={handleExportCsv}
          className="px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors border border-gray-700"
        >
          📥 Export CSV
        </button>
      </div>

      {Object.entries(byUnit).map(([unitName, encs]) => (
        <div key={unitName} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b theme-card-header">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">🚑 {unitName} — {encs.length} patient{encs.length !== 1 ? 's' : ''}</h3>
          </div>
          {/* Mobile layout: compact card-style rows */}
          <div className="md:hidden divide-y divide-gray-800/30">
            {encs.map(enc => {
              const claim = claimBySeqId[enc.seq_id]
              return (
                <button key={enc.id} onClick={() => setSelected(enc === selected ? null : enc)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800/40 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-blue-400 text-xs font-semibold">{enc.seq_id}</span>
                    <span className="text-gray-500 text-xs">{enc.date ? new Date(enc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                    {enc.patient_agency && <AgencyLogo agency={enc.patient_agency} size={20} />}
                    <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-medium ${ACUITY_PILL[enc.acuity] ?? 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                      {enc.acuity?.split(' ')[0] || '—'}
                    </span>
                  </div>
                  <p className="text-sm text-white">{enc.chief_complaint || <span className="text-gray-600 italic">Not recorded</span>}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {enc.age && <span className="text-xs text-gray-500">Age {enc.age}</span>}
                    {enc.has_comp_claim && claim?.has_pdf && (
                      <button onClick={e => { e.stopPropagation(); handleDownload(claim.id) }}
                        disabled={downloading === claim.id}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-1.5 py-0.5 rounded transition-colors leading-none">
                        {downloading === claim.id ? '...' : '⬇ CC PDF'}
                      </button>
                    )}
                    {enc.has_ama && <span className="text-xs bg-orange-900/50 text-orange-300 border border-orange-700/40 px-1.5 py-0.5 rounded leading-none">AMA</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Desktop layout: full grid table */}
          <div className="hidden md:block">
          <div className="grid grid-cols-[60px_60px_44px_90px_1fr_110px_110px_72px] gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
            <span>ID</span><span>Date</span><span>Age</span><span>Agency</span><span>Chief Complaint</span><span>CC / OSHA</span><span>Supervisor</span><span>Acuity</span>
          </div>
          <div className="divide-y divide-gray-800/50">
            {encs.map(enc => {
              const claim = claimBySeqId[enc.seq_id]
              return (
                <button key={enc.id} onClick={() => setSelected(enc === selected ? null : enc)}
                  className="w-full text-left grid grid-cols-[60px_60px_44px_90px_1fr_110px_110px_72px] gap-2 px-4 py-2.5 text-sm hover:bg-gray-800/50 transition-colors items-center">
                  <span className="font-mono text-blue-400 text-xs font-semibold">{enc.seq_id}</span>
                  <span className="text-gray-400 text-xs">{enc.date ? new Date(enc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <span className="text-gray-400 text-xs">{enc.age || '—'}</span>
                  <span className="flex items-center justify-center">{enc.patient_agency ? <AgencyLogo agency={enc.patient_agency} size={24} /> : <span className="text-gray-600">—</span>}</span>
                  <span className="text-white text-xs truncate">{enc.chief_complaint || <span className="text-gray-600 italic">Not recorded</span>}</span>
                  {/* CC / OSHA column */}
                  <span className="flex flex-col gap-1">
                    {enc.has_comp_claim && claim?.has_pdf && (
                      <button onClick={e => { e.stopPropagation(); handleDownload(claim.id) }}
                        disabled={downloading === claim.id}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-1.5 py-0.5 rounded transition-colors leading-none w-fit">
                        {downloading === claim.id ? '...' : '⬇ CC PDF'}
                      </button>
                    )}
                    {enc.has_ama && <span className="text-xs bg-orange-900/50 text-orange-300 border border-orange-700/40 px-1.5 py-0.5 rounded leading-none">⚠️ AMA</span>}
                    {!enc.has_ama && !(enc.has_comp_claim && claim?.has_pdf) && <span className="text-gray-700 text-xs">—</span>}
                  </span>
                  {/* Supervisor from comp claim */}
                  <span className="text-xs text-gray-400 truncate">{claim?.supervisor_name || '—'}</span>
                  {/* Acuity — last column */}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium text-center ${ACUITY_PILL[enc.acuity] ?? 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                    {enc.acuity?.split(' ')[0] || '—'}
                  </span>
                </button>
              )
            })}
          </div>
          </div>{/* end desktop */}
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
function ICS214Tab({ data, code, logEvent, isPreview }: { data: DashboardData; code: string; logEvent: (e: { event_type: string; tab?: string; document_type?: string; document_id?: string }) => void; isPreview?: boolean }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (formId: string) => {
    setDownloading(formId)
    logEvent({ event_type: 'pdf_download', tab: 'ics214', document_type: 'ics214', document_id: formId })
    try {
      const res = await fetch(isPreview
            ? `/api/incident-access/download?incidentId=${code}&type=ics214&id=${formId}`
            : `/api/incident-access/download?code=${code}&type=ics214&id=${formId}`,
          isPreview ? { headers: { Authorization: `Bearer ${(await createClient().auth.getSession()).data?.session?.access_token ?? ''}` } } : undefined)
      const { url } = await res.json()
      if (url) {
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
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
              <div className="grid grid-cols-[90px_1fr_100px_100px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
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
function SupplyTab({ data, dateFilter }: { data: DashboardData; dateFilter?: DateFilter }) {
  // Re-aggregate from raw items when date filter is active
  const items = useMemo(() => {
    if (!dateFilter || dateFilter === 'all' || !data.supply_items?.length) {
      return data.supply_aggregated || []
    }
    const ms = dateFilter === '24h' ? 86400000 : dateFilter === '48h' ? 172800000 : 604800000
    const cutoff = Date.now() - ms
    const filtered = data.supply_items.filter(i => i.created_at && new Date(i.created_at).getTime() >= cutoff)
    const totals: Record<string, { qty: number; unit: string; category: string }> = {}
    filtered.forEach(i => {
      if (!i.item_name) return
      if (!totals[i.item_name]) totals[i.item_name] = { qty: 0, unit: i.unit_of_measure || '', category: i.category || '' }
      totals[i.item_name].qty += i.quantity || 0
    })
    return Object.entries(totals)
      .map(([item_name, { qty, unit, category }]) => ({ item_name, total_qty: qty, unit, category }))
      .sort((a, b) => b.total_qty - a.total_qty)
  }, [data.supply_aggregated, data.supply_items, dateFilter])

  if (items.length === 0) return <Empty text={dateFilter && dateFilter !== 'all' ? 'No supply runs in this time period' : 'No supply run data for this incident'} />

  const BAR_COLORS = [C.blue, C.teal, C.violet, C.orange, C.red, C.green, C.amber]
  const chartItems = items.slice(0, 20)
  const filterLabel = !dateFilter || dateFilter === 'all' ? 'Full incident' : dateFilter === '24h' ? 'Last 24 hours' : dateFilter === '48h' ? 'Last 48 hours' : 'Last 7 days'

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-white mb-1">🧰 Consumables Used — All Units Combined</h3>
        <p className="text-xs text-gray-500 mb-4">{filterLabel} — {items.reduce((s, i) => s + i.total_qty, 0)} items across {items.length} types</p>
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
        <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
          <span>Item</span><span className="text-right">Total Qty</span><span className="text-right">Unit</span>
        </div>
        {items.map(item => (
          <div key={item.item_name} className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 border-b border-gray-800/50 text-sm items-center hover:theme-card-footer">
            <span className="text-xs text-white truncate">{item.item_name}</span>
            <span className="text-right text-xs font-mono text-blue-300">{item.total_qty}</span>
            <span className="text-right text-xs text-gray-400">{item.unit || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type ExternalMessage = {
  id: string
  channel_id: string
  content: string
  message_type: string
  file_url?: string | null
  file_name?: string | null
  created_at: string
  external_sender_name?: string | null
  sender: { id: string | null; name: string; headshot_url: string | null }
}

function ChatTab({ code, channelId, codeLabel, codeAvatarUrl }: { code: string; channelId: string | null; codeLabel: string | null; codeAvatarUrl?: string | null }) {
  const [messages, setMessages] = useState<ExternalMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(codeAvatarUrl || null)
  const [uploading, setUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setSendError('Please upload a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setSendError('Image must be under 2MB.')
      return
    }
    setUploading(true)
    setSendError(null)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/incident-access/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, image: dataUrl }),
      })
      const json = await res.json()
      if (json.avatar_url) {
        setAvatarUrl(json.avatar_url)
      } else if (json.error) {
        setSendError(json.error)
      }
    } catch {
      setSendError('Failed to upload avatar')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const fetchMessages = useCallback(async () => {
    if (!channelId) return
    try {
      const res = await fetch(`/api/incident-access/chat?code=${encodeURIComponent(code)}&channelId=${encodeURIComponent(channelId)}`)
      const json = await res.json()
      if (json.messages) {
        setMessages(json.messages)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch { /* silent */ }
  }, [code, channelId])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
      setSendError('Please select a JPEG, PNG, WebP, or GIF image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSendError('Image must be under 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const sendPhoto = async () => {
    if (!photoPreview || !channelId || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/incident-access/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, channelId, image: photoPreview }),
      })
      const json = await res.json()
      if (json.error) {
        setSendError(json.error)
      } else {
        setPhotoPreview(null)
        setMessages((prev) => [...prev, json.message])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch {
      setSendError('Failed to send photo')
    } finally {
      setSending(false)
    }
  }

  const send = async () => {
    if (!input.trim() || !channelId || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/incident-access/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, channelId, content: input.trim() }),
      })
      const json = await res.json()
      if (json.error) {
        setSendError(json.error)
      } else {
        setInput('')
        setMessages((prev) => {
          return [...prev, json.message]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch {
      setSendError('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (!channelId) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No external chat channel found for this access code.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden" style={{ height: 520 }}>
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 shrink-0">
        <span>🔥</span>
        <span className="text-sm font-semibold text-white">External Chat</span>
        <span className="text-xs text-gray-600 ml-auto">Auto-refreshes every 3s</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">No messages yet. Start the conversation!</div>
        )}
        {messages.map((msg) => {
          const isExternal = msg.sender.id === null
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          // For external messages, use their uploaded avatar or the API-returned one
          const extAvatar = isExternal ? (msg.sender.headshot_url || avatarUrl) : null
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isExternal ? 'justify-end' : 'justify-start'}`}>
              {/* Avatar: team member on the left */}
              {!isExternal && (
                <Avatar person={{ name: msg.sender.name, headshot_url: msg.sender.headshot_url }} size={28} />
              )}
              <div className={`flex flex-col ${isExternal ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-gray-400">{msg.sender.name}</span>
                  <span className="text-xs text-gray-600">{time}</span>
                </div>
                <div
                  className={`rounded-xl text-sm text-white break-words ${
                    isExternal
                      ? 'bg-red-900/60 border border-red-700/40'
                      : 'bg-gray-800 border border-gray-700'
                  } ${msg.message_type === 'image' && msg.file_url ? 'p-1' : 'px-3 py-2'}`}
                >
                  {msg.message_type === 'image' && msg.file_url ? (
                    <img
                      src={msg.file_url}
                      alt={msg.file_name || 'Image'}
                      className="max-h-[200px] rounded-lg cursor-pointer object-contain"
                      onClick={() => setLightboxUrl(msg.file_url!)}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
              {/* External user avatar: uploaded headshot or fire emoji */}
              {isExternal && (
                extAvatar ? (
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                    title="Click to change your photo"
                  >
                    <img src={extAvatar} alt={msg.sender.name} className="w-7 h-7 rounded-full object-cover shrink-0 border border-orange-700/40 group-hover:ring-2 group-hover:ring-orange-500 transition-all" />
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-white">📷</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-7 h-7 rounded-full bg-orange-900/60 border border-orange-700/40 flex items-center justify-center text-sm shrink-0 cursor-pointer hover:ring-2 hover:ring-orange-500 transition-all group relative"
                    onClick={() => fileInputRef.current?.click()}
                    title="Click to upload your photo"
                  >
                    🔥
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-300 text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Upload photo
                    </div>
                  </div>
                )
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {uploading && <p className="text-xs text-amber-400 px-4 py-1 shrink-0">Uploading photo...</p>}
      {sendError && <p className="text-xs text-red-400 px-4 py-1 shrink-0">{sendError}</p>}

      {/* Photo preview */}
      {photoPreview && (
        <div className="px-3 pb-2 shrink-0">
          <div className="relative inline-block">
            <img src={photoPreview} alt="Preview" className="max-h-24 rounded-lg object-contain border border-gray-700" />
            <button
              onClick={() => setPhotoPreview(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-xs text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} className="hidden" />
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />

      <div className="border-t border-gray-800 p-3 flex gap-2 shrink-0">
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={sending}
          title="Send a photo"
          className="px-2 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-base rounded-lg transition-colors shrink-0"
        >
          📷
        </button>
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setSendError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); photoPreview ? sendPhoto() : send() } }}
          placeholder="Type a message..."
          maxLength={4000}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <button
          onClick={photoPreview ? sendPhoto : send}
          disabled={photoPreview ? sending : (!input.trim() || sending)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  )
}

export type Tab = 'overview' | 'timeline' | 'map' | 'patients' | 'ics214' | 'supply' | 'chat'
export type DateFilter = 'all' | '24h' | '48h' | '7d'

export { OverviewTab, PatientLogTab, ICS214Tab, SupplyTab, STATUS_COLOR, C }

export default function FireAdminPage() {
  const params = useParams()
  const code = params.code as string
  // Detect internal preview: if the "code" is actually a UUID (incident ID), use authenticated path
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code || '')
  const isPreview = isUUID
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [chatUnread, setChatUnread] = useState(0)
  const lastSeenChatCount = useRef(0)
  const currentTabRef = useRef<Tab>('overview')

  // Fire-and-forget event logger — records tab views + PDF downloads (skip for previews)
  const logEvent = (event: { event_type: string; tab?: string; document_type?: string; document_id?: string }) => {
    if (!code || isPreview) return
    fetch('/api/incident-access/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase(), ...event }),
    }).catch(() => {/* silent */})
  }

  const handleTabChange = (newTab: Tab) => {
    if (newTab === 'chat') {
      setChatUnread(0)
      // Update the baseline to current known count
      lastSeenChatCount.current = -1 // will be re-synced on next poll
    }
    currentTabRef.current = newTab
    setTab(newTab)
    logEvent({ event_type: 'tab_view', tab: newTab })
  }

  // Lightweight poll for chat unread badge — runs even when ChatTab isn't mounted
  useEffect(() => {
    if (isPreview || !data?.channel_id) return
    const channelId = data.channel_id
    let mounted = true

    const pollUnread = async () => {
      try {
        const res = await fetch(
          `/api/incident-access/chat?code=${encodeURIComponent(code!)}&channelId=${encodeURIComponent(channelId)}`
        )
        const json = await res.json()
        if (!mounted || !json.messages) return
        const count = json.messages.length

        if (lastSeenChatCount.current === -1) {
          // Re-sync baseline after switching to chat tab
          lastSeenChatCount.current = count
          setChatUnread(0)
          return
        }

        if (currentTabRef.current === 'chat') {
          lastSeenChatCount.current = count
          setChatUnread(0)
        } else if (lastSeenChatCount.current === 0 && count > 0) {
          // First load — set baseline, don't show old messages as unread
          lastSeenChatCount.current = count
        } else {
          const unread = Math.max(0, count - lastSeenChatCount.current)
          setChatUnread(unread)
        }
      } catch { /* silent */ }
    }

    pollUnread()
    const interval = setInterval(pollUnread, 5000)
    return () => { mounted = false; clearInterval(interval) }
  }, [code, isPreview, data?.channel_id])

  useEffect(() => {
    if (!code) return
    const loadDashboard = async () => {
      try {
        let res: Response
        if (isPreview) {
          // Internal preview: use authenticated incidentId path
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token
          if (!token) { setError('Not logged in — sign in first to preview'); setLoading(false); return }
          res = await fetch(`/api/incident-access?incidentId=${encodeURIComponent(code)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        } else {
          res = await fetch(`/api/incident-access?code=${code.toUpperCase()}`)
        }
        const json = await res.json()
        if (json.error) setError(json.error)
        else setData(json)
      } catch {
        setError('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [code, isPreview])

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'timeline', label: 'Timeline', icon: '🕒' },
    { id: 'map', label: 'Live Map', icon: '🗺️' },
    { id: 'patients', label: 'Patient Log', icon: '📋' },
    { id: 'ics214', label: 'ICS 214s', icon: '📝' },
    { id: 'supply', label: 'Supply', icon: '🧰' },
    { id: 'chat', label: 'Chat', icon: '🔥' },
  ]

  // eslint-disable-next-line react-hooks/purity
  const applyDateFilterNow = useMemo(() => Date.now(), [dateFilter])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyDateFilter = (items: any[]): any[] => {
    if (dateFilter === 'all') return items
    const ms = dateFilter === '24h' ? 86400000 : dateFilter === '48h' ? 172800000 : 604800000
    return items.filter((i: { created_at?: string | null }) => i.created_at && applyDateFilterNow - new Date(i.created_at).getTime() <= ms)
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
  const orgName = org?.dba || org?.name || brand.companyName
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
            {isPreview ? (
              <span className="text-xs px-2.5 py-1 bg-blue-900 text-blue-300 rounded-full font-semibold">👁️ Admin Preview</span>
            ) : (
              <>
                <p className="text-xs text-gray-500">Access Code</p>
                <p className="text-sm font-mono font-bold text-amber-400">{code.toUpperCase()}</p>
              </>
            )}
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

        {/* ── Medical Directors & Deployed Units ── */}
        <ContactCards medicalDirectors={data.medical_directors} deployedUnits={data.deployed_units} />

        {/* ── Tab pills + date filter ── */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => handleTabChange(t.id)}
              className={`relative px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {t.icon} {t.label}
              {t.id === 'chat' && chatUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {chatUnread > 99 ? '99+' : chatUnread}
                </span>
              )}
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
        {tab === 'map' && (
          <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
            <LazyUnitMap incidentId={data.incident.id} accessCode={code} height="calc(100vh - 200px)" className="rounded-xl overflow-hidden" />
          </Suspense>
        )}
        {tab === 'timeline' && (
          <TimelineTab
            isExternal={!isPreview}
            fetchFn={async ({ limit, before, types }) => {
              const params = new URLSearchParams()
              params.set('limit', String(limit))
              if (before) params.set('before', before)
              if (types?.length) params.set('types', types.join(','))
              const baseUrl = isPreview
                ? `/api/incident-access/timeline?incidentId=${encodeURIComponent(code)}&${params}`
                : `/api/incident-access/timeline?code=${encodeURIComponent(code)}&${params}`
              const headers: Record<string, string> = {}
              if (isPreview) {
                const { data: { session } } = await createClient().auth.getSession()
                if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
              }
              const res = await fetch(baseUrl, { headers })
              return res.json()
            }}
          />
        )}
        {tab === 'patients' && <PatientLogTab data={{ ...data, encounters: applyDateFilter(data.encounters) }} code={code} logEvent={logEvent} isPreview={isPreview} />}
        {tab === 'ics214' && <ICS214Tab data={data} code={code} logEvent={logEvent} isPreview={isPreview} />}
        {tab === 'supply' && <SupplyTab data={data} dateFilter={dateFilter} />}
        {tab === 'chat' && !isPreview && <ChatTab code={code} channelId={data.channel_id ?? null} codeLabel={data.code_label} codeAvatarUrl={data.code_avatar_url} />}
        {tab === 'chat' && isPreview && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 text-sm">Chat is not available in admin preview mode.</p>
          </div>
        )}

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
