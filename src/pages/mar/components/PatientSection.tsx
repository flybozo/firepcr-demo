
import type { FormState } from '../types'
import { inputCls, labelCls, sectionCls, RESPONSES } from '../types'

interface PatientSectionProps {
  form: FormState
  encounterId: string
  patientNameParam: string
  set: (field: keyof FormState, value: string) => void
}

export function PatientSection({ form, encounterId, patientNameParam, set }: PatientSectionProps) {
  return (
    <>
      <p className={sectionCls}>Patient</p>
      <div>
        <label className={labelCls}>Patient Name *</label>
        {patientNameParam ? (
          <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm">{form.patient_name}</div>
        ) : (
          <input type="text" className={inputCls} value={form.patient_name} onChange={e => set('patient_name', e.target.value)} />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={labelCls}>Date of Birth</label>
          <input type="date" className={inputCls + ' min-w-0'} value={form.dob} onChange={e => set('dob', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Encounter ID</label>
          {encounterId ? (
            <div className="bg-gray-700 rounded-lg px-3 py-2 text-blue-300 text-sm font-mono">{encounterId}</div>
          ) : (
            <input type="text" className={inputCls} value={form.encounter_id} onChange={e => set('encounter_id', e.target.value)} placeholder="PCR-xxx (optional)" />
          )}
        </div>
      </div>
      <div>
        <label className={labelCls}>Indication</label>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          value={form.indication}
          onChange={e => set('indication', e.target.value)}
          placeholder="Clinical indication for administration"
        />
      </div>
      <div>
        <label className={labelCls}>Response to Medication</label>
        <div className="grid grid-cols-2 gap-2">
          {RESPONSES.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => set('response_to_medication', r)}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${form.response_to_medication === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
