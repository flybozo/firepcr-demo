import { inputCls, labelCls } from '@/components/ui/FormField'

type VitalFields = {
  initial_hr: string
  initial_rr: string
  initial_spo2: string
  initial_bp_systolic: string
  initial_bp_diastolic: string
  initial_temp_f: string
  initial_pain_scale: string
  initial_blood_glucose: string
}

interface Props {
  form: VitalFields
  set: (key: string, val: string) => void
}

export function VitalsSection({ form, set }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>HR (bpm)</label>
          <input type="number" className={inputCls} value={form.initial_hr} onChange={e => set('initial_hr', e.target.value)} min="0" max="300" />
        </div>
        <div>
          <label className={labelCls}>RR (/min)</label>
          <input type="number" className={inputCls} value={form.initial_rr} onChange={e => set('initial_rr', e.target.value)} min="0" max="100" />
        </div>
        <div>
          <label className={labelCls}>SpO2 (%)</label>
          <input type="number" className={inputCls} value={form.initial_spo2} onChange={e => set('initial_spo2', e.target.value)} min="0" max="100" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>BP Systolic (mmHg)</label>
          <input type="number" className={inputCls} value={form.initial_bp_systolic} onChange={e => set('initial_bp_systolic', e.target.value)} placeholder="Systolic" />
        </div>
        <div>
          <label className={labelCls}>BP Diastolic (mmHg)</label>
          <input type="number" className={inputCls} value={form.initial_bp_diastolic} onChange={e => set('initial_bp_diastolic', e.target.value)} placeholder="Diastolic" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Temp (°F)</label>
          <input type="number" className={inputCls} value={form.initial_temp_f} onChange={e => set('initial_temp_f', e.target.value)} step="0.1" />
        </div>
        <div>
          <label className={labelCls}>Pain (0-10)</label>
          <input type="number" className={inputCls} value={form.initial_pain_scale} onChange={e => set('initial_pain_scale', e.target.value)} min="0" max="10" />
        </div>
        <div>
          <label className={labelCls}>BGL (mg/dL)</label>
          <input type="number" className={inputCls} value={form.initial_blood_glucose} onChange={e => set('initial_blood_glucose', e.target.value)} min="0" />
        </div>
      </div>
    </div>
  )
}
