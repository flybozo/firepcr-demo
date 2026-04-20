
import type { CompClaimForm } from './types'
import { inputCls, labelCls, sectionCls } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section7Employer({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 7 — Employer</p>
      <div>
        <label className={labelCls}>Employer Name</label>
        <input type="text" className={inputCls} value={form.employer_name} onChange={e => set('employer_name', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Employer Address</label>
        <input type="text" className={inputCls} value={form.employer_address} onChange={e => set('employer_address', e.target.value)} />
      </div>
    </div>
  )
}
