
import type { CompClaimForm } from './types'
import { inputCls, labelCls, sectionCls, MECHANISM_OPTIONS, BODY_PART_OPTIONS } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section3InjuryDetails({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 3 — Injury Details</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Mechanism of Injury</label>
          <select className={inputCls} value={form.mechanism_of_injury} onChange={e => set('mechanism_of_injury', e.target.value)}>
            <option value="">Select</option>
            {MECHANISM_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Body Part Affected</label>
          <select className={inputCls} value={form.body_part_affected} onChange={e => set('body_part_affected', e.target.value)}>
            <option value="">Select</option>
            {BODY_PART_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Activity Prior to Event</label>
        <textarea className={`${inputCls} h-24 resize-none`} value={form.activity_prior_to_event} onChange={e => set('activity_prior_to_event', e.target.value)} placeholder="What was the employee doing before the injury?" />
      </div>
      <div>
        <label className={labelCls}>What Harmed the Employee</label>
        <textarea className={`${inputCls} h-24 resize-none`} value={form.what_harmed_employee} onChange={e => set('what_harmed_employee', e.target.value)} placeholder="Describe the object, substance, or exposure that caused the injury" />
      </div>
    </div>
  )
}
