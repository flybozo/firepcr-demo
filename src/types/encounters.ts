export type ConsentForm = {
  id: string
  consent_id: string
  consent_type: string
  date_time: string
  patient_first_name: string | null
  patient_last_name: string | null
  provider_of_record: string | null
  signed: boolean | null
  pdf_url: string | null
}

export type CompClaim = {
  id: string
  encounter_id: string | null
  patient_name: string | null
  date_of_injury: string | null
  status: string | null
  pdf_url: string | null
  created_at: string | null
  provider_name: string | null
}

export type PatientPhoto = {
  id: string
  encounter_id: string
  photo_url: string
  caption: string | null
  taken_at: string
}

export type EncounterProcedure = {
  id: string
  encounter_id: string
  procedure_name: string
  performed_at: string
  performed_by: string | null
  body_site: string | null
  outcome: string
  complications: string | null
  notes: string | null
}

export type Encounter = {
  id: string
  encounter_id: string
  created_at?: string | null
  created_by?: string | null
  created_by_employee_id?: string | null
  date: string
  time?: string | null
  unit: string
  incident_id: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  patient_dob: string | null
  patient_age: number | null
  patient_gender: string | null
  patient_agency: string | null
  // Vitals — actual DB column names (initial_*)
  initial_hr: number | null
  initial_rr: number | null
  initial_spo2: number | null
  initial_bp_systolic: number | null
  initial_bp_diastolic: number | null
  initial_temp_f: number | null
  initial_gcs_total: number | null
  initial_gcs_eye: number | null
  initial_gcs_verbal: number | null
  initial_gcs_motor: number | null
  initial_pain_scale: number | null
  initial_blood_glucose: number | null
  initial_skin: string | null
  cardiac_rhythm: string | null
  pupils: string | null
  etco2: number | null
  // Legacy aliases (may exist on old records)
  heart_rate: number | null
  respiratory_rate: number | null
  spo2: number | null
  blood_pressure_systolic: number | null
  blood_pressure_diastolic: number | null
  temperature: number | null
  gcs: number | null
  pain_scale: number | null
  blood_glucose: number | null
  skin_condition: string | null
  // Assessment
  primary_symptom_text: string | null
  primary_impression: string | null
  secondary_impression: string | null
  initial_acuity: string | null
  possible_injury: boolean | null
  // Transport
  transport_disposition: string | null
  transport_method: string | null
  transport_destination: string | null
  patient_disposition: string | null
  refusal_signed: boolean | null
  // Provider
  provider_of_record: string | null
  pcr_notes: string | null
  pcr_status: string | null
  notes: string | null
  crew_resource_number: string | null
  pcr_number: string | null
  final_acuity: string | null
  dispatch_reason: string | null
  scene_type: string | null
  destination_type: string | null
  destination_name: string | null
  advance_directive: string | null
  signed_at: string | null
  signed_by: string | null
  // Response & Times
  type_of_service: string | null
  transport_capability: string | null
  response_number: string | null
  incident_number: string | null
  agency_number: string | null
  patient_occupational_industry: string | null
  patient_occupation: string | null
  time_employee_began_work: string | null
  dispatch_datetime: string | null
  en_route_datetime: string | null
  arrive_scene_datetime: string | null
  patient_contact_datetime: string | null
  depart_scene_datetime: string | null
  arrive_destination_datetime: string | null
  available_datetime: string | null
  // Scene
  scene_address: string | null
  scene_city: string | null
  scene_county: string | null
  scene_state: string | null
  scene_zip: string | null
  scene_gps: string | null
  num_patients_at_scene: number | null
  first_ems_unit_on_scene: string | null
  // Situation
  primary_impression_snomed: string | null
  primary_impression_text: string | null
  primary_symptom_snomed: string | null
  symptom_onset_datetime: string | null
  // Transport expanded
  destination_address: string | null
  no_transport_reason: string | null
  hospital_capability: string | null
  // Cardiac arrest
  cardiac_arrest: string | null
  arrest_etiology: string | null
  resuscitation_attempted: string | null
  arrest_witnessed: string | null
  arrest_rhythm: string | null
  rosc: string | null
  who_initiated_cpr: string | null
  aed_prior_to_ems: string | null
  cpr_type: string | null
  date_time_cardiac_arrest: string | null
  end_of_arrest_event: string | null
}

export type EncounterVitals = {
  id: string
  encounter_id: string
  recorded_at: string
  recorded_by: string | null
  hr: number | null
  rr: number | null
  spo2: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  gcs_eye: number | null
  gcs_verbal: number | null
  gcs_motor: number | null
  gcs_total: number | null
  pain_scale: number | null
  blood_glucose: number | null
  temp_f: number | null
  skin: string | null
  cardiac_rhythm: string | null
  etco2: number | null
  pupils: string | null
  notes: string | null
}

export type VitalsColumn = {
  label: string
  hr: number | null
  rr: number | null
  spo2: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  gcs: number | null
  pain_scale: number | null
  temp_f: number | null
  blood_glucose: number | null
  cardiac_rhythm: string | null
  skin: string | null
  etco2: number | null
  pupils: string | null
}

export type VitalsFormState = {
  recorded_at: string
  recorded_by: string
  hr: string
  rr: string
  spo2: string
  bp_systolic: string
  bp_diastolic: string
  gcs_eye: string
  gcs_verbal: string
  gcs_motor: string
  gcs_total: string
  pain_scale: string
  blood_glucose: string
  temp_f: string
  skin: string
  cardiac_rhythm: string
  etco2: string
  pupils: string
  notes: string
}
