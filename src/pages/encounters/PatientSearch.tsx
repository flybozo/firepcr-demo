import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { usePermission } from '@/hooks/usePermission'

type SearchResult = {
  id: string
  encounter_id: string
  date: string | null
  unit: string | null
  incident_name: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  primary_symptom_text: string | null
  initial_acuity: string | null
  pcr_status: string | null
  provider_of_record: string | null
}

const ACUITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-900 text-red-300',
  High: 'bg-orange-900 text-orange-300',
  Moderate: 'bg-yellow-900 text-yellow-300',
  Low: 'bg-green-900 text-green-300',
  Minor: 'bg-gray-700 text-gray-300',
}

export default function PatientSearchPage() {
  const supabase = createClient()
  const isField = !usePermission('incidents.manage')
  const assignment = useUserAssignment()

  const [query, setQuery] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  const runSearch = async () => {
    const q = query.trim()
    if (!q && !unitFilter && !dateFrom && !dateTo) return
    setLoading(true)
    setSearched(true)
    try {
      let dbQuery = supabase
        .from('patient_encounters')
        .select('id, encounter_id, date, unit, patient_first_name, patient_last_name, primary_symptom_text, initial_acuity, pcr_status, provider_of_record, incident:incidents(name)')
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(200)

      // Field users locked to their incident
      const fieldIncidentId = isField ? assignment.incidentUnit?.incident_id : null
      if (fieldIncidentId) dbQuery = dbQuery.eq('incident_id', fieldIncidentId)
      if (isField && assignment.unit?.name) dbQuery = (dbQuery as any).eq('unit', assignment.unit.name)

      // Text search across patient name, complaint, encounter ID
      if (q) {
        dbQuery = dbQuery.or(
          `patient_last_name.ilike.%${q}%,patient_first_name.ilike.%${q}%,primary_symptom_text.ilike.%${q}%,encounter_id.ilike.%${q}%,provider_of_record.ilike.%${q}%`
        )
      }

      // Optional filters
      if (unitFilter) dbQuery = (dbQuery as any).eq('unit', unitFilter)
      if (dateFrom) dbQuery = dbQuery.gte('date', dateFrom)
      if (dateTo) dbQuery = dbQuery.lte('date', dateTo)

      const { data } = await dbQuery
      const mapped = (data || []).map((e: any) => ({
        ...e,
        incident_name: e.incident?.name || null,
      }))
      setResults(mapped)
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch()
  }

  const clear = () => {
    setQuery('')
    setUnitFilter('')
    setDateFrom('')
    setDateTo('')
    setResults([])
    setSearched(false)
    inputRef.current?.focus()
  }

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 mt-8 md:mt-0">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold">🔍 Patient Search</h1>
          <p className="text-gray-500 text-xs mt-0.5">Search all patient records across all time — by name, complaint, encounter ID, or provider</p>
        </div>

        {/* Search input */}
        <div className="theme-card rounded-xl border p-4 space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Patient name, complaint, encounter ID, provider…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-500"
          />

          {/* Optional filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {!isField && (
              <input
                type="text"
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                placeholder="Unit (e.g. RAMBO 1)"
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600"
              />
            )}
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={runSearch}
              disabled={loading || (!query.trim() && !unitFilter && !dateFrom && !dateTo)}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {loading ? 'Searching…' : 'Search All Records'}
            </button>
            {searched && (
              <button onClick={clear}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-10 text-gray-500 text-sm">Searching…</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="theme-card rounded-xl border p-10 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-white font-medium">No records found</p>
            <p className="text-gray-500 text-sm mt-1">Try a different name, complaint, or date range</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 px-1">{results.length} record{results.length !== 1 ? 's' : ''} found</p>
            <div className="theme-card rounded-xl border overflow-hidden">
              {/* Header */}
              <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 theme-card-header border-b">
                <span className="w-24 shrink-0">Date</span>
                <span className="flex-1 min-w-0">Patient</span>
                <span className="w-24 shrink-0 hidden sm:block">Unit</span>
                <span className="w-24 shrink-0 hidden sm:block">Acuity</span>
                <span className="w-20 shrink-0 text-right">Status</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {results.map(r => (
                  <Link
                    key={r.id}
                    to={`/encounters/${r.id}`}
                    className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-sm"
                  >
                    <span className="w-24 shrink-0 text-gray-400 text-xs">{r.date || '—'}</span>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-medium text-white truncate">
                        {r.patient_last_name
                          ? `${r.patient_last_name}, ${r.patient_first_name || ''}`
                          : r.patient_first_name || '(Unknown)'}
                      </p>
                      {r.primary_symptom_text && (
                        <p className="text-xs text-gray-500 truncate">{r.primary_symptom_text}</p>
                      )}
                    </div>
                    <span className="w-24 shrink-0 text-gray-400 text-xs truncate hidden sm:block pr-2">
                      {r.unit || '—'}
                    </span>
                    <span className="w-24 shrink-0 hidden sm:block pr-2">
                      {r.initial_acuity ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ACUITY_COLORS[r.initial_acuity] || 'bg-gray-700 text-gray-300'}`}>
                          {r.initial_acuity}
                        </span>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </span>
                    <span className="w-20 shrink-0 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.pcr_status === 'Signed' ? 'bg-green-900 text-green-300' :
                        r.pcr_status === 'Complete' ? 'bg-blue-900 text-blue-300' :
                        'bg-orange-900 text-orange-300'
                      }`}>
                        {r.pcr_status || 'Draft'}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {!searched && (
          <div className="text-center py-10 text-gray-600 text-sm space-y-1">
            <p>Enter a patient name, complaint, or encounter ID above</p>
            <p className="text-xs">Optionally filter by unit and date range</p>
          </div>
        )}
      </div>
    </div>
  )
}
