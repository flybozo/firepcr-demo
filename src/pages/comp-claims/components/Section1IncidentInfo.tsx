
import type { CompClaimForm } from './types'
import { inputCls, labelCls, sectionCls } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section1IncidentInfo({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 1 — Incident Information</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date of Injury *</label>
          <input type="date" className={inputCls} value={form.date_of_injury} onChange={e => set('date_of_injury', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Time of Event</label>
          <input type="time" className={inputCls} value={form.time_of_event} onChange={e => set('time_of_event', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Incident Name</label>
        <input type="text" className={inputCls} value={form.incident} onChange={e => set('incident', e.target.value)} placeholder="e.g. Park Fire" />
      </div>
      <div>
        <label className={labelCls}>Unit</label>
        <input type="text" className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. Medic 2" />
      </div>
      <div>
        <label className={labelCls}>Time Employee Began Work</label>
        <input type="time" className={inputCls} value={form.time_employee_began_work} onChange={e => set('time_employee_began_work', e.target.value)} />
      </div>
    </div>
  )
}
