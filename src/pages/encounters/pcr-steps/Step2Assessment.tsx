import { NEMSISWarnings } from '@/components/NEMSISWarnings'
import { SearchableSelect } from '@/components/SearchableSelect'
import { MultiSelect } from '@/components/MultiSelect'
import type { SelectOption } from '@/components/SearchableSelect'
import {
  DISPATCH_REASON_OPTIONS, POSSIBLE_INJURY_OPTIONS,
  CARDIAC_ARREST_OPTIONS, ARREST_ETIOLOGY_OPTIONS,
  ROSC_OPTIONS_LIST as ROSC_OPTIONS,
} from '@/constants/nemsis'
import type { StepProps } from './types'
import { inputCls, labelCls, sectionCls } from './types'

const INITIAL_ACUITY_OPTIONS = [
  { value: 'Critical (Red)', color: 'bg-red-600 hover:bg-red-500', ring: 'ring-red-400', label: 'Immediate' },
  { value: 'Emergent (Yellow)', color: 'bg-yellow-500 hover:bg-yellow-400', ring: 'ring-yellow-300', label: 'Delayed' },
  { value: 'Lower Acuity (Green)', color: 'bg-green-600 hover:bg-green-500', ring: 'ring-green-400', label: 'Minor' },
  { value: 'Dead without Resuscitation Efforts (Black)', color: 'bg-gray-800 hover:bg-gray-700 border border-gray-600', ring: 'ring-gray-400', label: 'Expectant' },
  { value: 'Non-Acute/Routine', color: 'bg-blue-700 hover:bg-blue-600', ring: 'ring-blue-400', label: 'Routine' },
]

const WORKER_TYPE_OPTIONS_PCR = [
  'Firefighter','Hotshot Crew Member','Hand Crew Member','Dozer Operator',
  'Air Tanker Pilot','Helicopter Crew','Engine Crew','Lookout','Camp Worker',
  'Overhead/Supervisor','Contractor Employee','Other','Not Applicable',
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
const END_ARREST_OPTIONS = [
  'Expired in the Field', 'Ongoing Resuscitation in the Field', 'ROSC in the Field',
  'ROSC in the ED', 'Expired in ED', 'Ongoing Resuscitation in ED',
]
const WHO_CPR_OPTIONS = ['Bystander', 'Family Member', 'Healthcare Provider', 'First Responder (non-EMS)', 'EMS']
const CARDIAC_RHYTHM_OPTIONS = [
  'Normal Sinus Rhythm', 'Atrial Fibrillation', 'Atrial Flutter',
  'AV Block-1st Degree', 'AV Block-2nd Degree-Type 1 (Wenckebach)',
  'AV Block-2nd Degree-Type 2 (Mobitz)', 'AV Block-3rd Degree (Complete)',
  'Idioventricular', 'Junctional', 'Left Bundle Branch Block',
  'Non-STEMI Anterior Ischemia', 'Non-STEMI Inferior Ischemia',
  'Non-STEMI Lateral Ischemia', 'Non-STEMI Posterior Ischemia',
  'Non-STEMI Septal Ischemia', 'Other', 'Paced Rhythm', 'PEA',
  'Pre-excitation (WPW)', 'Right Bundle Branch Block', 'Sinus Arrhythmia',
  'Sinus Bradycardia', 'Sinus Tachycardia',
  'STEMI Anterior Ischemia', 'STEMI Inferior Ischemia',
  'STEMI Lateral Ischemia', 'STEMI Posterior Ischemia', 'STEMI Septal Ischemia',
  'Supraventricular Tachycardia', 'Torsades De Points',
  'Unknown AED Non-Shockable Rhythm', 'Unknown AED Shockable Rhythm',
  'Ventricular Fibrillation', 'Ventricular Tachycardia-Perfusing',
  'Ventricular Tachycardia-Pulseless', 'Agonal/Idioventricular', 'Asystole', 'Artifact',
]

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

export function Step2Assessment({ form, set, nemsisWarnings }: StepProps) {
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
}
