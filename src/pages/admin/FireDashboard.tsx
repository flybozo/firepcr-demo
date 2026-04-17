
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/authFetch'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'
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
  encounters: { id: string; seq_id: string; date: string | null; unit: string | null; patient_agency: string | null; age: string | null; chief_complaint: string | null; acuity: string; disposition: string | null; created_at: string | null }[]
  comp_claims: { id: string; claim_number: string; date: string | null; status: string | null; has_pdf: boolean; pdf_url: string | null; patient_seq_id: string | null; osha_recordable: boolean | null; created_at: string | null }[]
  ics214s: { id: string; ics214_id: string; unit: string | null; prepared_by: string | null; date: string | null; status: string | null; has_pdf: boolean; pdf_file_name: string | null }[]
  supply_aggregated: { item_name: string; total_qty: number; unit: string; category?: string }[]
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
  const [expiryDays, setExpiryDays] = useState('7')
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [editingExpiry, setEditingExpiry] = useState<string | null>(null)
  const [newExpiry, setNewExpiry] = useState('')

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
      const expires_at = expiryDays !== '0'
        ? new Date(Date.now() + parseInt(expiryDays) * 86400000).toISOString()
        : null
      const res = await authFetch('/api/incident-access', {
        method: 'POST',
        body: JSON.stringify({ incident_id: incidentId, label: label || null, expires_at }),
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
    const res = await authFetch('/api/incident-access', {
      method: 'PATCH',
      body: JSON.stringify({ code_id: codeId, active }),
    })
    if (res.ok) loadCodes()
  }

  const deleteCode = async (codeId: string, codeStr: string) => {
    if (!confirm(`Delete access code ${codeStr}? This cannot be undone.`)) return
    const res = await authFetch(`/api/incident-access?code_id=${encodeURIComponent(codeId)}`, {
      method: 'DELETE',
    })
    if (res.ok) loadCodes()
  }

  const saveExpiry = async (codeId: string) => {
    const expires_at = newExpiry ? new Date(newExpiry).toISOString() : null
    const res = await authFetch('/api/incident-access', {
      method: 'PATCH',
      body: JSON.stringify({ code_id: codeId, expires_at }),
    })
    if (res.ok) { setEditingExpiry(null); loadCodes() }
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
                <div>
                  <label className="text-xs text-gray-400">Expires after</label>
                  <select value={expiryDays} onChange={e => setExpiryDays(e.target.value)}
                    className="ml-2 bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:border-red-500 outline-none">
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="0">Never</option>
                  </select>
                </div>
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
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      <div className="flex gap-1">
                        <button onClick={() => copyToClipboard(code.access_code)}
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-lg transition-colors">
                          {copied === code.access_code ? '✓ Copied!' : '📋 Copy'}
                        </button>
                        <button onClick={() => toggleActive(code.id, !code.active)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${code.active ? 'bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900' : 'bg-green-900/50 text-green-400 hover:bg-green-900'}`}>
                          {code.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => deleteCode(code.id, code.access_code)}
                          className="text-xs bg-red-900/50 text-red-400 hover:bg-red-900 px-2 py-1 rounded-lg transition-colors">
                          🗑 Delete
                        </button>
                      </div>
                      {editingExpiry === code.id ? (
                        <div className="flex gap-1 items-center mt-1">
                          <input type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)}
                            className="text-xs bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 outline-none" />
                          <button onClick={() => saveExpiry(code.id)} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors">Save</button>
                          <button onClick={() => setEditingExpiry(null)} className="text-xs text-gray-500 hover:text-gray-300 px-1">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingExpiry(code.id); setNewExpiry(code.expires_at ? code.expires_at.slice(0,10) : '') }}
                          className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                          {code.expires_at ? `Expires ${new Date(code.expires_at).toLocaleDateString()}` : 'Set expiry'}
                        </button>
                      )}
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

// ── Dashboard tabs ────────────────────────────────────────────────────────────
type DashTab = 'overview' | 'patients' | 'ics214' | 'access-log' | 'supply'

function IncidentDashboard({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DashTab>('overview')
  const [dateFilter, setDateFilter] = useState<'all' | '24h' | '48h' | '7d'>('all')

  useEffect(() => {
    if (!incidentId) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const load = async () => {
      try {
        const [incRes, orgRes, encRes, unitsRes, compRes, icsRes] = await Promise.all([
          supabase.from('incidents').select('id, name, location, incident_number, start_date, end_date, status').eq('id', incidentId).single(),
          supabase.from('organizations').select('name, dba, logo_url').limit(1).single(),
          supabase.from('patient_encounters').select('id, encounter_id, date, unit, patient_agency, patient_age, patient_age_units, primary_symptom_text, initial_acuity, final_acuity, patient_disposition, created_at').eq('incident_id', incidentId).is('deleted_at', null).order('date', { ascending: true }),
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
          patient_agency: (enc as any).patient_agency || null,
          age: enc.patient_age ? `${enc.patient_age}${enc.patient_age_units ? ' ' + enc.patient_age_units : ''}` : null,
          chief_complaint: enc.primary_symptom_text,
          acuity: mapAcuity(enc.initial_acuity),
          disposition: enc.patient_disposition,
          created_at: enc.created_at ?? null,
        }))
        // encLookup maps both UUID and text encounter_id → encounter UUID
        const encLookup: Record<string, string> = {}
        const encIdToSeq: Record<string, string> = {}
        encountersRaw.forEach((e, idx) => {
          const seqId = `PT-${String(idx + 1).padStart(3, '0')}`
          encLookup[e.id] = e.id  // UUID → UUID (identity)
          if ((e as any).encounter_id) encLookup[(e as any).encounter_id] = e.id  // text → UUID
          encIdToSeq[e.id] = seqId
        })

        const compClaims = (compRes.data || []).map((cc, idx) => ({
          id: cc.id, claim_number: `WC-${String(idx + 1).padStart(3, '0')}`,
          date: cc.date_of_injury, status: cc.status,
          has_pdf: !!cc.pdf_url, pdf_url: cc.pdf_url ?? null,
          patient_seq_id: cc.encounter_id ? (encIdToSeq[encLookup[cc.encounter_id] || cc.encounter_id] || null) : null,
          osha_recordable: cc.osha_recordable,
          created_at: cc.created_at ?? null,
          // store the resolved UUID so WC lookup works correctly
          encounter_id: cc.encounter_id ? (encLookup[cc.encounter_id] || cc.encounter_id) : null,
        }))

        const ics214s = (icsRes.data || []).map(form => ({
          id: form.id, ics214_id: form.ics214_id, unit: form.unit_name,
          prepared_by: form.leader_name || form.created_by, date: form.op_date,
          status: form.status, has_pdf: !!form.pdf_url, pdf_file_name: form.pdf_file_name,
          closed_at: form.closed_at,
        }))

        // ── Supply runs fetch ──
        const supplyRunsRes = await supabase
          .from('supply_runs')
          .select('id, run_date, created_at')
          .eq('incident_id', incidentId)
        const runIds = (supplyRunsRes.data || []).map((r: { id: string }) => r.id)
        let supplyAggregated: { item_name: string; total_qty: number; unit: string }[] = []
        if (runIds.length > 0) {
          const supplyItemsRes = await supabase
            .from('supply_run_items')
            .select('item_name, quantity, unit_of_measure, category')
            .in('supply_run_id', runIds)
            .is('deleted_at', null)
          const itemTotals: Record<string, { total_qty: number; unit: string; category: string }> = {}
          ;(supplyItemsRes.data || []).forEach((item: { item_name: string; quantity: number | null; unit_of_measure: string | null; category: string | null }) => {
            if (!item.item_name) return
            if (!itemTotals[item.item_name]) itemTotals[item.item_name] = { total_qty: 0, unit: item.unit_of_measure || '', category: item.category || '' }
            itemTotals[item.item_name].total_qty += item.quantity || 0
          })
          supplyAggregated = Object.entries(itemTotals)
            .sort((a, b) => b[1].total_qty - a[1].total_qty)
            .map(([item_name, d]) => ({ item_name, ...d }))
        }

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
          supply_aggregated: supplyAggregated,
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
    { id: 'ics214', label: 'ICS 214s', icon: '📝' },
    { id: 'supply', label: 'Supply', icon: '🧰' },
    { id: 'access-log', label: 'Access Log', icon: '👀' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-60">
      <div className="w-8 h-8 rounded-full border-2 border-red-600 border-t-transparent animate-spin" />
    </div>
  )
  if (error || !data) return <div className="text-red-500 text-sm py-8 text-center">{error || 'No data'}</div>

  const { stats } = data
  const renderPieLabel = ({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.6
    return <text x={cx + r * Math.cos(-midAngle * RADIAN)} y={cy + r * Math.sin(-midAngle * RADIAN)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{`${(percent * 100).toFixed(0)}%`}</text>
  }

  // ── Date filter helper ─────────────────────────────────────────────────────
  const passesDateFilter = (createdAt: string | null): boolean => {
    if (dateFilter === 'all' || !createdAt) return true
    const now = Date.now()
    const t = new Date(createdAt).getTime()
    if (dateFilter === '24h') return now - t <= 24 * 60 * 60 * 1000
    if (dateFilter === '48h') return now - t <= 48 * 60 * 60 * 1000
    if (dateFilter === '7d') return now - t <= 7 * 24 * 60 * 60 * 1000
    return true
  }
  const filteredEncounters = data.encounters.filter(enc => passesDateFilter(enc.created_at))
  const filteredCompClaims = data.comp_claims.filter(cc => passesDateFilter(cc.created_at))

  // ── Recompute analytics from filtered encounters ───────────────────────────
  const filteredChiefComplaints = (() => {
    const counts: Record<string, number> = {}
    filteredEncounters.forEach(e => { if (e.chief_complaint) counts[e.chief_complaint] = (counts[e.chief_complaint] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
  })()
  const filteredAcuityBreakdown = (() => {
    const acCounts: Record<string, number> = { Immediate: 0, Delayed: 0, Minimal: 0, Expectant: 0 }
    filteredEncounters.forEach(e => { acCounts[e.acuity] = (acCounts[e.acuity] || 0) + 1 })
    return Object.entries(acCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  })()
  const filteredEncountersByDay = (() => {
    const daily: Record<string, number> = {}
    filteredEncounters.forEach(e => { if (e.date) daily[e.date] = (daily[e.date] || 0) + 1 })
    return Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }))
  })()
  const acuityTotal = filteredAcuityBreakdown.reduce((s, d) => s + d.value, 0)

  // ── WC encounter ID set ────────────────────────────────────────────────────
  const wcEncounterIds = new Set(
    data.comp_claims
      .map(cc => (cc as typeof cc & { encounter_id?: string | null }).encounter_id)
      .filter((id): id is string => !!id)
  )

  // ── PDF signed URL opener ──────────────────────────────────────────────────
  const openPdf = async (pdfUrl: string) => {
    const supabase = createClient()
    // All comp claim PDFs live in the 'documents' bucket under comp-claims/ subfolder
    const { data: signedData } = await supabase.storage
      .from('documents')
      .createSignedUrl(pdfUrl, 3600)
    if (signedData?.signedUrl) {
      window.open(signedData.signedUrl, '_blank')
    } else {
      alert('Could not generate PDF link. The file may have been removed.')
    }
  }

  // ── WC claim lookup by encounter id ─────────────────────────────────────────
  const claimByEncId = Object.fromEntries(
    data.comp_claims
      .map(cc => {
        const encId = (cc as typeof cc & { encounter_id?: string | null }).encounter_id
        return encId ? [encId, cc] : null
      })
      .filter((x): x is [string, typeof data.comp_claims[0]] => x !== null)
  )

  // ── Date range filter dropdown ─────────────────────────────────────────────
  const DateFilterDropdown = () => (
    <select
      value={dateFilter}
      onChange={e => setDateFilter(e.target.value as typeof dateFilter)}
      className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:border-red-500 outline-none cursor-pointer"
    >
      <option value="all">All time</option>
      <option value="24h">Last 24h</option>
      <option value="48h">Last 48h</option>
      <option value="7d">Last 7 days</option>
    </select>
  )

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

      {/* Date range filter (shown on all data tabs) */}
      {(tab === 'patients' || tab === 'overview' || tab === 'supply') && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Date range:</span>
          <DateFilterDropdown />
        </div>
      )}

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Total Encounters" value={filteredEncounters.length} accent={C.red} />
            <StatCard label="Units Deployed" value={stats.units_deployed} accent={C.green} sub={stats.unique_units.slice(0, 2).join(', ')} />
            <StatCard label="Comp Claims" value={filteredCompClaims.length} accent={C.amber} />
            <StatCard label="ICS 214s" value={stats.ics214_count} accent={C.violet} />
            <StatCard label="Status" value={data.incident.status || '—'} accent={STATUS_COLOR[data.incident.status] ?? C.gray} />
          </div>
          {filteredChiefComplaints.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">🩺 Chief Complaints</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(180, filteredChiefComplaints.length * 28)}>
                  <BarChart data={filteredChiefComplaints} layout="vertical" margin={{ top: 5, right: 30, left: 155, bottom: 5 }}>
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
          {filteredAcuityBreakdown.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">🚨 Acuity</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-6">
                <div className="w-full md:w-56 shrink-0">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={filteredAcuityBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" labelLine={false} label={renderPieLabel}>
                        {filteredAcuityBreakdown.map(e => <Cell key={e.name} fill={ACUITY_COLORS[e.name] ?? C.gray} />)}
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
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          {filteredEncountersByDay.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-white mb-3">📈 Daily Volume</h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={filteredEncountersByDay.map(d => ({ ...d, date: d.date.slice(5) }))} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
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
          <p className="text-xs text-gray-500">{filteredEncounters.length} encounters — de-identified</p>
          {filteredEncounters.length === 0 ? <Empty text="No encounters for this period" /> : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <div className="grid grid-cols-[72px_72px_52px_100px_1fr_140px_80px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60 min-w-[640px]">
                <span>ID</span><span>Date</span><span>Age</span><span>Agency</span><span>Chief Complaint</span><span>CC / OSHA</span><span>Acuity</span>
              </div>
              {filteredEncounters.map(enc => {
                const claim = claimByEncId[enc.id]
                return (
                  <div key={enc.id} className="grid grid-cols-[72px_72px_52px_100px_1fr_140px_80px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 transition-colors items-center min-w-[640px]">
                    <span className="font-mono text-xs text-blue-400 font-semibold">{enc.seq_id}</span>
                    <span className="text-xs text-gray-400">{enc.date ? new Date(enc.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                    <span className="text-xs text-gray-400">{enc.age || '—'}</span>
                    <span className="text-xs text-gray-300 truncate">{enc.patient_agency || <span className="text-gray-600">—</span>}</span>
                    <span className="text-xs text-white truncate">{enc.chief_complaint || '—'}</span>
                    <span className="flex flex-col gap-1">
                      {wcEncounterIds.has(enc.id) && claim ? (
                        <>
                          <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded leading-none">📋 CC Filed</span>
                          {claim.has_pdf && claim.pdf_url && (
                            <button
                              onClick={() => openPdf(claim.pdf_url!)}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded transition-colors leading-none w-fit">
                              ⬇ CC PDF
                            </button>
                          )}
                        </>
                      ) : wcEncounterIds.has(enc.id) ? (
                        <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-700/40 px-1.5 py-0.5 rounded leading-none">📋 CC Filed</span>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </span>
                    <span><Badge color={ACUITY_COLORS[enc.acuity] ?? C.gray} label={enc.acuity} /></span>
                  </div>
                )
              })}
              </div>{/* end overflow-x-auto */}
            </div>
          )}
        </div>
      )}

      {/* ── ICS 214s ── */}
      {tab === 'ics214' && (
        <div className="space-y-3">
          {data.ics214s.length === 0 ? <Empty text="No ICS 214s for this incident" /> : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <div className="grid grid-cols-[90px_1fr_1fr_80px_60px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60 min-w-[420px]">
                <span>Date</span><span>Unit</span><span>Leader</span><span>Status</span><span>PDF</span>
              </div>
              {data.ics214s.map(form => (
                <div key={form.id} className="grid grid-cols-[90px_1fr_1fr_80px_60px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 items-center min-w-[420px]">
                  <span className="text-xs text-gray-400">{form.date ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                  <span className="text-xs text-white truncate">{form.unit || '—'}</span>
                  <span className="text-xs text-gray-400 truncate">{form.prepared_by || '—'}</span>
                  <span><Badge color={form.status === 'Closed' ? C.gray : C.green} label={form.status || 'Open'} /></span>
                  <span className="text-xs text-gray-600">{form.has_pdf ? '✅' : '—'}</span>
                </div>
              ))}
              </div>{/* end overflow-x-auto */}
            </div>
          )}
        </div>
      )}

      {/* ── Supply Tab ── */}
      {tab === 'supply' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white">🧰 Consumables Used — All Units Combined</h3>
            <p className="text-xs text-gray-500 mt-1">Full incident totals — not affected by date filter</p>
          </div>
          {data.supply_aggregated.length === 0 ? (
            <Empty text="No supply run data for this incident" />
          ) : (
            <>
              {/* Horizontal bar chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
                <ResponsiveContainer width="100%" height={Math.max(200, data.supply_aggregated.length * 32)}>
                  <BarChart
                    data={data.supply_aggregated.map(d => ({ name: d.item_name, qty: d.total_qty }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 11 }} width={155} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="qty" radius={[0, 4, 4, 0]} name="Total Qty">
                      {data.supply_aggregated.map((item, i) => {
                        const CAT: Record<string, string> = { 'CS': C.red, 'Medication': C.violet, 'IV': C.blue, 'Airway': C.teal, 'Wound Care': C.amber, 'OTC': C.green, 'Supply': C.amber }
                        const BARS = [C.blue, C.teal, C.violet, C.green, C.amber, C.red]
                        return <Cell key={i} fill={CAT[item.category || ''] || BARS[i % BARS.length]} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary table */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/60">
                  <span>Item</span><span>Total Qty</span><span>Unit</span>
                </div>
                {data.supply_aggregated.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2.5 border-b border-gray-800/50 text-sm hover:bg-gray-800/30 items-center">
                    <span className="text-xs text-white truncate">{item.item_name}</span>
                    <span className="text-xs font-bold text-blue-400">{item.total_qty}</span>
                    <span className="text-xs text-gray-400">{item.unit || '—'}</span>
                  </div>
                ))}
              </div>
            </>
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
      .limit(500)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [incidentId])

  if (loading) return <p className="text-gray-500 text-sm py-4 text-center">Loading access log...</p>

  // ── Aggregate by access code ───────────────────────────────────────────────
  const byCode: Record<string, {
    label: string; code: string; pageViews: number; tabViews: Record<string, number>
    pdfDownloads: number; lastAccess: string; devices: Set<string>
  }> = {}
  logs.forEach(l => {
    const key = l.access_code
    if (!byCode[key]) byCode[key] = {
      label: l.label || l.access_code, code: l.access_code,
      pageViews: 0, tabViews: {}, pdfDownloads: 0, lastAccess: '', devices: new Set()
    }
    const entry = byCode[key]
    const evType = l.event_type || 'page_view'
    if (evType === 'page_view') entry.pageViews++
    else if (evType === 'tab_view' && l.tab) entry.tabViews[l.tab] = (entry.tabViews[l.tab] || 0) + 1
    else if (evType === 'pdf_download') entry.pdfDownloads++
    if (!entry.lastAccess || l.accessed_at > entry.lastAccess) entry.lastAccess = l.accessed_at
    if (l.user_agent) {
      const ua = l.user_agent
      const device = ua.includes('Mobile') ? '📱 Mobile' : ua.includes('iPad') ? '📱 iPad' : '💻 Desktop'
      entry.devices.add(device)
    }
  })

  const TAB_LABEL: Record<string, string> = {
    overview: 'Overview', patients: 'Patient Log', ics214: 'ICS 214s', supply: 'Supply'
  }

  // Totals
  const totalPageViews = logs.filter(l => (l.event_type || 'page_view') === 'page_view').length
  const totalTabViews = logs.filter(l => l.event_type === 'tab_view').length
  const totalPdfDownloads = logs.filter(l => l.event_type === 'pdf_download').length
  const uniqueCodes = Object.keys(byCode).length
  const lastAccess = logs.length > 0 ? logs[0].accessed_at : null

  // Recent activity feed (all events)
  const recentLogs = logs.slice(0, 60)

  return (
    <div className="space-y-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-400">{totalPageViews}</p>
          <p className="text-xs text-gray-500 mt-1">Page Opens</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-teal-400">{totalTabViews}</p>
          <p className="text-xs text-gray-500 mt-1">Tab Views</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-amber-400">{totalPdfDownloads}</p>
          <p className="text-xs text-gray-500 mt-1">PDF Downloads</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-400">{uniqueCodes}</p>
          <p className="text-xs text-gray-500 mt-1">Active Code{uniqueCodes !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-10 text-center text-gray-600 text-sm">
          No access yet — share a code to start tracking
        </div>
      ) : (
        <>
          {/* ── Per-code breakdown ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">👀 Activity by Access Code</h3>
            {Object.entries(byCode)
              .sort((a, b) => (b[1].pageViews + b[1].pdfDownloads) - (a[1].pageViews + a[1].pdfDownloads))
              .map(([_key, info]) => (
              <div key={info.code} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                {/* Code header */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm text-white">{info.label !== info.code ? info.label : '(No label)'}</p>
                    <p className="font-mono text-xs text-amber-400 mt-0.5">{info.code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Last access</p>
                    <p className="text-xs text-gray-300">{new Date(info.lastAccess).toLocaleString()}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{[...info.devices].join(' · ')}</p>
                  </div>
                </div>
                {/* Stats row */}
                <div className="flex gap-4 flex-wrap text-xs">
                  <span className="text-gray-400"><span className="font-bold text-blue-400">{info.pageViews}</span> opens</span>
                  <span className="text-gray-400"><span className="font-bold text-amber-400">{info.pdfDownloads}</span> PDF{info.pdfDownloads !== 1 ? 's' : ''} downloaded</span>
                </div>
                {/* Tab breakdown */}
                {Object.keys(info.tabViews).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-1.5">Tabs viewed:</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(info.tabViews)
                        .sort((a, b) => b[1] - a[1])
                        .map(([t, count]) => (
                        <span key={t} className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full text-gray-300">
                          {TAB_LABEL[t] || t} <span className="text-gray-500 ml-0.5">×{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Activity feed ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-800/50">
              {recentLogs.map(l => {
                const evType = l.event_type || 'page_view'
                const icon = evType === 'page_view' ? '🔓' : evType === 'tab_view' ? '🔍' : '⬇'
                const detail = evType === 'page_view'
                  ? 'Opened dashboard'
                  : evType === 'tab_view'
                  ? `Viewed ${TAB_LABEL[l.tab] || l.tab} tab`
                  : `Downloaded ${l.document_type === 'comp_claim' ? 'CC PDF' : 'ICS 214 PDF'}`
                return (
                  <div key={l.id} className="grid grid-cols-[20px_1fr_auto] gap-2 px-4 py-2 items-start text-xs">
                    <span>{icon}</span>
                    <span>
                      <span className="font-medium text-white">{l.label || l.access_code}</span>
                      <span className="text-gray-500 ml-1.5">{detail}</span>
                    </span>
                    <span className="text-gray-600 shrink-0 whitespace-nowrap">{new Date(l.accessed_at).toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function FireDashboardContent() {
  const { isField } = useRole()
  const assignment = useUserAssignment()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingIncidents, setLoadingIncidents] = useState(true)

  useEffect(() => {
    if (isField) {
      // Field users: locked to their assigned incident — no DB fetch needed
      const assignedId = assignment.incidentUnit?.incident_id || null
      if (assignedId) setSelectedId(assignedId)
      setLoadingIncidents(false)
      return
    }
    const supabase = createClient()
    supabase
      .from('incidents')
      .select('id, name, status, start_date, incident_number')
      .order('status', { ascending: true })
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
  }, [isField, assignment.loading])

  const selectedIncident = isField
    ? (selectedId ? { id: selectedId, name: assignment.incident?.name || 'Your Incident', status: 'Active', start_date: null, incident_number: null } : undefined)
    : incidents.find(i => i.id === selectedId)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">External Dashboard</h1>
            <p className="text-gray-500 text-xs">External access codes &amp; incident data for fire agency personnel</p>
          </div>
        </div>

        {/* Incident selector */}
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-2 font-medium">Incident</p>
          {loadingIncidents ? (
            <div className="flex gap-2">{[1, 2, 3].map(i => <div key={i} className="h-8 w-32 bg-gray-800/50 rounded-xl animate-pulse" />)}</div>
          ) : isField ? (
            // Field user — locked to their assigned fire
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-white">{selectedIncident?.name || 'Your assigned incident'}</span>
              <span className="text-xs text-gray-500 ml-1">(locked)</span>
            </div>
          ) : (
            <>
              {/* Dropdown on mobile */}
              <div className="md:hidden">
                <select
                  value={selectedId || ''}
                  onChange={e => setSelectedId(e.target.value)}
                  className="bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-red-500 w-full"
                >
                  {incidents.map(inc => (
                    <option key={inc.id} value={inc.id}>{inc.status === 'Active' ? '● ' : '◦ '}{inc.name}</option>
                  ))}
                </select>
              </div>
              {/* Pills on desktop */}
              <div className="hidden md:flex gap-2 flex-wrap">
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
            </>
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
  return <FireDashboardContent />
}
