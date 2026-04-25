
import { FieldGuard } from '@/components/FieldGuard'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadList } from '@/lib/offlineFirst'
import { useNavigate, useSearchParams, useMatch } from 'react-router-dom'
import { Suspense } from 'react'
import { queryIncidentsList } from '@/lib/services/incidents'
import { PageHeader, EmptyState, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type Incident = {
  id: string
  name: string
  location: string | null
  incident_number: string | null
  start_date: string | null
  closed_at: string | null
  status: string
  incident_units: { id: string; released_at: string | null }[]
}

function IncidentsPageInner() {
  const navigate = useNavigate()
  const detailMatch = useMatch('/incidents/:id')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const [tab, setTab] = useState<'Active' | 'Closed'>(statusParam === 'Closed' ? 'Closed' : 'Active')
  const [search, setSearch] = useState('')
  type IncSortKey = 'start_date' | 'name' | 'location'
  const { sortKey: incSortKey, sortDir: incSortDir, toggleSort: incToggleSort, sortFn: incSortFn } = useSortable<IncSortKey>('start_date', 'desc')
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)

  const [isOfflineData, setIsOfflineData] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Check for a user-set default fire
      let defaultIncidentId: string | null = null
      try { defaultIncidentId = localStorage.getItem('default_incident_id') } catch {}

      // Show cached incidents only when offline
      if (!navigator.onLine) {
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cached = await getCachedData('incidents') as any[]
          if (cached.length > 0) {
            cached.sort((a: any, b: any) => (b.start_date || b.created_at || '').localeCompare(a.start_date || a.created_at || ''))
            setIncidents(cached as any[])
            setLoading(false)
            const defaultFire = defaultIncidentId ? cached.find((i: any) => i.id === defaultIncidentId && i.status === 'Active') : null
            const target = defaultFire || cached.find((i: any) => i.status === 'Active')
            if (target && statusParam !== 'Closed') { navigate(`/incidents/${target.id}`, { replace: true }); return }
            return
          }
        } catch {}
      }
      const { data, offline } = await loadList(
        () => queryIncidentsList() as any,
        'incidents'
      )
      const sorted = [...data].sort((a: any, b: any) => (b.start_date || b.created_at || '').localeCompare(a.start_date || a.created_at || ''))
      setIncidents(sorted as Incident[])
      setIsOfflineData(offline)
      setLoading(false)
      // Auto-redirect: prefer user-set default fire if active, else most recent active
      const defaultFire = defaultIncidentId ? sorted.find((i: any) => i.id === defaultIncidentId && i.status === 'Active') : null
      const redirectTarget = defaultFire || sorted.find((i: any) => i.status === 'Active')
      if (redirectTarget && statusParam !== 'Closed') { navigate(`/incidents/${redirectTarget.id}`, { replace: true }); return }
    }
    load()
  }, [])

  const filtered = incSortFn(incidents.filter(i => {
    if (i.status !== tab) return false
    if (search) {
      const s = search.toLowerCase()
      return i.name?.toLowerCase().includes(s) || i.location?.toLowerCase().includes(s) || i.incident_number?.toLowerCase().includes(s)
    }
    return true
  }), (i, key) => {
    if (key === 'start_date') return i.start_date ?? ''
    if (key === 'name') return i.name ?? ''
    if (key === 'location') return i.location ?? ''
    return ''
  })

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="p-4 md:p-6 space-y-4">

        {/* Header */}
        <PageHeader
          title="Incidents"
          subtitle={`${incidents.filter(i => i.status === 'Active').length} active · ${incidents.filter(i => i.status === 'Closed').length} closed`}
          actions={
            <Link to="/incidents/new" className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">+ New</Link>
          }
        />

        {/* Tab bar */}
        <div className="flex gap-2">
          {(['Active', 'Closed'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearchParams(t === 'Closed' ? { status: 'Closed' } : {}, { replace: true }) }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? t === 'Active' ? 'bg-green-700 text-white' : 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {t === 'Active' ? '🔥 Active' : '📁 Closed'}
              <span className="ml-1.5 text-xs opacity-70">({incidents.filter(i => i.status === t).length})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, location, or number…"
          className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600"
        />

        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={tab === 'Active' ? '🔥' : '📁'}
            message={search ? 'No matches.' : `No ${tab.toLowerCase()} incidents.`}
            actionHref={tab === 'Active' && !search ? '/incidents/new' : undefined}
            actionLabel="Create one"
          />
        ) : (
          <div className={`${lc.container} overflow-x-auto`}>
            <div className={`flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide ${lc.header} min-w-[480px]`}>
              <SortableHeader label="Incident Name" sortKey="name" currentKey={incSortKey} currentDir={incSortDir} onToggle={incToggleSort} className="flex-1 min-w-[120px]" />
              <SortableHeader label="Start Date" sortKey="start_date" currentKey={incSortKey} currentDir={incSortDir} onToggle={incToggleSort} className="w-24 shrink-0 hidden sm:flex" />
              <SortableHeader label="Location" sortKey="location" currentKey={incSortKey} currentDir={incSortDir} onToggle={incToggleSort} className="w-40 shrink-0 hidden md:flex" />
              <span className="w-28 shrink-0 hidden md:block text-gray-500">Number</span>
              <span className="w-16 shrink-0 text-center text-gray-500">Units</span>
            </div>
            {filtered.map(incident => (
              <div
                key={incident.id}
                onClick={() => navigate(`/incidents/${incident.id}`)}
                className={`flex items-center px-4 py-2 cursor-pointer text-sm min-w-[480px] ${lc.rowCls(detailMatch?.params?.id === incident.id)}`}
              >
                <span className="flex-1 min-w-[120px] font-medium truncate pr-2">{incident.name}</span>
                <span className="w-24 shrink-0 text-gray-400 text-xs pr-2 hidden sm:block">
                  {incident.start_date || '—'}
                </span>
                <span className="w-40 shrink-0 text-gray-400 text-xs truncate pr-2 hidden md:block">
                  {incident.location || '—'}
                </span>

                <span className="w-16 shrink-0 text-center text-gray-400 text-xs">
                  {incident.incident_units?.filter(u => !u.released_at).length || 0}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link to="/" className="block text-center text-gray-600 text-sm">← Home</Link>
      </div>
    </div>
  )
}

export default function IncidentsPageWrapped() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <FieldGuard redirectFn={(a) => a.incidentUnit?.incident_id ? `/incidents/${a.incidentUnit.incident_id}` : null}>
        <IncidentsPageInner />
      </FieldGuard>
    </Suspense>
  )
}
