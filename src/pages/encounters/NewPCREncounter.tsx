

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getIsOnline } from '@/lib/syncManager'
import { getCachedData, cacheData, queueOfflineWrite } from '@/lib/offlineStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { SearchableSelect } from '@/components/SearchableSelect'
import { MultiSelect } from '@/components/MultiSelect'
import type { SelectOption } from '@/components/SearchableSelect'
import { useNEMSISWarnings } from '@/hooks/useNEMSISWarnings'
import { NEMSISWarnings, NEMSISQualitySummary, FieldWarning } from '@/components/NEMSISWarnings'

type Employee = {
  id: string
  name: string
  role: string
}

// NEMSIS canonical enums
const TYPE_OF_SERVICE_OPTIONS = [
  'Emergency Response (Primary Response Area)',
  'Emergency Response (Intercept)',
  'Emergency Response (Mutual Aid)',
  'Hospital-to-Hospital Transfer',
  'Hospital to Non-Hospital Facility Transfer',
  'Non-Hospital Facility to Hospital Transfer',
  'Non-Hospital Facility to Non-Hospital Facility Transfer',
  'Non-Emergency Medical Transport (Medically Necessary)',
  'Other Routine Medical Transport',
  'Standby',
  'Support Services',
  'Non-Patient Care Rescue/Extrication',
  'Administrative Operations',
  'Mobile Integrated Health Care Encounter',
]

const TRANSPORT_CAPABILITY_OPTIONS = [
  'Ground Transport (ALS Equipped)',
  'Ground Transport (BLS Equipped)',
  'Ground Transport (Critical Care Equipped)',
  'Non-Transport-Medical Treatment (ALS Equipped)',
  'Non-Transport-Medical Treatment (BLS Equipped)',
  'Non-Transport-No Medical Equipment',
  'Air Transport-Helicopter',
  'Air Transport-Fixed Wing',
]

const DISPATCH_REASON_OPTIONS = [
  'Traumatic Injury',
  'Burns/Explosion',
  'Fire/Burns/Explosion',
  'Heat/Cold Exposure',
  'Hemorrhage/Laceration',
  'Breathing Problem',
  'Cardiac Arrest/Death',
  'Chest Pain/Discomfort',
  'Altered Level of Consciousness',
  'Abdominal Pain/Problems',
  'Back Pain (Non-Traumatic)',
  'Allergic Reaction',
  'Diabetic Problem',
  'Seizure',
  'Stroke/CVA',
  'Headache',
  'Hypertension',
  'Nausea/Vomiting',
  'Drowning/Diving/SCUBA Accident',
  'Carbon Monoxide/Hazmat/Inhalation/CBRN',
  'Industrial Accident/Inaccessible Incident/Other Entrapments (Non-Vehicle)',
  'Transfer/Interfacility/Palliative Care',
  'Standby',
  'Other',
]

const PATIENT_GENDER_OPTIONS = ['Female', 'Male', 'Unknown']

const PATIENT_RACE_OPTIONS = [
  'White', 'Black or African American', 'Hispanic or Latino', 'Asian',
  'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander',
  'Middle Eastern or North African',
]

const INITIAL_ACUITY_OPTIONS = [
  { value: 'Critical (Red)', color: 'bg-red-600 hover:bg-red-500', ring: 'ring-red-400', label: 'Immediate' },
  { value: 'Emergent (Yellow)', color: 'bg-yellow-500 hover:bg-yellow-400', ring: 'ring-yellow-300', label: 'Delayed' },
  { value: 'Lower Acuity (Green)', color: 'bg-green-600 hover:bg-green-500', ring: 'ring-green-400', label: 'Minimal' },
  { value: 'Dead without Resuscitation Efforts (Black)', color: 'bg-gray-800 hover:bg-gray-700 border border-gray-600', ring: 'ring-gray-400', label: 'Expectant' },
  { value: 'Non-Acute/Routine', color: 'bg-blue-700 hover:bg-blue-600', ring: 'ring-blue-400', label: 'Routine' },
]


const WORKER_TYPE_OPTIONS_PCR = [
  'Firefighter','Hotshot Crew Member','Hand Crew Member','Dozer Operator',
  'Air Tanker Pilot','Helicopter Crew','Engine Crew','Lookout','Camp Worker',
  'Overhead/Supervisor','Contractor Employee','Other','Not Applicable'
]

const POSSIBLE_INJURY_OPTIONS = ['Yes', 'No', 'Unknown']

const CARDIAC_ARREST_OPTIONS = [
  'No',
  'Yes, Prior to Any EMS Arrival (includes Transport EMS & Medical First Responders)',
  'Yes, After EMS Arrival',
  'Unknown',
]
const ARREST_ETIOLOGY_OPTIONS = [
  'Cardiac (Presumed)', 'Drowning/Submersion', 'Drug Overdose', 'Electrocution',
  'Exsanguination - Medical', 'Exsanguination - Traumatic', 'Other',
  'Respiratory/Asphyxia', 'Trauma', 'Unknown',
]
const RESUS_ATTEMPTED_OPTIONS = [
  'Attempted Defibrillation', 'Attempted Ventilation', 'Initiated Chest Compressions',
  'Not Attempted - Considered Futile', 'Not Attempted - DNR Orders',
  'Not Attempted - Signs of Obvious Death', 'Cardioversion',
]
const ARREST_WITNESSED_OPTIONS = [
  'Not Witnessed', 'Witnessed by Bystander', 'Witnessed by Family Member',
  'Witnessed by Healthcare Provider',
]
const AED_PRIOR_OPTIONS = [
  'No', 'Yes, Applied with Defibrillation', 'Yes, Applied without Defibrillation',
]
const CPR_TYPE_OPTIONS = [
  'Compressions-Manual',
  'Compressions-External Band-Type Device',
  'Compressions-External Plunger Type Device',
  'Compressions-External Thumper Type Device',
  'Compressions-Intermittent with Ventilation',
  'Compressions-Load-Distributing Band Type Device',
  'Compressions-Other Device',
  'Compressions-Vest Type Device',
  'Ventilation-BVM',
  'Ventilation-CPAP',
  'Ventilation-Impedance Threshold Device',
  'Ventilation-Other Device',
  'Ventilation-Passive Ventilation with Oxygen',
]
const ARREST_RHYTHM_OPTIONS = [
  'Asystole', 'PEA', 'Ventricular Fibrillation', 'Ventricular Tachycardia-Pulseless',
  'Unknown AED Non-Shockable Rhythm', 'Unknown AED Shockable Rhythm',
]
const ROSC_OPTIONS = ['No', 'Yes, With Defibrillation', 'Yes, Without Defibrillation']
const END_ARREST_OPTIONS = [
  'Expired in the Field', 'Ongoing Resuscitation in the Field', 'ROSC in the Field',
  'ROSC in the ED', 'Expired in ED', 'Ongoing Resuscitation in ED',
]
const WHO_CPR_OPTIONS = ['Bystander', 'Family Member', 'Healthcare Provider', 'First Responder (non-EMS)', 'EMS']
const CARDIAC_RHYTHM_OPTIONS = [
  'Normal Sinus Rhythm',
  'Atrial Fibrillation',
  'Atrial Flutter',
  'AV Block-1st Degree',
  'AV Block-2nd Degree-Type 1 (Wenckebach)',
  'AV Block-2nd Degree-Type 2 (Mobitz)',
  'AV Block-3rd Degree (Complete)',
  'Idioventricular',
  'Junctional',
  'Left Bundle Branch Block',
  'Non-STEMI Anterior Ischemia',
  'Non-STEMI Inferior Ischemia',
  'Non-STEMI Lateral Ischemia',
  'Non-STEMI Posterior Ischemia',
  'Non-STEMI Septal Ischemia',
  'Other',
  'Paced Rhythm',
  'PEA',
  'Pre-excitation (WPW)',
  'Right Bundle Branch Block',
  'Sinus Arrhythmia',
  'Sinus Bradycardia',
  'Sinus Tachycardia',
  'STEMI Anterior Ischemia',
  'STEMI Inferior Ischemia',
  'STEMI Lateral Ischemia',
  'STEMI Posterior Ischemia',
  'STEMI Septal Ischemia',
  'Supraventricular Tachycardia',
  'Torsades De Points',
  'Unknown AED Non-Shockable Rhythm',
  'Unknown AED Shockable Rhythm',
  'Ventricular Fibrillation',
  'Ventricular Tachycardia-Perfusing',
  'Ventricular Tachycardia-Pulseless',
  'Agonal/Idioventricular',
  'Asystole',
  'Artifact',
]

const SKIN_SIGNS_OPTIONS = [
  'Normal', 'Pale', 'Flushed/Mottled', 'Cyanotic', 'Jaundiced', 'Diaphoretic/Moist', 'Dry',
]

const TRANSPORT_METHOD_OPTIONS = [
  'Ground-Ambulance',
  'Air Medical-Rotor Craft',
  'Air Medical-Fixed Wing',
  'ATV',
  'Other',
  'No Transport',
]

const NO_TRANSPORT_REASON_OPTIONS = [
  'Against Medical Advice',
  'Patient/Guardian Indicates Ambulance Transport is Not Necessary',
  'Released Following Protocol Guidelines',
  'Released to Law Enforcement',
  'Patient/Guardian States Intent to Transport by Other Means',
  'Medical/Physician Orders for Life Sustaining Treatment',
  'Patient Treated, Released per Protocol',
  'Deceased - Not Transported',
  'Other, Not Listed',
]

const DESTINATION_TYPE_OPTIONS = [
  'Home',
  'Hospital-Emergency Department',
  'Hospital-Non-Emergency Department Bed',
  'Clinic',
  'Morgue/Mortuary',
  'Nursing Home',
  'Assisted Living Facility',
  'Mental Health Facility',
  'Physical Rehabilitation Facility',
  'Drug and/or Alcohol Rehabilitation Facility',
  'Dialysis Center',
  'Diagnostic Services',
  'Other Recurring Care Center',
  'Patient Left at Scene - No Transport',
  'Urgent Care Center',
  'Other',
]

const PATIENT_DISPOSITION_OPTIONS = [
  'Patient Evaluated and Care Provided',
  'Patient Evaluated and Refused Care',
  'Patient Evaluated, No Care Required',
  'Patient Refused Evaluation/Care',
  'Patient Refused Evaluation/Care (AMA)',
  'Patient Support Services Provided',
  'Cancelled Prior to Arrival at Scene',
  'Cancelled (Prior to Arrival At Scene)',
  'No Patient Found',
  'No Patient Contact',
  'Patient Contact Made',
  'Patient Treated, Released (per patient request)',
  'Patient Treated, Released - AMA',
  'Patient Treated, Transported by This EMS Unit',
  'Patient Treated, Transported by Another EMS Unit',
  'Patient Treated, Transferred Care to Another EMS Unit',
]

const ADVANCE_DIRECTIVE_OPTIONS = [
  'None',
  'DNR',
  'Do Not Resuscitate',
  'Living Will',
  'POLST',
  'Power of Attorney',
  'Patient Instructed Comfort Measures Only',
  'Family/Guardian request DNR',
  'Family/Guardian request DNR (but no documentation)',
  'Other Healthcare Advanced Directive Form',
  'Other',
]

const SCENE_TYPE_OPTIONS: { code: string; label: string }[] = [
  // Private Residence
  { code: 'Y92.0', label: 'Private residence' },
  { code: 'Y92.00', label: 'Private Residence/Apartment' },
  { code: 'Y92.02', label: 'Mobile home' },
  { code: 'Y92.03', label: 'Apartment/condo' },
  { code: 'Y92.09', label: 'Other private residence' },
  // Street/Road
  { code: 'Y92.4', label: 'Street/road/highway' },
  { code: 'Y92.41', label: 'Street and Highway' },
  { code: 'Y92.480', label: 'Sidewalk' },
  { code: 'Y92.481', label: 'Parking lot' },
  // Commercial
  { code: 'Y92.5', label: 'Place of business, NOS' },
  { code: 'Y92.51', label: 'Store' },
  { code: 'Y92.511', label: 'Restaurant/cafe' },
  { code: 'Y92.520', label: 'Airport' },
  { code: 'Y92.59', label: 'Warehouse' },
  { code: 'Y92.6', label: 'Industrial/construction area' },
  { code: 'Y92.69', label: 'Industrial or construction area' },
  // Public/Recreational
  { code: 'Y92.2', label: 'Public area, NOS' },
  { code: 'Y92.24', label: 'Public building' },
  { code: 'Y92.3', label: 'Sports area' },
  { code: 'Y92.34', label: 'Pool' },
  { code: 'Y92.39', label: 'Gym/Health club' },
  { code: 'Y92.818', label: 'Wildland/outdoor area' },
  { code: 'Y92.82', label: 'Wilderness Area' },
  { code: 'Y92.830', label: 'Park' },
  { code: 'Y92.832', label: 'Beach/Ocean/Lake/River' },
  { code: 'Y92.838', label: 'Recreational area, NOS' },
  // Healthcare
  { code: 'Y92.23', label: 'Hospital' },
  { code: 'Y92.531', label: "Doctor's office" },
  { code: 'Y92.532', label: 'Urgent care' },
  { code: 'Y92.538', label: 'Other ambulatory care' },
  { code: 'Y92.12', label: 'Nursing home' },
  // School
  { code: 'Y92.21', label: 'School' },
  { code: 'Y92.219', label: 'School/College/University' },
  { code: 'Y92.210', label: 'Daycare' },
  // Other
  { code: 'Y92.7', label: 'Farm/Ranch' },
  { code: 'Y92.85', label: 'Railroad Track' },
  { code: 'Y92.248', label: 'Fire Department' },
  { code: 'Y92.13', label: 'Military installation' },
  { code: 'Y92.8', label: 'Other, NOS' },
  { code: 'Y92.9', label: 'Unknown/unspecified' },
]

type FormData = {
  // Step 1
  date: string
  unit: string
  incident: string
  crew_resource_number: string
  response_number: string
  incident_number: string
  pcr_number: string
  agency_number: string
  type_of_service: string
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
  // Step 2
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
  // Step 3
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
  // eArrest (shown when cardiac arrest)
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
  // Step 4
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
  // Step 5
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
  hospital_capability: string  // pipe-delimited multi-select
  // Step 6
  provider_of_record: string
  notes: string
}

const STEPS = [
  'Incident & Times',
  'Patient Demographics',
  'Assessment',
  'Vitals',
  'Treatment & Transport',
  'Provider & Submit',
]

// Clinical options with ICD-10 codes — used for Primary Symptom, Primary Impression, Secondary Impression
const CLINICAL_OPTIONS: SelectOption[] = [
  // Trauma
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
  // Burns/Environmental
  { group: 'Burns/Environmental', value: 'Burns (general)', label: 'Burns (general)', icd10: 'T30.0' },
  { group: 'Burns/Environmental', value: 'Smoke Inhalation', label: 'Smoke Inhalation', icd10: 'J70.5' },
  { group: 'Burns/Environmental', value: 'Carbon Monoxide Poisoning', label: 'Carbon Monoxide Poisoning', icd10: 'T58.01XA' },
  { group: 'Burns/Environmental', value: 'Heat Exhaustion', label: 'Heat Exhaustion', icd10: 'T67.3XXA' },
  { group: 'Burns/Environmental', value: 'Heat Stroke', label: 'Heat Stroke', icd10: 'T67.01XA' },
  { group: 'Burns/Environmental', value: 'Hypothermia', label: 'Hypothermia', icd10: 'T68.XXXA' },
  { group: 'Burns/Environmental', value: 'Near Drowning / Submersion', label: 'Near Drowning / Submersion', icd10: 'T75.1XXA' },
  { group: 'Burns/Environmental', value: 'Lightning Strike', label: 'Lightning Strike', icd10: 'T75.00XA' },
  { group: 'Burns/Environmental', value: 'Electrical Injury', label: 'Electrical Injury', icd10: 'T75.00XA' },
  // Cardiovascular
  { group: 'Cardiovascular', value: 'Chest Pain', label: 'Chest Pain', icd10: 'R07.9' },
  { group: 'Cardiovascular', value: 'Chest Pain - Cardiac', label: 'Chest Pain - Cardiac', icd10: 'R07.9' },
  { group: 'Cardiovascular', value: 'Cardiac Arrest', label: 'Cardiac Arrest', icd10: 'I46.9' },
  { group: 'Cardiovascular', value: 'Ventricular Fibrillation', label: 'Ventricular Fibrillation', icd10: 'I49.01' },
  { group: 'Cardiovascular', value: 'Acute MI / STEMI', label: 'Acute MI / STEMI', icd10: 'I21.3' },
  { group: 'Cardiovascular', value: 'Atrial Fibrillation', label: 'Atrial Fibrillation', icd10: 'I48.91' },
  { group: 'Cardiovascular', value: 'SVT', label: 'SVT (Supraventricular Tachycardia)', icd10: 'I47.1' },
  { group: 'Cardiovascular', value: 'Bradycardia', label: 'Bradycardia', icd10: 'R00.1' },
  { group: 'Cardiovascular', value: 'Tachycardia', label: 'Tachycardia', icd10: 'R00.0' },
  { group: 'Cardiovascular', value: 'Heart Failure / Pulmonary Edema', label: 'Heart Failure / Pulmonary Edema', icd10: 'I50.9' },
  { group: 'Cardiovascular', value: 'Hypertensive Emergency', label: 'Hypertensive Emergency', icd10: 'I10' },
  { group: 'Cardiovascular', value: 'Hypotension / Shock', label: 'Hypotension / Shock', icd10: 'R57.9' },
  { group: 'Cardiovascular', value: 'Syncope', label: 'Syncope', icd10: 'R55' },
  // Respiratory
  { group: 'Respiratory', value: 'Respiratory Distress', label: 'Respiratory Distress', icd10: 'J96.00' },
  { group: 'Respiratory', value: 'Respiratory Arrest', label: 'Respiratory Arrest', icd10: 'J96.00' },
  { group: 'Respiratory', value: 'Dyspnea / Shortness of Breath', label: 'Dyspnea / Shortness of Breath', icd10: 'R06.00' },
  { group: 'Respiratory', value: 'Asthma Exacerbation', label: 'Asthma Exacerbation', icd10: 'J45.901' },
  { group: 'Respiratory', value: 'COPD Exacerbation', label: 'COPD Exacerbation', icd10: 'J44.1' },
  { group: 'Respiratory', value: 'Airway Obstruction', label: 'Airway Obstruction', icd10: 'T17.908A' },
  // Neurological
  { group: 'Neurological', value: 'Altered Mental Status', label: 'Altered Mental Status', icd10: 'R41.3' },
  { group: 'Neurological', value: 'Unresponsive / Unconscious', label: 'Unresponsive / Unconscious', icd10: 'R55' },
  { group: 'Neurological', value: 'Seizure', label: 'Seizure', icd10: 'G40.909' },
  { group: 'Neurological', value: 'Status Epilepticus', label: 'Status Epilepticus', icd10: 'G40.901' },
  { group: 'Neurological', value: 'Stroke / CVA', label: 'Stroke / CVA', icd10: 'I63.9' },
  { group: 'Neurological', value: 'TIA', label: 'TIA', icd10: 'G45.9' },
  { group: 'Neurological', value: 'Headache', label: 'Headache', icd10: 'R51' },
  { group: 'Neurological', value: 'Dizziness / Vertigo', label: 'Dizziness / Vertigo', icd10: 'R42' },
  // Toxicology
  { group: 'Toxicology', value: 'Drug Overdose (general)', label: 'Drug Overdose (general)', icd10: 'T65.91XA' },
  { group: 'Toxicology', value: 'Opioid Overdose', label: 'Opioid Overdose', icd10: 'T40.0X1A' },
  { group: 'Toxicology', value: 'Alcohol Intoxication', label: 'Alcohol Intoxication', icd10: 'F10.129' },
  { group: 'Toxicology', value: 'Anaphylaxis', label: 'Anaphylaxis', icd10: 'T78.2XXA' },
  { group: 'Toxicology', value: 'Allergic Reaction - Mild', label: 'Allergic Reaction - Mild', icd10: 'T78.40XA' },
  { group: 'Toxicology', value: 'Allergic Reaction - Severe', label: 'Allergic Reaction - Severe', icd10: 'T78.2XXA' },
  { group: 'Toxicology', value: 'Envenomation - Snake', label: 'Envenomation - Snake', icd10: 'T63.001A' },
  { group: 'Toxicology', value: 'Envenomation - Bee/Wasp/Insect', label: 'Envenomation - Bee/Wasp/Insect', icd10: 'T63.441A' },
  // Medical
  { group: 'Medical', value: 'Abdominal Pain', label: 'Abdominal Pain', icd10: 'R10.9' },
  { group: 'Medical', value: 'Nausea and Vomiting', label: 'Nausea and Vomiting', icd10: 'R11.2' },
  { group: 'Medical', value: 'Dehydration', label: 'Dehydration', icd10: 'E86.0' },
  { group: 'Medical', value: 'Hypoglycemia', label: 'Hypoglycemia', icd10: 'E13.64' },
  { group: 'Medical', value: 'Hyperglycemia', label: 'Hyperglycemia', icd10: 'E13.65' },
  { group: 'Medical', value: 'Diabetic Ketoacidosis (DKA)', label: 'Diabetic Ketoacidosis (DKA)', icd10: 'E11.10' },
  { group: 'Medical', value: 'Sepsis', label: 'Sepsis', icd10: 'A41.9' },
  { group: 'Medical', value: 'Fever', label: 'Fever', icd10: 'R50.9' },
  { group: 'Medical', value: 'Back Pain (non-traumatic)', label: 'Back Pain (non-traumatic)', icd10: 'M54.9' },
  { group: 'Medical', value: 'Fatigue / Exhaustion', label: 'Fatigue / Exhaustion', icd10: 'R53.81' },
  { group: 'Medical', value: 'GI Bleeding', label: 'GI Bleeding', icd10: 'K92.1' },
  // Psychiatric
  { group: 'Psychiatric', value: 'Suicidal Ideation', label: 'Suicidal Ideation', icd10: 'R45.851' },
  { group: 'Psychiatric', value: 'Suicide Attempt', label: 'Suicide Attempt', icd10: 'T14.91XA' },
  { group: 'Psychiatric', value: 'Anxiety / Panic Attack', label: 'Anxiety / Panic Attack', icd10: 'F41.0' },
  { group: 'Psychiatric', value: 'Psychosis', label: 'Psychosis', icd10: 'F29' },
  { group: 'Psychiatric', value: 'Violent / Agitated Behavior', label: 'Violent / Agitated Behavior', icd10: 'R45.6' },
  // OB/GYN
  { group: 'OB/GYN', value: 'Labor / Delivery', label: 'Labor / Delivery', icd10: 'O80' },
  { group: 'OB/GYN', value: 'Preeclampsia / Eclampsia', label: 'Preeclampsia / Eclampsia', icd10: 'O14.90' },
  { group: 'OB/GYN', value: 'Vaginal Bleeding', label: 'Vaginal Bleeding', icd10: 'N93.9' },
  // Musculoskeletal
  { group: 'Musculoskeletal', value: 'Joint Pain', label: 'Joint Pain', icd10: 'M25.50' },
  { group: 'Musculoskeletal', value: 'Muscle Cramps', label: 'Muscle Cramps', icd10: 'R25.2' },
  { group: 'Musculoskeletal', value: 'Rhabdomyolysis', label: 'Rhabdomyolysis', icd10: 'M62.82' },
  // Fire Medicine
  { group: 'Fire Medicine', value: 'Wildland Fire Injury (general)', label: 'Wildland Fire Injury (general)', icd10: 'T14.90XA' },
  { group: 'Fire Medicine', value: 'Rope Rescue Injury', label: 'Rope Rescue Injury', icd10: 'T14.90XA' },
  { group: 'Fire Medicine', value: 'Entrapment Injury', label: 'Entrapment Injury', icd10: 'T14.90XA' },
  { group: 'Fire Medicine', value: 'Falls from Height', label: 'Falls from Height', icd10: 'W17.89XA' },
  { group: 'Fire Medicine', value: 'Vehicle Accident (crew transport)', label: 'Vehicle Accident (crew transport)', icd10: 'V89.2XXA' },
  { group: 'Fire Medicine', value: 'Dehydration / Hypovolemia', label: 'Dehydration / Hypovolemia', icd10: 'E86.1' },
  { group: 'Fire Medicine', value: 'Eye Injury / Debris', label: 'Eye Injury / Debris', icd10: 'T15.90XA' },
  // Administrative
  { group: 'Administrative', value: 'No Patient Found', label: 'No Patient Found', icd10: 'Z00.00' },
  { group: 'Administrative', value: 'Patient Refusal', label: 'Patient Refusal', icd10: 'Z53.21' },
  { group: 'Administrative', value: 'Standby - No Patient Contact', label: 'Standby - No Patient Contact', icd10: 'Z02.89' },
  { group: 'Administrative', value: 'Unknown / Unable to Determine', label: 'Unknown', icd10: 'R69' },
  { group: 'Administrative', value: 'Other / Not Listed', label: 'Other / Not Listed', icd10: 'R68.89' },
]

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2'

const CLINICAL_ROLES_PCR = ['MD', 'MD/DO', 'NP', 'PA']


const UNIT_DISPOSITION_OPTIONS = [
  'Patient Contact Made',
  'Cancelled on Scene',
  'Cancelled Prior to Arrival at Scene',
  'No Patient Contact',
  'No Patient Found',
  'Non-Patient Incident (Not Otherwise Listed)',
]

const PATIENT_EVALUATION_CARE_OPTIONS = [
  'Patient Evaluated and Care Provided',
  'Patient Evaluated and Refused Care',
  'Patient Evaluated, No Care Required',
  'Patient Refused Evaluation/Care',
  'Patient Support Services Provided',
]

const TRANSPORT_DISPOSITION_OPTIONS_NEW = [
  'No Transport',
  'Transport by This EMS Unit (This Crew Only)',
  'Transport by This EMS Unit, with a Member of Another Crew',
  'Transport by Another EMS Unit/Agency',
  'Transport by Another EMS Unit/Agency, with a Member of This Crew',
  'Patient Refused Transport',
  'Non-Patient Transport (Not Otherwise Listed)',
]

const CREW_DISPOSITION_OPTIONS = [
  'Initiated and Continued Primary Care',
  'Initiated Primary Care and Transferred to Another EMS Crew',
  'Provided Care Supporting Primary EMS Crew',
  'Assumed Primary Care from Another EMS Crew',
  'Incident Support Services Provided (Including Standby)',
  'Back in Service, No Care/Support Services Required',
  'Back in Service, Care/Support Services Refused',
]

function PCRFormInner() {
  const supabase = createClient()
  const navigate = useNavigate()
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
  const nowStr = now.toTimeString().slice(0, 5)

  const [form, setForm] = useState<FormData>({
    date: todayStr,
    unit: unitParam,
    incident: incidentNameParam || '',  // will be resolved from assignment or DB lookup
    crew_resource_number: crnParam,
    response_number: '',
    incident_number: '',
    pcr_number: `PCR-${Date.now()}`,
    agency_number: 'USFS',
    type_of_service: 'Standby',
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

  // Apply assignment once loaded
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
        // incidentId in URL but no name — fetch it
        supabase.from('incidents').select('name').eq('id', incidentParam).single().then(({ data }) => {
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
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, role')
          .in('role', ['MD', 'MD/DO', 'NP', 'PA'])
          .eq('status', 'Active')
          .order('role')
        if (error) throw error
        setEmployees(data || [])
        if (data) await cacheData('employees', data)
      } catch {
        // Offline — filter providers from cached employees
        const cached = await getCachedData('employees')
        const providers = cached.filter((e: any) => ['MD', 'MD/DO', 'NP', 'PA'].includes(e.role))
        if (providers.length > 0) setEmployees(providers)
      }
    }
    load()
  }, [])

  const set = (field: keyof FormData, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // NEMSIS real-time quality warnings
  // Remap form field names to NEMSIS hook field names
  const nemsisWarnings = useNEMSISWarnings({
    ...form,
    patient_dob: form.dob,
    primary_symptom_snomed: form.primary_symptom_text,
    primary_impression_snomed: form.primary_impression_text,
    num_patients_at_scene: undefined,
    symptom_onset_datetime: undefined,
    destination_address: undefined,
  })

  const handleGetLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6)
        const lon = pos.coords.longitude.toFixed(6)
        set('scene_gps', `${lat}, ${lon}`)
      },
      (err) => alert('Location unavailable: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const gcsTotal = () => {
    const e = parseInt(form.initial_gcs_eye) || 0
    const v = parseInt(form.initial_gcs_verbal) || 0
    const m = parseInt(form.initial_gcs_motor) || 0
    return e + v + m || ''
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const encounter_id = `ENC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`
    const gcsTotalVal = gcsTotal()

    // Resolve incident UUID from name (for proper incident linking)
    let resolvedIncidentId: string | null = incidentParam || null
    // Use assignment incident UUID directly if available
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
      // eArrest fields
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

    if (getIsOnline()) {
      const { error } = await supabase.from('patient_encounters').insert({
        ...payload,
        created_by: currentUser.employee?.name || null,
      })
      setSubmitting(false)
      if (!error) {
        navigate('/encounters?success=1')
      } else {
        alert(`Error saving PCR: ${error.message}`)
      }
    } else {
      // Offline — queue to sync when back online
      await queueOfflineWrite('patient_encounters', 'insert', {
        ...payload,
        created_by: currentUser.employee?.name || null,
      })
      setSubmitting(false)
      navigate('/encounters?success=1&offline=1')
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <NEMSISWarnings section="times" warnings={nemsisWarnings} />
            <p className={sectionCls}>Incident Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date *</label>
                <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Unit</label>
                {(unitParam || (!assignment.loading && assignment.unit)) ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                    <span className="text-sm text-white font-medium">{form.unit || assignment.unit?.name}</span>
                    <span className="text-xs text-gray-500">✓ auto-filled</span>
                  </div>
                ) : (
                  <select className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)}>
                    <option value="">Select unit</option>
                    {['RAMBO 1','RAMBO 2','RAMBO 3','RAMBO 4','The Beast','MSU 1','MSU 2','REMS 1','REMS 2'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls}>Incident</label>
              {(incidentNameParam || form.incident || (!assignment.loading && assignment.incident)) ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                  <span className="text-sm text-white font-medium">{form.incident || assignment.incident?.name}</span>
                  <span className="text-xs text-gray-500">✓ auto-filled</span>
                </div>
              ) : (
                <input type="text" className={inputCls} value={form.incident} onChange={e => set('incident', e.target.value)} placeholder="e.g. Park Fire" />
              )}
            </div>
            <div>
              <label className={labelCls}>Crew Resource Number</label>
              <input type="text" className={inputCls} value={form.crew_resource_number} onChange={e => set('crew_resource_number', e.target.value)} placeholder="e.g. CRN-2024-001" />
            </div>
            <div>
              <label className={labelCls}>Response # (CAD)</label>
              <input type="text" className={inputCls} value={form.response_number} onChange={e => set('response_number', e.target.value)} placeholder="e.g. 2024-001234" />
            </div>
            <div>
              <label className={labelCls}>Incident Number</label>
              <input type="text" className={inputCls} value={form.incident_number} onChange={e => set('incident_number', e.target.value)} placeholder="e.g. INC-2024-001" />
            </div>
            <div>
              <label className={labelCls}>PCR Number</label>
              <input type="text" className={inputCls} value={form.pcr_number} onChange={e => set('pcr_number', e.target.value)} placeholder="Patient care report #" />
            </div>
            <div>
              <label className={labelCls}>Type of Service</label>
              <select className={inputCls} value={form.type_of_service} onChange={e => set('type_of_service', e.target.value)}>
                <option value="">Select</option>
                {TYPE_OF_SERVICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Transport Capability</label>
              <select className={inputCls} value={form.transport_capability} onChange={e => set('transport_capability', e.target.value)}>
                <option value="">Select</option>
                {TRANSPORT_CAPABILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <p className={sectionCls}>Timestamps</p>
            {[
              { field: 'dispatch_datetime', label: 'Dispatch' },
              { field: 'en_route_datetime', label: 'En Route' },
              { field: 'arrive_scene_datetime', label: 'Arrive Scene' },
              { field: 'patient_contact_datetime', label: 'Patient Contact' },
              { field: 'depart_scene_datetime', label: 'Depart Scene' },
              { field: 'arrive_destination_datetime', label: 'Arrive Destination' },
              { field: 'available_datetime', label: 'Back in Service' },
            ].map(({ field, label }) => (
              <div key={field}>
                <label className={labelCls}>{label}</label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form[field as keyof FormData] as string}
                  onChange={e => set(field as keyof FormData, e.target.value)}
                />
              </div>
            ))}

            <p className={sectionCls}>Delays (select all that apply)</p>
            {([
              { field: 'dispatch_delay', label: 'Dispatch Delay', opts: ['None/No Delay','Caller (Uncooperative)','Diversion/Failure (of previous unit)','High Call Volume','Language Barrier','Incomplete Address Information Provided','No EMS Vehicles (Units) Available','Technical Failure (Computer, Phone etc.)','Communication Specialist-Assignment Error','Other'] },
              { field: 'response_delay', label: 'Response Delay', opts: ['None/No Delay','Crowd','Directions/Unable to Locate','Distance','Diversion (Different Incident)','HazMat','Route Obstruction (e.g., Train)','Scene Safety (Not Secure for EMS)','Staff Delay','Traffic','Vehicle Crash Involving this Unit','Vehicle Failure of this Unit','Weather','Other'] },
              { field: 'scene_delay', label: 'Scene Delay', opts: ['None/No Delay','Awaiting Air Unit','Awaiting Ground Unit','Crowd','Directions/Unable to Locate','Distance','Extrication','HazMat','Language Barrier','Patient Access','Safety-Crew/Staging','Safety-Patient','Staff Delay','Traffic','Triage/Multiple Patients','Vehicle Crash Involving this Unit','Weather','Other'] },
              { field: 'transport_delay', label: 'Transport Delay', opts: ['None/No Delay','Crowd','Directions/Unable to Locate','Distance','Diversion','HazMat','Staff Delay','Traffic','Vehicle Crash Involving this Unit','Vehicle Failure of this Unit','Weather','Other'] },
              { field: 'turnaround_delay', label: 'Turnaround Delay', opts: ['None/No Delay','Clean-up','Decontamination','Distance','Documentation','ED Overcrowding / Transfer of Care','Equipment Failure','Mechanical Issue-Unit, Equipment, etc.','Other','Staff Delay','Traffic','Vehicle Failure of this Unit','Weather'] },
            ] as { field: string; label: string; opts: string[] }[]).map(({ field, label, opts }) => (
              <div key={field}>
                <label className={labelCls}>{label}</label>
                <MultiSelect
                  options={opts}
                  value={form[field as keyof FormData] as string[]}
                  onChange={v => set(field as keyof FormData, v)}
                  placeholder="None/No Delay (select if delays occurred)"
                />
              </div>
            ))}
          </div>
        )

      case 1:
        return (
          <div className="space-y-4">
            <NEMSISWarnings section="patient" warnings={nemsisWarnings} />
            <NEMSISWarnings section="scene" warnings={nemsisWarnings} />
            <p className={sectionCls}>Patient Identity</p>
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
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Age</label>
                  <input type="number" className={inputCls} value={form.patient_age} onChange={e => set('patient_age', e.target.value)} min="0" />
                </div>
                <div className="w-24">
                  <label className={labelCls}>Units</label>
                  <select className={inputCls} value={form.patient_age_units} onChange={e => set('patient_age_units', e.target.value)}>
                    <option>Years</option>
                    <option>Months</option>
                    <option>Days</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={form.patient_gender} onChange={e => set('patient_gender', e.target.value)}>
                  <option value="">Select</option>
                  {PATIENT_GENDER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Race</label>
                <select className={inputCls} value={form.patient_race} onChange={e => set('patient_race', e.target.value)}>
                  <option value="">Select</option>
                  {PATIENT_RACE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" className={inputCls} value={form.patient_phone} onChange={e => set('patient_phone', e.target.value)} />
            </div>

            <p className={sectionCls}>Patient Address</p>
            <div>
              <label className={labelCls}>Street Address</label>
              <input type="text" className={inputCls} value={form.patient_address} onChange={e => set('patient_address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input type="text" className={inputCls} value={form.patient_city} onChange={e => set('patient_city', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input type="text" className={inputCls} value={form.patient_state} onChange={e => set('patient_state', e.target.value)} maxLength={2} />
              </div>
            </div>
            <div>
              <label className={labelCls}>ZIP</label>
              <input type="text" className={inputCls} value={form.patient_zip} onChange={e => set('patient_zip', e.target.value)} maxLength={10} />
            </div>

            <p className={sectionCls}>Scene Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First EMS Unit on Scene</label>
                <select className={inputCls} value={form.first_ems_unit_on_scene} onChange={e => set('first_ems_unit_on_scene', e.target.value)}>
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className={labelCls}># Patients at Scene</label>
                <input type="number" min="0" className={inputCls} value={form.num_patients_at_scene} onChange={e => set('num_patients_at_scene', e.target.value)} placeholder="1" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Scene Type (Place of Occurrence ICD-10)</label>
              <select className={inputCls} value={form.scene_type} onChange={e => set('scene_type', e.target.value)}>
                <option value="">Select</option>
                {SCENE_TYPE_OPTIONS.map(o => {
                  const display = `${o.code} — ${o.label}`
                  return <option key={o.code} value={display}>{display}</option>
                })}
              </select>
            </div>
            <div>
              <label className={labelCls}>Scene Address</label>
              <input type="text" className={inputCls} value={form.scene_address} onChange={e => set('scene_address', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input type="text" className={inputCls} value={form.scene_city} onChange={e => set('scene_city', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>County</label>
                <input type="text" className={inputCls} value={form.scene_county} onChange={e => set('scene_county', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>State</label>
                <input type="text" className={inputCls} value={form.scene_state} onChange={e => set('scene_state', e.target.value)} maxLength={2} />
              </div>
              <div>
                <label className={labelCls}>ZIP</label>
                <input type="text" className={inputCls} value={form.scene_zip} onChange={e => set('scene_zip', e.target.value)} maxLength={10} />
              </div>
            </div>
            <div>
              <label className={labelCls}>GPS Coordinates</label>
              <div className="flex gap-2">
                <input type="text" className={inputCls + ' flex-1'} value={form.scene_gps} onChange={e => set('scene_gps', e.target.value)} placeholder="lat, long" />
                <button type="button" onClick={handleGetLocation}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm whitespace-nowrap">
                  📍 GPS
                </button>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <NEMSISWarnings section="situation" warnings={nemsisWarnings} />
            <NEMSISWarnings section="cardiac" warnings={nemsisWarnings} />
            <p className={sectionCls}>Dispatch & Impression</p>
            <div>
              <label className={labelCls}>Dispatch Reason</label>
              <select className={inputCls} value={form.dispatch_reason} onChange={e => set('dispatch_reason', e.target.value)}>
                <option value="">Select</option>
                {DISPATCH_REASON_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Primary Symptom</label>
              <SearchableSelect
                options={CLINICAL_OPTIONS}
                value={form.primary_symptom_text}
                onChange={v => {
                  set('primary_symptom_text', v)
                  const opt = CLINICAL_OPTIONS.find(o => o.value === v)
                  if (opt?.icd10) set('primary_symptom_snomed', opt.icd10)
                }}
                placeholder="Search chief complaint..."
              />
            </div>
            <div>
              <label className={labelCls}>Primary Impression</label>
              <SearchableSelect
                options={CLINICAL_OPTIONS}
                value={form.primary_impression_text}
                onChange={v => {
                  set('primary_impression_text', v)
                  // Also save the ICD-10 code as the SNOMED/ICD field
                  const opt = CLINICAL_OPTIONS.find(o => o.value === v)
                  if (opt?.icd10) set('primary_impression_snomed', opt.icd10)
                }}
                placeholder="Search primary impression..."
              />
            </div>
            <div>
              <label className={labelCls}>Secondary Impression</label>
              <MultiSelect
                options={CLINICAL_OPTIONS.map(o => o.value)}
                value={form.secondary_impression}
                onChange={v => set('secondary_impression', v)}
                placeholder="Search secondary impression (optional)..."
              />
            </div>

            <p className={sectionCls}>Acuity</p>
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
              <label className={labelCls}>Final Acuity</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {INITIAL_ACUITY_OPTIONS.map(({ value, color, ring, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('final_acuity', value)}
                    className={`flex-1 py-2 rounded-lg text-white text-xs font-bold transition-all ${color} ${form.final_acuity === value ? `ring-2 ${ring}` : 'opacity-70'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.final_acuity && <p className="text-xs text-gray-400 mt-1">{form.final_acuity}</p>}
            </div>

            <div>
              <label className={labelCls}>Other Associated Symptoms</label>
              <input type="text" className={inputCls} value={form.other_symptoms} onChange={e => set('other_symptoms', e.target.value)} placeholder="Additional symptoms (if any)" />
            </div>
            <div>
              <label className={labelCls}>Injury Mechanism (if applicable)</label>
              <input type="text" className={inputCls} value={form.injury_mechanism} onChange={e => set('injury_mechanism', e.target.value)} placeholder="e.g. Fall from height, MVC" />
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

            {(form.possible_injury === 'Yes' || form.possible_injury === 'Unknown') && (
              <>
                <div>
                  <label className={labelCls}>Worker Type / Occupation</label>
                  <select className={inputCls} value={form.worker_type} onChange={e => set('worker_type', e.target.value)}>
                    <option value="">Select...</option>
                    {WORKER_TYPE_OPTIONS_PCR.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Time Employee Began Work</label>
                  <input type="datetime-local" className={inputCls} value={form.time_employee_began_work} onChange={e => set('time_employee_began_work', e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Cardiac Rhythm</label>
              <select className={inputCls} value={form.cardiac_rhythm} onChange={e => set('cardiac_rhythm', e.target.value)}>
                <option value="">Select (if applicable)</option>
                {CARDIAC_RHYTHM_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            <p className={sectionCls}>Cardiac Arrest</p>
            <div>
              <label className={labelCls}>Cardiac Arrest</label>
              <select className={inputCls} value={form.cardiac_arrest} onChange={e => set('cardiac_arrest', e.target.value)}>
                {CARDIAC_ARREST_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            {form.cardiac_arrest !== 'No' && (
              <div className="space-y-4 border-l-4 border-red-600 pl-4">
                <p className="text-xs font-bold text-red-400 uppercase tracking-wide">⚠️ Cardiac Arrest — Required Fields</p>

                <div>
                  <label className={labelCls}>Date/Time of Arrest</label>
                  <input type="datetime-local" className={inputCls} value={form.date_time_cardiac_arrest} onChange={e => set('date_time_cardiac_arrest', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Arrest Etiology</label>
                  <select className={inputCls} value={form.arrest_etiology} onChange={e => set('arrest_etiology', e.target.value)}>
                    <option value="">Select</option>
                    {ARREST_ETIOLOGY_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Witnessed By</label>
                  <MultiSelect
                    options={ARREST_WITNESSED_OPTIONS}
                    value={form.arrest_witnessed}
                    onChange={v => set('arrest_witnessed', v)}
                    placeholder="Select all that witnessed..."
                  />
                </div>
                <div>
                  <label className={labelCls}>AED Prior to EMS</label>
                  <select className={inputCls} value={form.aed_prior_to_ems} onChange={e => set('aed_prior_to_ems', e.target.value)}>
                    <option value="">Select</option>
                    {AED_PRIOR_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Resuscitation Attempted</label>
                  <MultiSelect
                    options={RESUS_ATTEMPTED_OPTIONS}
                    value={form.resuscitation_attempted}
                    onChange={v => set('resuscitation_attempted', v)}
                    placeholder="Select all that apply..."
                  />
                </div>
                <div>
                  <label className={labelCls}>CPR Type</label>
                  <MultiSelect
                    options={CPR_TYPE_OPTIONS}
                    value={form.cpr_type}
                    onChange={v => set('cpr_type', v)}
                    placeholder="Select all CPR types provided..."
                  />
                </div>
                <div>
                  <label className={labelCls}>Who Initiated CPR</label>
                  <select className={inputCls} value={form.who_initiated_cpr} onChange={e => set('who_initiated_cpr', e.target.value)}>
                    <option value="">Select</option>
                    {WHO_CPR_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Who Used AED</label>
                  <select className={inputCls} value={form.who_used_aed} onChange={e => set('who_used_aed', e.target.value)}>
                    <option value="">Select</option>
                    {WHO_CPR_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Initial Arrest Rhythm</label>
                  <select className={inputCls} value={form.arrest_rhythm} onChange={e => set('arrest_rhythm', e.target.value)}>
                    <option value="">Select</option>
                    {ARREST_RHYTHM_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>ROSC Achieved</label>
                  <select className={inputCls} value={form.rosc} onChange={e => set('rosc', e.target.value)}>
                    <option value="">Select</option>
                    {ROSC_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>End of Arrest Event</label>
                  <select className={inputCls} value={form.end_of_arrest_event} onChange={e => set('end_of_arrest_event', e.target.value)}>
                    <option value="">Select</option>
                    {END_ARREST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Reason CPR Discontinued</label>
                  <select className={inputCls} value={form.reason_cpr_discontinued} onChange={e => set('reason_cpr_discontinued', e.target.value)}>
                    <option value="">Select (if applicable)</option>
                    <option>DNR</option>
                    <option>Medical Control Order</option>
                    <option>Obvious Signs of Death</option>
                    <option>Physically Unable to Perform</option>
                    <option>Protocol/Policy Requirements Completed</option>
                    <option>Return of Spontaneous Circulation (pulse or BP noted)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )

      case 3: {
        const gcs = gcsTotal()
        return (
          <div className="space-y-4">
            <p className={sectionCls}>Circulatory & Respiratory</p>
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
                <input type="number" className={inputCls} value={form.initial_bp_systolic} onChange={e => set('initial_bp_systolic', e.target.value)} placeholder="Systolic" min="0" max="300" />
                <span className="text-gray-500 font-bold">/</span>
                <input type="number" className={inputCls} value={form.initial_bp_diastolic} onChange={e => set('initial_bp_diastolic', e.target.value)} placeholder="Diastolic" min="0" max="200" />
              </div>
            </div>

            <p className={sectionCls}>Glasgow Coma Scale</p>
            <div className="grid grid-cols-3 gap-3">
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
              <div className="bg-gray-800 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-400">GCS Total</span>
                <span className={`text-2xl font-bold ${Number(gcs) >= 13 ? 'text-green-400' : Number(gcs) >= 9 ? 'text-yellow-400' : 'text-red-400'}`}>{gcs}</span>
              </div>
            ) : null}

            <p className={sectionCls}>Other Vitals</p>
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
                <input type="number" className={inputCls} value={form.initial_temp_f} onChange={e => set('initial_temp_f', e.target.value)} step="0.1" min="80" max="115" />
              </div>
              <div>
                <label className={labelCls}>Skin Signs</label>
                <select className={inputCls} value={form.initial_skin} onChange={e => set('initial_skin', e.target.value)}>
                  <option value="">Select</option>
                  {SKIN_SIGNS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        )
      }

      case 4:
        return (
          <div className="space-y-4">
            <NEMSISWarnings section="disposition" warnings={nemsisWarnings} />
            <p className={sectionCls}>Transport</p>
            <div>
              <label className={labelCls}>Transport Method</label>
              <select className={inputCls} value={form.transport_method} onChange={e => set('transport_method', e.target.value)}>
                <option value="">Select transport method</option>
                {TRANSPORT_METHOD_OPTIONS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Transport Mode Descriptors (Lights/Sirens)</label>
              <MultiSelect
                options={['Lights and Sirens','Lights and No Sirens','No Lights or Sirens','Initial No Lights or Sirens, Upgraded to Lights and Sirens','Initial Lights and Sirens, Downgraded to No Lights or Sirens','Speed-Enhanced per Local Policy','Speed-Normal Traffic']}
                value={form.transport_mode_descriptors}
                onChange={v => set('transport_mode_descriptors', v)}
                placeholder="Select all that apply..."
              />
            </div>

            {form.transport_method === 'No Transport' && (
              <div>
                <label className={labelCls}>No Transport Reason</label>
                <select className={inputCls} value={form.no_transport_reason} onChange={e => set('no_transport_reason', e.target.value)}>
                  <option value="">Select reason</option>
                  {NO_TRANSPORT_REASON_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}

            {form.transport_method !== 'No Transport' && form.transport_method && (
              <>
                <div>
                  <label className={labelCls}>Type of Destination</label>
                  <select className={inputCls} value={form.destination_type} onChange={e => set('destination_type', e.target.value)}>
                    <option value="">Select</option>
                    {DESTINATION_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Destination Name / Hospital</label>
                  <input type="text" className={inputCls} value={form.destination_name} onChange={e => set('destination_name', e.target.value)} placeholder="e.g. Mercy Medical Center" />
                </div>
                <div>
                  <label className={labelCls}>Destination Address</label>
                  <input type="text" className={inputCls} value={form.destination_address} onChange={e => set('destination_address', e.target.value)} placeholder="Street address" />
                </div>
                <div>
                  <label className={labelCls}>Hospital Capability (select all that apply)</label>
                  <div className="bg-gray-800 rounded-lg p-3 grid grid-cols-1 gap-1 border border-gray-700 max-h-48 overflow-y-auto">
                    {["Hospital (General)","Behavioral Health","Burn Center","Critical Access Hospital","Neonatal Center","Pediatric Center","Rehab Center","Trauma Center Level 1","Trauma Center Level 2","Trauma Center Level 3","Trauma Center Level 4","Trauma Center Level 5","Cardiac-STEMI/PCI Capable","Cardiac-STEMI/PCI Capable (24/7)","Cardiac-STEMI/Non-PCI Capable","Stroke-Acute Stroke Ready Hospital (ASRH)","Stroke-Primary Stroke Center (PSC)","Stroke-Thrombectomy-Capable Stroke Center (TSC)","Stroke-Comprehensive Stroke Center (CSC)","Cancer Center","Labor and Delivery","None / Not Applicable"].map(o => {
                      const selected = form.hospital_capability ? form.hospital_capability.split(' | ').includes(o) : false
                      return (
                        <label key={o} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-700 text-sm">
                          <input type="checkbox" checked={selected} onChange={e => {
                            const parts = form.hospital_capability ? form.hospital_capability.split(' | ').filter(Boolean) : []
                            const next = e.target.checked ? [...parts, o] : parts.filter(p => p !== o)
                            set('hospital_capability', next.join(' | '))
                          }} className="rounded" />
                          <span className="text-gray-200">{o}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            <p className={sectionCls}>Disposition</p>
            <div>
              <label className={labelCls}>Unit Disposition (eDisp.27)</label>
              <select className={inputCls} value={form.unit_disposition} onChange={e => set('unit_disposition', e.target.value)}>
                <option value="">Select</option>
                {UNIT_DISPOSITION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Patient Evaluation / Care (eDisp.28)</label>
              <select className={inputCls} value={form.patient_evaluation_care} onChange={e => set('patient_evaluation_care', e.target.value)}>
                <option value="">Select</option>
                {PATIENT_EVALUATION_CARE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Transport Disposition (eDisp.30)</label>
              <select className={inputCls} value={form.transport_disposition} onChange={e => set('transport_disposition', e.target.value)}>
                <option value="">Select</option>
                {TRANSPORT_DISPOSITION_OPTIONS_NEW.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Crew Disposition (eDisp.29)</label>
              <select className={inputCls} value={form.crew_disposition} onChange={e => set('crew_disposition', e.target.value)}>
                <option value="">Select</option>
                {CREW_DISPOSITION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <p className={sectionCls}>Documentation</p>
            {/* Refusal Signed — only available after an AMA form is created.
                For new PCRs, offer a quick AMA entry that links to this encounter. */}
            <div className="bg-gray-800 rounded-lg px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Refusal / AMA Form</p>
                  <p className="text-xs text-gray-400">
                    {form.refusal_signed
                      ? '✅ AMA form obtained and linked'
                      : 'AMA forms are created from the encounter detail page after saving'}
                  </p>
                </div>
                {form.refusal_signed && (
                  <button
                    type="button"
                    onClick={() => set('refusal_signed', false)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {!form.refusal_signed && (
                <div className="bg-gray-700/50 rounded-lg px-3 py-2 border border-gray-600">
                  <p className="text-xs text-amber-300">
                    ⚠️ To attach an AMA/refusal form: save this PCR first, then use the{' '}
                    <strong>Chart Actions → AMA / Refusal</strong> button on the encounter detail page.
                    The refusal_signed flag will auto-update when a signed form is linked.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Advance Directive</label>
              <MultiSelect
                options={ADVANCE_DIRECTIVE_OPTIONS}
                value={form.advance_directive}
                onChange={v => set('advance_directive', v)}
                placeholder='Select all that apply...'
              />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <p className={sectionCls}>Provider</p>
            <div>
              <label className={labelCls}>Provider of Record *</label>
              <select className={inputCls} value={form.provider_of_record} onChange={e => set('provider_of_record', e.target.value)}>
                <option value="">Select provider</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
                ))}
              </select>
            </div>

            <p className={sectionCls}>Narrative</p>
            <div>
              <label className={labelCls}>Notes / Narrative</label>
              <textarea
                className={`${inputCls} h-40 resize-none`}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Patient narrative, interventions, response to treatment..."
              />
            </div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm text-gray-400">
              <p className="text-white font-semibold text-sm">Review Summary</p>
              <p>Unit: <span className="text-white">{form.unit || '—'}</span></p>
              <p>Patient: <span className="text-white">{form.patient_first_name || '—'} {form.patient_last_name}</span></p>
              <p>Date: <span className="text-white">{form.date || '—'}</span></p>
              <p>Acuity: <span className="text-white">{form.initial_acuity || '—'} → {form.final_acuity || '—'}</span></p>
              <p>Transport: <span className="text-white">{form.transport_method || '—'}</span></p>
              <p>Status: <span className="text-yellow-400">Draft</span></p>
            </div>

            <NEMSISQualitySummary warnings={nemsisWarnings} />

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !form.unit || !form.date}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
            >
              {submitting ? 'Saving PCR...' : '💾 Save PCR (Draft)'}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">NEMSIS PCR</h1>
            <p className="text-xs text-gray-500">{form.unit || 'Ambulance'} · Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>

        {/* Step tabs */}
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

        {/* Step content */}
        <div className="bg-gray-900 rounded-xl p-4">
          {renderStep()}
        </div>

        {/* Navigation */}
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
