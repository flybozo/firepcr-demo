
import type { CompClaimForm } from './types'
import { inputCls, labelCls, sectionCls } from './types'

interface Props {
  form: CompClaimForm
  set: (field: string, value: string | boolean | null) => void
}

export function Section6ClaimsCoordinator({ form, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 6 — Claims Coordinator</p>
      <div>
        <label className={labelCls}>Coordinator Name</label>
        <input type="text" className={inputCls} value={form.claims_coordinator_name} onChange={e => set('claims_coordinator_name', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Phone</label>
          <input type="tel" className={inputCls} value={form.claims_coordinator_phone} onChange={e => set('claims_coordinator_phone', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={form.claims_coordinator_email} onChange={e => set('claims_coordinator_email', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
