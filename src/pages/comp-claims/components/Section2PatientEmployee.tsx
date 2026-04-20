
import type { CompClaimForm } from './types'
import { inputCls, labelCls, sectionCls } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section2PatientEmployee({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 2 — Patient / Employee</p>
      <div>
        <label className={labelCls}>Patient / Employee Name *</label>
        <input type="text" className={inputCls} value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Full name" />
      </div>
      <div>
        <label className={labelCls}>Date of Birth</label>
        <input type="date" className={inputCls} value={form.patient_dob} onChange={e => set('patient_dob', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Patient Agency</label>
        <select className={inputCls} value={form.employee_agency} onChange={e => set('employee_agency', e.target.value)}>
          <option value="">Select...</option>
          <option>Cal Fire</option>
          <option>USFS</option>
          <option>BLM</option>
          <option>NPS</option>
          <option>CHP</option>
          <option>County Fire</option>
          <option>Municipal Fire</option>
          <option>OES / CAL OES</option>
          <option>Private Contractor</option>
          <option>Other</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Crew / Assignment (Resource Number)</label>
        <input type="text" className={inputCls} value={form.employee_crew_assignment} onChange={e => set('employee_crew_assignment', e.target.value)} placeholder="e.g. CRN-2024-001" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Supervisor Name</label>
          <input type="text" className={inputCls} value={form.employee_supervisor_name} onChange={e => set('employee_supervisor_name', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Supervisor Phone</label>
          <input type="tel" className={inputCls} value={form.employee_supervisor_phone} onChange={e => set('employee_supervisor_phone', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
