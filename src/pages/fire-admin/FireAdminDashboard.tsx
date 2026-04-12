

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
    id: string; seq_id: string; date: string | null; unit: string | null
    age: string | null; chief_complaint: string | null; acuity: string; disposition: string | null
  }[]
  comp_claims: {
    id: string; claim_number: string; date: string | null; status: string | null
    has_pdf: boolean; patient_seq_id: string | null; osha_recordable: boolean | null
  }[]
  ics214s: {
    id: string; ics214_id: string; unit: string | null; prepared_by: string | null
    date: string | null; status: string | null; has_pdf: boolean; pdf_file_name: string | null
    closed_at: string | null
  }[]
  code_label: string | null
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
function OverviewTab({ data }: { data: DashboardData }) {
  const { analytics, stats } = data
  const acuityTotal = analytics.acuity_breakdown.reduce((s, d) => s + d.value, 0)

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
        <StatCard label="Total Patients" value={stats.total_patients} accent={C.red} />
        <StatCard label="Total Encounters" value={stats.total_encounters} accent={C.blue} />
        <StatCard label="Units Deployed" value={stats.units_deployed} accent={C.green}
          sub={stats.unique_units.slice(0, 3).join(', ')} />
        <StatCard label="Comp Claims" value={stats.comp_claims_count} accent={C.amber} />
        <StatCard label="ICS 214s" value={stats.ics214_count} accent={C.violet} />
        <StatCard label="Incident Status" value={data.incident.status || '—'} accent={STATUS_COLOR[data.incident.status] ?? C.gray} />
      </div>

      {/* Chief complaints bar chart */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">🩺 Chief Complaints (Top 10)</h3>
        {analytics.chief_complaints.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={Math.max(200, analytics.chief_complaints.length * 30)}>
              <BarChart data={analytics.chief_complaints} layout="vertical" margin={{ top: 5, right: 30, left: 155, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} horizontal={false} />
                <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} width={150} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={C.red} radius={[0, 4, 4, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Acuity pie chart */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">🚨 Acuity Breakdown</h3>
        {analytics.acuity_breakdown.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-64 shrink-0">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analytics.acuity_breakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" labelLine={false} label={renderPieLabel}>
                    {analytics.acuity_breakdown.map(entry => (
                      <Cell key={entry.name} fill={ACUITY_COLORS[entry.name] ?? C.gray} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => { const n = typeof v === 'number' ? v : 0; return [`${n} (${acuityTotal > 0 ? ((n / acuityTotal) * 100).toFixed(1) : 0}%)`, ''] as [string, string] }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {analytics.acuity_breakdown.map(d => (
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
        {analytics.encounters_by_day.length === 0 ? <Empty /> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analytics.encounters_by_day.map(d => ({ ...d, date: d.date.slice(5) }))} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
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
function PatientLogTab({ data, code }: { data: DashboardData; code: string }) {
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')
  const sorted = [...data.encounters].sort((a, b) => {
    const cmp = (a.date || '').localeCompare(b.date || '')
    return sort === 'asc' ? cmp : -cmp
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {data.encounters.length} total encounters — patient names and DOB are not shown. Sequential IDs assigned for reference only.
        </p>
        <button onClick={() => setSort(s => s === 'asc' ? 'desc' : 'asc')}
          className="text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-lg transition-colors">
          Date {sort === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {sorted.length === 0 ? <Empty text="No encounters recorded for this incident" /> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[72px_80px_60px_1fr_80px_1fr_1fr] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
            <span>Patient ID</span>
            <span>Date</span>
            <span>Age</span>
            <span>Chief Complaint</span>
            <span>Acuity</span>
            <span className="hidden md:block">Disposition</span>
            <span className="hidden lg:block">Unit</span>
          </div>
          {sorted.map(enc => (
            <div key={enc.id} className="grid grid-cols-[72px_80px_60px_1fr_80px_1fr_1fr] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 transition-colors items-center">
              <span className="font-mono text-gray-300 text-xs font-semibold">{enc.seq_id}</span>
              <span className="text-gray-400 text-xs">{enc.date ? new Date(enc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
              <span className="text-gray-400 text-xs">{enc.age || '—'}</span>
              <span className="text-white text-xs truncate">{enc.chief_complaint || <span className="text-gray-600 italic">Not recorded</span>}</span>
              <span>
                <Badge color={ACUITY_COLORS[enc.acuity] ?? C.gray} label={enc.acuity} />
              </span>
              <span className="hidden md:block text-gray-400 text-xs truncate">{enc.disposition || '—'}</span>
              <span className="hidden lg:block text-gray-500 text-xs truncate">{enc.unit || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Comp Claims ────────────────────────────────────────────────────────
function CompClaimsTab({ data, code }: { data: DashboardData; code: string }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (claimId: string) => {
    setDownloading(claimId)
    try {
      const res = await fetch(`/api/incident-access/download?code=${code}&type=comp_claim&id=${claimId}`)
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {data.comp_claims.length} workers' compensation claims for this incident.
        Patient information is de-identified below.
      </p>

      {data.comp_claims.length === 0 ? <Empty text="No comp claims on file for this incident" /> : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[80px_80px_72px_1fr_100px_100px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
            <span>Claim #</span>
            <span>Date</span>
            <span>Patient ID</span>
            <span>Status</span>
            <span className="hidden md:block">OSHA</span>
            <span className="text-right">PDF</span>
          </div>
          {data.comp_claims.map(cc => (
            <div key={cc.id} className="grid grid-cols-[80px_80px_72px_1fr_100px_100px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 transition-colors items-center">
              <span className="font-mono text-gray-300 text-xs font-semibold">{cc.claim_number}</span>
              <span className="text-gray-400 text-xs">{cc.date ? new Date(cc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
              <span className="font-mono text-xs text-gray-400">{cc.patient_seq_id || '—'}</span>
              <span>
                <Badge color={STATUS_COLOR[cc.status || ''] ?? C.gray} label={cc.status || 'Unknown'} />
              </span>
              <span className="hidden md:block">
                {cc.osha_recordable === true
                  ? <Badge color={C.red} label="Recordable" />
                  : cc.osha_recordable === false
                  ? <Badge color={C.gray} label="Not Recordable" />
                  : <span className="text-gray-600 text-xs">—</span>
                }
              </span>
              <div className="flex justify-end">
                {cc.has_pdf ? (
                  <button
                    onClick={() => handleDownload(cc.id)}
                    disabled={downloading === cc.id}
                    className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {downloading === cc.id ? '...' : '⬇ PDF'}
                  </button>
                ) : (
                  <span className="text-xs text-gray-700">No PDF</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 4: ICS 214s ──────────────────────────────────────────────────────────
function ICS214Tab({ data, code }: { data: DashboardData; code: string }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (formId: string) => {
    setDownloading(formId)
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
type Tab = 'overview' | 'patients' | 'comp' | 'ics214'

export default function FireAdminPage() {
  const params = useParams()
  const code = params.code as string
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

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
    { id: 'comp', label: 'Comp Claims', icon: '📄' },
    { id: 'ics214', label: 'ICS 214s', icon: '📝' },
  ]

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

        {/* ── Tab pills ── */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {tab === 'overview' && <OverviewTab data={data} />}
        {tab === 'patients' && <PatientLogTab data={data} code={code} />}
        {tab === 'comp' && <CompClaimsTab data={data} code={code} />}
        {tab === 'ics214' && <ICS214Tab data={data} code={code} />}

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
