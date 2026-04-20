import { NEMSISWarnings } from '@/components/NEMSISWarnings'
import { toast } from '@/lib/toast'
import type { StepProps } from './types'
import { inputCls, labelCls, sectionCls } from './types'

const PATIENT_GENDER_OPTIONS = ['Female', 'Male', 'Unknown']

const PATIENT_RACE_OPTIONS = [
  'White', 'Black or African American', 'Hispanic or Latino', 'Asian',
  'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander',
  'Middle Eastern or North African',
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

export function Step1PatientScene({ form, set, nemsisWarnings }: StepProps) {
  const handleGetLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6)
        const lon = pos.coords.longitude.toFixed(6)
        set('scene_gps', `${lat}, ${lon}`)
      },
      (err) => toast.warning('Location unavailable: ' + err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-4">
      <NEMSISWarnings section="patient" warnings={nemsisWarnings} />
      <NEMSISWarnings section="scene" warnings={nemsisWarnings} />
      <p className={sectionCls}>Patient Identity</p>
      <div>
        <label className={labelCls}>Crew Resource Number</label>
        <input type="text" className={inputCls} value={form.crew_resource_number} onChange={e => set('crew_resource_number', e.target.value)} placeholder="e.g. CRN-2024-001" />
      </div>
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
          <label className={labelCls}>Date of Birth <span className="text-red-400">*</span></label>
          <input type="date" className={inputCls} value={form.dob} onChange={e => set('dob', e.target.value)} required />
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
}
