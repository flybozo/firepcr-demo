
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { FieldGuard } from '@/components/FieldGuard'
import { PageHeader, LoadingSkeleton, EmptyState, SortBar } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type Claim = { id: string; patient_name: string | null; incident: string | null; date_of_injury: string | null; status: string | null; pdf_url: string | null; unit: string | null }

function CompClaimsInner() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const [searchParams] = useSearchParams()
  const incidentId = searchParams.get('incidentId')
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7d')
  type ClaimSortKey = 'date_of_injury' | 'patient_name'
  const { sortKey: claimSortKey, sortDir: claimSortDir, toggleSort: claimToggleSort, sortFn: claimSortFn } = useSortable<ClaimSortKey>('date_of_injury', 'desc')

  useEffect(() => {
    const load = async () => {
      const dateFilter = dateRange === 'All' ? null :
        new Date(Date.now() - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000).toISOString()
      let query = supabase.from('comp_claims')
        .select('id, patient_name, incident, date_of_injury, status, pdf_url, unit')
        .order('created_at', { ascending: false })
        .limit(200)
      if (incidentId) query = (query as any).eq('incident_id', incidentId)
      if (dateFilter) query = (query as any).gte('created_at', dateFilter)
      try {
        const { data, error } = await query
        if (error) throw error
        setClaims(data || [])
      } catch { setClaims([]) }
      setLoading(false)
    }
    load()
  }, [incidentId, dateRange])

  return (
    <div className="p-4 md:p-6 mt-8 md:mt-0">
      <PageHeader
        title="Comp Claims"
        subtitle={`${claims.length} claims`}
        actions={
          <div className="flex items-center gap-2">
            {/* Desktop: date range pills */}
            <div className="hidden md:flex gap-1.5">
              {(['7d', '30d', '90d', 'All'] as const).map(range => (
                <button key={range} onClick={() => setDateRange(range)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
                </button>
              ))}
            </div>
            <Link to={`/comp-claims/new${incidentId ? `?incidentId=${incidentId}` : ''}`}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
              + New Claim
            </Link>
          </div>
        }
        className="mb-4"
      />
      {/* Mobile: date range dropdown */}
      <select
        value={dateRange}
        onChange={e => setDateRange(e.target.value)}
        className="md:hidden w-full mb-4 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
      >
        <option value="7d">7 Days</option>
        <option value="30d">30 Days</option>
        <option value="90d">90 Days</option>
        <option value="All">All Time</option>
      </select>
      {loading ? <LoadingSkeleton rows={4} header /> : claims.length === 0 ? (
        <EmptyState icon="🪢" message={`No comp claims${incidentId ? ' for this incident' : ''}.`} />
      ) : (
        <>
          <SortBar
            options={[{ label: 'Date of Injury', key: 'date_of_injury' }, { label: 'Patient', key: 'patient_name' }]}
            currentKey={claimSortKey}
            currentDir={claimSortDir}
            onToggle={claimToggleSort}
            className="mb-3"
          />
        <div className={lc.container}>
          <div className="divide-y divide-gray-800">
            {claimSortFn(claims, (c, key) => {
              if (key === 'date_of_injury') return c.date_of_injury ?? ''
              if (key === 'patient_name') return c.patient_name ?? ''
              return ''
            }).map(c => (
              <div key={c.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${lc.row}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{c.patient_name || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{c.incident} · {c.unit} · {c.date_of_injury}</p>
                </div>
                {c.pdf_url ? (
                  <a href={c.pdf_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 shrink-0 hover:bg-green-800">📄 PDF</a>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 shrink-0">⚠️ No PDF</span>
                )}
              </div>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  )
}

export default function CompClaimsPage() {
  return (
    <FieldGuard redirectFn={(a) => a.incidentUnit?.incident_id ? `/comp-claims?incidentId=${a.incidentUnit.incident_id}` : null}>
      <Suspense fallback={<LoadingSkeleton fullPage />}>
        <CompClaimsInner />
      </Suspense>
    </FieldGuard>
  )
}
