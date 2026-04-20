import { NEMSISQualitySummary } from '@/components/NEMSISWarnings'
import type { Employee, StepProps } from './types'
import { inputCls, labelCls, sectionCls } from './types'

interface Step5Props extends StepProps {
  employees: Employee[]
  submitting: boolean
  onSubmit: () => void
}

export function Step5Provider({ form, set, nemsisWarnings, employees, submitting, onSubmit }: Step5Props) {
  return (
    <div className="space-y-4">
      <p className={sectionCls}>Provider</p>
      <div>
        <label className={labelCls}>Provider of Record *</label>
        <select className={inputCls} value={form.provider_of_record} onChange={e => set('provider_of_record', e.target.value)}>
          <option value="">Select provider</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
          ))}
        </select>
      </div>

      <p className={sectionCls}>Narrative</p>
      <div>
        <label className={labelCls}>Notes / Narrative</label>
        <textarea
          className={`${inputCls} h-40 resize-none`}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Patient narrative, interventions, response to treatment..."
        />
      </div>

      <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm text-gray-400">
        <p className="text-white font-semibold text-sm">Review Summary</p>
        <p>Unit: <span className="text-white">{form.unit || '—'}</span></p>
        <p>Patient: <span className="text-white">{form.patient_first_name || '—'} {form.patient_last_name}</span></p>
        <p>Date: <span className="text-white">{form.date || '—'}</span></p>
        <p>Acuity: <span className="text-white">{form.initial_acuity || '—'} → {form.final_acuity || '—'}</span></p>
        <p>Transport: <span className="text-white">{form.transport_method || '—'}</span></p>
        <p>Status: <span className="text-yellow-400">Draft</span></p>
      </div>

      <NEMSISQualitySummary warnings={nemsisWarnings} />

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !form.unit || !form.date}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
      >
        {submitting ? 'Saving PCR...' : '💾 Save PCR (Draft)'}
      </button>
    </div>
  )
}
