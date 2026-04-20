import type { StepProps } from './types'
import { inputCls, labelCls, sectionCls } from './types'

const SKIN_SIGNS_OPTIONS = [
  'Normal', 'Pale', 'Flushed/Mottled', 'Cyanotic', 'Jaundiced', 'Diaphoretic/Moist', 'Dry',
]

export function Step3Vitals({ form, set }: StepProps) {
  const gcs = (() => {
    const e = parseInt(form.initial_gcs_eye) || 0
    const v = parseInt(form.initial_gcs_verbal) || 0
    const m = parseInt(form.initial_gcs_motor) || 0
    return e + v + m || ''
  })()

  return (
    <div className="space-y-4">
      <p className={sectionCls}>Circulatory & Respiratory</p>
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
      <div>
        <label className={labelCls}>Blood Pressure (mmHg)</label>
        <div className="flex items-center gap-2">
          <input type="number" className={inputCls} value={form.initial_bp_systolic} onChange={e => set('initial_bp_systolic', e.target.value)} placeholder="Systolic" min="0" max="300" />
          <span className="text-gray-500 font-bold">/</span>
          <input type="number" className={inputCls} value={form.initial_bp_diastolic} onChange={e => set('initial_bp_diastolic', e.target.value)} placeholder="Diastolic" min="0" max="200" />
        </div>
      </div>

      <p className={sectionCls}>Glasgow Coma Scale</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Eye (1-4)</label>
          <select className={inputCls} value={form.initial_gcs_eye} onChange={e => set('initial_gcs_eye', e.target.value)}>
            <option value="">-</option>
            <option value="1">1 – None</option>
            <option value="2">2 – Pain</option>
            <option value="3">3 – Voice</option>
            <option value="4">4 – Spontaneous</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Verbal (1-5)</label>
          <select className={inputCls} value={form.initial_gcs_verbal} onChange={e => set('initial_gcs_verbal', e.target.value)}>
            <option value="">-</option>
            <option value="1">1 – None</option>
            <option value="2">2 – Sounds</option>
            <option value="3">3 – Words</option>
            <option value="4">4 – Confused</option>
            <option value="5">5 – Oriented</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Motor (1-6)</label>
          <select className={inputCls} value={form.initial_gcs_motor} onChange={e => set('initial_gcs_motor', e.target.value)}>
            <option value="">-</option>
            <option value="1">1 – None</option>
            <option value="2">2 – Extension</option>
            <option value="3">3 – Flexion</option>
            <option value="4">4 – Withdrawal</option>
            <option value="5">5 – Localize</option>
            <option value="6">6 – Obeys</option>
          </select>
        </div>
      </div>
      {gcs ? (
        <div className="bg-gray-800 rounded-lg px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-gray-400">GCS Total</span>
          <span className={`text-2xl font-bold ${Number(gcs) >= 13 ? 'text-green-400' : Number(gcs) >= 9 ? 'text-yellow-400' : 'text-red-400'}`}>{gcs}</span>
        </div>
      ) : null}

      <p className={sectionCls}>Other Vitals</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Pain Scale (0-10)</label>
          <input type="number" className={inputCls} value={form.initial_pain_scale} onChange={e => set('initial_pain_scale', e.target.value)} min="0" max="10" />
        </div>
        <div>
          <label className={labelCls}>Blood Glucose (mg/dL)</label>
          <input type="number" className={inputCls} value={form.initial_blood_glucose} onChange={e => set('initial_blood_glucose', e.target.value)} min="0" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Temp (°F)</label>
          <input type="number" className={inputCls} value={form.initial_temp_f} onChange={e => set('initial_temp_f', e.target.value)} step="0.1" min="80" max="115" />
        </div>
        <div>
          <label className={labelCls}>Skin Signs</label>
          <select className={inputCls} value={form.initial_skin} onChange={e => set('initial_skin', e.target.value)}>
            <option value="">Select</option>
            {SKIN_SIGNS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
