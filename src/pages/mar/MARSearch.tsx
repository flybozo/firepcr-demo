import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, Link } from 'react-router-dom'
import { PageHeader, EmptyState, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

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
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<MAREntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  type MARSearchSortKey = 'date' | 'patient' | 'item_name'
  const { sortKey: srchSortKey, sortDir: srchSortDir, toggleSort: srchToggleSort, sortFn: srchSortFn } = useSortable<MARSearchSortKey>('date', 'desc')

  useEffect(() => {
    const trimmed = searchInput.trim()
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <PageHeader
          title="🔍 Search MAR"
          subtitle="Search all medication records across all time"
          backHref="/mar"
          backLabel="← MAR"
        />

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
          <EmptyState icon="🔍" message="Type to search all medication records" className="py-12" />
        )}

        {results !== null && results.length === 0 && !loading && (
          <EmptyState icon="💊" message="No results found." className="py-12" />
        )}

        {results !== null && results.length > 0 && (
          <div className={lc.container}>
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Header */}
                <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b theme-card-header">
                  <SortableHeader label="Date" sortKey="date" currentKey={srchSortKey} currentDir={srchSortDir} onToggle={srchToggleSort} className="w-20 shrink-0" />
                  <SortableHeader label="Patient" sortKey="patient" currentKey={srchSortKey} currentDir={srchSortDir} onToggle={srchToggleSort} className="w-20 shrink-0" />
                  <SortableHeader label="Medication" sortKey="item_name" currentKey={srchSortKey} currentDir={srchSortDir} onToggle={srchToggleSort} className="flex-1 min-w-[120px]" />
                  <span className="w-14 shrink-0 text-gray-500">Route</span>
                  <span className="w-20 shrink-0 text-gray-500">Qty</span>
                  <span className="w-20 shrink-0 text-gray-500">Unit</span>
                  <span className="w-20 shrink-0 text-gray-500">Incident</span>
                  <span className="w-14 shrink-0 text-gray-500">Type</span>
                  <span className="w-28 shrink-0 text-right text-gray-500">Status</span>
                </div>
                {srchSortFn(results, (e, key) => {
                  if (key === 'date') return e.date ?? ''
                  if (key === 'patient') return e.patient_name ?? ''
                  if (key === 'item_name') return e.item_name ?? ''
                  return ''
                }).map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => navigate(`/mar/${entry.id}`)}
                    className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50"
                  >
                    <span className="w-20 shrink-0 text-gray-400 text-xs">{entry.date || '—'}</span>
                    <span className="w-20 shrink-0 text-white text-xs font-medium truncate pr-1">
                      {entry.patient_name
                        ? entry.patient_name.split(/[, ]+/).filter(Boolean).map((n: string) => n[0].toUpperCase() + '.').join(' ')
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
