/**
 * Internal Fire Dashboard — admin page for managing external access codes
 * and previewing the same incident dashboard that external users see.
 *
 * Shares all tab components with FireAdminDashboard (external view).
 * Only adds: incident selector, access codes panel, and access log tab.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/authFetch'
import { usePermission } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'
import {
  type DashboardData,
  type DateFilter,
  OverviewTab, PatientLogTab, ICS214Tab, SupplyTab, STATUS_COLOR, C,
} from '@/pages/fire-admin/FireAdminDashboard'
import { ContactCards } from '@/components/ContactCards'
import { ConfirmDialog } from '@/components/ui'
import { TimelineTab } from '@/components/timeline/TimelineTab'

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://ram-field-ops.vercel.app'

type Incident = { id: string; name: string; status: string; start_date: string | null; incident_number: string | null }
type AccessCode = { id: string; access_code: string; incident_id: string; label: string | null; active: boolean; expires_at: string | null; created_at: string; created_by: string | null }

// Minimal local helpers used by AccessCodesPanel
function Skeleton({ h = 'h-40' }: { h?: string }) {
  return <div className={`${h} bg-gray-800/50 rounded-xl animate-pulse`} />
}
function Badge({ color, label }: { color: string; label: string }) {
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: color + '30', color }}>{label}</span>
}

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
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

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
    } catch {}
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
        toast.error('Error: ' + (err.error || 'Failed to generate code'))
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

  const deleteCode = (codeId: string, codeStr: string) => {
    setConfirmAction({
      action: async () => {
        const res = await authFetch(`/api/incident-access?code_id=${encodeURIComponent(codeId)}`, {
          method: 'DELETE',
        })
        if (res.ok) {
          loadCodes()
        } else {
          const err = await res.json().catch(() => ({ error: 'Failed to delete' }))
          toast.error(err.error || 'Failed to delete access code')
        }
      },
      title: 'Delete Access Code',
      message: `Delete access code ${codeStr}? This cannot be undone.`,
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
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
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

// ── Incident Dashboard (uses same API + shared tab components as external) ──
type DashTab = 'overview' | 'timeline' | 'patients' | 'ics214' | 'supply' | 'access-log'

function IncidentDashboard({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DashTab>('overview')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  useEffect(() => {
    setLoading(true)
    setError(null)
    authFetch(`/api/incident-access?incidentId=${incidentId}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setError(json.error)
        else setData(json)
      })
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }, [incidentId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filterNow = useMemo(() => Date.now(), [dateFilter])
  const applyDateFilter = <T extends { created_at?: string | null }>(items: T[]): T[] => {
    if (dateFilter === 'all') return items
    const ms = dateFilter === '24h' ? 86400000 : dateFilter === '48h' ? 172800000 : 604800000
    return items.filter(i => i.created_at && filterNow - new Date(i.created_at).getTime() <= ms)
  }

  const tabs: { id: DashTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'timeline', label: 'Timeline', icon: '🕒' },
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

  // No-op logger for internal view (no access code tracking)
  const noopLog = () => {}

  return (
    <div className="space-y-6">
      {/* Medical Directors & Deployed Units */}
      <ContactCards medicalDirectors={data.medical_directors} deployedUnits={data.deployed_units} />

      {/* Tabs + date filter */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
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

      {/* Shared tab content — same components as external dashboard */}
      {tab === 'overview' && <OverviewTab data={data} filteredEncounters={applyDateFilter(data.encounters)} />}
      {tab === 'timeline' && (
        <TimelineTab
          fetchFn={async ({ limit, before, types }) => {
            const params = new URLSearchParams()
            params.set('incident_id', incidentId)
            params.set('limit', String(limit))
            if (before) params.set('before', before)
            if (types?.length) params.set('types', types.join(','))
            const res = await authFetch(`/api/timeline?${params}`)
            return res.json()
          }}
        />
      )}
      {tab === 'patients' && <PatientLogTab data={{ ...data, encounters: applyDateFilter(data.encounters) }} code="" logEvent={noopLog} />}
      {tab === 'ics214' && <ICS214Tab data={data} code="" logEvent={noopLog} />}
      {tab === 'supply' && <SupplyTab data={data} dateFilter={dateFilter} />}
      {tab === 'access-log' && <AccessLogTab incidentId={incidentId} />}
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

  const totalPageViews = logs.filter(l => (l.event_type || 'page_view') === 'page_view').length
  const totalTabViews = logs.filter(l => l.event_type === 'tab_view').length
  const totalPdfDownloads = logs.filter(l => l.event_type === 'pdf_download').length
  const uniqueCodes = Object.keys(byCode).length
  const recentLogs = logs.slice(0, 60)

  return (
    <div className="space-y-5">
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
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">👀 Activity by Access Code</h3>
            {Object.entries(byCode)
              .sort((a, b) => (b[1].pageViews + b[1].pdfDownloads) - (a[1].pageViews + a[1].pdfDownloads))
              .map(([_key, info]) => (
              <div key={info.code} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
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
                <div className="flex gap-4 flex-wrap text-xs">
                  <span className="text-gray-400"><span className="font-bold text-blue-400">{info.pageViews}</span> opens</span>
                  <span className="text-gray-400"><span className="font-bold text-amber-400">{info.pdfDownloads}</span> PDF{info.pdfDownloads !== 1 ? 's' : ''} downloaded</span>
                </div>
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
  const canSettings = usePermission('admin.settings')
  const assignment = useUserAssignment()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingIncidents, setLoadingIncidents] = useState(true)

  useEffect(() => {
    if (!canSettings) {
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
  }, [canSettings, assignment.loading])

  const selectedIncident = !canSettings
    ? (selectedId ? { id: selectedId, name: assignment.incident?.name || 'Your Incident', status: 'Active', start_date: null, incident_number: null } : undefined)
    : incidents.find(i => i.id === selectedId)

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">External Dashboard</h1>
            <p className="text-gray-500 text-xs">External access codes &amp; incident data for fire agency personnel</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-600 uppercase tracking-wide mb-2 font-medium">Incident</p>
          {loadingIncidents ? (
            <div className="flex gap-2">{[1, 2, 3].map(i => <div key={i} className="h-8 w-32 bg-gray-800/50 rounded-xl animate-pulse" />)}</div>
          ) : !canSettings ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-white">{selectedIncident?.name || 'Your assigned incident'}</span>
              <span className="text-xs text-gray-500 ml-1">(locked)</span>
            </div>
          ) : (
            <>
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

            <AccessCodesPanel incidentId={selectedId} incidentName={selectedIncident.name} />

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
