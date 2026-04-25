import { useEffect, useState, lazy, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { usePermission } from '@/hooks/usePermission'
import { LoadingSkeleton, ConfirmDialog } from '@/components/ui'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

const EncounterDetail = lazy(() => import('@/pages/encounters/EncounterDetail'))

// ── Types ────────────────────────────────────────────────────────────────────

type UnsignedChart = {
  id: string
  encounter_id: string
  date: string | null
  unit: string | null
  incident: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  created_by: string | null
  provider_of_record: string | null
  pcr_status: string | null
  signed_at: string | null
  unsignedNoteCount?: number
}

type UnsignedNote = {
  id: string
  encounter_id: string
  encounter_uuid: string | null
  note_datetime: string
  author_name: string
  note_text: string
}

type UnsignedMAR = {
  id: string
  date: string | null
  time: string | null
  patient_name: string | null
  item_name: string | null
  qty_used: number | null
  dispensed_by: string | null
  encounter_id: string | null
  unit: string | null
  incident: string | null
  category: string | null
}

const PRESCRIBER_ROLES = ['MD', 'DO', 'NP', 'PA', 'PA-C']

// ── Helpers ──────────────────────────────────────────────────────────────────

function patientName(first: string | null, last: string | null): string {
  if (last) return `${last}, ${first || ''}`
  return first || '(Unknown Patient)'
}

function statusBadge(status: string | null) {
  const label = status || 'Draft'
  const isUrgent = label === 'Complete'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>
      {label}
    </span>
  )
}

// ── Detail Panels ────────────────────────────────────────────────────────────

function ChartDetailPanel({ chart }: { chart: UnsignedChart }) {
  return (
    <Suspense fallback={<div className="p-6"><LoadingSkeleton rows={8} /></div>}>
      <EncounterDetail encounterId={chart.id} embedded />
    </Suspense>
  )
}

function MARDetailPanel({ entry }: { entry: UnsignedMAR }) {
  const marLink = entry.encounter_id ? `/mar/${entry.encounter_id}/${entry.id}` : null

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white">{entry.item_name || '—'}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{entry.patient_name || 'Unknown Patient'}</p>
      </div>

      <div className="theme-card rounded-xl border p-4 mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">MAR Entry</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ['Patient', entry.patient_name],
            ['Medication', entry.item_name],
            ['Qty Used', entry.qty_used != null ? String(entry.qty_used) : null],
            ['Date', entry.date],
            ['Time', entry.time],
            ['Dispensed By', entry.dispensed_by],
            ['Unit', entry.unit],
            ['Incident', entry.incident],
            ['Category', entry.category],
          ] as [string, string | null][]).map(([label, value]) => (
            <div key={label}>
              <span className="text-xs text-gray-500">{label}</span>
              <p className="text-sm text-white">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {marLink ? (
        <Link
          to={marLink}
          className="block w-full text-center py-2.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-semibold transition-colors"
        >
          Open MAR →
        </Link>
      ) : (
        <p className="text-xs text-gray-500 text-center">No encounter linked to this MAR entry.</p>
      )}
    </div>
  )
}

// ── List Sections ─────────────────────────────────────────────────────────────

function ChartList({
  charts,
  selectedId,
  onSelect,
}: {
  charts: UnsignedChart[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  if (charts.length === 0) return (
    <div className="p-6 text-center">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-gray-500 text-sm">All charts signed.</p>
    </div>
  )
  return (
    <div className="divide-y divide-gray-800/50">
      {charts.map(c => {
        const isSelected = c.id === selectedId
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-3 flex items-start gap-2 ${lc.rowCls(isSelected)}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                {patientName(c.patient_first_name, c.patient_last_name)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {c.date || '—'} · {c.unit || '—'}{c.incident ? ` · ${c.incident}` : ''}
              </p>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-1 mt-0.5">
              {statusBadge(c.pcr_status)}
              {(c.unsignedNoteCount ?? 0) > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
                  +{c.unsignedNoteCount} note{c.unsignedNoteCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function OrphanNotesList({
  notes,
  onDelete,
}: {
  notes: UnsignedNote[]
  onDelete: (id: string) => void
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  if (notes.length === 0) return null

  return (
    <>
      <div className="px-3 py-2 bg-gray-800/40 border-b border-t border-gray-800">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
          Unsigned Notes on Signed Charts ({notes.length})
        </h3>
      </div>
      <div className="divide-y divide-gray-800/50">
        {notes.map(n => (
          <div key={n.id} className="flex items-start gap-2 px-3 py-2.5">
            <Link to={`/encounters/${n.encounter_uuid || n.encounter_id}#notes`} className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{new Date(n.note_datetime).toLocaleString()} · {n.encounter_id}</p>
              <p className="text-sm text-white mt-0.5 line-clamp-2">{n.note_text}</p>
            </Link>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900 text-amber-300">Unsigned</span>
              <button
                onClick={() => setConfirmId(n.id)}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors p-1"
                title="Delete note"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!confirmId}
        title="Delete unsigned note?"
        message="This note has not been signed and will be permanently removed."
        confirmLabel="Delete"
        onConfirm={() => { if (confirmId) onDelete(confirmId); setConfirmId(null) }}
        onCancel={() => setConfirmId(null)}
      />
    </>
  )
}

function MARList({
  entries,
  selectedId,
  onSelect,
}: {
  entries: UnsignedMAR[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  if (entries.length === 0) return (
    <div className="p-6 text-center">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-gray-500 text-sm">All medication orders co-signed.</p>
    </div>
  )
  return (
    <div className="divide-y divide-gray-800/50">
      {entries.map(m => {
        const isSelected = m.id === selectedId
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={`w-full text-left px-3 py-3 flex items-start gap-2 ${lc.rowCls(isSelected)}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                {m.item_name || '—'}
                {m.category && <span className="text-gray-500 text-xs ml-1">({m.category})</span>}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {m.patient_name || 'Unknown'} · {m.date || '—'}{m.time ? ` ${m.time}` : ''}
              </p>
            </div>
            <div className="flex-shrink-0 text-right mt-0.5">
              <p className="text-xs font-medium text-orange-300">{m.qty_used ?? '—'}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{m.dispensed_by || '—'}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function UnsignedItemsPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = usePermission('encounters.sign')
  const [charts, setCharts] = useState<UnsignedChart[]>([])
  const [orphanNotes, setOrphanNotes] = useState<UnsignedNote[]>([])
  const [marEntries, setMarEntries] = useState<UnsignedMAR[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'charts' | 'mar'>('charts')
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null)
  const [selectedMarId, setSelectedMarId] = useState<string | null>(null)

  const myName = assignment.employee?.name || ''
  const myRole = assignment.employee?.role || ''
  const isProvider = PRESCRIBER_ROLES.some(r => myRole.toUpperCase().includes(r))

  const deleteOrphanNote = async (noteId: string) => {
    const now = new Date().toISOString()
    await supabase.from('progress_notes').update({ deleted_at: now, deleted_by: myName }).eq('id', noteId)
    setOrphanNotes(prev => prev.filter(n => n.id !== noteId))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (assignment.loading || !myName) { if (!assignment.loading) setLoading(false); return }

    const load = async () => {
      const [{ data: created }, { data: provider }] = await Promise.all([
        supabase.from('patient_encounters')
          .select('id, encounter_id, date, unit, incident, patient_first_name, patient_last_name, created_by, provider_of_record, pcr_status, signed_at')
          .eq('created_by', myName).is('signed_at', null).is('deleted_at', null)
          .order('date', { ascending: false }).limit(100),
        supabase.from('patient_encounters')
          .select('id, encounter_id, date, unit, incident, patient_first_name, patient_last_name, created_by, provider_of_record, pcr_status, signed_at')
          .eq('provider_of_record', myName).is('signed_at', null).is('deleted_at', null)
          .order('date', { ascending: false }).limit(100),
      ])

      const seen = new Set<string>()
      const allCharts: UnsignedChart[] = [...(created || []), ...(provider || [])].filter(r => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
      })
      allCharts.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

      const { data: noteData } = await supabase.from('progress_notes')
        .select('id, encounter_id, encounter_uuid, note_datetime, author_name, note_text')
        .eq('author_name', myName).is('signed_at', null).is('deleted_at', null)
        .order('note_datetime', { ascending: false }).limit(100)
      const allNotes = noteData || []

      const chartEncounterIds = new Set(allCharts.map(c => c.encounter_id))
      const noteCountByEncId: Record<string, number> = {}
      const orphans: UnsignedNote[] = []

      for (const note of allNotes) {
        if (chartEncounterIds.has(note.encounter_id)) {
          noteCountByEncId[note.encounter_id] = (noteCountByEncId[note.encounter_id] || 0) + 1
        } else {
          orphans.push(note)
        }
      }

      for (const chart of allCharts) {
        chart.unsignedNoteCount = noteCountByEncId[chart.encounter_id] || 0
      }

      setCharts(allCharts)
      setOrphanNotes(orphans)

      if (isProvider || isAdmin) {
        const { data: marData } = await supabase.from('dispense_admin_log')
          .select('id, date, time, patient_name, item_name, qty_used, dispensed_by, encounter_id, unit, incident, category')
          .eq('requires_cosign', true)
          .is('provider_signature_url', null)
          .is('voided_at', null)
          .order('date', { ascending: false })
          .limit(100)
        setMarEntries(marData || [])
      }

      setLoading(false)
    }

    load()
  }, [assignment.loading, myName, myRole]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSkeleton fullPage />

  const chartTotal = charts.length + orphanNotes.length
  const marTotal = marEntries.length
  const grandTotal = chartTotal + marTotal

  const selectedChart = selectedChartId ? charts.find(c => c.id === selectedChartId) ?? null : null
  const selectedMar = selectedMarId ? marEntries.find(m => m.id === selectedMarId) ?? null : null

  const activeMobileDetail = tab === 'charts' ? selectedChart : selectedMar
  const clearMobileDetail = () => {
    if (tab === 'charts') setSelectedChartId(null)
    else setSelectedMarId(null)
  }

  return (
    <div className="bg-gray-950 text-white h-full flex flex-col">

      {/* Header — full width, flex-shrink-0 */}
      <div className="flex-shrink-0 p-4 md:px-6 md:pt-6 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              Unsigned Items
              {grandTotal > 0 && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-orange-500 text-white text-xs font-bold">
                  {grandTotal > 99 ? '99+' : grandTotal}
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Items awaiting your signature · {myName}
            </p>
          </div>
          <Link
            to="/encounters/new"
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors shrink-0"
          >
            + New Encounter
          </Link>
        </div>

        {/* Tab pills */}
        {(isProvider || isAdmin) && grandTotal > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setTab('charts')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'charts'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📋 Charts & Notes
              {chartTotal > 0 && (
                <span className="ml-1.5 text-xs bg-black/30 px-1.5 py-0.5 rounded-full">{chartTotal}</span>
              )}
            </button>
            <button
              onClick={() => setTab('mar')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'mar'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              💊 MAR Orders
              {marTotal > 0 && (
                <span className="ml-1.5 text-xs bg-black/30 px-1.5 py-0.5 rounded-full">{marTotal}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* All clear */}
      {grandTotal === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-12">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-gray-500 text-sm mt-1">Nothing needs your signature right now.</p>
          </div>
        </div>
      ) : (
        /* Split panel */
        <div className="flex-1 flex min-h-0 border-t border-gray-800">

          {/* Left: list (40%) */}
          <div className="w-full md:w-[40%] md:border-r border-gray-800 overflow-y-auto">
            {tab === 'charts' ? (
              <>
                {charts.length === 0 && orphanNotes.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-2xl mb-2">✅</p>
                    <p className="text-gray-500 text-sm">All charts signed.</p>
                  </div>
                ) : (
                  <>
                    {charts.length > 0 && (
                      <>
                        <div className="px-3 py-2 bg-gray-800/40 border-b border-gray-800">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                            Unsigned Encounters ({charts.length})
                          </h3>
                        </div>
                        <ChartList
                          charts={charts}
                          selectedId={selectedChartId}
                          onSelect={setSelectedChartId}
                        />
                      </>
                    )}
                    <OrphanNotesList notes={orphanNotes} onDelete={deleteOrphanNote} />
                  </>
                )}
              </>
            ) : (
              <MARList
                entries={marEntries}
                selectedId={selectedMarId}
                onSelect={setSelectedMarId}
              />
            )}
          </div>

          {/* Right: detail (60%) — desktop only */}
          <div className="hidden md:flex md:w-[60%] overflow-y-auto">
            {tab === 'charts' ? (
              selectedChart ? (
                <ChartDetailPanel chart={selectedChart} />
              ) : (
                <div className="flex items-center justify-center w-full text-gray-600">
                  <div className="text-center">
                    <p className="text-3xl mb-2">📋</p>
                    <p className="text-sm">Select an item to view details</p>
                  </div>
                </div>
              )
            ) : (
              selectedMar ? (
                <MARDetailPanel entry={selectedMar} />
              ) : (
                <div className="flex items-center justify-center w-full text-gray-600">
                  <div className="text-center">
                    <p className="text-3xl mb-2">💊</p>
                    <p className="text-sm">Select an item to view details</p>
                  </div>
                </div>
              )
            )}
          </div>

        </div>
      )}

      {/* Mobile overlay */}
      {activeMobileDetail && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-950 overflow-y-auto flex flex-col">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-bold text-white">
              {tab === 'charts' ? 'Chart Detail' : 'MAR Detail'}
            </h3>
            <button
              onClick={clearMobileDetail}
              className="text-gray-400 hover:text-white text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'charts' && selectedChart && <ChartDetailPanel chart={selectedChart} />}
            {tab === 'mar' && selectedMar && <MARDetailPanel entry={selectedMar} />}
          </div>
        </div>
      )}

    </div>
  )
}
