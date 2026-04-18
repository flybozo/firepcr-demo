import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'

type UnsignedEncounter = {
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
}

export default function UnsignedPCRsPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [encounters, setEncounters] = useState<UnsignedEncounter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (assignment.loading) return
    const myName = assignment.employee?.name
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!myName) { setLoading(false); return }

    const load = async () => {
      const [{ data: created }, { data: provider }] = await Promise.all([
        supabase
          .from('patient_encounters')
          .select('id, encounter_id, date, unit, incident, patient_first_name, patient_last_name, created_by, provider_of_record, pcr_status, signed_at')
          .eq('created_by', myName)
          .is('signed_at', null)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(100),
        supabase
          .from('patient_encounters')
          .select('id, encounter_id, date, unit, incident, patient_first_name, patient_last_name, created_by, provider_of_record, pcr_status, signed_at')
          .eq('provider_of_record', myName)
          .is('signed_at', null)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(100),
      ])

      // Deduplicate by id
      const seen = new Set<string>()
      const all = [...(created || []), ...(provider || [])].filter(r => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
      })
      // Sort by date descending (most recent first)
      all.sort((a, b) => {
        if (!a.date && !b.date) return 0
        if (!a.date) return 1
        if (!b.date) return -1
        return b.date.localeCompare(a.date)
      })
      setEncounters(all)
      setLoading(false)
    }

    load()
  }, [assignment.loading, assignment.employee?.name])

  const myName = assignment.employee?.name

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 mt-8 md:mt-0">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              My Unsigned PCRs
              {encounters.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                  {encounters.length > 99 ? '99+' : encounters.length}
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">
              Encounters created by or assigned to {myName || 'you'} that haven't been signed yet
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
        {encounters.length === 0 ? (
          <div className="theme-card rounded-xl border p-12 text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-white font-medium">All caught up!</p>
            <p className="text-gray-500 text-sm mt-1">You have no unsigned patient encounters.</p>
          </div>
        ) : (
          <div className="theme-card rounded-xl border overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-slate-800/90">
              <span className="w-24 shrink-0">Date</span>
              <span className="flex-1 min-w-0">Patient</span>
              <span className="w-36 shrink-0 hidden sm:block">Unit / Incident</span>
              <span className="w-24 shrink-0 text-right">Status</span>
            </div>

            <div className="divide-y divide-gray-800/50">
              {encounters.map(enc => {
                const patientName = enc.patient_last_name
                  ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                  : enc.patient_first_name || '(Unknown Patient)'

                const statusLabel = enc.pcr_status || 'Draft'
                const isUrgent = statusLabel.toLowerCase().includes('complete') ||
                  statusLabel.toLowerCase().includes('final') ||
                  statusLabel.toLowerCase().includes('submitted')

                return (
                  <Link
                    key={enc.id}
                    to={`/encounters/${enc.id}`}
                    className="flex items-center px-4 py-3 hover:bg-gray-800 transition-colors text-sm"
                  >
                    <span className="w-24 shrink-0 text-gray-400 text-xs">{enc.date || '—'}</span>
                    <span className="flex-1 min-w-0 font-medium truncate pr-2">{patientName}</span>
                    <span className="w-36 shrink-0 text-gray-500 text-xs truncate hidden sm:block pr-2">
                      {enc.unit || '—'}{enc.incident ? ` · ${enc.incident}` : ''}
                    </span>
                    <span className="w-24 shrink-0 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isUrgent ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>
                        {statusLabel}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          Showing encounters you created or are listed as provider of record · Tap to open and sign
        </p>
      </div>
    </div>
  )
}
