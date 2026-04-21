

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadSingle, loadList } from '@/lib/offlineFirst'
import { LoadingSkeleton } from '@/components/ui'
import { queryEncounter, queryPhysicians } from '@/lib/services/encounters'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { SearchableSelect } from '@/components/SearchableSelect'
import { inputCls, labelCls } from '@/components/ui/FormField'
import { VitalsSection } from '@/components/encounters/VitalsSection'
import {
  INITIAL_ACUITY_OPTIONS, POSSIBLE_INJURY_OPTIONS, PATIENT_GENDER_OPTIONS,
  PATIENT_RACE_OPTIONS, SKIN_SIGNS_OPTIONS, TRANSPORT_METHOD_OPTIONS,
  PATIENT_DISPOSITION_OPTIONS, CLINICAL_OPTIONS,
} from '@/data/clinicalOptions'

const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2 border-b border-gray-800 pb-1'

type Employee = { id: string; full_name: string; role?: string | null }
type EncounterRecord = Record<string, unknown>

function EditEncounterInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [encounter, setEncounter] = useState<EncounterRecord | null>(null)

  const [form, setForm] = useState({
    // Patient Info
    patient_first_name: '',
    patient_last_name: '',
    dob: '',
    patient_age: '',
    patient_gender: '',
    patient_race: '',
    patient_address: '',
    patient_city: '',
    patient_state: '',
    patient_zip: '',
    patient_phone: '',
    // Assessment
    primary_symptom_text: '',
    primary_impression_text: '',
    secondary_impression: '',
    initial_acuity: '',
    possible_injury: '',
    // Vitals
    initial_hr: '',
    initial_rr: '',
    initial_spo2: '',
    initial_bp_systolic: '',
    initial_bp_diastolic: '',
    initial_gcs_eye: '',
    initial_gcs_verbal: '',
    initial_gcs_motor: '',
    initial_pain_scale: '',
    initial_blood_glucose: '',
    initial_temp_f: '',
    initial_skin: '',
    // Disposition
    transport_method: '',
    patient_disposition: '',
    refusal_signed: false,
    provider_of_record: '',
    // Notes
    notes: '',
  })

  useEffect(() => {
    const load = async () => {
      // Show cached data instantly
      try {
        const { getCachedById } = await import('@/lib/offlineStore')
        const cached = await getCachedById('encounters', id) as any
        if (cached) {
          setEncounter(cached)
          setLoading(false)
        }
      } catch {}
      const [{ data: enc }, { data: emps }] = await Promise.all([
        loadSingle(
          () => queryEncounter(id) as any,
          'encounters',
          id
        ),
        loadList<Employee>(
          () => queryPhysicians(),
          'employees',
          (all) => all.filter((e: any) => ['MD', 'DO'].includes(e.role))
        ),
      ])
      setEmployees(emps)
      if (!enc) {
        setError('Encounter not found.')
        setLoading(false)
        return
      }
      setEncounter(enc as EncounterRecord)
      // Pre-fill form
      const s = (field: string): string => {
        const v = (enc as EncounterRecord)[field]
        return v != null ? String(v) : ''
      }
      setForm({
        patient_first_name: s('patient_first_name'),
        patient_last_name: s('patient_last_name'),
        dob: s('patient_dob') || s('dob'),
        patient_age: s('patient_age'),
        patient_gender: s('patient_gender'),
        patient_race: s('patient_race'),
        patient_address: s('patient_address'),
        patient_city: s('patient_city'),
        patient_state: s('patient_state'),
        patient_zip: s('patient_zip'),
        patient_phone: s('patient_phone'),
        primary_symptom_text: s('primary_symptom_text'),
        primary_impression_text: s('primary_impression_text'),
        secondary_impression: (() => { const v = (enc as any)['secondary_impression']; return Array.isArray(v) ? (v[0] || '') : (v != null ? String(v) : ''); })(),
        initial_acuity: s('initial_acuity'),
        possible_injury: (enc as EncounterRecord)['possible_injury'] === true ? 'Yes' : (enc as EncounterRecord)['possible_injury'] === false ? 'No' : 'Unknown',
        initial_hr: s('initial_hr'),
        initial_rr: s('initial_rr'),
        initial_spo2: s('initial_spo2'),
        initial_bp_systolic: s('initial_bp_systolic'),
        initial_bp_diastolic: s('initial_bp_diastolic'),
        initial_gcs_eye: s('initial_gcs_eye'),
        initial_gcs_verbal: s('initial_gcs_verbal'),
        initial_gcs_motor: s('initial_gcs_motor'),
        initial_pain_scale: s('initial_pain_scale'),
        initial_blood_glucose: s('initial_blood_glucose'),
        initial_temp_f: s('initial_temp_f'),
        initial_skin: s('initial_skin'),
        transport_method: s('transport_method'),
        patient_disposition: s('patient_disposition'),
        refusal_signed: !!(enc as EncounterRecord)['refusal_signed'],
        provider_of_record: s('provider_of_record'),
        notes: s('notes'),
      })
      setLoading(false)
    }
    load()
  }, [id])

  const set = (field: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const gcsTotal = () => {
    const e = parseInt(form.initial_gcs_eye) || 0
    const v = parseInt(form.initial_gcs_verbal) || 0
    const m = parseInt(form.initial_gcs_motor) || 0
    return e + v + m || ''
  }

  const handleSave = async () => {
    setSubmitting(true)
    setError(null)
    const gcsTotalVal = gcsTotal()

    const payload = {
      patient_first_name: form.patient_first_name || null,
      patient_last_name: form.patient_last_name || null,
      patient_dob: form.dob || null,
      patient_age: form.patient_age ? parseInt(form.patient_age) : null,
      patient_gender: form.patient_gender || null,
      patient_race: form.patient_race || null,
      patient_address: form.patient_address || null,
      patient_city: form.patient_city || null,
      patient_state: form.patient_state || null,
      patient_zip: form.patient_zip || null,
      patient_phone: form.patient_phone || null,
      primary_symptom_text: form.primary_symptom_text || null,
      primary_impression_text: form.primary_impression_text || null,
      secondary_impression: form.secondary_impression ? [form.secondary_impression] : null,
      initial_acuity: form.initial_acuity || null,
      possible_injury: form.possible_injury === 'Yes' ? true : form.possible_injury === 'No' ? false : null,
      initial_hr: form.initial_hr ? parseInt(form.initial_hr) : null,
      initial_rr: form.initial_rr ? parseInt(form.initial_rr) : null,
      initial_spo2: form.initial_spo2 ? parseInt(form.initial_spo2) : null,
      initial_bp_systolic: form.initial_bp_systolic ? parseInt(form.initial_bp_systolic) : null,
      initial_bp_diastolic: form.initial_bp_diastolic ? parseInt(form.initial_bp_diastolic) : null,
      initial_gcs_eye: form.initial_gcs_eye ? parseInt(form.initial_gcs_eye) : null,
      initial_gcs_verbal: form.initial_gcs_verbal ? parseInt(form.initial_gcs_verbal) : null,
      initial_gcs_motor: form.initial_gcs_motor ? parseInt(form.initial_gcs_motor) : null,
      initial_gcs_total: gcsTotalVal || null,
      initial_pain_scale: form.initial_pain_scale ? parseInt(form.initial_pain_scale) : null,
      initial_blood_glucose: form.initial_blood_glucose ? parseFloat(form.initial_blood_glucose) : null,
      initial_temp_f: form.initial_temp_f ? parseFloat(form.initial_temp_f) : null,
      initial_skin: form.initial_skin || null,
      transport_method: form.transport_method || null,
      patient_disposition: form.patient_disposition || null,
      refusal_signed: form.refusal_signed,
      provider_of_record: form.provider_of_record || null,
      notes: form.notes || null,
    }

    try {
      const { getIsOnline } = await import('@/lib/syncManager')
      if (getIsOnline()) {
        const { error: updateErr } = await supabase
          .from('patient_encounters')
          .update(payload)
          .eq('id', id)
        if (updateErr) { setError(`Save failed: ${updateErr.message}`); setSubmitting(false); return }
      } else {
        const { queueOfflineWrite } = await import('@/lib/offlineStore')
        await queueOfflineWrite('patient_encounters', 'update', { id, ...payload })
      }
      setSubmitting(false)
      navigate(`/encounters/${id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading encounter...</p>
    </div>
  )

  if (error && !encounter) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-red-400">{error}</p>
        <Link to="/encounters" className="text-gray-400 underline text-sm">← Encounters</Link>
      </div>
    </div>
  )

  const gcs = gcsTotal()
  const enc = encounter as EncounterRecord

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Nav */}
        <div className="flex items-center gap-3">
          <Link to={`/encounters/${id}`} className="text-gray-500 hover:text-gray-300 text-sm">← Encounter</Link>
          <h1 className="text-xl font-bold flex-1">Edit Encounter</h1>
        </div>

        {/* ── HEADER (read-only) ── */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <p className={sectionCls}>Encounter Header (read-only)</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Encounter ID</p>
              <p className="text-white font-mono">{String(enc['encounter_id'] || enc['id'] || '—')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
              <p className="text-white">{String(enc['date'] || '—')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Unit</p>
              <p className="text-white">{String(enc['unit'] || '—')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Incident</p>
              <p className="text-white">{String(enc['incident'] || '—')}</p>
            </div>
          </div>
        </div>

        {/* ── PATIENT INFO ── */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <p className={sectionCls}>Patient Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name</label>
              <input type="text" className={inputCls} value={form.patient_first_name} onChange={e => set('patient_first_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input type="text" className={inputCls} value={form.patient_last_name} onChange={e => set('patient_last_name', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls} value={form.dob} onChange={e => set('dob', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Age</label>
              <input type="number" className={inputCls} value={form.patient_age} onChange={e => set('patient_age', e.target.value)} min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Gender</label>
              <select className={inputCls} value={form.patient_gender} onChange={e => set('patient_gender', e.target.value)}>
                <option value="">Select</option>
                {PATIENT_GENDER_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Race</label>
              <select className={inputCls} value={form.patient_race} onChange={e => set('patient_race', e.target.value)}>
                <option value="">Select</option>
                {PATIENT_RACE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Street Address</label>
            <input type="text" className={inputCls} value={form.patient_address} onChange={e => set('patient_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>City</label>
              <input type="text" className={inputCls} value={form.patient_city} onChange={e => set('patient_city', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input type="text" className={inputCls} value={form.patient_state} onChange={e => set('patient_state', e.target.value)} maxLength={2} />
            </div>
            <div>
              <label className={labelCls}>ZIP</label>
              <input type="text" className={inputCls} value={form.patient_zip} onChange={e => set('patient_zip', e.target.value)} maxLength={10} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input type="tel" className={inputCls} value={form.patient_phone} onChange={e => set('patient_phone', e.target.value)} />
          </div>
        </div>

        {/* ── ASSESSMENT ── */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <p className={sectionCls}>Assessment</p>
          <div>
            <label className={labelCls}>Chief Complaint</label>
            <SearchableSelect
              options={CLINICAL_OPTIONS}
              value={form.primary_symptom_text}
              onChange={v => set('primary_symptom_text', v)}
              placeholder="Search chief complaint..."
            />
          </div>
          <div>
            <label className={labelCls}>Primary Impression</label>
            <SearchableSelect
              options={CLINICAL_OPTIONS}
              value={form.primary_impression_text}
              onChange={v => set('primary_impression_text', v)}
              placeholder="Search primary impression..."
            />
          </div>
          <div>
            <label className={labelCls}>Secondary Impression</label>
            <SearchableSelect
              options={CLINICAL_OPTIONS}
              value={form.secondary_impression}
              onChange={v => set('secondary_impression', v)}
              placeholder="Search secondary impression (optional)..."
            />
          </div>

          <div>
            <label className={labelCls}>Initial Acuity (Triage)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {INITIAL_ACUITY_OPTIONS.map(({ value, color, ring, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('initial_acuity', value)}
                  className={`flex-1 py-2 rounded-lg text-white text-xs font-bold transition-all ${color} ${form.initial_acuity === value ? `ring-2 ${ring}` : 'opacity-70'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.initial_acuity && <p className="text-xs text-gray-400 mt-1">{form.initial_acuity}</p>}
          </div>

          <div>
            <label className={labelCls}>Possible Injury</label>
            <div className="flex gap-2 mt-1">
              {POSSIBLE_INJURY_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => set('possible_injury', opt)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.possible_injury === opt ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}>{opt}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── VITALS ── */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <p className={sectionCls}>Vitals</p>
          <VitalsSection form={form} set={set} />

          <div>
            <label className={labelCls}>Glasgow Coma Scale</label>
            <div className="grid grid-cols-3 gap-3 mt-1">
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
              <div className="bg-gray-800 rounded-lg px-4 py-2 flex justify-between items-center mt-2">
                <span className="text-sm text-gray-400">GCS Total</span>
                <span className={`text-xl font-bold ${Number(gcs) >= 13 ? 'text-green-400' : Number(gcs) >= 9 ? 'text-yellow-400' : 'text-red-400'}`}>{gcs}</span>
              </div>
            ) : null}
          </div>

          <div>
            <label className={labelCls}>Skin Signs</label>
            <select className={inputCls} value={form.initial_skin} onChange={e => set('initial_skin', e.target.value)}>
              <option value="">Select</option>
              {SKIN_SIGNS_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {/* ── DISPOSITION ── */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <p className={sectionCls}>Disposition</p>
          <div>
            <label className={labelCls}>Transport Method</label>
            <select className={inputCls} value={form.transport_method} onChange={e => set('transport_method', e.target.value)}>
              <option value="">Select</option>
              {TRANSPORT_METHOD_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Patient Disposition</label>
            <select className={inputCls} value={form.patient_disposition} onChange={e => set('patient_disposition', e.target.value)}>
              <option value="">Select</option>
              {PATIENT_DISPOSITION_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Refusal Signed</p>
              <p className="text-xs text-gray-400">Patient AMA/refusal form obtained</p>
            </div>
            <button
              type="button"
              onClick={() => set('refusal_signed', !form.refusal_signed)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.refusal_signed ? 'bg-red-600' : 'bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.refusal_signed ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div>
            <label className={labelCls}>Provider of Record</label>
            <select className={inputCls} value={form.provider_of_record} onChange={e => set('provider_of_record', e.target.value)}>
              <option value="">Select provider</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.full_name}>{emp.full_name} — {emp.role}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── NOTES ── */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <p className={sectionCls}>Notes / Narrative</p>
          <textarea
            className={`${inputCls} h-36 resize-none`}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Patient narrative, interventions, response to treatment..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
        >
          {submitting ? 'Saving...' : '💾 Save Changes'}
        </button>
        <div className="pb-8" />
      </div>
    </div>
  )
}

export default function EncounterEditPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <EditEncounterInner />
    </Suspense>
  )
}
