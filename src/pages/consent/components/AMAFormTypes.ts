export type PickerEncounter = {
  id: string
  encounter_id: string
  patient_first_name: string | null
  patient_last_name: string | null
  patient_dob: string | null
  primary_symptom_text: string | null
  date: string | null
  unit: string | null
  provider_of_record: string | null
  incident_id: string | null
}

export type FormState = {
  patient_first_name: string
  patient_last_name: string
  dob: string
  unit: string
  incident: string
  provider_of_record: string
}

export type ConsentData = {
  patient_name: string
  patient_dob: string
  unit: string
  incident: string
  provider_name: string
  form_date: string
  form_time: string
  patient_signature_url?: string | null
  provider_signature_url?: string | null
}
