import { NEMSISWarnings } from '@/components/NEMSISWarnings'
import { MultiSelect } from '@/components/MultiSelect'
import { TYPE_OF_SERVICE_OPTIONS } from '@/constants/nemsis'
import type { StepProps } from './types'
import { inputCls, labelCls, sectionCls } from './types'

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

interface Step0Props extends StepProps {
  unitLocked: boolean
  incidentLocked: boolean
  assignmentUnit?: string
  assignmentIncident?: string
}

export function Step0IncidentTimes({ form, set, nemsisWarnings, unitLocked, incidentLocked, assignmentUnit, assignmentIncident }: Step0Props) {
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
          {unitLocked ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
              <span className="text-sm text-white font-medium">{form.unit || assignmentUnit}</span>
              <span className="text-xs text-gray-500">🔒 locked</span>
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
        {incidentLocked ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
            <span className="text-sm text-white font-medium">{form.incident || assignmentIncident || 'Loading...'}</span>
            <span className="text-xs text-gray-500">🔒 locked</span>
          </div>
        ) : (
          <input type="text" className={inputCls} value={form.incident} onChange={e => set('incident', e.target.value)} placeholder="e.g. Park Fire" />
        )}
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
        <label className={labelCls}>Patient Agency</label>
        <select className={inputCls} value={form.patient_agency} onChange={e => set('patient_agency', e.target.value)}>
          <option value="">Select or type below...</option>
          <option>Cal Fire</option>
          <option>USFS</option>
          <option>BLM</option>
          <option>NPS</option>
          <option>CHP</option>
          <option>County Fire</option>
          <option>Municipal Fire</option>
          <option>OES / CAL OES</option>
          <option>Private Contractor</option>
          <option>Other</option>
        </select>
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
            value={form[field as keyof typeof form] as string}
            onChange={e => set(field as keyof typeof form, e.target.value)}
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
            value={form[field as keyof typeof form] as string[]}
            onChange={v => set(field as keyof typeof form, v)}
            placeholder="None/No Delay (select if delays occurred)"
          />
        </div>
      ))}
    </div>
  )
}
