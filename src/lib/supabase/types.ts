export type Role = 'MD/DO' | 'NP' | 'PA' | 'RN' | 'Paramedic' | 'EMT' | 'Tech'

export type Employee = {
  id: string
  name: string
  role: Role
  email: string
  phone: string | null
  date_of_birth: string | null
  home_address: string | null
  emergency_contact: string | null
  medical_license: string | null
  npi: string | null
  bls: string | null
  acls: string | null
  itls: string | null
  pals: string | null
  paramedic_license: string | null
  ssv_accreditation: string | null
  ambulance_driver_cert: string | null
  s130: string | null
  s190: string | null
  l180: string | null
  ics100: string | null
  ics200: string | null
  ics700: string | null
  ics800: string | null
  status: string
  rems: boolean
  additional_certs: string | null
  wf_email: string | null
  created_at: string
  updated_at: string
}

export type PatientEncounter = {
  id: string
  encounter_id: string
  date: string | null
  time: string | null
  unit: string | null
  incident: string | null
  crew_resource_number: string | null
  pcr_number: string | null
  pcr_status: string | null
  patient_last_name: string | null
  patient_first_name: string | null
  patient_age: number | null
  patient_age_units: string | null
  patient_gender: string | null
  provider_of_record: string | null
  refusal_signed: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type ConsentForm = {
  id: string
  consent_id: string
  encounter_id: string | null
  consent_type: string
  date_time: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  dob: string | null
  unit: string | null
  incident: string | null
  provider_of_record: string | null
  patient_signature_url: string | null
  provider_signature_url: string | null
  signed: boolean
  pdf_url: string | null
  created_at: string
}

export type DispenseLog = {
  id: string
  date: string | null
  time: string | null
  med_unit: string | null
  item_name: string | null
  lot_number: string | null
  qty_used: number | null
  qty_wasted: number | null
  patient_name: string | null
  indication: string | null
  dispensed_by: string | null
  prescribing_provider: string | null
  encounter_id: string | null
  created_at: string
}
