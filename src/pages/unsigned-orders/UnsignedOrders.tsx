
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'

type UnsignedChart = {
  id: string
  encounter_id: string
  date: string | null
  unit: string | null
  incident: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  created_by: string | null
  pcr_status: string | null
  signed_at: string | null
}

type UnsignedNote = {
  id: string
  encounter_id: string
  note_datetime: string
  author_name: string
  note_text: string
}

export default function UnsignedOrdersPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [charts, setCharts] = useState<UnsignedChart[]>([])
  const [notes, setNotes] = useState<UnsignedNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (assignment.loading) return
    const myName = assignment.employee?.name
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!myName) { setLoading(false); return }

    const load = async () => {
      const [{ data: chartData }, { data: provCharts }, { data: noteData }] = await Promise.all([
        supabase.from('patient_encounters')
          .select('id, encounter_id, date, unit, incident, patient_first_name, patient_last_name, created_by, pcr_status, signed_at')
          .eq('created_by', myName).is('signed_at', null).is('deleted_at', null)
          .order('date', { ascending: false }).limit(100),
        supabase.from('patient_encounters')
          .select('id, encounter_id, date, unit, incident, patient_first_name, patient_last_name, created_by, pcr_status, signed_at')
          .eq('provider_of_record', myName).is('signed_at', null).is('deleted_at', null)
          .order('date', { ascending: false }).limit(100),
        supabase.from('progress_notes')
          .select('id, encounter_id, note_datetime, author_name, note_text')
          .eq('author_name', myName).is('signed_at', null).is('deleted_at', null)
          .order('note_datetime', { ascending: false }).limit(50),
      ])
      const all = [...(chartData || []), ...(provCharts || [])]
      const seen = new Set<string>()
      setCharts(all.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true }))
      setNotes(noteData || [])
      setLoading(false)
    }
    load()
  }, [assignment.loading, assignment.employee?.name])

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>

  const myName = assignment.employee?.name

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 mt-8 md:mt-0">
        <div>
          <h1 className="text-xl font-bold">Unsigned Charts</h1>
          <p className="text-gray-500 text-xs mt-0.5">Charts and notes by {myName || 'you'} awaiting your signature</p>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Patient Encounters ({charts.length})</h2>
          {charts.length === 0 ? (
            <div className="theme-card rounded-xl border p-8 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 text-sm">All your charts are signed.</p>
            </div>
          ) : (
            <div className="theme-card rounded-xl border overflow-hidden divide-y divide-gray-800/50">
              <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-slate-800/90">
                <span className="w-24 shrink-0">Date</span>
                <span className="flex-1 min-w-0">Patient</span>
                <span className="w-32 shrink-0 hidden sm:block">Unit / Incident</span>
                <span className="w-20 shrink-0 text-right">Status</span>
              </div>
              {charts.map(c => (
                <Link key={c.id} to={`/encounters/${c.id}`}
                  className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-sm">
                  <span className="w-24 shrink-0 text-gray-400 text-xs">{c.date || '—'}</span>
                  <span className="flex-1 min-w-0 font-medium truncate pr-2">
                    {c.patient_last_name ? `${c.patient_last_name}, ${c.patient_first_name || ''}` : c.patient_first_name || '(Unknown Patient)'}
                  </span>
                  <span className="w-32 shrink-0 text-gray-500 text-xs truncate hidden sm:block pr-2">
                    {c.unit || '—'}{c.incident ? ` · ${c.incident}` : ''}
                  </span>
                  <span className="w-20 shrink-0 text-right">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300">{c.pcr_status || 'Draft'}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {notes.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Progress Notes ({notes.length})</h2>
            <div className="theme-card rounded-xl border overflow-hidden divide-y divide-gray-800/50">
              {notes.map(n => (
                <Link key={n.id} to={`/encounters/${n.encounter_id}#notes`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-400 text-xs">{new Date(n.note_datetime).toLocaleString()} · {n.encounter_id}</p>
                    <p className="text-white text-sm mt-0.5 line-clamp-2">{n.note_text}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 shrink-0 mt-0.5">Unsigned</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
