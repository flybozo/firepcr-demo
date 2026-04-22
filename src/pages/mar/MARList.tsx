
import { FieldGuard } from '@/components/FieldGuard'
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { PageHeader, EmptyState, LoadingSkeleton } from '@/components/ui'
import { useNavigate, useSearchParams, useMatch } from 'react-router-dom'
import { unitFilterButtonClass, UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { getCachedData, cacheData } from '@/lib/offlineStore'
import { loadList } from '@/lib/offlineFirst'

type MAREntry = {
  id: string
  date: string
  time: string | null
  patient_name: string | null
  item_name: string | null
  qty_used: number | null
  medication_route: string | null
  dosage_units: string | null
  med_unit: string | null
  incident: string | null
  dispensed_by: string | null
  item_type: string | null
  entry_type: string | null
  requires_cosign: boolean | null
  provider_signature_url: string | null
}

const TYPE_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
}

function getUnitType(name: string): string {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.startsWith('medic')) return 'Ambulance'
  if (n.startsWith('aid') || n === 'command 1') return 'Med Unit'
  if (n.startsWith('rescue')) return 'REMS'
  return 'Warehouse'
}

function getStatusBadge(entry: MAREntry) {
  if (entry.requires_cosign && !entry.provider_signature_url) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 whitespace-nowrap">
        ⚠ Unsigned
      </span>
    )
  }
  if (entry.provider_signature_url?.startsWith('digital:')) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 whitespace-nowrap">
        ✓ Signed (digital)
      </span>
    )
  }
  if (entry.provider_signature_url) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 whitespace-nowrap">
        ✓ Signed
      </span>
    )
  }
  return null
}

function getRouteAbbr(route: string | null): string | null {
  if (!route) return null
  const abbrs: Record<string, string> = {
    'Intravenous (IV)': 'IV',
    'Intramuscular (IM)': 'IM',
    'Oral': 'PO',
    'Intranasal': 'IN',
    'Subcutaneous': 'SQ',
    'Intraosseous (IO)': 'IO',
    'Inhalation': 'Inh',
    'Nebulizer': 'Neb',
    'Sublingual': 'SL',
    'Topical': 'Top',
    'Endotracheal Tube (ET)': 'ET',
    'CPAP': 'CPAP',
    'BVM': 'BVM',
    'Auto Injector': 'Auto',
    'Other/miscellaneous': 'Other',
  }
  return abbrs[route] || route
}

function MARListInner() {
  const supabase = createClient()
  const roleLoading = usePermissionLoading()
  const isField = !usePermission('mar.view')
  const assignment = useUserAssignment()
  const navigate = useNavigate()
  const detailMatch = useMatch('/mar/:id')
  const [searchParams] = useSearchParams()
  const unitParam = searchParams.get('unit')
  const success = searchParams.get('success')

  const [entries, setEntries] = useState<MAREntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [unitFilter, setUnitFilter] = useState('All')
  const [incidentFilter, setIncidentFilter] = useState('All')
  const [activeIncidents, setActiveIncidents] = useState<{id: string; name: string}[]>([])
  const [dateRange, setDateRange] = useState('7d')

  const DATE_RANGES = ['2d', '7d', '14d', '30d'] as const
  const dateRangeDays: Record<string, number> = { '2d': 2, '7d': 7, '14d': 14, '30d': 30 }
  // eslint-disable-next-line react-hooks/purity
  const dateFilterNow = useMemo(() => Date.now(), [dateRange])
  const dateFilter = new Date(dateFilterNow - (dateRangeDays[dateRange] ?? 7) * 86400000).toISOString().split('T')[0]

  useEffect(() => {
    setIsOffline(!getIsOnline())
    return onConnectionChange((online) => setIsOffline(!online))
  }, [])

  // ── Phase 1: render cache instantly ──
  // Only show unfiltered cache for admins. Field users must wait for role+assignment
  // to load so we can apply the unit filter — never show other units' MAR data.
  useEffect(() => {
    if (roleLoading || assignment.loading) return // wait until we know who this is
    const preload = async () => {
      try {
        const cached = await getCachedData('mar_entries') as any[]
        if (cached.length > 0) {
          // Apply unit filter to cache for field users
          const effectiveUnit = unitParam || (isField ? assignment.unit?.name : null)
          const filtered = effectiveUnit
            ? cached.filter((e: any) => e.med_unit === effectiveUnit)
            : cached
          const sorted = [...filtered].sort((a: any, b: any) => (b.date || b.created_at || '').localeCompare(a.date || a.created_at || ''))
          setEntries(sorted as any[])
        }
      } catch {}
      // Always unblock loading after cache attempt
      setLoading(false)
    }
    preload()
  }, [roleLoading, assignment.loading, isField, assignment.unit?.name, unitParam])

  useEffect(() => {
    if (roleLoading || assignment.loading) return
    const load = async () => {
      // Load incidents for filter
      let localIncidents: {id: string; name: string}[] = activeIncidents
      if (!isField) {
        const incResult = await loadList(
          async () => supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
          'incidents'
        )
        localIncidents = incResult.data as any[]
        setActiveIncidents(localIncidents)
      }
      // Load MAR entries
      const { data, offline } = await loadList(
        async () => {
          let query = supabase
            .from('dispense_admin_log')
            .select('id, date, time, patient_name, dob, item_name, qty_used, medication_route, dosage_units, med_unit, dispensed_by, item_type, entry_type, requires_cosign, provider_signature_url, incident')
            .order('date', { ascending: false })
          const effectiveUnit = unitParam || (isField ? assignment.unit?.name : null)
          if (effectiveUnit) query = query.eq('med_unit', effectiveUnit)
          // incidentFilter holds incident ID; incident column stores the incident name
          if (incidentFilter !== 'All') {
            const incidentName = localIncidents.find(i => i.id === incidentFilter)?.name
            if (incidentName) query = query.eq('incident', incidentName)
          }
          if (dateFilter) query = query.gte('date', dateFilter)
          return query.limit(200)
        },
        'mar_entries'
      )
      const sorted = [...data].sort((a: any, b: any) => (b.date || b.created_at || '').localeCompare(a.date || a.created_at || ''))
      setEntries(sorted as MAREntry[])
      if (offline) setIsOffline(true)
      setLoading(false)
    }
    load()
  }, [isField, assignment.loading, assignment.unit?.name, unitParam, incidentFilter, dateRange])

  // Distinct unit names sorted by type order
  const unitNames = Array.from(
    new Set(entries.map(e => e.med_unit).filter(Boolean) as string[])
  ).sort((a, b) => {
    const aOrder = UNIT_TYPE_ORDER[getUnitType(a)] ?? 99
    const bOrder = UNIT_TYPE_ORDER[getUnitType(b)] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })

  const filtered = entries.filter(e => {
    if (unitFilter !== 'All' && e.med_unit !== unitFilter) return false
    return true
  })

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="p-4 md:p-6 space-y-4">
        <PageHeader
          title="💊 MAR"
          subtitle={`Medication Administration Record · ${entries.length} entries`}
          actions={
            <Link to="/mar/new" className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">+ New</Link>
          }
        />
        <div>
        </div>

        {isOffline && (
          <div className="bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
            📶 <span>Offline - showing cached data. New entries will sync when you reconnect.</span>
          </div>
        )}

        {success && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm">
            ✅ Medication administration recorded successfully.
          </div>
        )}

        {/* Date range pills */}
        <div className="hidden md:flex gap-1.5">
          {DATE_RANGES.map(range => (
            <button key={range} onClick={() => setDateRange(range)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {range === '2d' ? '2 Days' : range === '7d' ? '7 Days' : range === '14d' ? '14 Days' : '30 Days'}
            </button>
          ))}
        </div>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)}
          className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500">
          <option value="2d">2 Days</option>
          <option value="7d">7 Days</option>
          <option value="14d">14 Days</option>
          <option value="30d">30 Days</option>
        </select>

        {/* Unit filter buttons - hidden/locked for field users */}
        {/* Incident filter pills - admin only */}
        {!isField && activeIncidents.length > 0 && (
          <>
            {/* Desktop: incident pills */}
            <div className="hidden md:flex gap-1.5 flex-wrap">
              <button onClick={() => setIncidentFilter('All')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${incidentFilter === 'All' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                All Incidents
              </button>
              {activeIncidents.map((inc, i) => (
                <button key={inc.id} onClick={() => setIncidentFilter(inc.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    incidentFilter === inc.id
                      ? ['bg-teal-700 text-white','bg-amber-700 text-white','bg-indigo-700 text-white'][i % 3]
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  🔥 {inc.name}
                </button>
              ))}
            </div>
            {/* Mobile: incident dropdown */}
            <select
              value={incidentFilter}
              onChange={e => setIncidentFilter(e.target.value)}
              className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="All">All Incidents</option>
              {activeIncidents.map(inc => (
                <option key={inc.id} value={inc.id}>🔥 {inc.name}</option>
              ))}
            </select>
          </>
        )}
        {unitNames.length > 0 && !isField && (
          <>
            {/* Desktop: unit pills */}
            <div className="hidden md:flex gap-2 flex-wrap">
              <button
                onClick={() => setUnitFilter('All')}
                className={'px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ' + unitFilterButtonClass('All', unitFilter === 'All')}
              >
                All
              </button>
              {unitNames.map(u => (
                <button
                  key={u}
                  onClick={() => setUnitFilter(u)}
                  className={'px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ' + unitFilterButtonClass(getUnitType(u), unitFilter === u)}
                >
                  {u}
                </button>
              ))}
            </div>
            {/* Mobile: unit dropdown */}
            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="All">All</option>
              {unitNames.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </>
        )}
        {isField && assignment.unit?.name && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Showing:</span>
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit.name}</span>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton rows={5} header />
        ) : filtered.length === 0 ? (
          <EmptyState icon="💊" message="No entries recorded yet." />
        ) : (
          <div className="theme-card rounded-xl border overflow-hidden">
            {/* Horizontally scrollable on mobile - each row stays single-line */}
            <div className="overflow-x-auto">
              <div className="min-w-[740px]">
                {/* Header */}
                <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
                  <span className="w-20 shrink-0">Date</span>
                  <span className="w-20 shrink-0">Patient</span>
                  <span className="flex-1 min-w-[120px]">Medication</span>
                  <span className="w-14 shrink-0">Route</span>
                  <span className="w-20 shrink-0">Qty</span>
                  <span className="w-20 shrink-0">Unit</span>
                  <span className="w-20 shrink-0">Incident</span>
                  <span className="w-14 shrink-0">Type</span>
                  <span className="w-28 shrink-0 text-right">Status</span>
                </div>
                {filtered.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => navigate(`/mar/${entry.id}`)}
                    className={`flex items-center px-4 py-2.5 cursor-pointer border-b border-gray-800/50 ${detailMatch?.params?.id === entry.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                  >
                    <span className="w-20 shrink-0 text-gray-400 text-xs">{entry.date || '-'}</span>
                    <span className="w-20 shrink-0 text-white text-xs font-medium truncate pr-1">
                      {entry.patient_name
                        ? entry.patient_name.split(/[, ]+/).filter(Boolean).map((n: string) => n[0].toUpperCase() + '.').join(' ')
                        : '-'}
                    </span>
                    <span className="flex-1 min-w-[120px] text-gray-200 text-xs truncate pr-2">
                      {entry.item_name || '—'}
                    </span>
                    <span className="w-14 shrink-0 text-gray-400 text-xs">
                      {getRouteAbbr(entry.medication_route) || '—'}
                    </span>
                    <span className="w-20 shrink-0 font-mono text-white text-xs">
                      {entry.qty_used !== null
                        ? `×${entry.qty_used}${entry.dosage_units ? ' ' + entry.dosage_units : ''}`
                        : '—'}
                    </span>
                    <span className="w-20 shrink-0 text-gray-400 text-xs truncate">{entry.med_unit || '—'}</span>
                    <span className="w-20 shrink-0 text-gray-400 text-xs truncate">{entry.incident || '—'}</span>
                    <span className="w-14 shrink-0">
                      {entry.item_type ? (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[entry.item_type] || 'bg-gray-700 text-gray-300'}`}>
                          {entry.item_type}
                        </span>
                      ) : <span className="text-gray-600">-</span>}
                    </span>
                    <span className="w-28 shrink-0 text-right">
                      {getStatusBadge(entry)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && filtered.length < entries.length && (
          <p className="text-center text-gray-600 text-xs">Showing {filtered.length} of {entries.length}</p>
        )}

        <Link to="/" className="block text-center text-gray-600 text-sm">← Home</Link>
      </div>
    </div>
  )
}

function MARPageInner() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading MAR...</p>
      </div>
    }>
      <MARListInner />
    </Suspense>
  )
}

export default function MARPageWrapped() {
  return (
    // Don't redirect if viewing a specific detail (id in URL) — let SplitShell handle it
    <FieldGuard redirectFn={(a) => {
      if (window.location.pathname.match(/\/mar\/.+/)) return null
      return a.unit?.name ? `/mar?unit=${encodeURIComponent(a.unit.name)}` : null
    }}>
      <MARPageInner />
    </FieldGuard>
  )
}
