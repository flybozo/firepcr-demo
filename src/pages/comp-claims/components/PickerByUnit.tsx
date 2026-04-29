
import type { PickerEncounterItem } from './types'

export function PickerByUnit({ pickerUnit, setPickerUnit, pickerEncounters, assignmentUnitName, assignmentLoading, onSelect }: {
  pickerUnit: string
  setPickerUnit: (v: string) => void
  pickerEncounters: PickerEncounterItem[]
  assignmentUnitName: string | undefined
  assignmentLoading: boolean
  onSelect: (enc: PickerEncounterItem) => void
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-blue-900/50 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-blue-400">
        🔗 Link to Patient Encounter
      </h2>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Unit</label>
        {assignmentUnitName && !assignmentLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
            <span className="text-sm text-white font-medium">{assignmentUnitName}</span>
            <span className="text-xs text-gray-500">(your unit)</span>
          </div>
        ) : (
          <select
            value={pickerUnit}
            onChange={e => setPickerUnit(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select unit...</option>
            {['Medic 1','Medic 2','Medic 3','Medic 4','Command 1','Aid 1','Aid 2','Rescue 1','Rescue 2'].map(u => <option key={u}>{u}</option>)}
          </select>
        )}
      </div>
      {pickerUnit && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Patient Encounter</label>
          {pickerEncounters.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No recent encounters on {pickerUnit}.</p>
          ) : (
            <select
              defaultValue=""
              onChange={e => {
                const enc = pickerEncounters.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
                if (enc) onSelect(enc)
              }}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select patient...</option>
              {pickerEncounters.map(enc => (
                <option key={enc.id} value={enc.encounter_id || enc.id}>
                  {enc.patient_last_name
                    ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                    : 'Unknown'
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
