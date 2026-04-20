export const CARDIAC_RHYTHMS = [
  'NSR (Normal Sinus Rhythm)', 'Sinus Tachycardia', 'Sinus Bradycardia',
  'Atrial Fibrillation', 'Atrial Flutter',
  'AV Block-1st Degree', 'AV Block-2nd Degree-Type 1', 'AV Block-2nd Degree-Type 2', 'AV Block-3rd Degree',
  'Left Bundle Branch Block', 'Right Bundle Branch Block', 'Junctional',
  'PEA (Pulseless Electrical Activity)',
  'Ventricular Tachycardia (Perfusing)', 'Ventricular Tachycardia (Pulseless)',
  'Ventricular Fibrillation', 'Asystole', 'Agonal/Idioventricular', 'Pacemaker Rhythm', 'Other',
]

export const SKIN_SIGNS = ['Normal', 'Pale', 'Flushed/Mottled', 'Cyanotic', 'Diaphoretic', 'Dry']
export const PUPILS_OPTIONS = ['Equal and Reactive', 'Unequal', 'Non-Reactive', 'Dilated', 'Constricted']

export const TYPE_OF_SERVICE_OPTIONS = [
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

export const SCENE_TYPE_LABELS = [
  'Private residence', 'Apartment/condo', 'Mobile home', 'Other private residence',
  'Street/road/highway', 'Parking lot', 'Sidewalk',
  'Place of business, NOS', 'Store', 'Restaurant/cafe', 'Airport', 'Warehouse',
  'Industrial/construction area',
  'Public area, NOS', 'Public building', 'Sports area', 'Pool', 'Gym/Health club',
  'Wildland/outdoor area', 'Wilderness Area', 'Park', 'Beach/Ocean/Lake/River', 'Recreational area, NOS',
  'Hospital', "Doctor's office", 'Urgent care', 'Other ambulatory care', 'Nursing home',
  'School', 'School/College/University', 'Daycare',
  'Farm/Ranch', 'Railroad Track', 'Fire Department', 'Military installation',
  'Other, NOS', 'Unknown/unspecified',
]

export const FIRST_EMS_OPTIONS = ['Yes', 'No', 'Unknown']

export const ACUITY_OPTIONS = [
  'Critical (Red)', 'Emergent (Yellow)', 'Lower Acuity (Green)',
  'Dead without Resuscitation Efforts (Black)', 'Non-Acute/Routine',
]

export const POSSIBLE_INJURY_OPTIONS = ['Yes', 'No', 'Unknown']

export const CARDIAC_ARREST_OPTIONS = [
  'No',
  'Yes, Prior to Any EMS Arrival (includes Transport EMS & Medical First Responders)',
  'Yes, After EMS Arrival',
  'Unknown',
]

export const ARREST_ETIOLOGY_OPTIONS = [
  'Cardiac (Presumed)', 'Drowning/Submersion', 'Drug Overdose', 'Electrocution',
  'Exsanguination - Medical', 'Exsanguination - Traumatic', 'Other',
  'Respiratory/Asphyxia', 'Trauma', 'Unknown',
]

export const ROSC_OPTIONS_LIST = ['No', 'Yes, With Defibrillation', 'Yes, Without Defibrillation']

export const PATIENT_DISPOSITION_OPTIONS = [
  'Patient Evaluated and Care Provided',
  'Patient Evaluated and Refused Care',
  'Patient Evaluated, No Care Required',
  'Patient Refused Evaluation/Care',
  'Patient Refused Evaluation/Care (AMA)',
  'Patient Support Services Provided',
  'Cancelled Prior to Arrival at Scene',
  'No Patient Found',
  'No Patient Contact',
  'Patient Contact Made',
  'Patient Treated, Released (per patient request)',
  'Patient Treated, Released - AMA',
  'Patient Treated, Transported by This EMS Unit',
  'Patient Treated, Transported by Another EMS Unit',
  'Patient Treated, Transferred Care to Another EMS Unit',
]

export const TRANSPORT_METHOD_OPTIONS = [
  'Ground-Ambulance', 'Air Medical-Rotor Craft', 'Air Medical-Fixed Wing', 'ATV', 'Other', 'No Transport',
]

export const DESTINATION_TYPE_OPTIONS = [
  'Home', 'Hospital-Emergency Department', 'Hospital-Non-Emergency Department Bed',
  'Clinic', 'Morgue/Mortuary', 'Nursing Home', 'Assisted Living Facility',
  'Mental Health Facility', 'Physical Rehabilitation Facility',
  'Drug and/or Alcohol Rehabilitation Facility', 'Dialysis Center',
  'Diagnostic Services', 'Other Recurring Care Center',
  'Patient Left at Scene - No Transport', 'Urgent Care Center', 'Other',
]

export const ADVANCE_DIRECTIVE_OPTIONS = [
  'None', 'DNR', 'Do Not Resuscitate', 'Living Will', 'POLST', 'Power of Attorney',
  'Patient Instructed Comfort Measures Only', 'Family/Guardian request DNR',
  'Family/Guardian request DNR (but no documentation)',
  'Other Healthcare Advanced Directive Form', 'Other',
]

export const DISPATCH_REASON_OPTIONS = [
  'Traumatic Injury', 'Burns/Explosion', 'Fire/Burns/Explosion', 'Heat/Cold Exposure',
  'Hemorrhage/Laceration', 'Breathing Problem', 'Cardiac Arrest/Death',
  'Chest Pain/Discomfort', 'Altered Level of Consciousness', 'Abdominal Pain/Problems',
  'Back Pain (Non-Traumatic)', 'Allergic Reaction', 'Diabetic Problem', 'Seizure',
  'Stroke/CVA', 'Headache', 'Hypertension', 'Nausea/Vomiting',
  'Drowning/Diving/SCUBA Accident', 'Carbon Monoxide/Hazmat/Inhalation/CBRN',
  'Industrial Accident/Inaccessible Incident/Other Entrapments (Non-Vehicle)',
  'Transfer/Interfacility/Palliative Care', 'Standby', 'Other',
]

export const AGENCY_OPTIONS = ['Cal Fire','USFS','BLM','NPS','ODF','OES / CAL OES','California Conservation Corps','County Fire','Municipal Fire','State/Local Fire','Law Enforcement','BIA','USFWS','DOD','Private Contractor','Other']

export const PATIENT_GENDER_OPTIONS = ['Male','Female','Female-to-Male Transgender','Male-to-Female Transgender','Other','Unknown']

export const TYPE_OF_SERVICE_OPTIONS_NEMSIS = [
  '911 Response','Interfacility Transfer','Medical Transport','Fire/Rescue',
  'Standby','Mutual Aid','Event Coverage','Training','Other'
]

export const RESPONSE_MODE_OPTIONS = ['Emergent','Non-Emergent','Standby']

export const TRANSPORT_MODE_OPTIONS = ['Ground BLS','Ground ALS','Air Medical Rotor','Air Medical Fixed-Wing','Other']

export const PATIENT_RACE_OPTIONS = [
  'American Indian or Alaska Native','Asian','Black or African American',
  'Hispanic or Latino','Native Hawaiian or Other Pacific Islander',
  'White','Multiracial','Other','Unknown','Refused'
]

export const SITUATION_CATEGORY_OPTIONS = [
  'Trauma','Cardiac','Respiratory','Neurological','Gastrointestinal','Obstetric',
  'Toxicological','Environmental','Behavioral/Psychiatric','Allergic','Endocrine','Other'
]

export const LEVEL_OF_CARE_OPTIONS = ['BLS','ALS','Critical Care','Specialty Care']

export const TRANSPORT_DISPOSITION_OPTIONS = [
  'Transport by This EMS Unit','Transport by Another EMS Unit','Transport by Law Enforcement',
  'Transport by Private Vehicle','Treated, Released, No Transport',
  'Treated, Transferred Care','Patient Refused Care','Cancelled Prior to Arrival',
  'No Patient Found','Standby - No Treatment Required','Dead at Scene','Other'
]

export const OCCUPATIONAL_INDUSTRY_OPTIONS = [
  'Accommodation and Food Services',
  'Administrative and Support and Waste Management and Remediation Services',
  'Agriculture, Forestry, Fishing and Hunting',
  'Arts, Entertainment, and Recreation',
  'Construction',
  'Educational Services',
  'Finance and Insurance',
  'Health Care and Social Assistance',
  'Information',
  'Management of Companies and Enterprises',
  'Manufacturing',
  'Mining, Quarrying, and Oil and Gas Extraction',
  'Other Services (except Public Administration)',
  'Professional, Scientific, and Technical Services',
  'Public Administration',
  'Real Estate and Rental and Leasing',
  'Retail Trade',
  'Transportation and Warehousing',
  'Utilities',
  'Wholesale Trade',
]

export const PATIENT_OCCUPATION_OPTIONS = [
  'Architecture and Engineering Occupations',
  'Arts, Design, Entertainment, Sports, and Media Occupations',
  'Building and Grounds Cleaning and Maintenance Occupations',
  'Business and Financial Operations Occupations',
  'Community and Social Services Occupations',
  'Computer and Mathematical Occupations',
  'Construction and Extraction Occupations',
  'Educational Instruction and Library Occupations',
  'Farming, Fishing and Forestry Occupations',
  'Food Preparation and Serving Related Occupations',
  'Healthcare Practitioners and Technical Occupations',
  'Healthcare Support Occupations',
  'Installation, Maintenance, and Repair Occupations',
  'Legal Occupations',
  'Life, Physical, and Social Science Occupations',
  'Management Occupations',
  'Military Specific Occupations',
  'Office and Administrative Support Occupations',
  'Personal Care and Service Occupations',
  'Production Occupations',
  'Protective Service Occupations',
  'Sales and Related Occupations',
  'Transportation and Material Moving Occupations',
]

export const CHIEF_COMPLAINT_OPTIONS = [
  'Abdominal Pain/Problems','Allergic Reaction/Stings','Altered Level of Consciousness',
  'Animal Bite','Assault/Sexual Assault','Back Pain (Non-Traumatic)','Back Pain (Traumatic)',
  'Breathing Problem','Burns/Explosion','Carbon Monoxide/Inhalation/Hazmat',
  'Cardiac Arrest/Death','Chest Pain (Non-Traumatic)','Chest Pain (Traumatic)',
  'Choking','Convulsions/Seizures','Diabetic Problems','Drowning/Diving/SCUBA',
  'Electrocution/Lightning','Eye Problems/Injuries','Falls','Headache',
  'Heart Problems/A-Fib','Heat/Cold Exposure','Hemorrhage/Laceration',
  'Industrial/Machinery Accidents','Intercept','Mutual Aid/Assist Outside Agency',
  'Medical Alert','Nausea/Vomiting','No Apparent Illness/Injury',
  'Overdose/Poisoning/Ingestion','Pandemic/Epidemic/Outbreak','Pregnancy/Childbirth/Miscarriage',
  'Psychiatric/Abnormal Behavior/Suicide Attempt','Sick Person (Specific Diagnosis)',
  'Stab/Gunshot/Penetrating Trauma','Stroke/CVA','Traffic/Transportation Incident',
  'Transfer/Interfacility/Palliative Care','Traumatic Injury','Unknown Problem (Person Down)',
  'Unconscious/Fainting (Near)','Weakness','Other'
]

export const NO_TRANSPORT_REASON_OPTIONS = [
  'ALS Not Required','Cancelled Prior to Arrival','No Patient Found',
  'Patient Died During This EMS Encounter','Patient Evaluated, No Treatment/Transport Required',
  'Patient Refused Care (AMA)','Patient Treated and Released','Patient Transferred Care',
  'Standby — No Patient Contact','Other'
]

export const HOSPITAL_CAPABILITY_OPTIONS = [
  'Burn Center','Cardiac Intervention Center','Neonatal Center','Pediatric Center',
  'Stroke Center','Trauma Center — Level 1','Trauma Center — Level 2','Trauma Center — Level 3',
  'Trauma Center — Level 4','Hyperbaric Oxygen Therapy','STEMI Receiving Center',
  'Cardiac Surgery Center','Obstetrics','Rural Primary Care','Community Hospital','Other'
]

export const CLINICAL_OPTION_VALUES = [
  'Traumatic Injury (general)','Blunt Trauma','Head Injury','Traumatic Brain Injury','Concussion',
  'Spinal Cord Injury','Cervical Spine Injury','Chest Trauma','Pneumothorax - Traumatic',
  'Tension Pneumothorax','Hemothorax','Abdominal Trauma','Pelvic Fracture','Fracture (general)',
  'Dislocation','Sprain / Strain','Laceration','Abrasion','Contusion / Bruise','Extremity Injury',
  'Burns (general)','Burns - Thermal','Burns - Chemical','Burns - Electrical','Smoke Inhalation',
  'Eye Injury / Foreign Body','Dental Injury','Chest Pain - Cardiac','STEMI','NSTEMI',
  'Unstable Angina','Heart Failure / Pulmonary Edema','Cardiac Arrest','Dysrhythmia',
  'Hypertensive Emergency','Stroke / CVA','TIA','Syncope / Near-Syncope','Altered Mental Status',
  'Seizure','Headache','Dizziness / Vertigo','Respiratory Distress','Asthma / Bronchospasm',
  'COPD Exacerbation','Pneumonia','Allergic Reaction','Anaphylaxis','Hypoglycemia','Hyperglycemia',
  'Diabetic Emergency','Overdose / Poisoning','Alcohol Intoxication','Abdominal Pain',
  'Nausea / Vomiting','GI Bleeding','Obstetric Emergency','Heat Exhaustion','Heat Stroke',
  'Hypothermia','Drowning / Near-Drowning','Envenomation','Behavioral / Psychiatric Emergency',
  'Suicidal Ideation','Anxiety / Panic Attack','Pain Management','Wound Care',
  'Dehydration','Fatigue / Weakness','Back Pain','Musculoskeletal Pain','No Apparent Injury',
  'Refusal of Care','Standby - No Patient Contact','Other',
]

export const AMBULANCE_DEFAULT_ORDER = ['actions', 'narrative', 'response', 'scene', 'assessment', 'cardiac', 'vitals', 'mar', 'procedures', 'photos', 'transport', 'provider', 'forms', 'notes']
export const MEDUNIT_DEFAULT_ORDER = ['actions', 'narrative', 'assessment', 'vitals', 'mar', 'procedures', 'photos', 'transport', 'provider', 'forms', 'notes']
