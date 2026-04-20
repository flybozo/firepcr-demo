
import type { CompClaimForm } from './types'
import { inputCls, labelCls, sectionCls } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section5Witnesses({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 5 — Witnesses</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Witness Name</label>
          <input type="text" className={inputCls} value={form.witness_name} onChange={e => set('witness_name', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Witness Contact</label>
          <input type="tel" className={inputCls} value={form.witness_contact} onChange={e => set('witness_contact', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
