
import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { FieldGuard } from '@/components/FieldGuard'

type Claim = { id: string; patient_name: string | null; incident: string | null; date_of_injury: string | null; status: string | null; pdf_url: string | null; unit: string | null }

function CompClaimsInner() {
  const supabase = createClient()
  const [searchParams] = useSearchParams()
  const incidentId = searchParams.get('incidentId')
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7d')

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Comp Claims</h1>
          <p className="text-gray-500 text-xs">{claims.length} claims</p>
        </div>
        <div className="flex gap-1.5">
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
      {loading ? <p className="text-gray-500 text-sm">Loading...</p> : claims.length === 0 ? (
        <p className="text-center text-gray-600 py-12">No comp claims{incidentId ? ' for this incident' : ''}.</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="divide-y divide-gray-800">
            {claims.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-800/50">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{c.patient_name || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{c.incident} · {c.unit} · {c.date_of_injury}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${c.status === 'Complete' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                  {c.status || 'Pending'}
                </span>
                {c.pdf_url && (
                  <a href={c.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 shrink-0">📄 PDF</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CompClaimsPage() {
  return (
    <FieldGuard redirectFn={(a) => a.incidentUnit?.incident_id ? `/comp-claims?incidentId=${a.incidentUnit.incident_id}` : null}>
      <Suspense fallback={<div className="p-8 text-gray-500">Loading...</div>}>
        <CompClaimsInner />
      </Suspense>
    </FieldGuard>
  )
}
