
export type Employee = { id: string; name: string; role: string }

export type EncounterOption = {
  id: string; encounter_id: string
  patient_first_name: string|null; patient_last_name: string|null
  primary_symptom_text: string|null; date: string|null
  unit: string|null; provider_of_record: string|null
}

export type PickerEncounterItem = {
  id: string; encounter_id: string
  patient_first_name: string|null; patient_last_name: string|null
  patient_dob: string|null; primary_symptom_text: string|null
  date: string|null; unit: string|null; provider_of_record: string|null
  incident_id: string|null
}

export type CompClaimForm = {
  date_of_injury: string
  time_of_event: string
  incident: string
  unit: string
  patient_name: string
  employee_agency: string
  employee_crew_assignment: string
  employee_supervisor_name: string
  employee_supervisor_phone: string
  mechanism_of_injury: string
  body_part_affected: string
  activity_prior_to_event: string
  what_harmed_employee: string
  clinical_impression: string
  treatment_summary: string
  physician_of_record: string
  lost_time_expected: boolean | null
  transported_to_hospital: boolean | null
  hospital_name: string
  facility_city: string
  facility_state: string
  hospitalized_overnight: boolean | null
  witness_name: string
  witness_contact: string
  claims_coordinator_name: string
  claims_coordinator_phone: string
  claims_coordinator_email: string
  employer_name: string
  employer_address: string
  notes: string
  provider_name: string
  patient_dob: string
  time_employee_began_work: string
}

export const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
export const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
export const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-2 mb-2 border-b border-gray-800 pb-1'

export const MECHANISM_OPTIONS = [
  'Fall', 'Motor Vehicle', 'Struck By Object', 'Overexertion',
  'Burn', 'Chemical Exposure', 'Animal/Insect', 'Equipment', 'Other',
]

export const BODY_PART_OPTIONS = [
  'Head', 'Neck', 'Back', 'Shoulder', 'Arm', 'Hand',
  'Hip', 'Leg', 'Foot', 'Multiple', 'Other',
]

export const CLINICAL_OPTIONS_COMP = [
  'Traumatic Injury (general)', 'Head Injury', 'Traumatic Brain Injury', 'Laceration', 'Abrasion',
  'Fracture (general)', 'Sprain / Strain', 'Dislocation', 'Burns (general)', 'Smoke Inhalation',
  'Heat Exhaustion', 'Heat Stroke', 'Chest Pain', 'Cardiac Arrest', 'Respiratory Distress',
  'Dyspnea / Shortness of Breath', 'Altered Mental Status', 'Seizure', 'Stroke / CVA',
  'Hypoglycemia', 'Allergic Reaction - Mild', 'Anaphylaxis', 'Drug Overdose (general)',
  'Back Injury', 'Abdominal Trauma', 'Eye Injury / Debris', 'Musculoskeletal Pain',
  'Dehydration', 'Fatigue / Exhaustion', 'Rhabdomyolysis', 'Envenomation - Snake',
  'Envenomation - Bee/Wasp/Insect', 'Falls from Height', 'Rope Rescue Injury',
  'Vehicle Accident (crew transport)', 'No Patient Found', 'Patient Refusal', 'Other / Not Listed',
]
