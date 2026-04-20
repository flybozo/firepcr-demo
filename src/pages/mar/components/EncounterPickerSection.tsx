
import { inputCls } from '../types'
import type { EncounterOption } from '../useMARForm'


type Props = {
  encounterOptions: EncounterOption[]
  formUnit: string
  onSelect: (enc: EncounterOption) => void
}

export function EncounterPickerSection({ encounterOptions, formUnit, onSelect }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-3 mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Link to Patient Encounter
      </h2>
      {encounterOptions.length === 0 ? (
        <p className="text-xs text-gray-600">
          {formUnit ? 'No recent encounters on this unit.' : 'Select a unit to see patient encounters.'}
        </p>
      ) : (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Select Patient</label>
          <select
            className={inputCls}
            defaultValue=""
            onChange={e => {
              const enc = encounterOptions.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
              if (enc) onSelect(enc)
            }}
          >
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
