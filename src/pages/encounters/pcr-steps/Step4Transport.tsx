import { NEMSISWarnings } from '@/components/NEMSISWarnings'
import { MultiSelect } from '@/components/MultiSelect'
import {
  TRANSPORT_METHOD_OPTIONS, DESTINATION_TYPE_OPTIONS, ADVANCE_DIRECTIVE_OPTIONS,
} from '@/constants/nemsis'
import type { StepProps } from './types'
import { inputCls, labelCls, sectionCls } from './types'

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

export function Step4Transport({ form, set, nemsisWarnings }: StepProps) {
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
}
