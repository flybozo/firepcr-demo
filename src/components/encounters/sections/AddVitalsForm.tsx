import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getIsOnline } from '@/lib/syncManager'
import { cacheData, queueOfflineWrite } from '@/lib/offlineStore'
import { SKIN_SIGNS, CARDIAC_RHYTHMS, PUPILS_OPTIONS } from '@/constants/nemsis'
import type { EncounterVitals, VitalsFormState } from '@/types/encounters'

function blankVitalsForm(): VitalsFormState {
  const now = new Date()
  return {
    recorded_at: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    recorded_by: '',
    hr: '', rr: '', spo2: '',
    bp_systolic: '', bp_diastolic: '',
    gcs_eye: '', gcs_verbal: '', gcs_motor: '', gcs_total: '',
    pain_scale: '', blood_glucose: '', temp_f: '',
    skin: '', cardiac_rhythm: '', etco2: '', pupils: '', notes: '',
  }
}

export function AddVitalsForm({
  encounterId,
  crewOptions,
  onSaved,
  onCancel,
  currentUser,
}: {
  encounterId: string
  crewOptions: { id: string; name: string }[]
  onSaved: (v: EncounterVitals) => void
  onCancel: () => void
  currentUser: any
}) {
  const supabase = createClient()
  const [form, setForm] = useState<VitalsFormState>(() => ({
    ...blankVitalsForm(),
    recorded_by: currentUser?.employee?.name || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // suppress unused — crewOptions available for future recorded_by select
  void crewOptions

  const set = (k: keyof VitalsFormState, v: string) => {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'gcs_eye' || k === 'gcs_verbal' || k === 'gcs_motor') {
        const e = k === 'gcs_eye' ? Number(v) : Number(next.gcs_eye)
        const vb = k === 'gcs_verbal' ? Number(v) : Number(next.gcs_verbal)
        const m = k === 'gcs_motor' ? Number(v) : Number(next.gcs_motor)
        if (e && vb && m) next.gcs_total = String(e + vb + m)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const vitalsPayload = {
        encounter_id: encounterId,
        recorded_at: new Date(form.recorded_at).toISOString(),
        recorded_by: form.recorded_by || null,
        hr: form.hr ? Number(form.hr) : null,
        rr: form.rr ? Number(form.rr) : null,
        spo2: form.spo2 ? Number(form.spo2) : null,
        bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
        gcs_eye: form.gcs_eye ? Number(form.gcs_eye) : null,
        gcs_verbal: form.gcs_verbal ? Number(form.gcs_verbal) : null,
        gcs_motor: form.gcs_motor ? Number(form.gcs_motor) : null,
        gcs_total: form.gcs_total ? Number(form.gcs_total) : null,
        pain_scale: form.pain_scale ? Number(form.pain_scale) : null,
        blood_glucose: form.blood_glucose ? Number(form.blood_glucose) : null,
        temp_f: form.temp_f ? Number(form.temp_f) : null,
        skin: form.skin || null,
        cardiac_rhythm: form.cardiac_rhythm || null,
        etco2: form.etco2 ? Number(form.etco2) : null,
        pupils: form.pupils || null,
        notes: form.notes || null,
      }
      if (getIsOnline()) {
        const { data, error: err } = await supabase
          .from('encounter_vitals')
          .insert(vitalsPayload)
          .select()
          .single()
        if (err) throw err
        onSaved(data as EncounterVitals)
      } else {
        const tempId = crypto.randomUUID()
        const offlineVital = { id: tempId, ...vitalsPayload }
        await queueOfflineWrite('encounter_vitals', 'insert', offlineVital)
        await cacheData('vitals', [offlineVital])
        onSaved(offlineVital as EncounterVitals)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  const inp = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const lbl = 'text-xs text-gray-400 block mb-1'

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4 mt-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">New Vitals Set</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Time *</label>
          <input type="datetime-local" value={form.recorded_at} onChange={e => set('recorded_at', e.target.value)} className={inp} style={{ maxWidth: '100%', fontSize: '13px' }} />
        </div>
        <div>
          <label className={lbl}>Recorded By</label>
          <input type="text" value={form.recorded_by} readOnly className={inp + ' bg-gray-900 cursor-default'} />
          <p className="text-xs text-gray-600 mt-1">Auto-populated with your name</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(['hr', 'rr', 'spo2'] as const).map(k => (
          <div key={k}>
            <label className={lbl}>{k === 'spo2' ? 'SpO2 %' : k.toUpperCase()}</label>
            <input type="number" value={form[k]} onChange={e => set(k, e.target.value)} className={inp} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>BP Systolic</label>
          <input type="number" value={form.bp_systolic} onChange={e => set('bp_systolic', e.target.value)} className={inp} placeholder="mmHg" />
        </div>
        <div>
          <label className={lbl}>BP Diastolic</label>
          <input type="number" value={form.bp_diastolic} onChange={e => set('bp_diastolic', e.target.value)} className={inp} placeholder="mmHg" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={lbl}>Eye (1-4)</label>
          <select value={form.gcs_eye} onChange={e => set('gcs_eye', e.target.value)} className={inp}>
            <option value="">—</option>
            <option value="1">1</option><option value="2">2</option>
            <option value="3">3</option><option value="4">4</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Verbal (1-5)</label>
          <select value={form.gcs_verbal} onChange={e => set('gcs_verbal', e.target.value)} className={inp}>
            <option value="">—</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Motor (1-6)</label>
          <select value={form.gcs_motor} onChange={e => set('gcs_motor', e.target.value)} className={inp}>
            <option value="">—</option>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>GCS Total</label>
          <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm text-center font-bold">
            {form.gcs_total || '—'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Pain (0-10)</label>
          <input type="number" min="0" max="10" value={form.pain_scale} onChange={e => set('pain_scale', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>BGL mg/dL</label>
          <input type="number" value={form.blood_glucose} onChange={e => set('blood_glucose', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Temp °F</label>
          <input type="number" step="0.1" value={form.temp_f} onChange={e => set('temp_f', e.target.value)} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>EtCO2</label>
          <input type="number" value={form.etco2} onChange={e => set('etco2', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Skin Signs</label>
          <select value={form.skin} onChange={e => set('skin', e.target.value)} className={inp}>
            <option value="">—</option>
            {SKIN_SIGNS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Cardiac Rhythm</label>
          <select value={form.cardiac_rhythm} onChange={e => set('cardiac_rhythm', e.target.value)} className={inp}>
            <option value="">—</option>
            {CARDIAC_RHYTHMS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Pupils</label>
          <select value={form.pupils} onChange={e => set('pupils', e.target.value)} className={inp}>
            <option value="">—</option>
            {PUPILS_OPTIONS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={lbl}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inp + ' resize-none'} />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-lg text-sm transition-colors">
          {saving ? 'Saving...' : 'Save Vitals'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
