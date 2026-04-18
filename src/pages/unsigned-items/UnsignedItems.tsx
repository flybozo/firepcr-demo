import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useRole } from '@/lib/useRole'

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
  // Flag: has unsigned progress notes
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

// ── Section components ───────────────────────────────────────────────────────

function ChartsSection({ charts }: { charts: UnsignedChart[] }) {
  if (charts.length === 0) return (
    <div className="theme-card rounded-xl border p-8 text-center">
      <p className="text-3xl mb-2">✅</p>
      <p className="text-gray-500 text-sm">All charts signed.</p>
    </div>
  )

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-slate-800/90">
        <span className="w-24 shrink-0">Date</span>
        <span className="flex-1 min-w-0">Patient</span>
        <span className="w-36 shrink-0 hidden sm:block">Unit / Incident</span>
        <span className="w-24 shrink-0 text-right">Status</span>
      </div>
      <div className="divide-y divide-gray-800/50">
        {charts.map(c => (
          <Link key={c.id} to={`/encounters/${c.id}`}
            className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-sm">
            <span className="w-24 shrink-0 text-gray-400 text-xs">{c.date || '—'}</span>
            <span className="flex-1 min-w-0 font-medium truncate pr-2">
              {patientName(c.patient_first_name, c.patient_last_name)}
              {(c.unsignedNoteCount ?? 0) > 0 && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">
                  +{c.unsignedNoteCount} note{c.unsignedNoteCount !== 1 ? 's' : ''}
                </span>
              )}
            </span>
            <span className="w-36 shrink-0 text-gray-500 text-xs truncate hidden sm:block pr-2">
              {c.unit || '—'}{c.incident ? ` · ${c.incident}` : ''}
            </span>
            <span className="w-24 shrink-0 text-right">{statusBadge(c.pcr_status)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function OrphanNotesSection({ notes }: { notes: UnsignedNote[] }) {
  // Notes on encounters that ARE signed but the note itself isn't
  if (notes.length === 0) return null

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="divide-y divide-gray-800/50">
        {notes.map(n => (
          <Link key={n.id} to={`/encounters/${n.encounter_uuid || n.encounter_id}#notes`}
            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-gray-400 text-xs">
                {new Date(n.note_datetime).toLocaleString()} · {n.encounter_id}
              </p>
              <p className="text-white text-sm mt-0.5 line-clamp-2">{n.note_text}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 shrink-0 mt-0.5">Unsigned</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function MARSection({ entries }: { entries: UnsignedMAR[] }) {
  if (entries.length === 0) return (
    <div className="theme-card rounded-xl border p-8 text-center">
      <p className="text-3xl mb-2">✅</p>
      <p className="text-gray-500 text-sm">All medication orders co-signed.</p>
    </div>
  )

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-slate-800/90">
        <span className="w-24 shrink-0">Date</span>
        <span className="w-28 shrink-0">Patient</span>
        <span className="flex-1 min-w-0">Medication</span>
        <span className="w-24 shrink-0 hidden sm:block">Administered By</span>
        <span className="w-20 shrink-0 text-right">Qty</span>
      </div>
      <div className="divide-y divide-gray-800/50">
        {entries.map(m => (
          <Link key={m.id} to={m.encounter_id ? `/mar/${m.encounter_id}/${m.id}` : '#'}
            className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-sm">
            <span className="w-24 shrink-0 text-gray-400 text-xs">{m.date || '—'}</span>
            <span className="w-28 shrink-0 text-gray-300 text-xs truncate pr-2">{m.patient_name || '—'}</span>
            <span className="flex-1 min-w-0 font-medium truncate pr-2 text-white">
              {m.item_name || '—'}
              {m.category && <span className="text-gray-500 text-xs ml-1">({m.category})</span>}
            </span>
            <span className="w-24 shrink-0 text-gray-500 text-xs truncate hidden sm:block pr-2">{m.dispensed_by || '—'}</span>
            <span className="w-20 shrink-0 text-right text-orange-300 text-xs font-medium">{m.qty_used ?? '—'}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function UnsignedItemsPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const { isAdmin } = useRole()
  const [charts, setCharts] = useState<UnsignedChart[]>([])
  const [orphanNotes, setOrphanNotes] = useState<UnsignedNote[]>([])
  const [marEntries, setMarEntries] = useState<UnsignedMAR[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'charts' | 'mar'>('charts')

  const myName = assignment.employee?.name || ''
  const myRole = assignment.employee?.role || ''
  const isProvider = PRESCRIBER_ROLES.some(r => myRole.toUpperCase().includes(r))

  useEffect(() => {
    if (assignment.loading || !myName) { if (!assignment.loading) setLoading(false); return }

    const load = async () => {
      // 1. Unsigned charts — created by me or I'm provider of record
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

      // 2. Unsigned progress notes — authored by me
      const { data: noteData } = await supabase.from('progress_notes')
        .select('id, encounter_id, encounter_uuid, note_datetime, author_name, note_text')
        .eq('author_name', myName).is('signed_at', null).is('deleted_at', null)
        .order('note_datetime', { ascending: false }).limit(100)
      const allNotes = noteData || []

      // Group notes by encounter — attach count to charts that already appear,
      // and collect "orphan" notes (on encounters that are already signed / not in the chart list)
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

      // Attach note counts to charts
      for (const chart of allCharts) {
        chart.unsignedNoteCount = noteCountByEncId[chart.encounter_id] || 0
      }

      setCharts(allCharts)
      setOrphanNotes(orphans)

      // 3. MAR entries needing co-sign (only for providers, but load for admins too)
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
  }, [assignment.loading, myName, myRole])

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  )

  const chartTotal = charts.length + orphanNotes.length
  const marTotal = marEntries.length
  const grandTotal = chartTotal + marTotal

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5 mt-8 md:mt-0">

        {/* Header */}
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

        {/* All clear */}
        {grandTotal === 0 ? (
          <div className="theme-card rounded-xl border p-12 text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-gray-500 text-sm mt-1">Nothing needs your signature right now.</p>
          </div>
        ) : (
          <>
            {/* Tab pills — only show if provider has both sections */}
            {(isProvider || isAdmin) && (
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

            {/* Charts & Notes tab */}
            {tab === 'charts' && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Unsigned Encounters ({charts.length})
                  </h2>
                  <ChartsSection charts={charts} />
                </div>

                {orphanNotes.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                      Unsigned Progress Notes on Signed Charts ({orphanNotes.length})
                    </h2>
                    <OrphanNotesSection notes={orphanNotes} />
                  </div>
                )}
              </div>
            )}

            {/* MAR tab */}
            {tab === 'mar' && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  MAR Entries Awaiting Co-Sign ({marEntries.length})
                </h2>
                <MARSection entries={marEntries} />
              </div>
            )}
          </>
        )}

        <p className="text-xs text-gray-600 text-center">
          Tap any item to open and sign
        </p>
      </div>
    </div>
  )
}
