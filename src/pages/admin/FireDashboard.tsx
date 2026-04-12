

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FieldGuard } from '@/components/FieldGuard'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  red: '#dc2626', blue: '#2563eb', green: '#16a34a',
  amber: '#d97706', violet: '#7c3aed', gray: '#6b7280',
  teal: '#0d9488', orange: '#ea580c',
}
const ACUITY_COLORS: Record<string, string> = {
  'Immediate': C.red, 'Delayed': C.amber, 'Minimal': C.green, 'Expectant': C.gray,
}
const axisStyle = { fill: '#9ca3af', fontSize: 11 }
const gridStyle = { stroke: '#1f2937' }
const tooltipStyle = { backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#fff', fontSize: 12 }

// ── Types ────────────────────────────────────────────────────────────────────
type Incident = { id: string; name: string; status: string; start_date: string | null; incident_number: string | null }
type AccessCode = { id: string; access_code: string; label: string | null; created_by: string | null; active: boolean; created_at: string; expires_at: string | null }
type DashboardData = {
  incident: { id: string; name: string; location: string | null; incident_number: string | null; start_date: string | null; end_date: string | null; status: string }
  stats: { total_patients: number; total_encounters: number; units_deployed: number; unique_units: string[]; comp_claims_count: number; ics214_count: number }
  analytics: { chief_complaints: { name: string; count: number }[]; acuity_breakdown: { name: string; value: number }[]; encounters_by_day: { date: string; count: number }[] }
  encounters: { id: string; seq_id: string; date: string | null; unit: string | null; age: string | null; chief_complaint: string | null; acuity: string; disposition: string | null }[]
  comp_claims: { id: string; claim_number: string; date: string | null; status: string | null; has_pdf: boolean; patient_seq_id: string | null; osha_recordable: boolean | null }[]
  ics214s: { id: string; ics214_id: string; unit: string | null; prepared_by: string | null; date: string | null; status: string | null; has_pdf: boolean; pdf_file_name: string | null }[]
  code_label: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent = C.red, sub }: { label: string; value: string | number; accent?: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-1" style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-xs text-gray-600 truncate">{sub}</span>}
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

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://ram-field-ops.vercel.app'

// ── Access Codes Panel ────────────────────────────────────────────────────────
function AccessCodesPanel({ incidentId, incidentName }: { incidentId: string; incidentName: string }) {
  const [codes, setCodes] = useState<AccessCode[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [label, setLabel] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const loadCodes = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('incident_access_codes')
        .select('*')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
      setCodes(data || [])
    } catch {
      // Offline — show empty list
    }
    setLoading(false)
  }, [incidentId])

  useEffect(() => { loadCodes() }, [loadCodes])

  const generateCode = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/incident-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId, label: label || null }),
      })
      if (res.ok) {
        setLabel('')
        setShowForm(false)
        loadCodes()
      } else {
        const err = await res.json()
        alert('Error: ' + (err.error || 'Failed to generate code'))
      }
    } finally {
      setGenerating(false)
    }
  }

  const toggleActive = async (codeId: string, active: boolean) => {
    const res = await fetch('/api/incident-access', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_id: codeId, active }),
    })
    if (res.ok) loadCodes()
  }

  const copyToClipboard = async (code: string) => {
    const url = `${BASE_URL}/fire-admin/${code}`
    await navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🔑</span>
          <span className="text-sm font-semibold text-white">External Access Codes</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{codes.length} code{codes.length !== 1 ? 's' : ''}</span>
        </div>
        <span className={`text-gray-600 transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-800">
          {/* Generate button */}
          <div className="pt-4">
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                + Generate New Access Code
              </button>
            ) : (
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-400">Optional label (e.g., "Med Unit Leader - Smith")</p>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-red-500 outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={generateCode} disabled={generating}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                    {generating ? 'Generating...' : 'Generate'}
                  </button>
                  <button onClick={() => { setShowForm(false); setLabel('') }}
                    className="text-gray-400 hover:text-gray-300 text-sm px-4 py-1.5 rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Code list */}
          {loading ? <Skeleton h="h-24" /> : codes.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No access codes yet. Generate one to share with fire agency personnel.</p>
          ) : (
            <div className="space-y-2">
              {codes.map(code => {
                const fullUrl = `${BASE_URL}/fire-admin/${code.access_code}`
                const isExpired = code.expires_at && new Date(code.expires_at) < new Date()
                return (
                  <div key={code.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${code.active && !isExpired ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/40 border-gray-800 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold text-amber-400 tracking-wider">{code.access_code}</span>
                        {code.label && <span className="text-xs text-gray-400">{code.label}</span>}
                        {!code.active && <Badge color={C.gray} label="Inactive" />}
                        {isExpired && <Badge color={C.red} label="Expired" />}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 truncate">{fullUrl}</p>
                      <p className="text-xs text-gray-700 mt-0.5">Created {new Date(code.created_at).toLocaleDateString()}{code.created_by ? ` by ${code.created_by}` : ''}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => copyToClipboard(code.access_code)}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-lg transition-colors">
                        {copied === code.access_code ? '✓ Copied!' : '📋 Copy URL'}
                      </button>
                      <button onClick={() => toggleActive(code.id, !code.active)}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${code.active ? 'bg-red-900/50 text-red-400 hover:bg-red-900' : 'bg-green-900/50 text-green-400 hover:bg-green-900'}`}>
                        {code.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dashboard tabs (same as external but with admin context) ──────────────────
type DashTab = 'overview' | 'patients' | 'comp' | 'ics214' | 'access-log' | 'access-log'

function IncidentDashboard({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DashTab>('overview')

  useEffect(() => {
    if (!incidentId) return
    setLoading(true)
    setError(null)
    // Admin uses authed client — fetch directly
    const supabase = createClient()
    const load = async () => {
      try {
        const [incRes, orgRes, encRes, unitsRes, compRes, icsRes] = await Promise.all([
          supabase.from('incidents').select('id, name, location, incident_number, start_date, end_date, status').eq('id', incidentId).single(),
          supabase.from('organizations').select('name, dba, logo_url').limit(1).single(),
          supabase.from('patient_encounters').select('id, date, unit, patient_age, patient_age_units, primary_symptom_text, initial_acuity, final_acuity, patient_disposition, created_at').eq('incident_id', incidentId).order('date', { ascending: true }),
          supabase.from('incident_units').select('id, unit_id').eq('incident_id', incidentId),
          supabase.from('comp_claims').select('id, date_of_injury, status, pdf_url, encounter_id, osha_recordable, created_at').eq('incident_id', incidentId).order('created_at', { ascending: true }),
          supabase.from('ics214_headers').select('id, ics214_id, unit_name, leader_name, op_date, status, pdf_url, pdf_file_name, created_by, created_at, closed_at').eq('incident_id', incidentId).order('op_date', { ascending: true }),
        ])

        const incident = incRes.data
        if (!incident) { setError('Incident not found'); setLoading(false); return }

        const encountersRaw = encRes.data || []
        const mapAcuity = (raw: string | null) => {
          if (!raw) return 'Expectant'
          const v = raw.toLowerCase()
          if (v.includes('critical') || v.includes('red') || v.includes('immediate')) return 'Immediate'
          if (v.includes('yellow') || v.includes('delayed') || v.includes('emergent')) return 'Delayed'
          if (v.includes('green') || v.includes('minor') || v.includes('non-acute') || v.includes('routine')) return 'Minimal'
          return 'Expectant'
        }
        const encounters = encountersRaw.map((enc, idx) => ({
          id: enc.id, seq_id: `PT-${String(idx + 1).padStart(3, '0')}`,
          date: enc.date, unit: enc.unit,
          age: enc.patient_age ? `${enc.patient_age}${enc.patient_age_units ? ' ' + enc.patient_age_units : ''}` : null,
          chief_complaint: enc.primary_symptom_text,
          acuity: mapAcuity(enc.initial_acuity),
          disposition: enc.patient_disposition,
        }))
        const encIdToSeq: Record<string, string> = {}
        encounters.forEach(e => { encIdToSeq[e.id] = e.seq_id })

        const compClaims = (compRes.data || []).map((cc, idx) => ({
          id: cc.id, claim_number: `WC-${String(idx + 1).padStart(3, '0')}`,
          date: cc.date_of_injury, status: cc.status, has_pdf: !!cc.pdf_url,
          patient_seq_id: cc.encounter_id ? encIdToSeq[cc.encounter_id] || null : null,
          osha_recordable: cc.osha_recordable,
        }))

        const ics214s = (icsRes.data || []).map(form => ({
          id: form.id, ics214_id: form.ics214_id, unit: form.unit_name,
          prepared_by: form.leader_name || form.created_by, date: form.op_date,
          status: form.status, has_pdf: !!form.pdf_url, pdf_file_name: form.pdf_file_name,
          closed_at: form.closed_at,
        }))

        const complaintCounts: Record<string, number> = {}
        encounters.forEach(e => { if (e.chief_complaint) complaintCounts[e.chief_complaint] = (complaintCounts[e.chief_complaint] || 0) + 1 })
        const acuityCounts: Record<string, number> = { Immediate: 0, Delayed: 0, Minimal: 0, Expectant: 0 }
        encounters.forEach(e => { acuityCounts[e.acuity]++ })
        const dailyCounts: Record<string, number> = {}
        encounters.forEach(e => { if (e.date) dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1 })

        setData({
          incident,
          stats: {
            total_patients: encounters.length,
            total_encounters: encounters.length,
            units_deployed: unitsRes.data?.length || 0,
            unique_units: [...new Set(encounters.map(e => e.unit).filter(Boolean) as string[])],
            comp_claims_count: compClaims.length,
            ics214_count: ics214s.length,
          },
          analytics: {
            chief_complaints: Object.entries(complaintCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
            acuity_breakdown: Object.entries(acuityCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
            encounters_by_day: Object.entries(dailyCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count })),
          },
          encounters,
          comp_claims: compClaims,
          ics214s,
          code_label: null,
        })
      } catch (e) {
        setError('Failed to load incident data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [incidentId])

  const tabs: { id: DashTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'patients', label: 'Patient Log', icon: '📋' },
    { id: 'comp', label: 'Comp Claims', icon: '📄' },
    { id: 'ics214', label: 'ICS 214s', icon: '📝' },
    { id: 'access-log', label: 'Access Log', icon: '👀' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-8 h-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
    </div>
  )
  if (error || !data) return <div className="text-red-500 text-sm py-8 text-center">{error || 'No data'}</div>

  const { analytics, stats } = data
  const acuityTotal = analytics.acuity_breakdown.reduce((s, d) => s + d.value, 0)
  const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.6
    return <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Total Encounters" value={stats.total_encounters} accent={C.red} />
            <StatCard label="Units Deployed" value={stats.units_deployed} accent={C.green} sub={stats.unique_units.slice(0, 2).join(', ')} />
            <StatCard label="Comp Claims" value={stats.comp_claims_count} accent={C.amber} />
            <StatCard label="ICS 214s" value={stats.ics214_count} accent={C.violet} />
            <StatCard label="Status" value={data.incident.status || '—'} accent={STATUS_COLOR[data.incident.status] ?? C.gray} />
          </div>
          {analytics.chief_complaints.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">🩺 Chief Complaints</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(180, analytics.chief_complaints.length * 28)}>
                  <BarChart data={analytics.chief_complaints} layout="vertical" margin={{ top: 5, right: 30, left: 155, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} width={150} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={C.red} radius={[0, 4, 4, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          {analytics.acuity_breakdown.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">🚨 Acuity</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
                <div className="w-full md:w-56 shrink-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={analytics.acuity_breakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" labelLine={false} label={renderPieLabel}>
                        {analytics.acuity_breakdown.map(e => <Cell key={e.name} fill={ACUITY_COLORS[e.name] ?? C.gray} />)}
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
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          {analytics.encounters_by_day.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">📈 Daily Volume</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={analytics.encounters_by_day.map(d => ({ ...d, date: d.date.slice(5) }))} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                    <XAxis dataKey="date" tick={axisStyle} interval="preserveStartEnd" />
                    <YAxis tick={axisStyle} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke={C.blue} strokeWidth={2} dot={false} name="Encounters" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Patient Log ── */}
      {tab === 'patients' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{data.encounters.length} encounters — de-identified</p>
          {data.encounters.length === 0 ? <Empty text="No encounters for this incident" /> : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[72px_80px_60px_1fr_80px_1fr] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
                <span>ID</span><span>Date</span><span>Age</span><span>Chief Complaint</span><span>Acuity</span><span className="hidden md:block">Disposition</span>
              </div>
              {data.encounters.map(enc => (
                <div key={enc.id} className="grid grid-cols-[72px_80px_60px_1fr_80px_1fr] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 transition-colors items-center">
                  <span className="font-mono text-xs text-gray-300">{enc.seq_id}</span>
                  <span className="text-xs text-gray-400">{enc.date ? new Date(enc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <span className="text-xs text-gray-400">{enc.age || '—'}</span>
                  <span className="text-xs text-white truncate">{enc.chief_complaint || '—'}</span>
                  <span><Badge color={ACUITY_COLORS[enc.acuity] ?? C.gray} label={enc.acuity} /></span>
                  <span className="hidden md:block text-xs text-gray-400 truncate">{enc.disposition || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Comp Claims ── */}
      {tab === 'comp' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">{data.comp_claims.length} comp claims</p>
          {data.comp_claims.length === 0 ? <Empty text="No comp claims for this incident" /> : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[80px_80px_72px_1fr_80px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
                <span>Claim #</span><span>Date</span><span>Patient</span><span>Status</span><span>PDF</span>
              </div>
              {data.comp_claims.map(cc => (
                <div key={cc.id} className="grid grid-cols-[80px_80px_72px_1fr_80px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 items-center">
                  <span className="font-mono text-xs text-gray-300">{cc.claim_number}</span>
                  <span className="text-xs text-gray-400">{cc.date ? new Date(cc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <span className="font-mono text-xs text-gray-400">{cc.patient_seq_id || '—'}</span>
                  <span><Badge color={STATUS_COLOR[cc.status || ''] ?? C.gray} label={cc.status || 'Unknown'} /></span>
                  <span className="text-xs text-gray-600">{cc.has_pdf ? '✅' : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ICS 214s ── */}
      {tab === 'ics214' && (
        <div className="space-y-3">
          {data.ics214s.length === 0 ? <Empty text="No ICS 214s for this incident" /> : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[90px_1fr_1fr_80px_60px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
                <span>Date</span><span>Unit</span><span>Leader</span><span>Status</span><span>PDF</span>
              </div>
              {data.ics214s.map(form => (
                <div key={form.id} className="grid grid-cols-[90px_1fr_1fr_80px_60px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 items-center">
                  <span className="text-xs text-gray-400">{form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <span className="text-xs text-white truncate">{form.unit || '—'}</span>
                  <span className="text-xs text-gray-400 truncate">{form.prepared_by || '—'}</span>
                  <span><Badge color={form.status === 'Closed' ? C.gray : C.green} label={form.status || 'Open'} /></span>
                  <span className="text-xs text-gray-600">{form.has_pdf ? '✅' : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 👀 Access Log tab */}
      {tab === 'access-log' && (
        <AccessLogTab incidentId={incidentId} />
      )}
    </div>
  )
}

// ── Access Log Tab ──────────────────────────────────────────────────────────
function AccessLogTab({ incidentId }: { incidentId: string }) {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('incident_access_log')
      .select('*')
      .eq('incident_id', incidentId)
      .order('accessed_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [incidentId])

  const byCode: Record<string, { count: number; lastAccess: string }> = {}
  logs.forEach(l => {
    const key = l.label || l.access_code
    if (!byCode[key]) byCode[key] = { count: 0, lastAccess: '' }
    byCode[key].count++
    if (!byCode[key].lastAccess || l.accessed_at > byCode[key].lastAccess) byCode[key].lastAccess = l.accessed_at
  })

  if (loading) return <p className="text-gray-500 text-sm py-4 text-center">Loading access log...</p>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-400">{logs.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Views</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-400">{logs.filter(l => new Date(l.accessed_at) > new Date(Date.now() - 24*60*60*1000)).length}</p>
          <p className="text-xs text-gray-500 mt-1">Views Today</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-400">{logs.length > 0 ? new Date(logs[0].accessed_at).toLocaleDateString() : '—'}</p>
          <p className="text-xs text-gray-500 mt-1">Last Access</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">👀 Views by Code</h3>
        </div>
        {Object.entries(byCode).sort((a, b) => b[1].count - a[1].count).map(([label, info]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50 text-sm">
            <p className="font-medium">{label}</p>
            <div className="text-right">
              <p className="font-bold text-blue-400">{info.count} views</p>
              <p className="text-xs text-gray-500">{new Date(info.lastAccess).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="px-4 py-6 text-gray-600 text-sm text-center">No access yet — share a code to start tracking</p>}
      </div>

      {logs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recent Access</h3></div>
          <div className="divide-y divide-gray-800/50">
            {logs.slice(0, 50).map(l => (
              <div key={l.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="font-medium text-white">{l.label || l.access_code}</span>
                <span className="text-gray-500">{new Date(l.accessed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function FireDashboardContent() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingIncidents, setLoadingIncidents] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('incidents')
      .select('id, name, status, start_date, incident_number')
      .order('status', { ascending: true }) // Active first
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        const sorted = (data || []).sort((a, b) => {
          if (a.status === 'Active' && b.status !== 'Active') return -1
          if (b.status === 'Active' && a.status !== 'Active') return 1
          return (b.start_date || '').localeCompare(a.start_date || '')
        })
        setIncidents(sorted)
        if (sorted.length > 0 && !selectedId) setSelectedId(sorted[0].id)
        setLoadingIncidents(false)
      })
  }, [])

  const selectedIncident = incidents.find(i => i.id === selectedId)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">🔥 Fire Admin Dashboard</h1>
            <p className="text-gray-500 text-xs">External access codes &amp; incident data for fire agency personnel</p>
          </div>
        </div>

        {/* Incident pills */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-2 font-medium">Select Incident</p>
          {loadingIncidents ? (
            <div className="flex gap-2">{[1, 2, 3].map(i => <div key={i} className="h-8 w-32 bg-gray-800/50 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {incidents.map(inc => (
                <button key={inc.id} onClick={() => setSelectedId(inc.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                    selectedId === inc.id
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border-gray-700'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${inc.status === 'Active' ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {inc.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedId && selectedIncident && (
          <>
            {/* Incident summary row */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedIncident.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedIncident.status === 'Active' ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    {selectedIncident.status}
                  </span>
                  {selectedIncident.incident_number && (
                    <span className="text-xs text-gray-500">#{selectedIncident.incident_number}</span>
                  )}
                  {selectedIncident.start_date && (
                    <span className="text-xs text-gray-600">
                      {new Date(selectedIncident.start_date + 'T00:00:00').toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <a href={`/fire-admin/${selectedId}`} target="_blank" rel="noopener noreferrer"
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                🔗 Preview External View
              </a>
            </div>

            {/* Access codes panel */}
            <AccessCodesPanel incidentId={selectedId} incidentName={selectedIncident.name} />

            {/* Dashboard */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                📊 Incident Data
                <span className="text-xs text-gray-600 font-normal">(same as external view)</span>
              </h3>
              <IncidentDashboard incidentId={selectedId} />
            </div>
          </>
        )}

        {incidents.length === 0 && !loadingIncidents && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-4xl mb-3">🔥</p>
            <p>No incidents found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FireDashboardPage() {
  return (
    <FieldGuard redirectFn={() => null}>
      <FireDashboardContent />
    </FieldGuard>
  )
}
