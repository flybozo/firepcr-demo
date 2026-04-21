import type { SelectOption } from '@/components/SearchableSelect'

// ── EncounterEdit options ───────────────────────────────────────────────────

export const INITIAL_ACUITY_OPTIONS = [
  { value: 'Critical (Red)', color: 'bg-red-600 hover:bg-red-500', ring: 'ring-red-400', label: 'Red' },
  { value: 'Emergent (Yellow)', color: 'bg-yellow-500 hover:bg-yellow-400', ring: 'ring-yellow-300', label: 'Yellow' },
  { value: 'Lower Acuity (Green)', color: 'bg-green-600 hover:bg-green-500', ring: 'ring-green-400', label: 'Green' },
  { value: 'Dead without Resuscitation Efforts (Black)', color: 'bg-gray-800 hover:bg-gray-700 border border-gray-600', ring: 'ring-gray-400', label: 'Black' },
  { value: 'Non-Acute/Routine', color: 'bg-blue-700 hover:bg-blue-600', ring: 'ring-blue-400', label: 'Routine' },
]

export const POSSIBLE_INJURY_OPTIONS = ['Yes', 'No', 'Unknown']

export const PATIENT_GENDER_OPTIONS = ['Female', 'Male', 'Unknown']
export const PATIENT_RACE_OPTIONS = [
  'White', 'Black or African American', 'Hispanic or Latino', 'Asian',
  'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander',
  'Middle Eastern or North African',
]

export const SKIN_SIGNS_OPTIONS = ['Normal', 'Pale', 'Flushed/Mottled', 'Cyanotic', 'Jaundiced', 'Diaphoretic/Moist', 'Dry']

export const TRANSPORT_METHOD_OPTIONS = [
  'Ground Transport (ALS Equipped)', 'Ground Transport (BLS Equipped)',
  'Air Transport-Helicopter', 'Air Transport-Fixed Wing', 'No Transport',
]

export const PATIENT_DISPOSITION_OPTIONS = [
  'Patient Evaluated and Care Provided',
  'Patient Evaluated and Refused Care',
  'Patient Evaluated, No Care Required',
  'Patient Refused Evaluation/Care',
  'Patient Support Services Provided',
]

export const CLINICAL_OPTIONS: SelectOption[] = [
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

// ── NewSimpleEncounter options ──────────────────────────────────────────────

export const CHIEF_COMPLAINTS = [
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

export const DISPOSITIONS = [
  'Treated & Released', 'Referred to Higher Level of Care',
  'Transport by Ambulance', 'Refused Treatment', 'No Treatment Required',
  'Evacuated', 'Return to Duty',
]

export const ACUITY = [
  { value: 'Green (Minor)', label: 'Minor', base: 'bg-green-700 hover:bg-green-600', selected: 'bg-green-500 ring-2 ring-green-300' },
  { value: 'Yellow (Delayed)', label: 'Delayed', base: 'bg-yellow-600 hover:bg-yellow-500', selected: 'bg-yellow-400 ring-2 ring-yellow-200' },
  { value: 'Red (Immediate)', label: 'Immediate', base: 'bg-red-700 hover:bg-red-600', selected: 'bg-red-500 ring-2 ring-red-300' },
  { value: 'Black (Expectant)', label: 'Expectant', base: 'bg-gray-700 hover:bg-gray-600 border border-gray-500', selected: 'bg-gray-600 ring-2 ring-gray-400 border border-gray-400' },
]

export const CARDIAC_RHYTHMS = [
  'NSR (Normal Sinus Rhythm)', 'Sinus Tachycardia', 'Sinus Bradycardia',
  'Atrial Fibrillation', 'Atrial Flutter',
  'AV Block-1st Degree', 'AV Block-2nd Degree-Type 1', 'AV Block-2nd Degree-Type 2', 'AV Block-3rd Degree',
  'Left Bundle Branch Block', 'Right Bundle Branch Block', 'Junctional',
  'PEA (Pulseless Electrical Activity)',
  'Ventricular Tachycardia (Perfusing)', 'Ventricular Tachycardia (Pulseless)',
  'Ventricular Fibrillation', 'Asystole', 'Agonal/Idioventricular', 'Pacemaker Rhythm', 'Other',
]

export const PUPILS_OPTIONS = ['Equal and Reactive', 'Unequal', 'Non-Reactive', 'Dilated', 'Constricted']

export const SCENE_TYPES = [
  'Wildland Fire Scene', 'Structure Fire Scene', 'Residence/Home', 'Street/Highway', 'Other',
]

export const CLINICAL_ROLES = ['MD', 'DO', 'NP', 'PA']
