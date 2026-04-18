import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, Link } from 'react-router-dom'

type SupplyRun = {
  id: string
  run_date: string
  time: string | null
  resource_number: string | null
  dispensed_by: string | null
  notes: string | null
  incident_id: string | null
  incident_unit: { unit: { name: string } | null } | null
  incident: { name: string } | null
}

export default function SupplyRunSearch() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<SupplyRun[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = searchInput.trim()
    if (!trimmed) { setResults(null); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('supply_runs')
          .select(`
            id, run_date, time, resource_number, dispensed_by, notes, incident_id,
            incident_unit:incident_units(unit:units(name)),
            incident:incidents(name)
          `)
          .or(`resource_number.ilike.%${trimmed}%,dispensed_by.ilike.%${trimmed}%`)
          .order('run_date', { ascending: false })
          .limit(200)
        setResults((data || []) as unknown as SupplyRun[])
      } catch { setResults([]) }
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 mt-8 md:mt-0">
        <div>
          <h1 className="text-xl font-bold">🔍 Search Supply Runs</h1>
          <p className="text-gray-500 text-xs mt-0.5">Search all supply runs across all time</p>
        </div>
        <Link to="/supply-runs" className="text-sm text-gray-400 hover:text-gray-300 transition-colors">← Supply Runs</Link>
      </div>

      <div className="space-y-2 mb-4">
        <div className="relative">
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by crew resource number or dispensed by…"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600 pr-16"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {loading && <span className="text-xs text-gray-500 animate-pulse">searching…</span>}
            {searchInput && (
              <button onClick={() => setSearchInput('')}
                className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
            )}
          </div>
        </div>
        {results !== null && (
          <p className="text-xs text-blue-400">🔍 {results.length} result{results.length !== 1 ? 's' : ''} across all time</p>
        )}
      </div>

      {!searchInput && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500 text-sm">Type to search all supply runs</p>
        </div>
      )}

      {results !== null && results.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🚚</p>
          <p className="text-gray-500 text-sm">No matching supply runs.</p>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="theme-card rounded-xl border overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
            <span className="w-24 shrink-0">Date</span>
            <span className="w-28 shrink-0 hidden sm:block">Unit</span>
            <span className="flex-1 min-w-0">Incident</span>
            <span className="w-32 shrink-0 hidden md:block">Crew Resource #</span>
            <span className="w-28 shrink-0 hidden md:block">Dispensed By</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {results.map(run => {
              const unitName = (run.incident_unit as any)?.unit?.name
              const incName = (run.incident as any)?.name
              return (
                <div key={run.id}
                  onClick={() => navigate(`/supply-runs/${run.id}`)}
                  className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer transition-colors text-sm">
                  <span className="w-24 shrink-0 text-xs text-gray-300 font-mono">{run.run_date}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-400 hidden sm:block truncate">{unitName || '—'}</span>
                  <span className="flex-1 min-w-0 text-xs text-white truncate">{incName || '—'}</span>
                  <span className="w-32 shrink-0 text-xs text-gray-500 hidden md:block truncate">{run.resource_number || '—'}</span>
                  <span className="w-28 shrink-0 text-xs text-gray-500 hidden md:block truncate">{run.dispensed_by || '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
