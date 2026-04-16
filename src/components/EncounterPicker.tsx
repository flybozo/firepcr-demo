

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'

const UNITS = ['RAMBO 1','RAMBO 2','RAMBO 3','RAMBO 4','The Beast','MSU 1','MSU 2','REMS 1','REMS 2']

export type PickedEncounter = {
  id: string
  encounter_id: string
  patient_first_name: string | null
  patient_last_name: string | null
  patient_dob: string | null
  primary_symptom_text: string | null
  date: string | null
  unit: string | null
  provider_of_record: string | null
  incident_id: string | null
}

interface Props {
  /** Called when the user selects a patient encounter */
  onSelect: (enc: PickedEncounter) => void
  /** If true, hide the picker (e.g. already linked via URL param) */
  hidden?: boolean
  /** Unit name to filter encounters — if provided, hides the internal unit selector */
  unitName?: string
}

export default function EncounterPicker({ onSelect, hidden, unitName }: Props) {
  const supabase = createClient()
  const assignment = useUserAssignment()

  // Use provided unitName, fall back to assignment, fall back to internal state
  const [internalUnit, setInternalUnit] = useState('')
  const unit = unitName || assignment.unit?.name || internalUnit

  const [encounters, setEncounters] = useState<PickedEncounter[]>([])
  const [loading, setLoading] = useState(false)

  // Load encounters when unit changes
  useEffect(() => {
    if (!unit) { setEncounters([]); return }
    setLoading(true)
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    supabase
      .from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, patient_dob, primary_symptom_text, date, unit, provider_of_record, incident_id')
      .eq('unit', unit)
      .gte('date', cutoff)
      .order('date', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) console.error('EncounterPicker fetch error:', error)
        setEncounters((data || []).map((e: any) => ({ ...e })))
        setLoading(false)
      })
  }, [unit])

  if (hidden) return null

  // If unit is already known (from prop or assignment), show it locked — no duplicate selector
  const showUnitSelector = !unitName && !assignment.unit?.name && !assignment.loading

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-blue-900/40 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-blue-400 text-base">🔗</span>
        <h2 className="text-xs font-bold uppercase tracking-wide text-blue-400">
          Link to Patient Encounter <span className="text-gray-600 font-normal normal-case">(optional)</span>
        </h2>
      </div>

      {/* Unit selector — only shown when unit is not already known */}
      {showUnitSelector && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Unit</label>
          <select
            value={internalUnit}
            onChange={e => setInternalUnit(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select unit...</option>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      )}

      {/* Encounter selector */}
      {unit && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Patient</label>
          {loading ? (
            <p className="text-xs text-gray-600 py-1">Loading encounters...</p>
          ) : encounters.length === 0 ? (
            <p className="text-xs text-gray-600 py-1">No recent encounters on {unit}.</p>
          ) : (
            <select
              defaultValue=""
              onChange={e => {
                const enc = encounters.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
                if (enc) onSelect(enc)
              }}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select patient encounter...</option>
              {encounters.map(enc => (
                <option key={enc.id} value={enc.encounter_id || enc.id}>
                  {enc.patient_last_name
                    ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                    : 'Unknown Patient'
                  } — {enc.primary_symptom_text || '—'} ({enc.date || '—'})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}
