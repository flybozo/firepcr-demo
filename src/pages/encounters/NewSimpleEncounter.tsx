

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useOfflineWrite } from '@/lib/useOfflineWrite'

const CHIEF_COMPLAINTS = [
  'Abrasion / Laceration', 'Allergic Reaction', 'Ankle / Foot Injury',
  'Back Pain', 'Blister', 'Burns', 'Chest Pain', 'Dehydration',
  'Dental Pain', 'Eye Irritation', 'Fatigue / Heat Exhaustion',
  'GI Complaint (N/V/D)', 'Hand / Wrist Injury', 'Head Injury',
  'Headache', 'Knee / Leg Injury', 'Laceration', 'Mental Health',
  'Musculoskeletal Pain', 'Poison Oak / Ivy', 'Respiratory',
  'Shoulder / Arm Injury', 'Skin Infection', 'Smoke Inhalation',
  'Sprain / Strain', 'Sting / Bite', 'Toothache', 'URI / Cold',
  'Urinary Complaint', 'Other',
]

const DISPOSITIONS = [
  'Treated & Released', 'Referred to Higher Level of Care',
  'Transport by Ambulance', 'Refused Treatment', 'No Treatment Required',
  'Evacuated', 'Return to Duty',
]

const ACUITY = [
  { value: 'Green (Minor)', label: 'Minimal', base: 'bg-green-700 hover:bg-green-600', selected: 'bg-green-500 ring-2 ring-green-300' },
  { value: 'Yellow (Delayed)', label: 'Delayed', base: 'bg-yellow-600 hover:bg-yellow-500', selected: 'bg-yellow-400 ring-2 ring-yellow-200' },
  { value: 'Red (Immediate)', label: 'Immediate', base: 'bg-red-700 hover:bg-red-600', selected: 'bg-red-500 ring-2 ring-red-300' },
  { value: 'Black (Expectant)', label: 'Expectant', base: 'bg-gray-700 hover:bg-gray-600 border border-gray-500', selected: 'bg-gray-600 ring-2 ring-gray-400 border border-gray-400' },
]

const CARDIAC_RHYTHMS = [
  'NSR (Normal Sinus Rhythm)', 'Sinus Tachycardia', 'Sinus Bradycardia',
  'Atrial Fibrillation', 'Atrial Flutter',
  'AV Block-1st Degree', 'AV Block-2nd Degree-Type 1', 'AV Block-2nd Degree-Type 2', 'AV Block-3rd Degree',
  'Left Bundle Branch Block', 'Right Bundle Branch Block', 'Junctional',
  'PEA (Pulseless Electrical Activity)',
  'Ventricular Tachycardia (Perfusing)', 'Ventricular Tachycardia (Pulseless)',
  'Ventricular Fibrillation', 'Asystole', 'Agonal/Idioventricular', 'Pacemaker Rhythm', 'Other',
]

const PUPILS_OPTIONS = ['Equal and Reactive', 'Unequal', 'Non-Reactive', 'Dilated', 'Constricted']

const SCENE_TYPES = [
  'Wildland Fire Scene', 'Structure Fire Scene', 'Residence/Home', 'Street/Highway', 'Other',
]

const CLINICAL_ROLES = ['MD', 'MD/DO', 'NP', 'PA']

function SimpleEHRInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { write: offlineWrite, isOffline } = useOfflineWrite()
  const [searchParams] = useSearchParams()
  const urlIncidentId = searchParams.get('incidentId')
  const urlUnitId = searchParams.get('unitId') || ''
  const urlUnitName = searchParams.get('unitName') || searchParams.get('unit') || ''
  const urlCRN = searchParams.get('crew_resource_number') || ''

  const assignment = useUserAssignment()
  const currentUser = assignment

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [incidents, setIncidents] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; name: string }[]>([])

  const now = new Date()
  const [form, setForm] = useState({
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5),
    unit: urlUnitName,
    unit_id: urlUnitId || '',
    incident_id: urlIncidentId || '',
    crew_resource_number: urlCRN,
    // Patient
    patient_first_name: '',
    patient_last_name: '',
    patient_age: '',
    patient_age_units: 'Years',
    patient_gender: '',
    // Clinical
    chief_complaint: '',
    chief_complaint_other: '',
    initial_acuity: '',
    // Vitals
    initial_hr: '',
    initial_rr: '',
    initial_spo2: '',
    initial_bp_systolic: '',
    initial_bp_diastolic: '',
    initial_temp_f: '',
    initial_pain_scale: '',
    initial_blood_glucose: '',
    // Additional vitals
    cardiac_rhythm: '',
    pupils: '',
    etco2: '',
    // Scene
    scene_type: '',
    // Assessment & Plan
    assessment: '',
    treatment: '',
    response_to_treatment: '',
    provider_of_record: '',
    // Disposition
    patient_disposition: '',
    notes: '',
  })

  const [providers, setProviders] = useState<{id: string; name: string; role: string}[]>([])
  const [assignmentApplied, setAssignmentApplied] = useState(false)

  // Apply assignment once loaded
  useEffect(() => {
    if (!assignment.loading && !assignmentApplied) {
      setAssignmentApplied(true)
      const updates: Partial<typeof form> = {}

      if (assignment.unit && !urlUnitName) {
        updates.unit = assignment.unit.name
        updates.unit_id = assignment.unit.id
      }
      if (assignment.incident && !urlIncidentId) {
        updates.incident_id = assignment.incident.id
      }
      if (assignment.employee && CLINICAL_ROLES.includes(assignment.employee.role)) {
        updates.provider_of_record = assignment.employee.name
      }

      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }))
      }
    }
  }, [assignment.loading, assignmentApplied, assignment.unit, assignment.incident, assignment.employee, urlUnitName, urlIncidentId])

  useEffect(() => {
    const load = async () => {
      const [{ data: emps }, { data: incs }, { data: unitData }] = await Promise.all([
        supabase.from('employees').select('id, name, role').in('role', CLINICAL_ROLES).eq('status', 'Active').order('role'),
        supabase.from('incidents').select('id, name').order('name'),
        supabase.from('units').select('id, name').order('name'),
      ])
      setProviders(emps || [])
      setIncidents(incs || [])
      setUnits(unitData || [])
    }
    load()
  }, [])

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  const hasAssignment = !assignment.loading && !!assignment.unit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.patient_last_name) { setError('Patient last name required'); return }
    if (!form.chief_complaint) { setError('Chief complaint required'); return }
    if (!form.provider_of_record) { setError('Provider of record required'); return }

    setSubmitting(true)
    setError('')

    try {
      const encounterId = `ENC-${Date.now()}`
      const complaint = form.chief_complaint === 'Other' ? form.chief_complaint_other : form.chief_complaint

      const encounterData = {
        id: `local-${encounterId}`,
        created_by: currentUser.employee?.name || null,
        encounter_id: encounterId,
        date: form.date,
        time: form.time,
        unit: form.unit,
        unit_id: form.unit_id || null,
        incident_id: form.incident_id || null,
        crew_resource_number: form.crew_resource_number,
        patient_first_name: form.patient_first_name,
        patient_last_name: form.patient_last_name,
        patient_age: form.patient_age ? Number(form.patient_age) : null,
        patient_age_units: form.patient_age_units,
        patient_gender: form.patient_gender,
        primary_symptom_text: complaint,
        initial_acuity: form.initial_acuity,
        initial_hr: form.initial_hr ? Number(form.initial_hr) : null,
        initial_rr: form.initial_rr ? Number(form.initial_rr) : null,
        initial_spo2: form.initial_spo2 ? Number(form.initial_spo2) : null,
        initial_bp_systolic: form.initial_bp_systolic ? Number(form.initial_bp_systolic) : null,
        initial_bp_diastolic: form.initial_bp_diastolic ? Number(form.initial_bp_diastolic) : null,
        initial_temp_f: form.initial_temp_f ? Number(form.initial_temp_f) : null,
        initial_pain_scale: form.initial_pain_scale ? Number(form.initial_pain_scale) : null,
        initial_blood_glucose: form.initial_blood_glucose ? Number(form.initial_blood_glucose) : null,
        cardiac_rhythm: form.cardiac_rhythm || null,
        pupils: form.pupils || null,
        etco2: form.etco2 ? Number(form.etco2) : null,
        scene_type: form.scene_type || null,
        response_to_treatment: form.response_to_treatment || null,
        notes: [form.assessment, form.treatment, form.notes].filter(Boolean).join('\n\n'),
        provider_of_record: form.provider_of_record,
        patient_disposition: form.patient_disposition,
        pcr_status: 'Draft',
      }

      // Remove local-id before sending to server (it will get a real UUID)
      const { id: _localId, ...serverData } = encounterData
      const result = await offlineWrite('patient_encounters', 'insert', serverData)
      if (!result.success) throw new Error(result.error || 'Save failed')
      navigate(`/encounters?success=1`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  const inputClass = "w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
  const labelClass = "text-xs text-gray-400"
  const sectionClass = "bg-gray-900 rounded-xl p-4 space-y-4"
  const readonlyClass = "w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white text-sm border border-gray-600"

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      <div className="max-w-lg mx-auto p-6 space-y-5">
        <div className="pt-4">
          <h1 className="text-2xl font-bold">Patient Encounter</h1>
          <p className="text-gray-400 text-sm">{form.unit || 'Medical Unit'} · {form.date}</p>
        </div>

        {isOffline && (
          <div className="bg-amber-950/60 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-2">
            📶 <span>You’re offline. This encounter will be saved locally and synced when you reconnect.</span>
          </div>
        )}

        {/* Assignment banner */}
        {!assignment.loading && hasAssignment && (
          <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-300">
            📋 Pre-filled from your assignment: <strong>{assignment.unit?.name}</strong>
            {assignment.incident ? ` · ${assignment.incident.name}` : ''}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Unit & Time */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Unit & Time</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Time</label>
                <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Unit */}
            <div>
              <label className={labelClass}>Unit</label>
              {hasAssignment ? (
                <div className={readonlyClass}>{form.unit}</div>
              ) : (
                <select value={form.unit_id} onChange={e => {
                  const u = units.find(x => x.id === e.target.value)
                  set('unit_id', e.target.value)
                  set('unit', u?.name || '')
                }} className={inputClass}>
                  <option value="">Select unit...</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </div>

            {/* Incident */}
            <div>
              <label className={labelClass}>Incident</label>
              {hasAssignment && assignment.incident ? (
                <div className={readonlyClass}>{assignment.incident.name}</div>
              ) : (
                <select value={form.incident_id} onChange={e => set('incident_id', e.target.value)} className={inputClass}>
                  <option value="">Select incident...</option>
                  {incidents.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className={labelClass}>Crew Resource Number</label>
              <input value={form.crew_resource_number} onChange={e => set('crew_resource_number', e.target.value)}
                placeholder="e.g. 2026-RAM-MSU1-001" className={inputClass} />
            </div>
          </div>

          {/* Patient */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Patient</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First Name</label>
                <input value={form.patient_first_name} onChange={e => set('patient_first_name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input value={form.patient_last_name} onChange={e => set('patient_last_name', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className={labelClass}>Age</label>
                <input type="number" value={form.patient_age} onChange={e => set('patient_age', e.target.value)} className={inputClass} />
              </div>
              <div className="col-span-1">
                <label className={labelClass}>Units</label>
                <select value={form.patient_age_units} onChange={e => set('patient_age_units', e.target.value)} className={inputClass}>
                  <option>Years</option><option>Months</option><option>Days</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className={labelClass}>Gender</label>
                <select value={form.patient_gender} onChange={e => set('patient_gender', e.target.value)} className={inputClass}>
                  <option value="">-</option>
                  <option>Male</option><option>Female</option><option>Other</option><option>Unknown</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chief Complaint & Acuity */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Chief Complaint</h2>
            <div>
              <label className={labelClass}>Chief Complaint *</label>
              <select value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {CHIEF_COMPLAINTS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {form.chief_complaint === 'Other' && (
              <div>
                <label className={labelClass}>Describe</label>
                <input value={form.chief_complaint_other} onChange={e => set('chief_complaint_other', e.target.value)} className={inputClass} />
              </div>
            )}

            {/* Scene Type */}
            <div>
              <label className={labelClass}>Scene Type</label>
              <select value={form.scene_type} onChange={e => set('scene_type', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {SCENE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Acuity</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ACUITY.map(a => (
                  <button key={a.value} type="button" onClick={() => set('initial_acuity', a.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-bold transition-colors text-white ${
                      form.initial_acuity === a.value ? a.selected : a.base
                    }`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Vitals</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'initial_hr', label: 'HR', placeholder: 'bpm' },
                { key: 'initial_rr', label: 'RR', placeholder: '/min' },
                { key: 'initial_spo2', label: 'SpO₂', placeholder: '%' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input type="number" value={(form as Record<string, string>)[key]} onChange={e => set(key, e.target.value)}
                    placeholder={placeholder} className={inputClass} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>BP Systolic</label>
                <input type="number" value={form.initial_bp_systolic} onChange={e => set('initial_bp_systolic', e.target.value)}
                  placeholder="mmHg" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>BP Diastolic</label>
                <input type="number" value={form.initial_bp_diastolic} onChange={e => set('initial_bp_diastolic', e.target.value)}
                  placeholder="mmHg" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Temp (°F)</label>
                <input type="number" step="0.1" value={form.initial_temp_f} onChange={e => set('initial_temp_f', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Pain (0-10)</label>
                <input type="number" min="0" max="10" value={form.initial_pain_scale} onChange={e => set('initial_pain_scale', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>BGL (mg/dL)</label>
                <input type="number" value={form.initial_blood_glucose} onChange={e => set('initial_blood_glucose', e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Additional Vitals */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cardiac Rhythm</label>
                <select value={form.cardiac_rhythm} onChange={e => set('cardiac_rhythm', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {CARDIAC_RHYTHMS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Pupils</label>
                <select value={form.pupils} onChange={e => set('pupils', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {PUPILS_OPTIONS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>EtCO2 (mmHg)</label>
              <input type="number" value={form.etco2} onChange={e => set('etco2', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Assessment & Treatment */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Assessment & Plan</h2>
            <div>
              <label className={labelClass}>Assessment / Findings</label>
              <textarea value={form.assessment} onChange={e => set('assessment', e.target.value)}
                rows={3} placeholder="Physical exam findings, clinical impression..."
                className={inputClass + " resize-none"} />
            </div>
            <div>
              <label className={labelClass}>Treatment Provided</label>
              <textarea value={form.treatment} onChange={e => set('treatment', e.target.value)}
                rows={3} placeholder="Interventions, medications given, wound care..."
                className={inputClass + " resize-none"} />
            </div>
            <div>
              <label className={labelClass}>Response to Treatment</label>
              <textarea value={form.response_to_treatment} onChange={e => set('response_to_treatment', e.target.value)}
                rows={2} placeholder="How did the patient respond to treatment?"
                className={inputClass + " resize-none"} />
            </div>
          </div>

          {/* Disposition */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Disposition</h2>
            <div className="grid grid-cols-1 gap-2">
              {DISPOSITIONS.map(d => (
                <button key={d} type="button" onClick={() => set('patient_disposition', d)}
                  className={`py-2 px-4 rounded-lg text-sm font-medium text-left transition-colors ${
                    form.patient_disposition === d ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Provider */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Provider</h2>
            <div>
              <label className={labelClass}>Provider of Record *</label>
              {hasAssignment && assignment.employee && CLINICAL_ROLES.includes(assignment.employee.role) ? (
                <div className={readonlyClass}>{form.provider_of_record}</div>
              ) : (
                <select value={form.provider_of_record} onChange={e => set('provider_of_record', e.target.value)} className={inputClass}>
                  <option value="">Select provider...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={labelClass}>Additional Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} className={inputClass + " resize-none"} />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors">
            {submitting ? 'Saving...' : 'Save Encounter'}
          </button>

        </form>
      </div>
    </div>
  )
}

export default function SimpleEHRPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <SimpleEHRInner />
    </Suspense>
  )
}
