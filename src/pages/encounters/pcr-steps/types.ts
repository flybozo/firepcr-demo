export type Employee = {
  id: string
  name: string
  role: string
}

export type FormData = {
  // Step 0
  date: string
  unit: string
  incident: string
  crew_resource_number: string
  response_number: string
  incident_number: string
  pcr_number: string
  agency_number: string
  type_of_service: string
  patient_agency: string
  transport_capability: string
  dispatch_datetime: string
  en_route_datetime: string
  arrive_scene_datetime: string
  patient_contact_datetime: string
  depart_scene_datetime: string
  arrive_destination_datetime: string
  available_datetime: string
  dispatch_delay: string[]
  response_delay: string[]
  scene_delay: string[]
  transport_delay: string[]
  turnaround_delay: string[]
  transport_mode_descriptors: string[]
  // Step 1
  patient_first_name: string
  patient_last_name: string
  dob: string
  patient_age: string
  patient_age_units: string
  patient_gender: string
  patient_race: string
  patient_address: string
  patient_city: string
  patient_state: string
  patient_zip: string
  patient_phone: string
  scene_address: string
  scene_city: string
  scene_county: string
  scene_state: string
  scene_zip: string
  scene_gps: string
  scene_type: string
  num_patients_at_scene: string
  first_ems_unit_on_scene: string
  // Step 2
  dispatch_reason: string
  primary_symptom_text: string
  primary_impression_text: string
  secondary_impression: string[]
  initial_acuity: string
  final_acuity: string
  possible_injury: string
  worker_type: string
  time_employee_began_work: string
  cardiac_rhythm: string
  other_symptoms: string
  primary_symptom_snomed: string
  primary_impression_snomed: string
  injury_mechanism: string
  // eArrest
  cardiac_arrest: string
  arrest_etiology: string
  resuscitation_attempted: string[]
  arrest_witnessed: string[]
  aed_prior_to_ems: string
  cpr_type: string[]
  arrest_rhythm: string
  rosc: string
  date_time_cardiac_arrest: string
  reason_cpr_discontinued: string
  end_of_arrest_event: string
  who_initiated_cpr: string
  who_used_aed: string
  // Step 3
  initial_hr: string
  initial_rr: string
  initial_spo2: string
  initial_bp_systolic: string
  initial_bp_diastolic: string
  initial_gcs_eye: string
  initial_gcs_verbal: string
  initial_gcs_motor: string
  initial_pain_scale: string
  initial_blood_glucose: string
  initial_temp_f: string
  initial_skin: string
  // Step 4
  transport_method: string
  no_transport_reason: string
  destination_type: string
  destination_name: string
  patient_disposition: string
  unit_disposition: string
  patient_evaluation_care: string
  transport_disposition: string
  crew_disposition: string
  refusal_signed: boolean
  advance_directive: string[]
  destination_address: string
  hospital_capability: string
  // Step 5
  provider_of_record: string
  notes: string
}

export type SetFn = (field: keyof FormData, value: string | boolean | string[]) => void

import type { NEMSISWarning } from '@/hooks/useNEMSISWarnings'

export interface StepProps {
  form: FormData
  set: SetFn
  nemsisWarnings: NEMSISWarning[]
}

export const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
export const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
export const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2'
