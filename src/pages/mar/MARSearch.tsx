import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, Link } from 'react-router-dom'

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

export default function MARSearch() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<MAREntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = searchInput.trim()
    if (!trimmed) { setResults(null); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('dispense_admin_log')
          .select('id, date, time, patient_name, item_name, qty_used, medication_route, dosage_units, med_unit, dispensed_by, item_type, entry_type, requires_cosign, provider_signature_url, incident')
          .or(`patient_name.ilike.%${trimmed}%,item_name.ilike.%${trimmed}%,med_unit.ilike.%${trimmed}%,dispensed_by.ilike.%${trimmed}%`)
          .order('date', { ascending: false })
          .limit(200)
        setResults((data || []) as MAREntry[])
      } catch { setResults([]) }
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput])

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">🔍 Search MAR</h1>
            <p className="text-gray-500 text-xs">Search all medication records across all time</p>
          </div>
          <Link to="/mar" className="text-sm text-gray-400 hover:text-gray-300 transition-colors">← MAR</Link>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search by patient, medication, unit, or provider…"
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 pr-16"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
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

        {!searchInput && (
          <div className="text-center py-12 text-gray-600 text-sm">
            Type to search all medication records
          </div>
        )}

        {results !== null && results.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">No results found.</div>
        )}

        {results !== null && results.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Header */}
                <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-slate-800/90">
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
                {results.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => navigate(`/mar/${entry.id}`)}
                    className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50"
                  >
                    <span className="w-20 shrink-0 text-gray-400 text-xs">{entry.date || '—'}</span>
                    <span className="w-20 shrink-0 text-white text-xs font-medium truncate pr-1">
                      {entry.patient_name
                        ? entry.patient_name.split(/[, ]+/).filter(Boolean).slice(0, 2).map((n: string, i: number) =>
                            i === 0 ? n : n[0] + '.'
                          ).join(', ')
                        : '—'}
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
                      ) : <span className="text-gray-600">—</span>}
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
      </div>
    </div>
  )
}
