
import type { CompClaimForm } from './types'
import { inputCls, sectionCls } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section8Notes({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-3">
      <p className={sectionCls}>Section 8 — Notes</p>
      <textarea className={`${inputCls} h-28 resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes, observations, follow-up actions..." />
    </div>
  )
}
