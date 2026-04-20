
import type { EncounterOption } from './types'

export function EncounterPickerSection({ encounterOptions, unit, onSelect }: {
  encounterOptions: EncounterOption[]
  unit: string
  onSelect: (enc: EncounterOption) => void
}) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Link to Patient Encounter
      </h2>
      {encounterOptions.length === 0 ? (
        <p className="text-xs text-gray-600">
          {unit ? 'No recent encounters on this unit.' : 'Select a unit to see recent patient encounters.'}
        </p>
      ) : (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Select Patient</label>
          <select
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            defaultValue=""
            onChange={e => {
              const enc = encounterOptions.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
              if (enc) onSelect(enc)
            }}>
            <option value="">Select patient encounter...</option>
            {encounterOptions.map(enc => (
              <option key={enc.id} value={enc.encounter_id || enc.id}>
                {enc.patient_last_name
                  ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                  : 'Unknown Patient'
                } — {enc.primary_symptom_text || 'No complaint'} ({enc.date || '—'})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
