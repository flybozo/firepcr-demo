

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadSingle, loadList } from '@/lib/offlineFirst'
import { LoadingSkeleton } from '@/components/ui'
import { queryEncounter, queryPhysicians } from '@/lib/services/encounters'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { SearchableSelect } from '@/components/SearchableSelect'
import type { SelectOption } from '@/components/SearchableSelect'

type Employee = { id: string; full_name: string; role: string }

const INITIAL_ACUITY_OPTIONS = [
  { value: 'Critical (Red)', color: 'bg-red-600 hover:bg-red-500', ring: 'ring-red-400', label: 'Red' },
  { value: 'Emergent (Yellow)', color: 'bg-yellow-500 hover:bg-yellow-400', ring: 'ring-yellow-300', label: 'Yellow' },
  { value: 'Lower Acuity (Green)', color: 'bg-green-600 hover:bg-green-500', ring: 'ring-green-400', label: 'Green' },
  { value: 'Dead without Resuscitation Efforts (Black)', color: 'bg-gray-800 hover:bg-gray-700 border border-gray-600', ring: 'ring-gray-400', label: 'Black' },
  { value: 'Non-Acute/Routine', color: 'bg-blue-700 hover:bg-blue-600', ring: 'ring-blue-400', label: 'Routine' },
]

const POSSIBLE_INJURY_OPTIONS = ['Yes', 'No', 'Unknown']

const PATIENT_GENDER_OPTIONS = ['Female', 'Male', 'Unknown']
const PATIENT_RACE_OPTIONS = [
  'White', 'Black or African American', 'Hispanic or Latino', 'Asian',
  'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander',
  'Middle Eastern or North African',
]

const SKIN_SIGNS_OPTIONS = ['Normal', 'Pale', 'Flushed/Mottled', 'Cyanotic', 'Jaundiced', 'Diaphoretic/Moist', 'Dry']

const TRANSPORT_METHOD_OPTIONS = [
  'Ground Transport (ALS Equipped)', 'Ground Transport (BLS Equipped)',
  'Air Transport-Helicopter', 'Air Transport-Fixed Wing', 'No Transport',
]

const PATIENT_DISPOSITION_OPTIONS = [
  'Patient Evaluated and Care Provided',
  'Patient Evaluated and Refused Care',
  'Patient Evaluated, No Care Required',
  'Patient Refused Evaluation/Care',
  'Patient Support Services Provided',
]

const CLINICAL_OPTIONS: SelectOption[] = [
  { group: 'Trauma', value: 'Traumatic Injury (general)', label: 'Traumatic Injury (general)', icd10: 'T14.90XA' },
  { group: 'Trauma', value: 'Blunt Trauma', label: 'Blunt Trauma', icd10: 'T14.90XA' },
  { group: 'Trauma', value: 'Head Injury', label: 'Head Injury', icd10: 'S09.90XA' },
  { group: 'Trauma', value: 'Traumatic Brain Injury', label: 'Traumatic Brain Injury', icd10: 'S09.90XA' },
  { group: 'Trauma', value: 'Concussion', label: 'Concussion', icd10: 'S09.90XA' },
  { group: 'Trauma', value: 'Spinal Cord Injury', label: 'Spinal Cord Injury', icd10: 'S14.109A' },
  { group: 'Trauma', value: 'Cervical Spine Injury', label: 'Cervical Spine Injury', icd10: 'S14.109A' },
  { group: 'Trauma', value: 'Chest Trauma', label: 'Chest Trauma', icd10: 'S29.9XXA' },
  { group: 'Trauma', value: 'Pneumothorax - Traumatic', label: 'Pneumothorax - Traumatic', icd10: 'S27.0XXA' },
  { group: 'Trauma', value: 'Tension Pneumothorax', label: 'Tension Pneumothorax', icd10: 'S27.0XXA' },
  { group: 'Trauma', value: 'Hemothorax', label: 'Hemothorax', icd10: 'S27.1XXA' },
  { group: 'Trauma', value: 'Abdominal Trauma', label: 'Abdominal Trauma', icd10: 'S39.91XA' },
  { group: 'Trauma', value: 'Pelvic Fracture', label: 'Pelvic Fracture', icd10: 'S32.9XXA' },
  { group: 'Trauma', value: 'Fracture (general)', label: 'Fracture (general)', icd10: 'T14.8XXA' },
  { group: 'Trauma', value: 'Dislocation', label: 'Dislocation', icd10: 'T14.8XXA' },
  { group: 'Trauma', value: 'Sprain / Strain', label: 'Sprain / Strain', icd10: 'T14.90XA' },
  { group: 'Trauma', value: 'Laceration', label: 'Laceration', icd10: 'R58' },
  { group: 'Trauma', value: 'Abrasion', label: 'Abrasion', icd10: 'T14.8XXA' },
  { group: 'Trauma', value: 'Contusion / Bruise', label: 'Contusion / Bruise', icd10: 'T14.8XXA' },
  { group: 'Trauma', value: 'Extremity Injury', label: 'Extremity Injury', icd10: 'T14.90XA' },
  { group: 'Trauma', value: 'Back Injury', label: 'Back Injury', icd10: 'M54.9' },
  { group: 'Burns/Environmental', value: 'Burns (general)', label: 'Burns (general)', icd10: 'T30.0' },
  { group: 'Burns/Environmental', value: 'Smoke Inhalation', label: 'Smoke Inhalation', icd10: 'J70.5' },
  { group: 'Burns/Environmental', value: 'Carbon Monoxide Poisoning', label: 'Carbon Monoxide Poisoning', icd10: 'T58.01XA' },
  { group: 'Burns/Environmental', value: 'Heat Exhaustion', label: 'Heat Exhaustion', icd10: 'T67.3XXA' },
  { group: 'Burns/Environmental', value: 'Heat Stroke', label: 'Heat Stroke', icd10: 'T67.01XA' },
  { group: 'Burns/Environmental', value: 'Hypothermia', label: 'Hypothermia', icd10: 'T68.XXXA' },
  { group: 'Burns/Environmental', value: 'Near Drowning / Submersion', label: 'Near Drowning / Submersion', icd10: 'T75.1XXA' },
  { group: 'Burns/Environmental', value: 'Lightning Strike', label: 'Lightning Strike', icd10: 'T75.00XA' },
  { group: 'Burns/Environmental', value: 'Electrical Injury', label: 'Electrical Injury', icd10: 'T75.00XA' },
  { group: 'Cardiovascular', value: 'Chest Pain', label: 'Chest Pain', icd10: 'R07.9' },
  { group: 'Cardiovascular', value: 'Cardiac Arrest', label: 'Cardiac Arrest', icd10: 'I46.9' },
  { group: 'Cardiovascular', value: 'Acute MI / STEMI', label: 'Acute MI / STEMI', icd10: 'I21.3' },
  { group: 'Cardiovascular', value: 'Atrial Fibrillation', label: 'Atrial Fibrillation', icd10: 'I48.91' },
  { group: 'Cardiovascular', value: 'SVT', label: 'SVT', icd10: 'I47.1' },
  { group: 'Cardiovascular', value: 'Bradycardia', label: 'Bradycardia', icd10: 'R00.1' },
  { group: 'Cardiovascular', value: 'Tachycardia', label: 'Tachycardia', icd10: 'R00.0' },
  { group: 'Cardiovascular', value: 'Heart Failure / Pulmonary Edema', label: 'Heart Failure / Pulmonary Edema', icd10: 'I50.9' },
  { group: 'Cardiovascular', value: 'Hypertensive Emergency', label: 'Hypertensive Emergency', icd10: 'I10' },
  { group: 'Cardiovascular', value: 'Hypotension / Shock', label: 'Hypotension / Shock', icd10: 'R57.9' },
  { group: 'Cardiovascular', value: 'Syncope', label: 'Syncope', icd10: 'R55' },
  { group: 'Respiratory', value: 'Respiratory Distress', label: 'Respiratory Distress', icd10: 'J96.00' },
  { group: 'Respiratory', value: 'Dyspnea / Shortness of Breath', label: 'Dyspnea / Shortness of Breath', icd10: 'R06.00' },
  { group: 'Respiratory', value: 'Asthma Exacerbation', label: 'Asthma Exacerbation', icd10: 'J45.901' },
  { group: 'Respiratory', value: 'COPD Exacerbation', label: 'COPD Exacerbation', icd10: 'J44.1' },
  { group: 'Respiratory', value: 'Airway Obstruction', label: 'Airway Obstruction', icd10: 'T17.908A' },
  { group: 'Neurological', value: 'Altered Mental Status', label: 'Altered Mental Status', icd10: 'R41.3' },
  { group: 'Neurological', value: 'Unresponsive / Unconscious', label: 'Unresponsive / Unconscious', icd10: 'R55' },
  { group: 'Neurological', value: 'Seizure', label: 'Seizure', icd10: 'G40.909' },
  { group: 'Neurological', value: 'Stroke / CVA', label: 'Stroke / CVA', icd10: 'I63.9' },
  { group: 'Neurological', value: 'TIA', label: 'TIA', icd10: 'G45.9' },
  { group: 'Neurological', value: 'Headache', label: 'Headache', icd10: 'R51' },
  { group: 'Neurological', value: 'Dizziness / Vertigo', label: 'Dizziness / Vertigo', icd10: 'R42' },
  { group: 'Toxicology', value: 'Drug Overdose (general)', label: 'Drug Overdose (general)', icd10: 'T65.91XA' },
  { group: 'Toxicology', value: 'Opioid Overdose', label: 'Opioid Overdose', icd10: 'T40.0X1A' },
  { group: 'Toxicology', value: 'Alcohol Intoxication', label: 'Alcohol Intoxication', icd10: 'F10.129' },
  { group: 'Toxicology', value: 'Anaphylaxis', label: 'Anaphylaxis', icd10: 'T78.2XXA' },
  { group: 'Toxicology', value: 'Allergic Reaction - Mild', label: 'Allergic Reaction - Mild', icd10: 'T78.40XA' },
  { group: 'Toxicology', value: 'Allergic Reaction - Severe', label: 'Allergic Reaction - Severe', icd10: 'T78.2XXA' },
  { group: 'Toxicology', value: 'Envenomation - Snake', label: 'Envenomation - Snake', icd10: 'T63.001A' },
  { group: 'Toxicology', value: 'Envenomation - Bee/Wasp/Insect', label: 'Envenomation - Bee/Wasp/Insect', icd10: 'T63.441A' },
  { group: 'Medical', value: 'Abdominal Pain', label: 'Abdominal Pain', icd10: 'R10.9' },
  { group: 'Medical', value: 'Nausea and Vomiting', label: 'Nausea and Vomiting', icd10: 'R11.2' },
  { group: 'Medical', value: 'Dehydration', label: 'Dehydration', icd10: 'E86.0' },
  { group: 'Medical', value: 'Hypoglycemia', label: 'Hypoglycemia', icd10: 'E13.64' },
  { group: 'Medical', value: 'Hyperglycemia', label: 'Hyperglycemia', icd10: 'E13.65' },
  { group: 'Medical', value: 'Sepsis', label: 'Sepsis', icd10: 'A41.9' },
  { group: 'Medical', value: 'Fever', label: 'Fever', icd10: 'R50.9' },
  { group: 'Medical', value: 'Back Pain (non-traumatic)', label: 'Back Pain (non-traumatic)', icd10: 'M54.9' },
  { group: 'Medical', value: 'Fatigue / Exhaustion', label: 'Fatigue / Exhaustion', icd10: 'R53.81' },
  { group: 'Psychiatric', value: 'Suicidal Ideation', label: 'Suicidal Ideation', icd10: 'R45.851' },
  { group: 'Psychiatric', value: 'Anxiety / Panic Attack', label: 'Anxiety / Panic Attack', icd10: 'F41.0' },
  { group: 'Psychiatric', value: 'Psychosis', label: 'Psychosis', icd10: 'F29' },
  { group: 'Fire Medicine', value: 'Wildland Fire Injury (general)', label: 'Wildland Fire Injury (general)', icd10: 'T14.90XA' },
  { group: 'Fire Medicine', value: 'Rope Rescue Injury', label: 'Rope Rescue Injury', icd10: 'T14.90XA' },
  { group: 'Fire Medicine', value: 'Heat Exhaustion (Wildland)', label: 'Heat Exhaustion (Wildland)', icd10: 'T67.3XXA' },
  { group: 'Fire Medicine', value: 'Falls from Height', label: 'Falls from Height', icd10: 'W17.89XA' },
  { group: 'Fire Medicine', value: 'Dehydration / Hypovolemia', label: 'Dehydration / Hypovolemia', icd10: 'E86.1' },
  { group: 'Administrative', value: 'No Patient Found', label: 'No Patient Found', icd10: 'Z00.00' },
  { group: 'Administrative', value: 'Patient Refusal', label: 'Patient Refusal', icd10: 'Z53.21' },
  { group: 'Administrative', value: 'Standby - No Patient Contact', label: 'Standby - No Patient Contact', icd10: 'Z02.89' },
  { group: 'Administrative', value: 'Unknown / Unable to Determine', label: 'Unknown', icd10: 'R69' },
  { group: 'Administrative', value: 'Other / Not Listed', label: 'Other / Not Listed', icd10: 'R68.89' },
]

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2 border-b border-gray-800 pb-1'

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
              <input type="number" className={inputCls} value={form.initial_bp_systolic} onChange={e => set('initial_bp_systolic', e.target.value)} placeholder="Systolic" />
              <span className="text-gray-500 font-bold">/</span>
              <input type="number" className={inputCls} value={form.initial_bp_diastolic} onChange={e => set('initial_bp_diastolic', e.target.value)} placeholder="Diastolic" />
            </div>
          </div>

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
              <input type="number" className={inputCls} value={form.initial_temp_f} onChange={e => set('initial_temp_f', e.target.value)} step="0.1" />
            </div>
            <div>
              <label className={labelCls}>Skin Signs</label>
              <select className={inputCls} value={form.initial_skin} onChange={e => set('initial_skin', e.target.value)}>
                <option value="">Select</option>
                {SKIN_SIGNS_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
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
