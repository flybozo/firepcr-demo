
import type { CompClaimForm } from './types'
import type { Employee } from './types'
import { inputCls, labelCls, sectionCls, CLINICAL_OPTIONS_COMP } from './types'
import { ToggleButton } from './ToggleButton'

interface Props {
  form: CompClaimForm
  physicians: Employee[]
  set: (field: string, value: string | boolean | null) => void
}

export function Section4Clinical({ form, physicians, set }: Props) {
  return (
    <div className="theme-card rounded-xl p-4 border space-y-4">
      <p className={sectionCls}>Section 4 — Clinical</p>
      <div>
        <label className={labelCls}>Clinical Impression</label>
        <select className={inputCls} value={CLINICAL_OPTIONS_COMP.includes(form.clinical_impression) ? form.clinical_impression : (form.clinical_impression ? '__custom__' : '')}
          onChange={e => {
            if (e.target.value === '__custom__') set('clinical_impression', '')
            else set('clinical_impression', e.target.value)
          }}>
          <option value="">Select from list...</option>
          {CLINICAL_OPTIONS_COMP.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="__custom__">Other / Type below...</option>
        </select>
        {(!form.clinical_impression || !CLINICAL_OPTIONS_COMP.includes(form.clinical_impression)) && (
          <input
            type="text"
            className={inputCls + ' mt-1'}
            value={form.clinical_impression}
            onChange={e => set('clinical_impression', e.target.value)}
            placeholder="Type clinical impression..."
          />
        )}
      </div>
      <div>
        <label className={labelCls}>Treatment Summary</label>
        <textarea className={`${inputCls} h-28 resize-none`} value={form.treatment_summary} onChange={e => set('treatment_summary', e.target.value)} placeholder="Treatments provided, medications given, interventions..." />
      </div>
      <div>
        <label className={labelCls}>Physician of Record</label>
        <select className={inputCls} value={form.physician_of_record} onChange={e => set('physician_of_record', e.target.value)}>
          <option value="">Select physician</option>
          {physicians.map(p => (
            <option key={p.id} value={p.name}>{p.name} — {p.role}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Lost Time Expected?</label>
        <ToggleButton value={form.lost_time_expected} onChange={v => set('lost_time_expected', v)} />
      </div>
      <div>
        <label className={labelCls}>Transported to Hospital?</label>
        <ToggleButton value={form.transported_to_hospital} onChange={v => set('transported_to_hospital', v)} />
      </div>
      {form.transported_to_hospital && (
        <div>
          <label className={labelCls}>Hospital Name</label>
          <input type="text" className={inputCls} value={form.hospital_name} onChange={e => set('hospital_name', e.target.value)} placeholder="e.g. Mercy Medical Center" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Facility City</label>
          <input type="text" className={inputCls} value={form.facility_city} onChange={e => set('facility_city', e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Facility State</label>
          <input type="text" className={inputCls} value={form.facility_state} onChange={e => set('facility_state', e.target.value)} maxLength={2} placeholder="CA" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Hospitalized Overnight?</label>
        <ToggleButton value={form.hospitalized_overnight} onChange={v => set('hospitalized_overnight', v)} />
      </div>
    </div>
  )
}
