// NEMSIS 3.5.1 Code Maps — ported from nemsis_export.py
// Do NOT abbreviate — all values copied verbatim from Python source.

export const TYPE_OF_SERVICE_MAP: Record<string, string> = {
  "Emergency Response (Primary Response Area)": "2205001",
  "Emergency Response (Intercept)": "2205003",
  "Emergency Response (Mutual Aid)": "2205009",
  "Hospital-to-Hospital Transfer": "2205005",
  "Hospital to Non-Hospital Facility Transfer": "2205015",
  "Non-Hospital Facility to Hospital Transfer": "2205019",
  "Non-Hospital Facility to Non-Hospital Facility Transfer": "2205017",
  "Non-Emergency Medical Transport (Medically Necessary)": "2205007",
  "Other Routine Medical Transport": "2205007",
  "Standby": "2205013",
  "Support Services": "2205021",
  "Non-Patient Care Rescue/Extrication": "2205023",
  "Mobile Integrated Health Care Encounter": "2205031",
  "Administrative Operations": "2205035",
};

export const TRANSPORT_CAP_MAP: Record<string, string> = {
  "Ground Transport (ALS Equipped)": "2207015",
  "Ground Transport (BLS Equipped)": "2207017",
  "Ground Transport (Critical Care Equipped)": "2207019",
  "Non-Transport-Medical Treatment (ALS Equipped)": "2207021",
  "Non-Transport-Medical Treatment (BLS Equipped)": "2207023",
  "Non-Transport-No Medical Equipment": "2207027",
  "Air Transport-Helicopter": "2207011",
  "Air Transport-Fixed Wing": "2207013",
};

export const RESPONSE_MODE_MAP: Record<string, string> = {
  "Emergent (Immediate Response)": "2223001",
  "Emergent Downgraded to Non-Emergent": "2223003",
  "Non-Emergent": "2223005",
  "Non-Emergent Upgraded to Emergent": "2223007",
};

export const DISPATCH_DELAY_MAP: Record<string, string> = {
  "Caller (Uncooperative)": "2208001",
  "Diversion/Failure (of previous unit)": "2208003",
  "High Call Volume": "2208005",
  "Language Barrier": "2208007",
  "Incomplete Address Information Provided": "2208009",
  "No EMS Vehicles (Units) Available": "2208011",
  "None/No Delay": "2208013",
  "Other": "2208015",
  "Technical Failure (Computer, Phone etc.)": "2208017",
};

export const RESPONSE_DELAY_MAP: Record<string, string> = {
  "Crowd": "2209001",
  "Directions/Unable to Locate": "2209003",
  "Distance": "2209005",
  "None/No Delay": "2209011",
  "Other": "2209013",
  "Route Obstruction (e.g., Train)": "2209017",
  "Scene Safety (Not Secure for EMS)": "2209019",
  "Traffic": "2209023",
  "Weather": "2209029",
};

export const SCENE_DELAY_MAP: Record<string, string> = {
  "None/No Delay": "2210017",
  "Other": "2210019",
  "Traffic": "2210029",
  "Weather": "2210037",
};

export const TRANSPORT_DELAY_MAP: Record<string, string> = {
  "None/No Delay": "2211011",
  "Other": "2211013",
  "Traffic": "2211023",
};

export const TURNAROUND_DELAY_MAP: Record<string, string> = {
  "None/No Delay": "2212015",
  "ED Overcrowding / Transfer of Care": "2212009",
  "Other": "2212017",
};

export const DISPATCH_REASON_MAP: Record<string, string> = {
  "Traumatic Injury": "2301073",
  "Burns/Explosion": "2301015",
  "Fire/Burns/Explosion": "2301035",
  "Heat/Cold Exposure": "2301043",
  "Hemorrhage/Laceration": "2301045",
  "Falls": "2301033",
  "Carbon Monoxide/Inhalation/HAZMAT": "2301017",
  "Breathing Problem": "2301013",
  "Cardiac Arrest/Death": "2301019",
  "Chest Pain (Non-Traumatic)": "2301021",
  "Altered Mental Status": "2301085",
  "Unconscious/Fainting/Near-Fainting": "2301077",
  "Sick Person": "2301061",
  "Standby": "2301065",
  "Fire": "2301035",
  "Drowning/Diving/SCUBA Accident": "2301081",
  "Transfer/Interfacility/Palliative Care": "2301071",
  "Unknown Problem/Person Down": "2301079",
  "No Other Appropriate Choice": "2301051",
  "Smoke Inhalation": "2301017",
  "Burn": "2301015",
};

export const GENDER_MAP: Record<string, string> = {
  "Female": "9919001",
  "Male": "9919003",
  "Unknown": "9919005",
};

export const GENDER_MAP_DEPRECATED: Record<string, string> = {
  "Female": "9906001",
  "Male": "9906003",
  "Unknown": "9906005",
};

export const RACE_MAP: Record<string, string> = {
  "White": "2514011",
  "Black or African American": "2514005",
  "Hispanic or Latino": "2514007",
  "Asian": "2514003",
  "American Indian or Alaska Native": "2514001",
  "Native Hawaiian or Other Pacific Islander": "2514009",
  "Middle Eastern or North African": "2514013",
};

export const ACUITY_MAP: Record<string, string> = {
  "Critical (Red)": "2813001",
  "Emergent (Yellow)": "2813003",
  "Emergent (Orange)": "2813003",
  "Lower Acuity (Green)": "2813005",
  "Dead without Resuscitation Efforts (Black)": "2813007",
  "Non-Acute/Routine": "2813009",
};

export const LEVEL_OF_CARE_MAP: Record<string, string> = {
  "Ground Transport (ALS Equipped)": "4232001",
  "Ground Transport (BLS Equipped)": "4232003",
  "Ground Transport (Critical Care Equipped)": "4232005",
  "Air Transport-Helicopter": "4232001",
  "Air Transport-Fixed Wing": "4232001",
  "Non-Transport-Medical Treatment (ALS Equipped)": "4232001",
  "Non-Transport-Medical Treatment (BLS Equipped)": "4232003",
  "Non-Transport-No Medical Equipment": "4232013",
};

export const POSSIBLE_INJURY_MAP: Record<string, string> = {
  "No": "9922001",
  "Unknown": "9922003",
  "Yes": "9922005",
  "true": "9922005",
  "false": "9922001",
};

export const ADVANCE_DIRECTIVE_MAP: Record<string, string> = {
  "Family/Guardian request DNR (but no documentation)": "3105001",
  "Living Will": "3105003",
  "None": "3105005",
  "Other": "3105007",
  "Other Healthcare Advanced Directive Form": "3105009",
  "State EMS DNR or Medical Order Form": "3105011",
  "DNR": "3105001",
  "Full Code": "3105005",
  "POLST": "3105011",
};

export const CARDIAC_RHYTHM_MAP: Record<string, string> = {
  "Asystole": "9901003",
  "Atrial Fibrillation": "9901007",
  "Atrial Flutter": "9901009",
  "AV Block-1st Degree": "9901011",
  "AV Block-2nd Degree-Type 1": "9901013",
  "AV Block-2nd Degree-Type 2": "9901015",
  "AV Block-3rd Degree": "9901017",
  "Junctional": "9901019",
  "Other": "9901031",
  "PEA": "9901035",
  "Premature Atrial Contractions": "9901037",
  "Premature Ventricular Contractions": "9901039",
  "Sinus Arrhythmia": "9901043",
  "Sinus Bradycardia": "9901045",
  "Sinus Rhythm": "9901047",
  "Sinus Tachycardia": "9901049",
  "Supraventricular Tachycardia": "9901059",
  "Ventricular Fibrillation": "9901067",
  "Ventricular Tachycardia (With Pulse)": "9901069",
  "Ventricular Tachycardia (Pulseless)": "9901071",
  "Normal Sinus Rhythm": "9901047",
  "NSR": "9901047",
};

export const SKIN_SIGNS_MAP: Record<string, string> = {
  "Clammy": "3504001",
  "Cold": "3504003",
  "Cyanotic": "3504005",
  "Diaphoretic": "3504007",
  "Dry": "3504009",
  "Flushed": "3504011",
  "Hot": "3504013",
  "Mottled": "3504019",
  "Normal": "3504021",
  "Not Done": "3504023",
  "Pale": "3504025",
  "Warm": "3504033",
};

export const DISPOSITION_MAP: Record<string, string> = {
  "Patient Contact Made": "4227001",
  "Cancelled on Scene": "4227003",
  "Cancelled Prior to Arrival at Scene": "4227005",
  "No Patient Contact": "4227007",
  "No Patient Found": "4227009",
  "Non-Patient Incident (Not Otherwise Listed)": "4227011",
  "Transported": "4227001",
  "Treated, Transported": "4227001",
  "Treated, Released": "4227001",
  "Refused Care": "4227001",
  "Treated, No Transport": "4227001",
  "Dead on Scene": "4227001",
  "Standby - No Patient": "4227007",
};

export const INCIDENT_DISPOSITION_MAP: Record<string, string> = {
  "Patient Evaluated and Care Provided": "4228001",
  "Patient Evaluated and Refused Care": "4228003",
  "Patient Evaluated, No Care Required": "4228005",
  "Patient Refused Evaluation/Care": "4228007",
  "Patient Refused Evaluation/Care (AMA)": "4228007",
  "Patient Support Services Provided": "4228009",
  "Cancelled Prior to Arrival at Scene": "4228011",
  "Cancelled (Prior to Arrival At Scene)": "4228011",
  "No Patient Found": "4228013",
  "No Patient Contact": "4228015",
  "Patient Contact Made": "4228017",
  "Patient Treated, Released (per patient request)": "4228019",
  "Patient Treated, Released - AMA": "4228021",
  "Patient Treated, Transported by This EMS Unit": "4228023",
  "Patient Treated, Transported by Another EMS Unit": "4228025",
  "Patient Treated, Transferred Care to Another EMS Unit": "4228027",
};

export const EMS_UNIT_ROLE_MAP: Record<string, string> = {
  "Initiated and Continued Primary Care": "4229001",
  "Initiated Primary Care and Transferred to Another EMS Crew": "4229003",
  "Provided Care Supporting Primary EMS Crew": "4229005",
  "Assumed Primary Care from Another EMS Crew": "4229007",
  "Incident Support Services Provided (Including Standby)": "4229009",
  "Back in Service, No Care/Support Services Required": "4229011",
  "Back in Service, Care/Support Services Refused": "4229013",
};

export const TRANSPORT_DISPOSITION_MAP: Record<string, string> = {
  "Transport by This EMS Unit (This Crew Only)": "4230001",
  "Transport by This EMS Unit, with a Member of Another Crew": "4230003",
  "Transport by Another EMS Unit/Agency": "4230005",
  "Patient Refused Transport": "4230009",
  "No Transport": "4230013",
};

export const NO_TRANSPORT_REASON_MAP: Record<string, string> = {
  "Against Medical Advice": "4231001",
  "Patient/Guardian Indicates Ambulance Transport is Not Necessary": "4231003",
  "Released Following Protocol Guidelines": "4231005",
  "Released to Law Enforcement": "4231007",
  "DNR": "4231011",
  "Other, Not Listed": "4231015",
  "Patient Elopement": "4231017",
};

export const DESTINATION_TYPE_MAP: Record<string, string> = {
  "Home": "4221001",
  "Hospital-Emergency Department": "4221003",
  "Hospital-Non-Emergency Department Bed": "4221005",
  "Clinic": "4221007",
  "Morgue/Mortuary": "4221009",
  "Other": "4221013",
  "Urgent Care": "4221021",
};

export const HOSPITAL_CAPABILITY_MAP: Record<string, string> = {
  "Hospital (General)": "9908007",
  "Behavioral Health": "9908001",
  "Burn Center": "9908003",
  "Critical Access Hospital": "9908005",
  "Neonatal Center": "9908009",
  "Pediatric Center": "9908011",
  "Rehab Center": "9908019",
  "Trauma Center Level 1": "9908021",
  "Trauma Center Level 2": "9908023",
  "Trauma Center Level 3": "9908025",
  "Trauma Center Level 4": "9908027",
  "Trauma Center Level 5": "9908029",
  "Cardiac-STEMI/PCI Capable": "9908031",
  "Cardiac-STEMI/PCI Capable (24/7)": "9908033",
  "Cardiac-STEMI/Non-PCI Capable": "9908035",
  "Stroke-Acute Stroke Ready Hospital (ASRH)": "9908037",
  "Stroke-Primary Stroke Center (PSC)": "9908039",
  "Stroke-Thrombectomy-Capable Stroke Center (TSC)": "9908041",
  "Stroke-Comprehensive Stroke Center (CSC)": "9908043",
  "Cancer Center": "9908045",
  "Labor and Delivery": "9908047",
  "ALS": "9908007",
  "BLS": "9908007",
};

export const ARREST_ETIOLOGY_MAP: Record<string, string> = {
  "Cardiac (Presumed)": "3002001",
  "Drowning/Submersion": "3002003",
  "Drug Overdose": "3002005",
  "Electrocution": "3002007",
  "Exsanguination - Medical": "3002009",
  "Exsanguination - Trauma": "3002011",
  "Other": "3002013",
  "Respiratory/Asphyxia": "3002015",
  "SIDS": "3002017",
  "Trauma": "3002019",
};

export const RESUS_ATTEMPTED_MAP: Record<string, string> = {
  "Attempted Defibrillation": "3003001",
  "Attempted Ventilation": "3003003",
  "Initiated Chest Compressions": "3003005",
  "Not Attempted - Considered Futile": "3003007",
  "Not Attempted - DNR Orders": "3003009",
  "Not Attempted - Signs of Death": "3003011",
  "Not Attempted - Other": "3003013",
};

export const ARREST_WITNESSED_MAP: Record<string, string> = {
  "Not Witnessed": "3004001",
  "Witnessed by Bystander": "3004003",
  "Witnessed by Family Member": "3004005",
  "Witnessed by Healthcare Provider": "3004007",
};

export const WHO_CPR_MAP: Record<string, string> = {
  "Bystander": "3020001",
  "Family Member": "3020003",
  "Healthcare Provider": "3020005",
  "First Responder (non-EMS)": "3020007",
  "EMS": "3020009",
};

export const CPR_TYPE_MAP: Record<string, string> = {
  "Compressions-Manual": "3009001",
  "Compressions-External Band-Type Device": "3009003",
  "Compressions-External Plunger Type Device": "3009005",
  "Compressions-External Thumper Type Device": "3009007",
  "Compressions-Intermittent with Ventilation": "3009009",
  "Compressions-Load-Distributing Band Type Device": "3009011",
  "Compressions-Other Device": "3009013",
  "Compressions-Vest Type Device": "3009015",
  "Ventilation-BVM": "3009017",
  "Ventilation-CPAP": "3009019",
  "Ventilation-Impedance Threshold Device": "3009021",
  "Ventilation-Other Device": "3009023",
  "Ventilation-Passive Ventilation with Oxygen": "3009025",
};

export const AED_PRIOR_MAP: Record<string, string> = {
  "No": "3007001",
  "Yes, Applied with Defibrillation": "3007003",
  "Yes, Applied without Defibrillation": "3007005",
};

export const ROSC_MAP: Record<string, string> = {
  "No": "3012001",
  "Yes, With Defibrillation": "3012003",
  "Yes, Without Defibrillation": "3012005",
};

export const END_ARREST_MAP: Record<string, string> = {
  "Expired in the Field": "3018001",
  "Ongoing Resuscitation in the Field": "3018003",
  "ROSC in the Field": "3018005",
  "ROSC in the ED": "3018007",
  "Expired in ED": "3018009",
  "Ongoing Resuscitation in the ED": "3018011",
};

export const EMS_TRANSPORT_METHOD_MAP: Record<string, string | null> = {
  "Ground-Ambulance": "4216005",
  "Ground ALS": "4216005",
  "Ground BLS": "4216005",
  "Ground Transport (ALS Equipped)": "4216005",
  "Ground Transport (BLS Equipped)": "4216005",
  "ATV": "4216007",
  "Air Medical-Fixed Wing": "4216001",
  "Air Medical-Rotor Craft": "4216003",
  "Air Transport-Fixed Wing": "4216001",
  "Air Transport-Helicopter": "4216003",
  "Other": "4216009",
  "No Transport": null,
};

export const TRANSPORT_MODE_MAP: Record<string, string> = {
  "Emergent (Immediate Response)": "4217001",
  "Emergent Downgraded to Non-Emergent": "4217003",
  "Non-Emergent": "4217005",
  "Non-Emergent Upgraded to Emergent": "4217007",
  "Emergent": "4217001",
};

export const ACUITY_RELEASE_MAP: Record<string, string> = {
  "Critical (Red)": "4219001",
  "Emergent (Yellow)": "4219003",
  "Lower Acuity (Green)": "4219005",
  "Dead without Resuscitation Efforts (Black)": "4219007",
  "Dead with Resuscitation Efforts (Black)": "4219009",
  "Non-Acute/Routine": "4219011",
};

export const ROUTE_MAP: Record<string, string> = {
  "Inhalation": "9927009",
  "Intramuscular (IM)": "9927015",
  "Intranasal": "9927017",
  "Intraosseous (IO)": "9927021",
  "Intravenous (IV)": "9927023",
  "Nasal Cannula": "9927025",
  "Non-Rebreather Mask": "9927031",
  "Oral": "9927035",
  "Other/miscellaneous": "9927037",
  "Subcutaneous": "9927045",
  "Sublingual": "9927047",
  "Topical": "9927049",
  "IM": "9927015",
  "IN": "9927017",
  "IO": "9927021",
  "IV": "9927023",
  "NC": "9927025",
  "NRB": "9927031",
  "PO": "9927035",
  "SL": "9927047",
  "Other": "9927037",
};

export const DOSE_UNIT_MAP: Record<string, string> = {
  "Grams (gms)": "3706001",
  "Liters (l)": "3706009",
  "Micrograms (mcg)": "3706015",
  "Milligrams (mg)": "3706021",
  "Milliliters (ml)": "3706025",
  "Other": "3706029",
  "Liters Per Minute (LPM [gas])": "3706035",
  "mg": "3706021",
  "mcg": "3706015",
  "mL": "3706025",
  "ml": "3706025",
  "LPM": "3706035",
  "L": "3706009",
  "g": "3706001",
  "%": "3706029",
};

export const MED_RESPONSE_MAP: Record<string, string> = {
  "Improved": "9916001",
  "Unchanged": "9916003",
  "Worse": "9916005",
};

export const CARDIAC_ARREST_MAP: Record<string, string> = {
  "Yes, Prior to Any EMS Arrival (includes Transport EMS & Medical First Responders)": "3001001",
  "Yes, Prior to Any EMS Arrival": "3001001",
  "Yes, After EMS Arrival": "3001005",
  "No": "3001003",
};

export const MED_AUTH_MAP: Record<string, string> = {
  "On-Line (Remote Verbal Order)": "9918001",
  "On-Scene": "9918003",
  "Protocol (Standing Order)": "9918005",
  "Written Orders (Patient Specific)": "9918007",
};

export const STATE_ANSI: Record<string, string> = {
  "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08",
  "CT": "09", "DE": "10", "FL": "12", "GA": "13", "HI": "15", "ID": "16",
  "IL": "17", "IN": "18", "IA": "19", "KS": "20", "KY": "21", "LA": "22",
  "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
  "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34",
  "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39", "OK": "40",
  "OR": "41", "PA": "42", "RI": "44", "SC": "45", "SD": "46", "TN": "47",
  "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54",
  "WI": "55", "WY": "56", "DC": "11", "PR": "72", "GU": "66", "VI": "78",
};

export const CA_COUNTY_FIPS: Record<string, string> = {
  "siskiyou": "06093",
  "shasta": "06089",
  "trinity": "06105",
  "tehama": "06103",
  "butte": "06007",
  "lassen": "06035",
  "modoc": "06049",
  "plumas": "06063",
  "sacramento": "06067",
  "los angeles": "06037",
  "san diego": "06073",
  "orange": "06059",
  "riverside": "06065",
  "san bernardino": "06071",
  "santa clara": "06085",
  "alameda": "06001",
  "fresno": "06019",
  "kern": "06029",
  "el dorado": "06017",
  "nevada": "06057",
  "placer": "06061",
  "tuolumne": "06109",
  "mariposa": "06043",
  "calaveras": "06009",
  "amador": "06005",
  "alpine": "06003",
  "mono": "06051",
  "inyo": "06027",
  "humboldt": "06023",
  "mendocino": "06045",
  "del norte": "06015",
};

export const PATIENT_EVALUATION_CARE_MAP: Record<string, string> = {
  'Patient Evaluated and Care Provided':  '4228001',
  'Patient Evaluated and Refused Care':   '4228003',
  'Patient Evaluated, No Care Required':  '4228005',
  'Patient Refused Evaluation/Care':      '4228007',
  'Patient Refused Evaluation/Care (AMA)':'4228007',
  'Patient Support Services Provided':    '4228009',
}

export const UNIT_DISPOSITION_MAP: Record<string, string> = {
  'Patient Contact Made':                          '4227001',
  'Cancelled on Scene':                            '4227003',
  'Cancelled Prior to Arrival at Scene':           '4227005',
  'No Patient Contact':                            '4227007',
  'No Patient Found':                              '4227009',
  'Non-Patient Incident (Not Otherwise Listed)':   '4227011',
}

export { INDUSTRY_MAP, OCCUPATION_MAP } from './occupationData.js';

