import { useEffect, useRef, useState, Suspense } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { getIsOnline } from '@/lib/syncManager'
import { queryIncidentName, createEncounter } from '@/lib/services/encounters'
import { loadList } from '@/lib/offlineFirst'
import { queueOfflineWrite } from '@/lib/offlineStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useNEMSISWarnings } from '@/hooks/useNEMSISWarnings'
import type { Employee, FormData } from './pcr-steps/types'
import { Step0IncidentTimes } from './pcr-steps/Step0IncidentTimes'
import { Step1PatientScene } from './pcr-steps/Step1PatientScene'
import { Step2Assessment } from './pcr-steps/Step2Assessment'
import { Step3Vitals } from './pcr-steps/Step3Vitals'
import { Step4Transport } from './pcr-steps/Step4Transport'
import { Step5Provider } from './pcr-steps/Step5Provider'

const CLINICAL_ROLES_PCR = ['MD', 'DO', 'NP', 'PA']

const STEPS = [
  'Incident & Times',
  'Patient Demographics',
  'Assessment',
  'Vitals',
  'Treatment & Transport',
  'Provider & Submit',
]

function PCRFormInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const requestId = useRef(crypto.randomUUID())
  const [searchParams] = useSearchParams()
  const unitParam = searchParams.get('unitName') || searchParams.get('unit') || ''
  const incidentParam = searchParams.get('incidentId') || ''
  const incidentNameParam = searchParams.get('incidentName') || ''
  const crnParam = searchParams.get('crew_resource_number') || ''

  const assignment = useUserAssignment()
  const currentUser = assignment
  const [assignmentApplied, setAssignmentApplied] = useState(false)

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [form, setForm] = useState<FormData>({
    date: todayStr,
    unit: unitParam,
    incident: incidentNameParam || '',
    crew_resource_number: crnParam,
    response_number: '',
    incident_number: '',
    pcr_number: `PCR-${Date.now()}`,
    agency_number: 'USFS',
    type_of_service: 'Standby',
    patient_agency: '',
    transport_capability: 'Ground Transport (ALS Equipped)',
    dispatch_datetime: '',
    en_route_datetime: '',
    arrive_scene_datetime: '',
    patient_contact_datetime: '',
    depart_scene_datetime: '',
    arrive_destination_datetime: '',
    available_datetime: '',
    dispatch_delay: ['None/No Delay'],
    response_delay: ['None/No Delay'],
    scene_delay: ['None/No Delay'],
    transport_delay: ['None/No Delay'],
    turnaround_delay: ['None/No Delay'],
    transport_mode_descriptors: [],
    patient_first_name: '',
    patient_last_name: '',
    dob: '',
    patient_age: '',
    patient_age_units: 'Years',
    patient_gender: '',
    patient_race: '',
    patient_address: '',
    patient_city: '',
    patient_state: 'CA',
    patient_zip: '',
    patient_phone: '',
    scene_address: '',
    scene_city: '',
    scene_county: '',
    scene_state: 'CA',
    scene_zip: '',
    scene_gps: '',
    scene_type: 'Y92.4 — Street/road/highway',
    num_patients_at_scene: '1',
    first_ems_unit_on_scene: 'Yes',
    dispatch_reason: '',
    primary_symptom_text: '',
    primary_impression_text: '',
    secondary_impression: [],
    initial_acuity: '',
    final_acuity: '',
    possible_injury: 'No',
    worker_type: '',
    time_employee_began_work: (() => { const d = new Date(); d.setHours(6,0,0,0); return d.toISOString().slice(0,16); })(),
    other_symptoms: '',
    primary_symptom_snomed: '',
    primary_impression_snomed: '',
    injury_mechanism: '',
    cardiac_rhythm: '',
    cardiac_arrest: 'No',
    arrest_etiology: '',
    resuscitation_attempted: [],
    arrest_witnessed: [],
    aed_prior_to_ems: '',
    cpr_type: [],
    arrest_rhythm: '',
    rosc: '',
    date_time_cardiac_arrest: '',
    reason_cpr_discontinued: '',
    end_of_arrest_event: '',
    who_initiated_cpr: '',
    who_used_aed: '',
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
    initial_skin: 'Normal',
    transport_method: 'No Transport',
    no_transport_reason: 'Patient Evaluated, Released per Protocol',
    destination_type: '',
    destination_name: '',
    destination_address: '',
    hospital_capability: '',
    patient_disposition: 'Patient Evaluated and Care Provided',
    unit_disposition: 'Patient Contact Made',
    patient_evaluation_care: 'Patient Evaluated and Care Provided',
    transport_disposition: 'No Transport',
    crew_disposition: 'Initiated and Continued Primary Care',
    refusal_signed: false,
    advance_directive: [],
    provider_of_record: '',
    notes: '',
  })

  useEffect(() => {
    if (!assignment.loading && !assignmentApplied) {
      setAssignmentApplied(true)
      const updates: Partial<FormData> = {}
      if (assignment.unit && !unitParam) {
        updates.unit = assignment.unit.name
      }
      if (assignment.incident) {
        updates.incident = assignment.incident.name
      } else if (incidentParam && !incidentNameParam) {
        queryIncidentName(incidentParam).then(({ data }) => {
          if (data?.name) setForm(prev => ({ ...prev, incident: data.name }))
        })
      }
      if (assignment.employee && CLINICAL_ROLES_PCR.includes(assignment.employee.role)) {
        updates.provider_of_record = assignment.employee.name
      }
      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }))
      }
    }
  }, [assignment.loading, assignmentApplied, assignment.unit, assignment.incident, assignment.employee, unitParam, incidentParam])

  useEffect(() => {
    const load = async () => {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedEmps = await getCachedData('employees') as any[]
        if (cachedEmps.length > 0) setEmployees(cachedEmps.filter((e: any) => ['MD', 'DO', 'NP', 'PA'].includes(e.role)) as Employee[])
      } catch {}
      const { data } = await loadList<Employee>(
        () => supabase
          .from('employees')
          .select('id, name, role')
          .in('role', ['MD', 'DO', 'NP', 'PA'])
          .eq('status', 'Active')
          .order('role'),
        'employees',
        (all) => all.filter(e => ['MD', 'DO', 'NP', 'PA'].includes(e.role))
      )
      setEmployees(data)
    }
    load()
  }, [])

  const set = (field: keyof FormData, value: string | boolean | string[]) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'dob' && typeof value === 'string' && value) {
        const birth = new Date(value + 'T00:00:00')
        const today = new Date()
        let age = today.getFullYear() - birth.getFullYear()
        const monthDiff = today.getMonth() - birth.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
        if (age < 0) age = 0
        if (age < 2) {
          const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth()
          next.patient_age = String(Math.max(0, months))
          next.patient_age_units = 'Months'
        } else {
          next.patient_age = String(age)
          next.patient_age_units = 'Years'
        }
      }
      return next
    })
  }

  const nemsisWarnings = useNEMSISWarnings({
    ...form,
    patient_dob: form.dob,
    primary_symptom_snomed: form.primary_symptom_text,
    primary_impression_snomed: form.primary_impression_text,
    num_patients_at_scene: undefined,
    symptom_onset_datetime: undefined,
    destination_address: undefined,
  })

  const gcsTotal = () => {
    const e = parseInt(form.initial_gcs_eye) || 0
    const v = parseInt(form.initial_gcs_verbal) || 0
    const m = parseInt(form.initial_gcs_motor) || 0
    return e + v + m || ''
  }

  const handleSubmit = async () => {
    if (!form.dob) { toast.warning('Date of birth is required'); return }
    setSubmitting(true)
    const encounter_id = `ENC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`
    const gcsTotalVal = gcsTotal()

    let resolvedIncidentId: string | null = incidentParam || null
    if (!resolvedIncidentId && assignment.incidentUnit?.incident_id) {
      resolvedIncidentId = assignment.incidentUnit.incident_id
    }
    if (!resolvedIncidentId && form.incident) {
      const { data: incRow } = await supabase
        .from('incidents')
        .select('id')
        .ilike('name', form.incident)
        .single()
      resolvedIncidentId = incRow?.id || null
    }

    const payload = {
      encounter_id,
      pcr_status: 'Draft',
      date: form.date,
      unit: form.unit,
      incident: form.incident,
      incident_id: resolvedIncidentId,
      crew_resource_number: form.crew_resource_number || null,
      response_number: form.response_number || null,
      incident_number: form.incident_number || null,
      pcr_number: form.pcr_number || null,
      available_datetime: form.available_datetime || null,
      first_ems_unit_on_scene: form.first_ems_unit_on_scene || null,
      num_patients_at_scene: form.num_patients_at_scene ? parseInt(form.num_patients_at_scene) : null,
      other_symptoms: form.other_symptoms || null,
      primary_symptom_snomed: form.primary_symptom_snomed || null,
      primary_impression_snomed: form.primary_impression_snomed || null,
      hospital_capability: form.hospital_capability || null,
      destination_address: form.destination_address || null,
      type_of_service: form.type_of_service || null,
      patient_agency: form.patient_agency || null,
      transport_capability: form.transport_capability || null,
      dispatch_datetime: form.dispatch_datetime || null,
      en_route_datetime: form.en_route_datetime || null,
      arrive_scene_datetime: form.arrive_scene_datetime || null,
      patient_contact_datetime: form.patient_contact_datetime || null,
      depart_scene_datetime: form.depart_scene_datetime || null,
      arrive_destination_datetime: form.arrive_destination_datetime || null,
      patient_first_name: form.patient_first_name || null,
      patient_last_name: form.patient_last_name || null,
      dob: form.dob || null,
      patient_age: form.patient_age ? parseInt(form.patient_age) : null,
      patient_age_units: form.patient_age_units || null,
      patient_gender: form.patient_gender || null,
      patient_race: form.patient_race || null,
      patient_address: form.patient_address || null,
      patient_city: form.patient_city || null,
      patient_state: form.patient_state || null,
      patient_zip: form.patient_zip || null,
      patient_phone: form.patient_phone || null,
      scene_address: form.scene_address || null,
      scene_city: form.scene_city || null,
      scene_county: form.scene_county || null,
      scene_state: form.scene_state || null,
      scene_zip: form.scene_zip || null,
      scene_gps: form.scene_gps || null,
      scene_type: form.scene_type || null,
      dispatch_reason: form.dispatch_reason || null,
      primary_symptom_text: form.primary_symptom_text || null,
      primary_impression_text: form.primary_impression_text || null,
      secondary_impression: form.secondary_impression.length > 0 ? form.secondary_impression : null,
      initial_acuity: form.initial_acuity || null,
      final_acuity: form.final_acuity || null,
      possible_injury: form.possible_injury === 'Yes' ? true : form.possible_injury === 'No' ? false : null,
      worker_type: form.worker_type || null,
      time_employee_began_work: form.time_employee_began_work || null,
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
      no_transport_reason: form.no_transport_reason || null,
      destination_type: form.destination_type || null,
      destination_name: form.destination_name || null,
      patient_disposition: form.patient_disposition || null,
      unit_disposition: form.unit_disposition || null,
      patient_evaluation_care: form.patient_evaluation_care || null,
      transport_disposition: form.transport_disposition || null,
      crew_disposition: form.crew_disposition || null,
      refusal_signed: form.refusal_signed,
      advance_directive: form.advance_directive.length > 0 ? form.advance_directive : null,
      dispatch_delay: form.dispatch_delay.length > 0 ? form.dispatch_delay : null,
      response_delay: form.response_delay.length > 0 ? form.response_delay : null,
      scene_delay: form.scene_delay.length > 0 ? form.scene_delay : null,
      transport_delay: form.transport_delay.length > 0 ? form.transport_delay : null,
      turnaround_delay: form.turnaround_delay.length > 0 ? form.turnaround_delay : null,
      transport_mode_descriptors: form.transport_mode_descriptors.length > 0 ? form.transport_mode_descriptors : null,
      provider_of_record: form.provider_of_record || null,
      notes: form.notes || null,
      cardiac_rhythm: form.cardiac_rhythm || null,
      cardiac_arrest: form.cardiac_arrest || null,
      arrest_etiology: form.arrest_etiology || null,
      resuscitation_attempted: form.resuscitation_attempted.length > 0 ? form.resuscitation_attempted : null,
      arrest_witnessed: form.arrest_witnessed.length > 0 ? form.arrest_witnessed : null,
      aed_prior_to_ems: form.aed_prior_to_ems || null,
      cpr_type: form.cpr_type.length > 0 ? form.cpr_type : null,
      arrest_rhythm: form.arrest_rhythm || null,
      rosc: form.rosc || null,
      date_time_cardiac_arrest: form.date_time_cardiac_arrest || null,
      reason_cpr_discontinued: form.reason_cpr_discontinued || null,
      end_of_arrest_event: form.end_of_arrest_event || null,
      who_initiated_cpr: form.who_initiated_cpr || null,
      who_used_aed: form.who_used_aed || null,
    }

    const encounterPayload = {
      ...payload,
      created_by: currentUser.employee?.name || null,
      client_request_id: requestId.current,
    }

    if (getIsOnline()) {
      const { error } = await createEncounter(encounterPayload)
      setSubmitting(false)
      if (!error) {
        navigate('/encounters?success=1')
      } else if (error.code === '23505') {
        console.warn('[PCR] Duplicate client_request_id — already saved:', requestId.current)
        navigate('/encounters?success=1')
      } else {
        toast.error(`Error saving PCR: ${error.message}`)
      }
    } else {
      await queueOfflineWrite('patient_encounters', 'insert', encounterPayload)
      setSubmitting(false)
      navigate('/encounters?success=1&offline=1')
    }
  }

  const stepProps = { form, set, nemsisWarnings }
  const unitLocked = !!(unitParam || (!assignment.loading && assignment.unit))
  const incidentLocked = !!(incidentParam || incidentNameParam || form.incident || (!assignment.loading && assignment.incident))

  const renderStep = () => {
    switch (step) {
      case 0: return <Step0IncidentTimes {...stepProps} unitLocked={unitLocked} incidentLocked={incidentLocked} assignmentUnit={assignment.unit?.name} assignmentIncident={assignment.incident?.name} />
      case 1: return <Step1PatientScene {...stepProps} />
      case 2: return <Step2Assessment {...stepProps} />
      case 3: return <Step3Vitals {...stepProps} />
      case 4: return <Step4Transport {...stepProps} />
      case 5: return <Step5Provider {...stepProps} employees={employees} submitting={submitting} onSubmit={handleSubmit} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">NEMSIS PCR</h1>
            <p className="text-xs text-gray-500">{form.unit || 'Ambulance'} · Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(i)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                i === step
                  ? 'bg-red-600 text-white'
                  : i < step
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
            >
              <span className={`mr-1 ${
                i < step ? 'text-green-400' : i === step ? 'text-white' : 'text-gray-600'
              }`}>{i < step ? '✓' : `${i + 1}.`}</span>
              {s}
            </button>
          ))}
        </div>

        <div className="bg-gray-900 rounded-xl p-4">
          {renderStep()}
        </div>

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              ← Previous
            </button>
          )}
          {step < STEPS.length - 1 && (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PCRPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading PCR form...</p>
      </div>
    }>
      <PCRFormInner />
    </Suspense>
  )
}
