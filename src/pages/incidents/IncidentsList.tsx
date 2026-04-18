
import { FieldGuard } from '@/components/FieldGuard'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { loadList } from '@/lib/offlineFirst'
import { useNavigate, useSearchParams, useMatch } from 'react-router-dom'
import { Suspense } from 'react'

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
  const supabase = createClient()
  const navigate = useNavigate()
  const detailMatch = useMatch('/incidents/:id')
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const [tab, setTab] = useState<'Active' | 'Closed'>(statusParam === 'Closed' ? 'Closed' : 'Active')
  const [search, setSearch] = useState('')

  const [isOfflineData, setIsOfflineData] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Show cached incidents instantly
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('incidents') as any[]
        if (cached.length > 0) {
          cached.sort((a: any, b: any) => (b.start_date || b.created_at || '').localeCompare(a.start_date || a.created_at || ''))
          setIncidents(cached as any[])
          setLoading(false)
        }
      } catch {}
      const { data, offline } = await loadList(
        () => supabase
          .from('incidents')
          .select('id, name, location, incident_number, start_date, closed_at, status, incident_units(id, released_at)')
          .order('created_at', { ascending: false }) as any,
        'incidents'
      )
      const sorted = [...data].sort((a: any, b: any) => (b.start_date || b.created_at || '').localeCompare(a.start_date || a.created_at || ''))
      setIncidents(sorted as Incident[])
      if (offline) setIsOfflineData(true)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = incidents.filter(i => {
    if (i.status !== tab) return false
    if (search) {
      const s = search.toLowerCase()
      return i.name?.toLowerCase().includes(s) || i.location?.toLowerCase().includes(s) || i.incident_number?.toLowerCase().includes(s)
    }
    return true
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">Incidents</h1>
            <p className="text-gray-500 text-xs">
              {incidents.filter(i => i.status === 'Active').length} active · {incidents.filter(i => i.status === 'Closed').length} closed
            </p>
          </div>
          <Link to="/incidents/new"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
            + New
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2">
          {(['Active', 'Closed'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
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
          <div className="text-center text-gray-500 py-12">
            <p className="text-4xl mb-4">{tab === 'Active' ? '🔥' : '📁'}</p>
            <p>{search ? 'No matches.' : `No ${tab.toLowerCase()} incidents.`}</p>
            {tab === 'Active' && !search && (
              <Link to="/incidents/new" className="text-red-400 underline text-sm mt-2 block">Create one</Link>
            )}
          </div>
        ) : (
          <div className="theme-card rounded-xl border overflow-x-auto">
            <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header min-w-[480px]">
              <span className="flex-1 min-w-[120px]">Incident Name</span>
              <span className="w-24 shrink-0 hidden sm:block">Start Date</span>
              <span className="w-40 shrink-0 hidden md:block">Location</span>
              <span className="w-28 shrink-0 hidden md:block">Number</span>
              <span className="w-16 shrink-0 text-center">Units</span>
            </div>
            {filtered.map(incident => (
              <div
                key={incident.id}
                onClick={() => navigate(`/incidents/${incident.id}`)}
                className={`flex items-center px-4 py-2 cursor-pointer border-b border-gray-800/50 text-sm min-w-[480px] ${detailMatch?.params?.id === incident.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
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
