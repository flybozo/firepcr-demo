

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { getIsOnline } from '@/lib/syncManager'
import { loadSingle } from '@/lib/offlineFirst'
import { getCachedData, getCachedById, cacheData, queueOfflineWrite } from '@/lib/offlineStore'
import { Link } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { SearchableSelect } from '@/components/SearchableSelect'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'
import type { SelectOption } from '@/components/SearchableSelect'
import { useNEMSISWarnings } from '@/hooks/useNEMSISWarnings'

type ConsentForm = {
  id: string
  consent_id: string
  consent_type: string
  date_time: string
  patient_first_name: string | null
  patient_last_name: string | null
  provider_of_record: string | null
  signed: boolean | null
  pdf_url: string | null
}

type CompClaim = {
  id: string
  encounter_id: string | null
  patient_name: string | null
  date_of_injury: string | null
  status: string | null
  pdf_url: string | null
  created_at: string | null
}

type PatientPhoto = {
  id: string
  encounter_id: string
  photo_url: string
  caption: string | null
  taken_at: string
}

type EncounterProcedure = {
  id: string
  encounter_id: string
  procedure_name: string
  performed_at: string
  performed_by: string | null
  body_site: string | null
  outcome: string
  complications: string | null
  notes: string | null
}

type Encounter = {
  id: string
  encounter_id: string
  created_by?: string | null
  created_by_employee_id?: string | null
  date: string
  time?: string | null
  unit: string
  incident_id: string | null
  patient_first_name: string | null
  patient_last_name: string | null
  patient_dob: string | null
  patient_age: number | null
  patient_gender: string | null
  // Vitals — actual DB column names (initial_*)
  initial_hr: number | null
  initial_rr: number | null
  initial_spo2: number | null
  initial_bp_systolic: number | null
  initial_bp_diastolic: number | null
  initial_temp_f: number | null
  initial_gcs_total: number | null
  initial_gcs_eye: number | null
  initial_gcs_verbal: number | null
  initial_gcs_motor: number | null
  initial_pain_scale: number | null
  initial_blood_glucose: number | null
  initial_skin: string | null
  cardiac_rhythm: string | null
  pupils: string | null
  etco2: number | null
  // Legacy aliases (may exist on old records)
  heart_rate: number | null
  respiratory_rate: number | null
  spo2: number | null
  blood_pressure_systolic: number | null
  blood_pressure_diastolic: number | null
  temperature: number | null
  gcs: number | null
  pain_scale: number | null
  blood_glucose: number | null
  skin_condition: string | null
  // Assessment
  primary_symptom_text: string | null
  primary_impression: string | null
  secondary_impression: string | null
  initial_acuity: string | null
  possible_injury: boolean | null
  // Transport
  transport_disposition: string | null
  transport_method: string | null
  transport_destination: string | null
  patient_disposition: string | null
  refusal_signed: boolean | null
  // Provider
  provider_of_record: string | null
  pcr_notes: string | null
  pcr_status: string | null
  notes: string | null
  crew_resource_number: string | null
  pcr_number: string | null
  final_acuity: string | null
  dispatch_reason: string | null
  scene_type: string | null
  destination_type: string | null
  destination_name: string | null
  advance_directive: string | null
  signed_at: string | null
  signed_by: string | null
  // Response & Times
  type_of_service: string | null
  transport_capability: string | null
  response_number: string | null
  incident_number: string | null
  agency_number: string | null
  patient_occupational_industry: string | null
  patient_occupation: string | null
  time_employee_began_work: string | null
  dispatch_datetime: string | null
  en_route_datetime: string | null
  arrive_scene_datetime: string | null
  patient_contact_datetime: string | null
  depart_scene_datetime: string | null
  arrive_destination_datetime: string | null
  available_datetime: string | null
  // Scene
  scene_address: string | null
  scene_city: string | null
  scene_county: string | null
  scene_state: string | null
  scene_zip: string | null
  scene_gps: string | null
  num_patients_at_scene: number | null
  first_ems_unit_on_scene: string | null
  // Situation
  primary_impression_snomed: string | null
  primary_impression_text: string | null
  primary_symptom_snomed: string | null
  symptom_onset_datetime: string | null
  // Transport expanded
  destination_address: string | null
  no_transport_reason: string | null
  hospital_capability: string | null
  // Cardiac arrest
  cardiac_arrest: string | null
  arrest_etiology: string | null
  resuscitation_attempted: string | null
  arrest_witnessed: string | null
  arrest_rhythm: string | null
  rosc: string | null
  who_initiated_cpr: string | null
  aed_prior_to_ems: string | null
  cpr_type: string | null
  date_time_cardiac_arrest: string | null
  end_of_arrest_event: string | null
}

type EncounterVitals = {
  id: string
  encounter_id: string
  recorded_at: string
  recorded_by: string | null
  hr: number | null
  rr: number | null
  spo2: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  gcs_eye: number | null
  gcs_verbal: number | null
  gcs_motor: number | null
  gcs_total: number | null
  pain_scale: number | null
  blood_glucose: number | null
  temp_f: number | null
  skin: string | null
  cardiac_rhythm: string | null
  etco2: number | null
  pupils: string | null
  notes: string | null
}

const CARDIAC_RHYTHMS = [
  'NSR (Normal Sinus Rhythm)', 'Sinus Tachycardia', 'Sinus Bradycardia',
  'Atrial Fibrillation', 'Atrial Flutter',
  'AV Block-1st Degree', 'AV Block-2nd Degree-Type 1', 'AV Block-2nd Degree-Type 2', 'AV Block-3rd Degree',
  'Left Bundle Branch Block', 'Right Bundle Branch Block', 'Junctional',
  'PEA (Pulseless Electrical Activity)',
  'Ventricular Tachycardia (Perfusing)', 'Ventricular Tachycardia (Pulseless)',
  'Ventricular Fibrillation', 'Asystole', 'Agonal/Idioventricular', 'Pacemaker Rhythm', 'Other',
]

const SKIN_SIGNS = ['Normal', 'Pale', 'Flushed/Mottled', 'Cyanotic', 'Diaphoretic', 'Dry']
const PUPILS_OPTIONS = ['Equal and Reactive', 'Unequal', 'Non-Reactive', 'Dilated', 'Constricted']

// ── Inline-edit option arrays ───────────────────────────────────────────────

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

const SCENE_TYPE_LABELS = [
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

const FIRST_EMS_OPTIONS = ['Yes', 'No', 'Unknown']

const ACUITY_OPTIONS = [
  'Critical (Red)', 'Emergent (Yellow)', 'Lower Acuity (Green)',
  'Dead without Resuscitation Efforts (Black)', 'Non-Acute/Routine',
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
const ROSC_OPTIONS_LIST = ['No', 'Yes, With Defibrillation', 'Yes, Without Defibrillation']

const PATIENT_DISPOSITION_OPTIONS = [
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

const TRANSPORT_METHOD_OPTIONS = [
  'Ground-Ambulance', 'Air Medical-Rotor Craft', 'Air Medical-Fixed Wing', 'ATV', 'Other', 'No Transport',
]

const DESTINATION_TYPE_OPTIONS = [
  'Home', 'Hospital-Emergency Department', 'Hospital-Non-Emergency Department Bed',
  'Clinic', 'Morgue/Mortuary', 'Nursing Home', 'Assisted Living Facility',
  'Mental Health Facility', 'Physical Rehabilitation Facility',
  'Drug and/or Alcohol Rehabilitation Facility', 'Dialysis Center',
  'Diagnostic Services', 'Other Recurring Care Center',
  'Patient Left at Scene - No Transport', 'Urgent Care Center', 'Other',
]

const ADVANCE_DIRECTIVE_OPTIONS = [
  'None', 'DNR', 'Do Not Resuscitate', 'Living Will', 'POLST', 'Power of Attorney',
  'Patient Instructed Comfort Measures Only', 'Family/Guardian request DNR',
  'Family/Guardian request DNR (but no documentation)',
  'Other Healthcare Advanced Directive Form', 'Other',
]

const DISPATCH_REASON_OPTIONS = [
  'Traumatic Injury', 'Burns/Explosion', 'Fire/Burns/Explosion', 'Heat/Cold Exposure',
  'Hemorrhage/Laceration', 'Breathing Problem', 'Cardiac Arrest/Death',
  'Chest Pain/Discomfort', 'Altered Level of Consciousness', 'Abdominal Pain/Problems',
  'Back Pain (Non-Traumatic)', 'Allergic Reaction', 'Diabetic Problem', 'Seizure',
  'Stroke/CVA', 'Headache', 'Hypertension', 'Nausea/Vomiting',
  'Drowning/Diving/SCUBA Accident', 'Carbon Monoxide/Hazmat/Inhalation/CBRN',
  'Industrial Accident/Inaccessible Incident/Other Entrapments (Non-Vehicle)',
  'Transfer/Interfacility/Palliative Care', 'Standby', 'Other',
]

// ── InlineField component ───────────────────────────────────────────────────


// Inline tooltip — wraps its children, shows popup on hover/tap
function NEMSISTooltip({ issues, children }: { issues: { severity: string; message: string }[]; children: React.ReactNode }) {
  const [show, setShow] = React.useState(false)
  const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0 })
  if (issues.length === 0) return <>{children}</>
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Position above the badge, left-aligned, clamped to viewport
    const top = Math.max(8, rect.top - 8)
    const left = Math.min(rect.left, window.innerWidth - 296)
    setTooltipPos({ top, left })
    setShow(true)
  }
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)}
      onClick={e => { e.stopPropagation(); setShow(s => !s) }}>
      {children}
      {show && typeof window !== 'undefined' && (() => {
        // Use a portal-style fixed div to escape overflow:hidden from parent cards
        return (
          <span className="fixed z-[9999] w-72 bg-gray-950 border border-gray-600 rounded-xl shadow-2xl p-3 text-left"
            style={{top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px`, transform: 'translateY(-100%)', pointerEvents: 'none'}}>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">NEMSIS Issues</p>
            <ul className="space-y-1.5">
              {issues.map((w, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="shrink-0">{w.severity === 'error' ? '🚫' : '⚠️'}</span>
                  <span className={w.severity === 'error' ? 'text-red-300' : 'text-amber-300'}>{w.message}</span>
                </li>
              ))}
            </ul>
          </span>
        )
      })()}
    </span>
  )
}

function InlineField({ label, value, fieldKey, isLocked, onSave, type = 'text', options, fullWidth }: {
  label: string
  value: string | number | null | undefined | string[]
  fieldKey: string
  isLocked: boolean
  onSave: (key: string, val: string) => void
  type?: 'text' | 'select' | 'date' | 'datetime-local' | 'number' | 'textarea' | 'clinical-select' | 'multi-select'
  options?: string[]
  fullWidth?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))

  // Keep draft in sync if value changes externally
  useEffect(() => { if (!editing) setDraft(String(value ?? '')) }, [value, editing])

  if (isLocked || !editing) {
    return (
      <div
        onClick={() => !isLocked && setEditing(true)}
        className={`${fullWidth ? 'col-span-full' : ''} ${!isLocked ? 'cursor-pointer hover:bg-gray-800/50 rounded px-1 -mx-1 transition-colors group' : ''}`}
      >
        <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
        <dd className="text-sm text-white mt-0.5 flex items-center gap-1">
          {value !== null && value !== undefined && value !== ''
            ? String(value)
            : <span className="text-gray-600">—</span>}
          {!isLocked && <span className="text-gray-700 text-xs opacity-0 group-hover:opacity-100">✏️</span>}
        </dd>
      </div>
    )
  }

  const commit = () => { setEditing(false); if (draft !== String(value ?? '')) onSave(fieldKey, draft) }
  const inputCls = 'w-full bg-gray-700 border border-red-600/50 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500'

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <dt className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</dt>
      {type === 'select' && options ? (
        <select className={inputCls} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} autoFocus>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'multi-select' ? (
        <div className="bg-gray-800 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 border border-gray-600">
          {(options || []).map((opt: string) => {
            const selected = draft ? draft.split(' | ').includes(opt) : false
            return (
              <label key={opt} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-gray-700">
                <input type="checkbox" checked={selected}
                  onChange={e => {
                    const parts = draft ? draft.split(' | ').filter(Boolean) : []
                    const next = e.target.checked ? [...parts, opt] : parts.filter(p => p !== opt)
                    const val = next.join(' | ')
                    setDraft(val)
                  }}
                  className="accent-red-500" />
                <span className="text-sm text-gray-200">{opt}</span>
              </label>
            )
          })}
          <div className="pt-1 border-t border-gray-700 flex justify-end">
            <button type="button" onClick={commit}
              className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg">Save</button>
          </div>
        </div>
      ) : type === 'clinical-select' ? (
        <SearchableSelect
          options={CLINICAL_OPTION_VALUES.map((v: string) => ({ value: v, label: v, group: '' }))}
          value={draft}
          onChange={(v: string) => { setDraft(v); commit() }}
          placeholder="Search impression..."
        />
      ) : type === 'textarea' ? (
        <textarea className={inputCls + ' resize-none'} rows={4} value={draft}
          onChange={e => setDraft(e.target.value)} onBlur={commit} autoFocus />
      ) : (
        <input type={type} className={inputCls} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus />
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  const display = value === null || value === undefined || value === ''
    ? <span className="text-gray-600">—</span>
    : value === true ? <span className="text-green-400">Yes</span>
    : value === false ? <span className="text-gray-500">No</span>
    : <span className="text-white">{String(value)}</span>
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm">{display}</dd>
    </div>
  )
}

function DraggableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="min-w-0">
      <div className="group relative min-w-0">
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-4 top-3 text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity select-none text-sm z-10"
          title="Drag to reorder"
        >⠿</div>
        {children}
      </div>
    </div>
  )
}

function SectionCard({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
        {badge && <span>{badge}</span>}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {children}
      </dl>
    </div>
  )
}

function acuityColor(acuity: string | null) {
  if (!acuity) return 'bg-gray-700 text-gray-400'
  if (acuity.startsWith('Green') || acuity.startsWith('Lower')) return 'bg-green-900 text-green-300'
  if (acuity.startsWith('Yellow') || acuity.startsWith('Emergent')) return 'bg-yellow-900 text-yellow-300'
  if (acuity.startsWith('Red') || acuity.startsWith('Critical')) return 'bg-red-900 text-red-300'
  if (acuity.startsWith('Black') || acuity.startsWith('Dead')) return 'bg-gray-700 text-gray-300'
  return 'bg-blue-900 text-blue-300'
}
function acuityLabel(acuity: string | null) {
  if (!acuity) return '—'
  if (acuity.startsWith('Red') || acuity.startsWith('Critical')) return 'Immediate'
  if (acuity.startsWith('Yellow') || acuity.startsWith('Emergent')) return 'Delayed'
  if (acuity.startsWith('Green') || acuity.startsWith('Lower')) return 'Minimal'
  if (acuity.startsWith('Black') || acuity.startsWith('Dead')) return 'Expectant'
  return 'Routine'
}

function statusColor(status: string | null) {
  if (status === 'Signed') return 'bg-green-900 text-green-300 border-green-700'
  if (status === 'Complete') return 'bg-blue-900 text-blue-300 border-blue-700'
  return 'bg-gray-800 text-gray-400 border-gray-700'
}

function formatDateTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dash(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}

// ── Vitals Trend Table ──────────────────────────────────────────────────────

type VitalsColumn = {
  label: string
  hr: number | null
  rr: number | null
  spo2: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  gcs: number | null
  pain_scale: number | null
  temp_f: number | null
  blood_glucose: number | null
  cardiac_rhythm: string | null
  skin: string | null
  etco2: number | null
  pupils: string | null
}

function VitalsTrendTable({ columns }: { columns: VitalsColumn[] }) {
  if (columns.length === 0) return null

  const rows: { label: string; key: keyof VitalsColumn; format?: (v: VitalsColumn) => string }[] = [
    { label: 'HR', key: 'hr', format: c => c.hr ? `${c.hr}` : '—' },
    { label: 'RR', key: 'rr', format: c => c.rr ? `${c.rr}` : '—' },
    { label: 'SpO2', key: 'spo2', format: c => c.spo2 ? `${c.spo2}%` : '—' },
    {
      label: 'BP', key: 'bp_systolic',
      format: c => c.bp_systolic && c.bp_diastolic ? `${c.bp_systolic}/${c.bp_diastolic}` : c.bp_systolic ? `${c.bp_systolic}` : '—',
    },
    { label: 'GCS', key: 'gcs', format: c => c.gcs ? `${c.gcs}` : '—' },
    { label: 'Pain', key: 'pain_scale', format: c => c.pain_scale !== null ? `${c.pain_scale}/10` : '—' },
    { label: 'Temp', key: 'temp_f', format: c => c.temp_f ? `${c.temp_f}°F` : '—' },
    { label: 'BGL', key: 'blood_glucose', format: c => c.blood_glucose ? `${c.blood_glucose}` : '—' },
    { label: 'EtCO2', key: 'etco2', format: c => c.etco2 ? `${c.etco2}` : '—' },
    { label: 'Rhythm', key: 'cardiac_rhythm', format: c => c.cardiac_rhythm ? c.cardiac_rhythm.replace(' (Normal Sinus Rhythm)', '').replace(' (Pulseless Electrical Activity)', '') : '—' },
    { label: 'Skin', key: 'skin', format: c => c.skin ?? '—' },
    { label: 'Pupils', key: 'pupils', format: c => c.pupils ?? '—' },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="text-sm min-w-full">
        <thead>
          <tr>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-1.5 pr-4 w-16">Vital</th>
            {columns.map((col, i) => (
              <th key={i} className={`text-center text-xs py-1.5 px-3 whitespace-nowrap ${i === 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const vals = columns.map(c => row.format ? row.format(c) : dash(c[row.key] as string | number | null))
            const hasAny = vals.some(v => v !== '—')
            if (!hasAny) return null
            return (
              <tr key={row.label} className="border-t border-gray-800">
                <td className="text-xs text-gray-500 uppercase tracking-wide py-1.5 pr-4">{row.label}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`text-center py-1.5 px-3 whitespace-nowrap ${v === '—' ? 'text-gray-700' : 'text-white'}`}>
                    {v}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Add Vitals Form ─────────────────────────────────────────────────────────

type VitalsFormState = {
  recorded_at: string
  recorded_by: string
  hr: string
  rr: string
  spo2: string
  bp_systolic: string
  bp_diastolic: string
  gcs_eye: string
  gcs_verbal: string
  gcs_motor: string
  gcs_total: string
  pain_scale: string
  blood_glucose: string
  temp_f: string
  skin: string
  cardiac_rhythm: string
  etco2: string
  pupils: string
  notes: string
}

function blankVitalsForm(): VitalsFormState {
  const now = new Date()
  return {
    recorded_at: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,  // local time
    recorded_by: '',
    hr: '', rr: '', spo2: '',
    bp_systolic: '', bp_diastolic: '',
    gcs_eye: '', gcs_verbal: '', gcs_motor: '', gcs_total: '',
    pain_scale: '', blood_glucose: '', temp_f: '',
    skin: '', cardiac_rhythm: '', etco2: '', pupils: '', notes: '',
  }
}

function AddVitalsForm({
  encounterId,
  crewOptions,
  onSaved,
  onCancel,
  currentUser,
}: {
  encounterId: string
  crewOptions: { id: string; name: string }[]
  onSaved: (v: EncounterVitals) => void
  onCancel: () => void
  currentUser: any
}) {
  const supabase = createClient()
  const [form, setForm] = useState<VitalsFormState>(() => {
    const blank = blankVitalsForm()
    return {
      ...blank,
      recorded_by: currentUser?.employee?.name || ''
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof VitalsFormState, v: string) => {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      // Auto-calc GCS total
      if (k === 'gcs_eye' || k === 'gcs_verbal' || k === 'gcs_motor') {
        const e = k === 'gcs_eye' ? Number(v) : Number(next.gcs_eye)
        const vb = k === 'gcs_verbal' ? Number(v) : Number(next.gcs_verbal)
        const m = k === 'gcs_motor' ? Number(v) : Number(next.gcs_motor)
        if (e && vb && m) next.gcs_total = String(e + vb + m)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const vitalsPayload = {
        encounter_id: encounterId,
        recorded_at: new Date(form.recorded_at).toISOString(),
        recorded_by: form.recorded_by || null,
        hr: form.hr ? Number(form.hr) : null,
        rr: form.rr ? Number(form.rr) : null,
        spo2: form.spo2 ? Number(form.spo2) : null,
        bp_systolic: form.bp_systolic ? Number(form.bp_systolic) : null,
        bp_diastolic: form.bp_diastolic ? Number(form.bp_diastolic) : null,
        gcs_eye: form.gcs_eye ? Number(form.gcs_eye) : null,
        gcs_verbal: form.gcs_verbal ? Number(form.gcs_verbal) : null,
        gcs_motor: form.gcs_motor ? Number(form.gcs_motor) : null,
        gcs_total: form.gcs_total ? Number(form.gcs_total) : null,
        pain_scale: form.pain_scale ? Number(form.pain_scale) : null,
        blood_glucose: form.blood_glucose ? Number(form.blood_glucose) : null,
        temp_f: form.temp_f ? Number(form.temp_f) : null,
        skin: form.skin || null,
        cardiac_rhythm: form.cardiac_rhythm || null,
        etco2: form.etco2 ? Number(form.etco2) : null,
        pupils: form.pupils || null,
        notes: form.notes || null,
      }
      if (getIsOnline()) {
        const { data, error: err } = await supabase
          .from('encounter_vitals')
          .insert(vitalsPayload)
          .select()
          .single()
        if (err) throw err
        onSaved(data as EncounterVitals)
      } else {
        const tempId = crypto.randomUUID()
        const offlineVital = { id: tempId, ...vitalsPayload }
        await queueOfflineWrite('encounter_vitals', 'insert', offlineVital)
        await cacheData('vitals', [offlineVital])
        onSaved(offlineVital as EncounterVitals)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  const inp = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const lbl = 'text-xs text-gray-400 block mb-1'

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4 mt-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">New Vitals Set</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Time *</label>
          <input type="datetime-local" value={form.recorded_at} onChange={e => set('recorded_at', e.target.value)} className={inp} style={{ maxWidth: '100%', fontSize: '13px' }} />
        </div>
        <div>
          <label className={lbl}>Recorded By</label>
          <input type="text" value={form.recorded_by} readOnly className={inp + ' bg-gray-900 cursor-default'} />
          <p className="text-xs text-gray-600 mt-1">Auto-populated with your name</p>
        </div>
      </div>

      {/* Basic Vitals */}
      <div className="grid grid-cols-3 gap-3">
        {(['hr', 'rr', 'spo2'] as const).map(k => (
          <div key={k}>
            <label className={lbl}>{k === 'spo2' ? 'SpO2 %' : k.toUpperCase()}</label>
            <input type="number" value={form[k]} onChange={e => set(k, e.target.value)} className={inp} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>BP Systolic</label>
          <input type="number" value={form.bp_systolic} onChange={e => set('bp_systolic', e.target.value)} className={inp} placeholder="mmHg" />
        </div>
        <div>
          <label className={lbl}>BP Diastolic</label>
          <input type="number" value={form.bp_diastolic} onChange={e => set('bp_diastolic', e.target.value)} className={inp} placeholder="mmHg" />
        </div>
      </div>

      {/* GCS */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className={lbl}>Eye (1-4)</label>
          <select value={form.gcs_eye} onChange={e => set('gcs_eye', e.target.value)} className={inp}>
            <option value="">—</option>
            <option value="1">1</option><option value="2">2</option>
            <option value="3">3</option><option value="4">4</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Verbal (1-5)</label>
          <select value={form.gcs_verbal} onChange={e => set('gcs_verbal', e.target.value)} className={inp}>
            <option value="">—</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Motor (1-6)</label>
          <select value={form.gcs_motor} onChange={e => set('gcs_motor', e.target.value)} className={inp}>
            <option value="">—</option>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>GCS Total</label>
          <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm text-center font-bold">
            {form.gcs_total || '—'}
          </div>
        </div>
      </div>

      {/* Other vitals */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Pain (0-10)</label>
          <input type="number" min="0" max="10" value={form.pain_scale} onChange={e => set('pain_scale', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>BGL mg/dL</label>
          <input type="number" value={form.blood_glucose} onChange={e => set('blood_glucose', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Temp °F</label>
          <input type="number" step="0.1" value={form.temp_f} onChange={e => set('temp_f', e.target.value)} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>EtCO2</label>
          <input type="number" value={form.etco2} onChange={e => set('etco2', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Skin Signs</label>
          <select value={form.skin} onChange={e => set('skin', e.target.value)} className={inp}>
            <option value="">—</option>
            {SKIN_SIGNS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Cardiac Rhythm</label>
          <select value={form.cardiac_rhythm} onChange={e => set('cardiac_rhythm', e.target.value)} className={inp}>
            <option value="">—</option>
            {CARDIAC_RHYTHMS.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Pupils</label>
          <select value={form.pupils} onChange={e => set('pupils', e.target.value)} className={inp}>
            <option value="">—</option>
            {PUPILS_OPTIONS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={lbl}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inp + ' resize-none'} />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-lg text-sm transition-colors">
          {saving ? 'Saving...' : 'Save Vitals'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
          Cancel
        </button>
      </div>

    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────



// ── NEMSIS Canonical Options ──
const AGENCY_OPTIONS = ['USFS','Cal Fire','BLM','ODF','NPS','BIA','USFWS','DOD','State/Local Fire','Private Contractor','Other']

const PATIENT_GENDER_OPTIONS = ['Male','Female','Female-to-Male Transgender','Male-to-Female Transgender','Other','Unknown']

const TYPE_OF_SERVICE_OPTIONS_NEMSIS = [
  '911 Response','Interfacility Transfer','Medical Transport','Fire/Rescue',
  'Standby','Mutual Aid','Event Coverage','Training','Other'
]

const RESPONSE_MODE_OPTIONS = ['Emergent','Non-Emergent','Standby']

const TRANSPORT_MODE_OPTIONS = ['Ground BLS','Ground ALS','Air Medical Rotor','Air Medical Fixed-Wing','Other']


const PATIENT_RACE_OPTIONS = [
  'American Indian or Alaska Native','Asian','Black or African American',
  'Hispanic or Latino','Native Hawaiian or Other Pacific Islander',
  'White','Multiracial','Other','Unknown','Refused'
]

const SITUATION_CATEGORY_OPTIONS = [
  'Trauma','Cardiac','Respiratory','Neurological','Gastrointestinal','Obstetric',
  'Toxicological','Environmental','Behavioral/Psychiatric','Allergic','Endocrine','Other'
]


const LEVEL_OF_CARE_OPTIONS = ['BLS','ALS','Critical Care','Specialty Care']

const TRANSPORT_DISPOSITION_OPTIONS = [
  'Transport by This EMS Unit','Transport by Another EMS Unit','Transport by Law Enforcement',
  'Transport by Private Vehicle','Treated, Released, No Transport',
  'Treated, Transferred Care','Patient Refused Care','Cancelled Prior to Arrival',
  'No Patient Found','Standby - No Treatment Required','Dead at Scene','Other'
]

// eSituation.15 - Patient's Occupational Industry (NAICS)
const OCCUPATIONAL_INDUSTRY_OPTIONS = [
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

// eSituation.16 - Patient's Occupation (SOC)
const PATIENT_OCCUPATION_OPTIONS = [
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


// Chief Complaint (NEMSIS eSituation.09 - Primary Complaint)
const CHIEF_COMPLAINT_OPTIONS = [
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

// No Transport Reason (NEMSIS eDisposition.28)
const NO_TRANSPORT_REASON_OPTIONS = [
  'ALS Not Required','Cancelled Prior to Arrival','No Patient Found',
  'Patient Died During This EMS Encounter','Patient Evaluated, No Treatment/Transport Required',
  'Patient Refused Care (AMA)','Patient Treated and Released','Patient Transferred Care',
  'Standby — No Patient Contact','Other'
]

// Hospital Capability (NEMSIS eDisposition.19) — multi-select
const HOSPITAL_CAPABILITY_OPTIONS = [
  'Burn Center','Cardiac Intervention Center','Neonatal Center','Pediatric Center',
  'Stroke Center','Trauma Center — Level 1','Trauma Center — Level 2','Trauma Center — Level 3',
  'Trauma Center — Level 4','Hyperbaric Oxygen Therapy','STEMI Receiving Center',
  'Cardiac Surgery Center','Obstetrics','Rural Primary Care','Community Hospital','Other'
]

// Clinical impression options (shared with PCR form)
const CLINICAL_OPTION_VALUES = [
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

export default function EncounterDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const navigate = useNavigate()
  const id = params.id as string

  const [enc, setEnc] = useState<Encounter | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const { isAdmin, isField } = useRole()
  const currentUser = useUserAssignment()
  const [progressNotes, setProgressNotes] = useState<any[]>([])
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [notePin, setNotePin] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Vitals state
  const [additionalVitals, setAdditionalVitals] = useState<EncounterVitals[]>([])
  const [showAddVitals, setShowAddVitals] = useState(false)
  const [crewOptions, setCrewOptions] = useState<{ id: string; name: string }[]>([])
  const [providerOptions, setProviderOptions] = useState<string[]>([])

  // Photos & Procedures
  const [photos, setPhotos] = useState<PatientPhoto[]>([])
  const [procedures, setProcedures] = useState<EncounterProcedure[]>([])

  // Linked documents
  const [consentForms, setConsentForms] = useState<ConsentForm[]>([])
  const [compClaims, setCompClaims] = useState<CompClaim[]>([])
  const [marEntries, setMarEntries] = useState<any[]>([])
  const [narrativeExpanded, setNarrativeExpanded] = useState(false)
  const [editingMarQtyId, setEditingMarQtyId] = useState<string | null>(null)
  const [editingMarQtyValue, setEditingMarQtyValue] = useState<string>('')
  const [showConsentForms, setShowConsentForms] = useState(true)
  const [showCompClaims, setShowCompClaims] = useState(true)

// Draggable section order
const AMBULANCE_DEFAULT_ORDER = ['actions', 'narrative', 'response', 'scene', 'assessment', 'cardiac', 'vitals', 'mar', 'procedures', 'photos', 'transport', 'provider', 'ama', 'comp']
const MEDUNIT_DEFAULT_ORDER = ['actions', 'narrative', 'assessment', 'vitals', 'mar', 'procedures', 'photos', 'transport', 'provider', 'ama', 'comp']
  const [cardOrder, setCardOrder] = useState<string[]>(AMBULANCE_DEFAULT_ORDER)
  const savedPrefRef = useRef(false)
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Record<string, string>>({})
  const [consentPdfUrls, setConsentPdfUrls] = useState<Record<string, string>>({})
  const [claimPdfUrls, setClaimPdfUrls] = useState<Record<string, string>>({})

  // Load saved section order for this user
  useEffect(() => {
    const loadPrefs = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: pref } = await supabase
        .from('user_preferences')
        .select('encounter_section_order')
        .eq('auth_user_id', user.id)
        .single()
      const allSections = [...new Set([...AMBULANCE_DEFAULT_ORDER, ...MEDUNIT_DEFAULT_ORDER])]
      if (pref && (pref as any).encounter_section_order && Array.isArray((pref as any).encounter_section_order)) {
        const saved = (pref as any).encounter_section_order as string[]
        // Merge saved with defaults (add any new sections not in saved)
        const merged = [...saved.filter((s: string) => allSections.includes(s)),
          ...allSections.filter((s: string) => !saved.includes(s))]
        setCardOrder(merged)
        savedPrefRef.current = true
      }
    }
    loadPrefs()
  }, [])


  // Set card order based on unit type after enc loads (only if no saved user preference)
  useEffect(() => {
    if (enc && !savedPrefRef.current) {
      const isAmb = enc.unit?.toUpperCase().startsWith('RAMBO')
      setCardOrder(isAmb ? AMBULANCE_DEFAULT_ORDER : MEDUNIT_DEFAULT_ORDER)
    }
  }, [enc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save a single field to the database
  const saveField = useCallback(async (key: string, val: string) => {
    const coerced: Record<string, unknown> = {}
    // Boolean fields
    const boolFields = ['possible_injury']
    // Columns that are text[] arrays in the DB — wrap string value in array
    const arrayFields = ['secondary_impression', 'advance_directive', 'arrest_witnessed',
      'cpr_type', 'resuscitation_attempted', 'dispatch_delay', 'response_delay',
      'scene_delay', 'transport_delay', 'turnaround_delay', 'transport_mode_descriptors']
    // Coerce numeric fields
    const numericFields = ['num_patients_at_scene', 'patient_age']
    if (boolFields.includes(key)) {
      coerced[key] = val === 'true' ? true : val === 'false' ? false : null
    } else if (arrayFields.includes(key)) {
      // Wrap single string in array; empty string → empty array
      coerced[key] = val === '' ? [] : [val]
    } else if (numericFields.includes(key)) {
      coerced[key] = val === '' ? null : Number(val)
    } else {
      coerced[key] = val === '' ? null : val
    }
    if (getIsOnline()) {
      const { error } = await supabase.from('patient_encounters').update(coerced).eq('id', id)
      if (!error) {
        setEnc(prev => prev ? { ...prev, [key]: coerced[key] } as Encounter : prev)
      } else {
        console.error('saveField error:', error.message)
        alert('Save failed: ' + error.message)
      }
    } else {
      await queueOfflineWrite('patient_encounters', 'update', { id, ...coerced })
      setEnc(prev => prev ? { ...prev, [key]: coerced[key] } as Encounter : prev)
    }
  }, [id, supabase])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setCardOrder(prev => {
        const oldIdx = prev.indexOf(active.id as string)
        const newIdx = prev.indexOf(over.id as string)
        const newOrder = arrayMove(prev, oldIdx, newIdx)
        // Persist to user_preferences
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (!user) return
          supabase.from('user_preferences').upsert({
            auth_user_id: user.id,
            encounter_section_order: newOrder,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'auth_user_id' }).then(({ error }) => {
            if (error) console.error('Failed to save section order:', error.message)
          })
        })
        return newOrder
      })
    }
  }, [])
  const [compClaimsSupported, setCompClaimsSupported] = useState(true)

  useEffect(() => {
    const load = async () => {
      // Show cached data instantly
      try {
        const cached = await getCachedById('encounters', id) as any
        if (cached) {
          setEnc(cached)
          setLoading(false)
        }
      } catch {}
      const { data, offline } = await loadSingle(
        () => supabase.from('patient_encounters').select('*').eq('id', id).single() as any,
        'encounters',
        id
      )
      if (offline) {
        if (data) {
          setIsOfflineData(true)
          const cachedVitals = await getCachedData('vitals')
          setAdditionalVitals(cachedVitals.filter((v: any) => v.encounter_id === id))
          const cachedMar = await getCachedData('mar_entries')
          if ((data as any).encounter_id) {
            setMarEntries(cachedMar.filter((m: any) => m.encounter_id === (data as any).encounter_id))
          }
        }
        setEnc(data)
        setLoading(false)
        return
      }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUserEmail(user?.email || null)
      } catch {}
      setEnc(data)

      // Load serial vitals
      const { data: vitals } = await supabase
        .from('encounter_vitals')
        .select('*')
        .eq('encounter_id', id)
        .order('recorded_at', { ascending: true })
      setAdditionalVitals(vitals || [])
      if (vitals) await cacheData('vitals', vitals)

      // Load photos
      const { data: photoData } = await supabase
        .from('patient_photos')
        .select('*')
        .eq('encounter_id', id)
        .order('taken_at', { ascending: true })
      setPhotos(photoData || [])

      // Generate display URLs for photos
      if (photoData && photoData.length > 0) {
        const urlMap: Record<string, string> = {}
        await Promise.all((photoData as any[]).map(async (ph) => {
          if (!ph.photo_url) return
          const raw = ph.photo_url as string
          if (raw.startsWith('http')) {
            // Already a full URL — use directly (public bucket)
            urlMap[ph.id] = raw
          } else {
            // Relative storage path — try signed URL first, fall back to public URL
            const { data: signed } = await supabase.storage
              .from('patient-photos')
              .createSignedUrl(raw, 3600)
            if (signed?.signedUrl) {
              urlMap[ph.id] = signed.signedUrl
            } else {
              // Public URL fallback
              const { data: pub } = supabase.storage.from('patient-photos').getPublicUrl(raw)
              if (pub?.publicUrl) urlMap[ph.id] = pub.publicUrl
            }
          }
        }))
        setPhotoSignedUrls(urlMap)
      }

      // Load procedures
      const { data: procData } = await supabase
        .from('encounter_procedures')
        .select('*')
        .eq('encounter_id', id)
        .order('performed_at', { ascending: true })
      setProcedures(procData || [])

      // Load MAR entries
      const encIdForMar = (data as any)?.encounter_id || null
      if (encIdForMar) {
        const { data: marData } = await supabase
          .from('dispense_admin_log')
          .select('id, date, time, item_name, item_type, qty_used, dosage_units, medication_route, dispensed_by, requires_cosign, provider_signature_url, med_unit')
          .eq('encounter_id', encIdForMar)
          .order('date', { ascending: false })
          .order('time', { ascending: false })
        setMarEntries(marData || [])
      }

      // Load linked consent forms — match by encounter_id text (FK) or encounter UUID
      const encIdText = (data as any)?.encounter_id || null
      const { data: consentData } = await supabase
        .from('consent_forms')
        .select('id, consent_id, consent_type, date_time, patient_first_name, patient_last_name, provider_of_record, signed, pdf_url')
        .eq('encounter_id', encIdText || id)
        .order('date_time', { ascending: false })
      setConsentForms(consentData || [])
      // Generate signed URLs for consent form PDFs (private documents bucket)
      if (consentData && consentData.length > 0) {
        const urlMap: Record<string, string> = {}
        await Promise.all(consentData.map(async (cf: any) => {
          if (!cf.pdf_url) return
          if (cf.pdf_url.startsWith('http')) { urlMap[cf.id] = cf.pdf_url; return }
          const { data: signed } = await supabase.storage.from('documents').createSignedUrl(cf.pdf_url, 3600)
          if (signed?.signedUrl) urlMap[cf.id] = signed.signedUrl
        }))
        setConsentPdfUrls(urlMap)
      }

      // Load linked comp claims (graceful fallback if column doesn't exist)
      try {
        const encText = (data as any)?.encounter_id || null
        const { data: claimsData, error: claimsError } = await supabase
          .from('comp_claims')
          .select('id, encounter_id, patient_name, date_of_injury, status, pdf_url, created_at')
          .eq('encounter_id', encText || id)
          .order('created_at', { ascending: false })
        if (claimsError) {
          setCompClaimsSupported(false)
        } else {
          setCompClaims(claimsData || [])
          // Generate signed URLs for comp claim PDFs
          if (claimsData && claimsData.length > 0) {
            const urlMap: Record<string, string> = {}
            await Promise.all(claimsData.map(async (cc: any) => {
              if (!cc.pdf_url) return
              if (cc.pdf_url.startsWith('http')) { urlMap[cc.id] = cc.pdf_url; return }
              const { data: signed } = await supabase.storage.from('documents').createSignedUrl(cc.pdf_url, 3600)
              if (signed?.signedUrl) urlMap[cc.id] = signed.signedUrl
            }))
            setClaimPdfUrls(urlMap)
          }
        }
      } catch {
        setCompClaimsSupported(false)
      }

      // Try to load crew for the unit
      if (data?.unit) {
        // Load only crew assigned to this unit via unit_assignments
        const { data: iuData } = await supabase
          .from('incident_units')
          .select('id')
          .eq('unit_id', data.unit_id || '')
          .is('released_at', null)
          .limit(1)
        
        let crew: {id: string, name: string}[] = []
        if (iuData?.length) {
          const { data: assignedCrew } = await supabase
            .from('unit_assignments')
            .select('employee:employees(id, name)')
            .eq('incident_unit_id', iuData[0].id)
            .is('released_at', null)
          crew = ((assignedCrew || []).map((a: any) => a.employee).filter(Boolean)) as {id: string, name: string}[]
        }
        // Fallback to all active if no unit assignments found
        if (!crew.length) {
          const { data: allCrew } = await supabase
            .from('employees')
            .select('id, name')
            .eq('status', 'Active')
            .order('name')
          crew = allCrew || []
        }
        setCrewOptions(crew)
        // Load MD/NP/PA for Provider of Record dropdown
        const { data: provs } = await supabase
          .from('employees')
          .select('name')
          .in('role', ['MD', 'MD/DO', 'NP', 'PA'])
          .eq('status', 'Active')
          .order('name')
        setProviderOptions((provs || []).map((p: any) => p.name))
      }

      // Load progress notes
    if (data?.encounter_id) {
      const { data: notesData } = await supabase.from('progress_notes').select('*').eq('encounter_id', data.encounter_id).order('note_datetime', { ascending: false })
      setProgressNotes(notesData || [])
    }
    setLoading(false)
    }
    load()
  }, [id])
  const loadNotes = async () => {
    const encId = enc?.encounter_id
    if (!encId) return
    const { data } = await supabase.from('progress_notes').select('*').eq('encounter_id', encId).order('note_datetime', { ascending: false })
    setProgressNotes(data || [])
  }

  const saveProgressNote = async () => {
    if (!noteDraft.trim() || !enc) return
    setNoteSaving(true)
    const myName = currentUser.employee?.name || 'Unknown'
    const myRole = currentUser.employee?.role || ''
    const now = new Date().toISOString()
    const signedAt = notePin ? now : null
    const notePayload = {
      encounter_id: enc.encounter_id,
      encounter_uuid: enc.id,
      note_text: noteDraft.trim(),
      author_name: myName,
      author_role: myRole,
      note_datetime: now,
      signed_at: signedAt,
      signed_by: signedAt ? myName : null,
    }
    if (getIsOnline()) {
      await supabase.from('progress_notes').insert(notePayload)
    } else {
      await queueOfflineWrite('progress_notes', 'insert', notePayload)
    }
    setNoteDraft('')
    setNotePin('')
    setShowNoteForm(false)
    setNoteSaving(false)
    loadNotes()
  }

  const markComplete = async () => {
    if (!enc) return
    // Block completion if there are NEMSIS errors on ambulance PCRs
    if (enc.unit?.toUpperCase().startsWith('RAMBO') && nemsisErrorCountRef.current > 0) {
      const errs = nemsisErrorsRef.current
      const errorList = errs.slice(0, 3).map((e: any) => '• ' + e.message).join('\n')
      const moreMsg = nemsisErrorCountRef.current > 3 ? '\n• ...and ' + (nemsisErrorCountRef.current - 3) + ' more' : ''
      alert('Cannot complete: ' + nemsisErrorCountRef.current + ' NEMSIS error' + (nemsisErrorCountRef.current > 1 ? 's' : '') + ' must be fixed first:\n\n' + errorList + moreMsg)
      return
    }
    setActionLoading(true)
    if (getIsOnline()) {
      await supabase.from('patient_encounters').update({ pcr_status: 'Complete' }).eq('id', id)
    } else {
      await queueOfflineWrite('patient_encounters', 'update', { id, pcr_status: 'Complete' })
    }
    setEnc(prev => prev ? { ...prev, pcr_status: 'Complete' } : prev)

    // Auto-generate and store NEMSIS XML for ambulance units (online only)
    if (getIsOnline() && enc.unit?.startsWith('RAMBO')) {
      try {
        const xmlResp = await fetch(`/api/encounters/${id}/nemsis-export`)
        if (xmlResp.ok) {
          const xmlText = await xmlResp.text()
          const blob = new Blob([xmlText], { type: 'application/xml' })

          // 1. Upload to Supabase storage (documents bucket, nemsis/ folder)
          const filename = `nemsis/${enc.encounter_id || id}-NEMSIS.xml`
          const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(filename, blob, { contentType: 'application/xml', upsert: true })

          if (!uploadErr) {
            // Save path to DB for later retrieval
            await supabase.from('patient_encounters')
              .update({ nemsis_xml_url: filename } as any)
              .eq('id', id)
            setEnc(prev => prev ? { ...prev, nemsis_xml_url: filename } as any : prev)
          }

          // 2. Also trigger browser download for the provider
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${enc.encounter_id || id}-NEMSIS.xml`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } catch (err) {
        console.error('NEMSIS XML generation failed:', err)
        // Non-fatal — PCR is still marked Complete even if XML fails
      }
    }

    setActionLoading(false)
  }

  const signAndLock = async () => {
    if (!enc) return
    setActionLoading(true)
    const now = new Date().toISOString()
    const signerName = currentUser.employee?.name || userEmail || 'unknown'
    const { error } = await supabase.from('patient_encounters').update({
      pcr_status: 'Signed',
      signed_at: now,
      signed_by: signerName,
    }).eq('id', id)
    if (error) {
      await supabase.from('patient_encounters').update({ pcr_status: 'Signed' }).eq('id', id)
      setEnc(prev => prev ? { ...prev, pcr_status: 'Signed' } : prev)
    } else {
      setEnc(prev => prev ? { ...prev, pcr_status: 'Signed', signed_at: now, signed_by: signerName } : prev)
    }
    setActionLoading(false)
  }

  // NEMSIS quality warnings — must be called before any early returns (hooks rule)
  const allNemsisWarnings = useNEMSISWarnings(enc ?? {} as Record<string, any>)
  const isAmbulance = enc?.unit?.toUpperCase().startsWith('RAMBO') ?? false
  const nemsisWarnings = isAmbulance ? allNemsisWarnings : []
  const nemsisErrors = nemsisWarnings.filter((w: any) => w.severity === 'error')
  const nemsisWarningCount = nemsisWarnings.filter((w: any) => w.severity === 'warning').length
  const nemsisErrorCount = nemsisErrors.length
  const nemsisErrorCountRef = useRef(0)
  const nemsisErrorsRef = useRef<any[]>([])
  nemsisErrorCountRef.current = nemsisErrorCount
  nemsisErrorsRef.current = nemsisErrors

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!enc) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Encounter not found.</p>
        <Link to="/encounters" className="text-red-400 underline">← Back</Link>
      </div>
    </div>
  )

  const patientName = enc.patient_last_name
    ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
    : enc.patient_first_name || 'Unknown Patient'

  const isSigned = enc.pcr_status === 'Signed'
  const isLocked = enc.pcr_status === 'Complete' || !!enc.signed_at

  // EMT and Tech roles cannot log medications or procedures (view only)
  const canMedicate = !['EMT', 'Tech'].includes(currentUser.employee?.role || '')

  // NEMSIS warnings computed below early returns — see after isLocked

  // Build vitals columns: first = initial vitals from encounter, then serial
  const encounterDateLabel = enc.time
    ? `${enc.date} ${enc.time}`
    : enc.date

  const initialColumn: VitalsColumn = {
    label: encounterDateLabel,
    hr: enc.initial_hr ?? enc.heart_rate,
    rr: enc.initial_rr ?? enc.respiratory_rate,
    spo2: enc.initial_spo2 ?? enc.spo2,
    bp_systolic: enc.initial_bp_systolic ?? enc.blood_pressure_systolic,
    bp_diastolic: enc.initial_bp_diastolic ?? enc.blood_pressure_diastolic,
    gcs: enc.initial_gcs_total ?? enc.gcs,
    pain_scale: enc.initial_pain_scale ?? enc.pain_scale,
    temp_f: enc.initial_temp_f ?? enc.temperature,
    blood_glucose: enc.initial_blood_glucose ?? enc.blood_glucose,
    cardiac_rhythm: enc.cardiac_rhythm ?? null,
    skin: enc.initial_skin ?? enc.skin_condition,
    etco2: enc.etco2 ?? null,
    pupils: enc.pupils ?? null,
  }

  const serialColumns: VitalsColumn[] = additionalVitals.map(v => ({
    label: formatTime(v.recorded_at),
    hr: v.hr,
    rr: v.rr,
    spo2: v.spo2,
    bp_systolic: v.bp_systolic,
    bp_diastolic: v.bp_diastolic,
    gcs: v.gcs_total,
    pain_scale: v.pain_scale,
    temp_f: v.temp_f,
    blood_glucose: v.blood_glucose,
    cardiac_rhythm: v.cardiac_rhythm,
    skin: v.skin,
    etco2: v.etco2,
    pupils: v.pupils,
  }))

  const allVitalsColumns = [initialColumn, ...serialColumns]

  const hasAnyInitialVitals = [
    enc.initial_hr ?? enc.heart_rate,
    enc.initial_rr ?? enc.respiratory_rate,
    enc.initial_spo2 ?? enc.spo2,
    enc.initial_bp_systolic ?? enc.blood_pressure_systolic,
    enc.initial_gcs_total ?? enc.gcs,
    enc.initial_pain_scale ?? enc.pain_scale,
  ].some(v => v !== null && v !== undefined)


  // Helper: count warnings for a given section
  const sectionWarningCount = (section: string) =>
    nemsisWarnings.filter(w => w.section === section).length
  const sectionErrorCount = (section: string) =>
    nemsisWarnings.filter(w => w.section === section && w.severity === 'error').length
  const SectionBadge = ({ section }: { section: string }) => {
    const sectionIssues = nemsisWarnings.filter(w => w.section === section)
    const errs = sectionIssues.filter(w => w.severity === 'error')
    const warns = sectionIssues.filter(w => w.severity === 'warning')
    if (!isAmbulance || sectionIssues.length === 0) return null
    return errs.length > 0
      ? <NEMSISTooltip issues={sectionIssues}><span className="text-xs px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 font-semibold cursor-help">🚫 {errs.length}</span></NEMSISTooltip>
      : <NEMSISTooltip issues={sectionIssues}><span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300 font-semibold cursor-help">⚠️ {warns.length}</span></NEMSISTooltip>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">

        {/* Back */}
        <Link to="/encounters" className="text-gray-500 hover:text-gray-300 text-sm">← Encounters</Link>

        {/* Status Bar */}
        <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${statusColor(enc.pcr_status)}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider">PCR Status</span>
            <span className="font-semibold">{enc.pcr_status || 'Draft'}</span>
            {marEntries.some((m: any) => m.requires_cosign && !m.provider_signature_url) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300 font-semibold">
                ✍️ Unsigned Order
              </span>
            )}
            {/* NEMSIS quality badge */}
            {isAmbulance && !isLocked && (
              nemsisErrorCount > 0 ? (
                <NEMSISTooltip issues={nemsisErrors}>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 font-semibold cursor-help">
                    🚫 {nemsisErrorCount} NEMSIS error{nemsisErrorCount > 1 ? 's' : ''}
                  </span>
                </NEMSISTooltip>
              ) : nemsisWarningCount > 0 ? (
                <NEMSISTooltip issues={nemsisWarnings.filter((w: any) => w.severity === 'warning')}>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 font-semibold cursor-help">
                    ⚠️ {nemsisWarningCount} quality {nemsisWarningCount > 1 ? 'issues' : 'issue'}
                  </span>
                </NEMSISTooltip>
              ) : allNemsisWarnings.length === 0 ? null : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-semibold">✅ NEMSIS ready</span>
              )
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isSigned && (
              <Link
                to={`/encounters/${enc.id}/edit`}
                className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Edit
              </Link>
            )}
            {enc.pcr_status === 'Draft' || !enc.pcr_status ? (
              <button
                onClick={markComplete}
                disabled={actionLoading}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold"
              >
                Mark Complete
              </button>
            ) : enc.pcr_status === 'Complete' ? (
              <button
                onClick={signAndLock}
                disabled={actionLoading}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold"
              >
                Sign & Lock
              </button>
            ) : null}
          </div>
        </div>

        {/* Offline Data Banner */}
        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Signed/Locked Banner */}
        {isSigned && (
          <div className="bg-green-950 border border-green-800 rounded-xl px-4 py-3 text-sm text-green-300">
            🔒 Locked — signed by <strong>{enc.signed_by || 'unknown'}</strong>
            {enc.signed_at ? ` on ${formatDateTime(enc.signed_at)}` : ''}
          </div>
        )}

        {/* Header card */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex gap-2 items-start flex-wrap mb-0.5">
                <InlineField label="First Name" value={enc.patient_first_name} fieldKey="patient_first_name" isLocked={isLocked} onSave={saveField} type="text" />
                <InlineField label="Last Name" value={enc.patient_last_name} fieldKey="patient_last_name" isLocked={isLocked} onSave={saveField} type="text" />
              </div>
              <div className="flex gap-3 flex-wrap mt-1">
                <InlineField label="DOB" value={enc.patient_dob} fieldKey="patient_dob" isLocked={isLocked} onSave={saveField} type="date" />
                <InlineField label="Gender" value={enc.patient_gender} fieldKey="patient_gender" isLocked={isLocked} onSave={saveField} type="select" options={PATIENT_GENDER_OPTIONS} />
                {enc.patient_age ? <span className="text-gray-500 text-xs self-end pb-1">{enc.patient_age}y</span> : null}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {enc.encounter_id} · {enc.date} · {enc.unit}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {enc.initial_acuity && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${acuityColor(enc.initial_acuity)}`}>
                  {acuityLabel(enc.initial_acuity)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Draggable Chart Sections ── */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-4 relative">
              {cardOrder.map(sectionId => {
                switch (sectionId) {

                  case 'actions':
                    return (
                      <DraggableSection key="actions" id="actions">
                        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                          <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Chart Actions</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3">
                            <Link to={`/consent/ama?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&firstName=${encodeURIComponent(enc.patient_first_name||'')}&lastName=${encodeURIComponent(enc.patient_last_name||'')}`}
                              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                              <span>✍️</span> AMA / Refusal
                            </Link>
                            {canMedicate && <Link to={`/mar/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&patientName=${encodeURIComponent(((enc.patient_first_name||'')+' '+(enc.patient_last_name||'')).trim())}&dob=${encodeURIComponent(enc.patient_dob||'')}`}
                              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                              <span>💊</span> Log Medication
                            </Link>}
                            {canMedicate && <Link to={`/encounters/procedures/new?encounterId=${enc.encounter_id}`}
                              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                              <span>🩺</span> Add Procedure
                            </Link>}
                            <Link to={`/encounters/photos/new?encounterId=${enc.encounter_id}`}
                              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                              <span>📷</span> Add Photo
                            </Link>
                            <Link to={`/comp-claims/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&tebw=${encodeURIComponent(enc.time_employee_began_work || (enc.date ? enc.date + "T06:00" : ""))}`}
                              className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                              <span>📋</span> Comp Claim
                            </Link>
                            {status !== 'Signed' && (
                              <Link to={`/encounters/${enc.id}/edit`}
                                className="flex items-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                                <span>✏️</span> Edit
                              </Link>
                            )}
                            {enc.unit?.toUpperCase().startsWith('RAMBO') && (
                              <>
                                <a
                                  href={`/api/encounters/${enc.id}/nemsis-export`}
                                  download
                                  className="flex items-center gap-2 px-3 py-2.5 bg-blue-900 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors text-blue-200">
                                  <span>📤</span> Re-export XML
                                </a>
                                {(enc as any).nemsis_xml_url && (
                                  <button
                                    onClick={async () => {
                                      const { data } = await supabase.storage.from('documents').createSignedUrl((enc as any).nemsis_xml_url, 3600)
                                      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                                    }}
                                    className="flex items-center gap-2 px-3 py-2.5 bg-green-900 hover:bg-green-800 rounded-lg text-sm font-medium transition-colors text-green-200">
                                    <span>✅</span> Stored XML
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </DraggableSection>
                    )


                  case 'mar':
                    return (
                      <DraggableSection key="mar" id="mar">
                        <div className="bg-gray-900 rounded-xl border border-gray-800">
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              Medications Administered
                              {marEntries.length > 0 && <span className="ml-2 text-gray-600 font-normal normal-case">({marEntries.length})</span>}
                            </h2>
                            {!isLocked && canMedicate && (
                              <Link to={`/mar/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&patientName=${encodeURIComponent(((enc.patient_first_name||'')+' '+(enc.patient_last_name||'')).trim())}&dob=${encodeURIComponent(enc.patient_dob||'')}`}
                                className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
                                <span>+</span> Log Medication
                              </Link>
                            )}
                          </div>
                          {marEntries.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-600">No medications recorded. Use Chart Actions above.</p>
                          ) : (
                            <div className="divide-y divide-gray-800/60">
                              {marEntries.map((m: any) => (
                                <div key={m.id} className="flex items-center px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-sm gap-3">
                                  <Link to={`/mar/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-xs text-gray-500 shrink-0 w-28">{m.date ? m.date + ' ' : ''}{m.time?.slice(0,5) || ''}</span>
                                    <span className="flex-1 min-w-0">
                                      <span className="text-white font-medium truncate block">{m.item_name}</span>
                                      <span className="text-xs text-gray-500">
                                        {editingMarQtyId === m.id ? '...' : `${m.qty_used}${m.dosage_units ? ' ' + m.dosage_units : ''}`}
                                        {' '}&middot; {m.medication_route} &middot; {m.dispensed_by?.split(',')[0]}
                                      </span>
                                    </span>
                                  </Link>
                                  {m.item_type === 'CS' && <span className="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded shrink-0">CS</span>}
                                  {m.requires_cosign && !m.provider_signature_url && <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded shrink-0">⚠ Unsigned</span>}
                                  {editingMarQtyId === m.id ? (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        autoFocus
                                        className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-white"
                                        value={editingMarQtyValue}
                                        onChange={e => setEditingMarQtyValue(e.target.value)}
                                        onKeyDown={async e => {
                                          if (e.key === 'Escape') { setEditingMarQtyId(null); return }
                                          if (e.key === 'Enter') {
                                            const newQty = parseFloat(editingMarQtyValue)
                                            if (isNaN(newQty) || newQty < 0) { setEditingMarQtyId(null); return }
                                            const delta = newQty - m.qty_used
                                            if (getIsOnline()) {
                                              await supabase.from('dispense_admin_log').update({ qty_used: newQty }).eq('id', m.id)
                                              if (delta !== 0 && m.med_unit) {
                                                const { data: invSearch } = await supabase
                                                  .from('unit_inventory')
                                                  .select('id, quantity, incident_unit:incident_units(unit:units(name))')
                                                  .eq('item_name', m.item_name)
                                                  .limit(20)
                                                const matched = (invSearch || []).find((r: any) => r.incident_unit?.unit?.name === m.med_unit)
                                                if (matched) {
                                                  const newInvQty = Math.max(0, (matched.quantity || 0) - delta)
                                                  await supabase.from('unit_inventory').update({ quantity: newInvQty }).eq('id', matched.id)
                                                }
                                              }
                                            } else {
                                              await queueOfflineWrite('dispense_admin_log', 'update', { id: m.id, qty_used: newQty })
                                            }
                                            setMarEntries(prev => prev.map(x => x.id === m.id ? { ...x, qty_used: newQty } : x))
                                            setEditingMarQtyId(null)
                                          }
                                        }}
                                      />
                                      <button
                                        onClick={async () => {
                                          const newQty = parseFloat(editingMarQtyValue)
                                          if (isNaN(newQty) || newQty < 0) { setEditingMarQtyId(null); return }
                                          const delta = newQty - m.qty_used
                                          if (getIsOnline()) {
                                            await supabase.from('dispense_admin_log').update({ qty_used: newQty }).eq('id', m.id)
                                            if (delta !== 0 && m.med_unit) {
                                              const { data: invSearch } = await supabase
                                                .from('unit_inventory')
                                                .select('id, quantity, incident_unit:incident_units(unit:units(name))')
                                                .eq('item_name', m.item_name)
                                                .limit(20)
                                              const matched = (invSearch || []).find((r: any) => r.incident_unit?.unit?.name === m.med_unit)
                                              if (matched) {
                                                const newInvQty = Math.max(0, (matched.quantity || 0) - delta)
                                                await supabase.from('unit_inventory').update({ quantity: newInvQty }).eq('id', matched.id)
                                              }
                                            }
                                          } else {
                                            await queueOfflineWrite('dispense_admin_log', 'update', { id: m.id, qty_used: newQty })
                                          }
                                          setMarEntries(prev => prev.map(x => x.id === m.id ? { ...x, qty_used: newQty } : x))
                                          setEditingMarQtyId(null)
                                        }}
                                        className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-white"
                                      >✓</button>
                                      <button
                                        onClick={() => setEditingMarQtyId(null)}
                                        className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                                      >✕</button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => { setEditingMarQtyId(m.id); setEditingMarQtyValue(String(m.qty_used)) }}
                                      className="text-xs text-blue-400 hover:text-blue-300 shrink-0 transition-colors"
                                      title="Edit quantity"
                                    >
                                      Edit Qty
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </DraggableSection>
                    )

                  case 'vitals':
                    return (
                      <DraggableSection key="vitals" id="vitals">
                        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vitals Trend</h2>
                            <button onClick={() => setShowAddVitals(v => !v)}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white transition-colors">
                              {showAddVitals ? 'Cancel' : '+ Add Vitals'}
                            </button>
                          </div>
                          {(hasAnyInitialVitals || allVitalsColumns.length > 1) && (
                            <div className="overflow-x-auto">
                              <VitalsTrendTable columns={allVitalsColumns} />
                            </div>
                          )}
                          {!hasAnyInitialVitals && allVitalsColumns.length <= 1 && !showAddVitals && (
                            <p className="text-gray-600 text-sm">No vitals recorded yet. Tap "+ Add Vitals" to begin.</p>
                          )}
                          {showAddVitals && (
                            <AddVitalsForm encounterId={enc.id} crewOptions={crewOptions} currentUser={currentUser} onSaved={(v) => { setAdditionalVitals(prev => [...prev, v]); setShowAddVitals(false) }} onCancel={() => setShowAddVitals(false)} />
                          )}
                        </div>
                      </DraggableSection>
                    )

                  case 'photos':
                    return (
                      <DraggableSection key="photos" id="photos">
                        <div className="bg-gray-900 rounded-xl border border-gray-800">
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              Photos {photos.length > 0 && <span className="text-gray-600 font-normal normal-case ml-1">({photos.length})</span>}
                            </h2>
                            {!isLocked && (
                              <Link to={`/encounters/photos/new?encounterId=${enc.encounter_id}`}
                                className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
                                <span>+</span> Add Photo
                              </Link>
                            )}
                          </div>
                          {photos.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-600">No photos yet.</p>
                          ) : (
                            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {photos.map(ph => (
                                <a key={ph.id} href={photoSignedUrls[ph.id] || '#'} target="_blank" rel="noopener noreferrer"
                                  className="aspect-square rounded-lg overflow-hidden bg-gray-800 hover:opacity-80 transition-opacity relative group">
                                  {photoSignedUrls[ph.id] ? (
                                    <img src={photoSignedUrls[ph.id]} alt={ph.caption || 'Photo'} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-2xl animate-pulse">🖼️</span>
                                    </div>
                                  )}
                                  {ph.caption && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                      {ph.caption}
                                    </div>
                                  )}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </DraggableSection>
                    )

                  case 'procedures':
                    return (
                      <DraggableSection key="procedures" id="procedures">
                        <div className="bg-gray-900 rounded-xl border border-gray-800">
                          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                              Procedures {procedures.length > 0 && <span className="text-gray-600 font-normal normal-case ml-1">({procedures.length})</span>}
                            </h2>
                            {!isLocked && canMedicate && (
                              <Link to={`/encounters/procedures/new?encounterId=${enc.encounter_id}`}
                                className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
                                <span>+</span> Add Procedure
                              </Link>
                            )}
                          </div>
                          {procedures.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-600">No procedures recorded.</p>
                          ) : (
                            <div className="divide-y divide-gray-800">
                              {procedures.map(p => (
                                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                                  <span className="text-xs text-gray-500 w-28 shrink-0">{p.performed_at ? new Date(p.performed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + new Date(p.performed_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                                  <span className="flex-1 text-white truncate">{p.procedure_name}</span>
                                  <span className="text-gray-400 text-xs hidden sm:block">{p.performed_by || '—'}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.outcome === 'Successful' ? 'bg-green-900 text-green-300' : p.outcome === 'Unsuccessful' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>{p.outcome}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </DraggableSection>
                    )

                  case 'response':
                    if (!isAmbulance) return null
                    return (
                      <DraggableSection key="response" id="response">
                        <SectionCard title="Response & Times" badge={<SectionBadge section="times" />}>
                          <InlineField label="Type of Service" value={enc.type_of_service} fieldKey="type_of_service" isLocked={isLocked} onSave={saveField} type="select" options={TYPE_OF_SERVICE_OPTIONS} />
                          <InlineField label="Transport Capability" value={enc.transport_capability} fieldKey="transport_capability" isLocked={isLocked} onSave={saveField} type="select" options={["ALS","ALS 2","ALS Specialty Care Transport","BLS","Critical Care","Hazmat","Neonatal","Pediatric","Psychiatric","Rescue","Specialized","Other"]} />
                          <InlineField label="Response #" value={enc.response_number} fieldKey="response_number" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="Incident #" value={enc.incident_number} fieldKey="incident_number" isLocked={isLocked} onSave={saveField} />
                          <div className="col-span-full border-t border-gray-800 pt-3 mt-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Unit Times</p>
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <InlineField label="Dispatch" value={enc.dispatch_datetime} fieldKey="dispatch_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                              <InlineField label="En Route" value={enc.en_route_datetime} fieldKey="en_route_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                              <InlineField label="Arrived Scene" value={enc.arrive_scene_datetime} fieldKey="arrive_scene_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                              <InlineField label="Patient Contact" value={enc.patient_contact_datetime} fieldKey="patient_contact_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                              <InlineField label="Left Scene" value={enc.depart_scene_datetime} fieldKey="depart_scene_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                              <InlineField label="Arrived Destination" value={enc.arrive_destination_datetime} fieldKey="arrive_destination_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                              <InlineField label="Back in Service" value={enc.available_datetime} fieldKey="available_datetime" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                            </dl>
                          </div>
                        </SectionCard>
                      </DraggableSection>
                    )

                  case 'scene':
                    if (!isAmbulance) return null
                    return (
                      <DraggableSection key="scene" id="scene">
                        <SectionCard title="Scene Information" badge={<SectionBadge section="scene" />}>
                          <InlineField label="Scene Type / Location" value={enc.scene_type} fieldKey="scene_type" isLocked={isLocked} onSave={saveField} type="select" options={SCENE_TYPE_LABELS} />
                          <InlineField label="# Patients at Scene" value={enc.num_patients_at_scene} fieldKey="num_patients_at_scene" isLocked={isLocked} onSave={saveField} type="number" />
                          <InlineField label="First Unit on Scene" value={enc.first_ems_unit_on_scene} fieldKey="first_ems_unit_on_scene" isLocked={isLocked} onSave={saveField} type="select" options={FIRST_EMS_OPTIONS} />
                          <InlineField label="Scene Address" value={enc.scene_address} fieldKey="scene_address" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="City" value={enc.scene_city} fieldKey="scene_city" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="County" value={enc.scene_county} fieldKey="scene_county" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="State" value={enc.scene_state} fieldKey="scene_state" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="ZIP" value={enc.scene_zip} fieldKey="scene_zip" isLocked={isLocked} onSave={saveField} />
                          <div className="col-span-full flex items-center gap-2">
                              <div className="flex-1">
                                <InlineField label="GPS Coordinates" value={enc.scene_gps} fieldKey="scene_gps" isLocked={isLocked} onSave={saveField} />
                              </div>
                              {!isLocked && (
                                <button
                                  type="button"
                                  className="shrink-0 text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg flex items-center gap-1 transition-colors mt-4"
                                  onClick={() => {
                                    if (!navigator.geolocation) { alert('Geolocation not available on this device.'); return }
                                    navigator.geolocation.getCurrentPosition(
                                      pos => {
                                        const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`
                                        saveField('scene_gps', coords)
                                        setEnc(prev => prev ? { ...prev, scene_gps: coords } : prev)
                                      },
                                      err => alert('GPS error: ' + err.message),
                                      { enableHighAccuracy: true, timeout: 10000 }
                                    )
                                  }}
                                >
                                  📍 Get GPS
                                </button>
                              )}
                            </div>
                        </SectionCard>
                      </DraggableSection>
                    )

                  case 'assessment':
                    return (
                      <DraggableSection key="assessment" id="assessment">
                        <SectionCard title="Assessment & Situation" badge={<SectionBadge section="situation" />}>
                          <InlineField label="Chief Complaint" value={enc.primary_symptom_text} fieldKey="primary_symptom_text" isLocked={isLocked} onSave={saveField} type="select" options={CHIEF_COMPLAINT_OPTIONS} />
                          <Field label="Symptom Onset" value={enc.symptom_onset_datetime ? new Date(enc.symptom_onset_datetime).toLocaleString() : null} />
                          <InlineField label="Possible Injury" value={enc.possible_injury === true ? 'Yes' : enc.possible_injury === false ? 'No' : ''} fieldKey="possible_injury" isLocked={isLocked} onSave={(k, v) => {
                                  saveField(k, v === 'Yes' ? 'true' : v === 'No' ? 'false' : '')
                                  // Auto-fill forestry defaults when switching to Yes
                                  if (v === 'Yes') {
                                    if (!enc.patient_occupational_industry) saveField('patient_occupational_industry', 'Agriculture, Forestry, Fishing and Hunting')
                                    if (!enc.patient_occupation) saveField('patient_occupation', 'Farming, Fishing and Forestry Occupations')
                                  }
                                }} type="select" options={['Yes','No','Unknown']} />
                              {enc.possible_injury === true && (
                                <>
                                  <InlineField label="Occupational Industry (eSituation.15)" value={enc.patient_occupational_industry} fieldKey="patient_occupational_industry" isLocked={isLocked} onSave={saveField} type="select" options={OCCUPATIONAL_INDUSTRY_OPTIONS} />
                                  <InlineField label="Patient Occupation (eSituation.16)" value={enc.patient_occupation} fieldKey="patient_occupation" isLocked={isLocked} onSave={saveField} type="select" options={PATIENT_OCCUPATION_OPTIONS} />
                                  <InlineField label="Time Employee Began Work" value={enc.time_employee_began_work || (enc.date ? enc.date + "T06:00" : (() => { const d = new Date(); d.setHours(6,0,0,0); return d.toISOString().slice(0,16); })())} fieldKey="time_employee_began_work" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                                </>
                              )}
                          <InlineField label="Dispatch Reason" value={enc.dispatch_reason} fieldKey="dispatch_reason" isLocked={isLocked} onSave={saveField} type="select" options={DISPATCH_REASON_OPTIONS} />
                          <div className="col-span-full border-t border-gray-800 pt-3 mt-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Impressions & Acuity</p>
                            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <InlineField label="Primary Impression" value={enc.primary_impression_text || enc.primary_impression} fieldKey="primary_impression_text" isLocked={isLocked} onSave={saveField} type="clinical-select" />
                              <InlineField label="Secondary Impression" value={enc.secondary_impression} fieldKey="secondary_impression" isLocked={isLocked} onSave={saveField} type="clinical-select" />
                              <InlineField label="Initial Acuity" value={enc.initial_acuity} fieldKey="initial_acuity" isLocked={isLocked} onSave={saveField} type="select" options={ACUITY_OPTIONS} />
                              <InlineField label="Final Acuity" value={enc.final_acuity} fieldKey="final_acuity" isLocked={isLocked} onSave={saveField} type="select" options={ACUITY_OPTIONS} />
                              <InlineField label="Advance Directive" value={enc.advance_directive} fieldKey="advance_directive" isLocked={isLocked} onSave={saveField} type="select" options={ADVANCE_DIRECTIVE_OPTIONS} />
                            </dl>
                          </div>
                        </SectionCard>
                      </DraggableSection>
                    )

                  case 'cardiac':
                    if (!isAmbulance) return null
                    return (
                      <DraggableSection key="cardiac" id="cardiac">
                        <SectionCard title="🫀 Cardiac Arrest" badge={<SectionBadge section="cardiac" />}>
                          <InlineField label="Cardiac Arrest" value={enc.cardiac_arrest} fieldKey="cardiac_arrest" isLocked={isLocked} onSave={saveField} type="select" options={CARDIAC_ARREST_OPTIONS} />
                          <InlineField label="Etiology" value={enc.arrest_etiology} fieldKey="arrest_etiology" isLocked={isLocked} onSave={saveField} type="select" options={ARREST_ETIOLOGY_OPTIONS} />
                          <InlineField label="Resuscitation Attempted" value={Array.isArray(enc.resuscitation_attempted) ? (enc.resuscitation_attempted as string[])[0] : enc.resuscitation_attempted} fieldKey="resuscitation_attempted" isLocked={isLocked} onSave={saveField} type="select" options={["Yes, Prior to Any EMS Arrival","Yes, by First EMS on Scene","No"]} />
                          <InlineField label="Witnessed" value={Array.isArray(enc.arrest_witnessed) ? (enc.arrest_witnessed as string[])[0] : enc.arrest_witnessed} fieldKey="arrest_witnessed" isLocked={isLocked} onSave={saveField} type="select" options={["Unwitnessed","Witnessed by Bystander","Witnessed by EMS"]} />
                          <InlineField label="Initial Rhythm" value={enc.arrest_rhythm} fieldKey="arrest_rhythm" isLocked={isLocked} onSave={saveField} type="select" options={["Asystole","Pulseless Electrical Activity","Ventricular Fibrillation","Ventricular Tachycardia","Unknown AED Non-Shockable Rhythm","Unknown AED Shockable Rhythm","Normal Sinus Rhythm","Other"]} />
                          <InlineField label="ROSC" value={enc.rosc} fieldKey="rosc" isLocked={isLocked} onSave={saveField} type="select" options={ROSC_OPTIONS_LIST} />
                          <InlineField label="Who Initiated CPR" value={enc.who_initiated_cpr} fieldKey="who_initiated_cpr" isLocked={isLocked} onSave={saveField} type="select" options={["EMS","Bystander","Both","None"]} />
                          <InlineField label="CPR Type" value={Array.isArray(enc.cpr_type) ? enc.cpr_type[0] : enc.cpr_type} fieldKey="cpr_type" isLocked={isLocked} onSave={saveField} type="select" options={["Manual Compressions Only","Mechanical CPR Device","Manual and Mechanical CPR"]} />
                          <InlineField label="AED Prior to EMS" value={enc.aed_prior_to_ems} fieldKey="aed_prior_to_ems" isLocked={isLocked} onSave={saveField} type="select" options={["Yes - Defibrillation Shock Delivered","Yes - No Shock Advised","No","Unknown"]} />
                          <InlineField label="Date/Time of Cardiac Arrest" value={enc.date_time_cardiac_arrest} fieldKey="date_time_cardiac_arrest" isLocked={isLocked} onSave={saveField} type="datetime-local" />
                          <InlineField label="End of Event" value={enc.end_of_arrest_event} fieldKey="end_of_arrest_event" isLocked={isLocked} onSave={saveField} type="select" options={["Expired in Field","Expired in ED","Ongoing Resuscitation in ED","ROSC in Field","ROSC in ED","Resuscitation Discontinued"]} />
                        </SectionCard>
                      </DraggableSection>
                    )

                  case 'transport':
                    return (
                      <DraggableSection key="transport" id="transport">
                        <SectionCard title="Transport & Disposition" badge={<SectionBadge section="disposition" />}>
                          <InlineField label="Patient Disposition" value={enc.patient_disposition} fieldKey="patient_disposition" isLocked={isLocked} onSave={saveField} type="select" options={PATIENT_DISPOSITION_OPTIONS} />
                          <InlineField label="Transport Disposition" value={enc.transport_disposition} fieldKey="transport_disposition" isLocked={isLocked} onSave={saveField} type="select" options={TRANSPORT_DISPOSITION_OPTIONS} />
                          <InlineField label="Transport Method" value={enc.transport_method} fieldKey="transport_method" isLocked={isLocked} onSave={saveField} type="select" options={TRANSPORT_METHOD_OPTIONS} />
                          <InlineField label="No Transport Reason" value={enc.no_transport_reason} fieldKey="no_transport_reason" isLocked={isLocked} onSave={saveField} type="select" options={NO_TRANSPORT_REASON_OPTIONS} />
                          <InlineField label="Destination" value={enc.destination_name} fieldKey="destination_name" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="Destination Address" value={enc.destination_address} fieldKey="destination_address" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="Destination Type" value={enc.destination_type} fieldKey="destination_type" isLocked={isLocked} onSave={saveField} type="select" options={DESTINATION_TYPE_OPTIONS} />
                          <InlineField label="Hospital Capability" value={enc.hospital_capability} fieldKey="hospital_capability" isLocked={isLocked} onSave={saveField} type="multi-select" options={HOSPITAL_CAPABILITY_OPTIONS} />
                          <Field label="Refusal Signed" value={enc.refusal_signed} />
                        </SectionCard>
                      </DraggableSection>
                    )

                  case 'narrative':
                    return (
                      <DraggableSection key="narrative" id="narrative">
                        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">📋 Clinical Narrative</h2>
                            <button onClick={() => setNarrativeExpanded(true)}
                              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                              ⛶ Expand
                            </button>
                          </div>
                          <div className="p-4">
                            <dl className="grid grid-cols-1 gap-3">
                              <InlineField label="Notes" value={enc.notes} fieldKey="notes" isLocked={isLocked} onSave={saveField} type="textarea" fullWidth />
                            </dl>
                          </div>
                        </div>
                      </DraggableSection>
                    )

                  case 'provider':
                    return (
                      <DraggableSection key="provider" id="provider">
                        <SectionCard title="Provider" badge={<SectionBadge section="provider" />}>
                          <InlineField label="Provider of Record" value={enc.provider_of_record} fieldKey="provider_of_record" isLocked={isLocked} onSave={saveField} type="select" options={providerOptions} />
                          <InlineField label="Crew Resource #" value={enc.crew_resource_number} fieldKey="crew_resource_number" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="PCR #" value={enc.pcr_number} fieldKey="pcr_number" isLocked={isLocked} onSave={saveField} />
                          <InlineField label="Agency" value={enc.agency_number} fieldKey="agency_number" isLocked={isLocked} onSave={saveField} type="select" options={AGENCY_OPTIONS} />
                          <Field label="Unit" value={enc.unit} />
                          <Field label="PCR Status" value={enc.pcr_status} />
                        </SectionCard>
                      </DraggableSection>
                    )

                  case 'ama':
                    return (
                      <DraggableSection key="ama" id="ama">
                        <div className="bg-gray-900 rounded-xl border border-gray-800">
                          <div className="flex items-center justify-between px-4 py-3">
                            <button onClick={() => setShowConsentForms(v => !v)} className="flex items-center gap-2 text-left flex-1">
                              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Consent / AMA Forms
                                {consentForms.length > 0 && <span className="ml-2 text-gray-600 normal-case font-normal">({consentForms.length})</span>}
                              </span>
                              <span className="text-gray-500 text-xs">{showConsentForms ? '▲' : '▼'}</span>
                            </button>
                            {!isLocked && (
                              <Link to={`/consent/ama?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}`}
                                className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
                                <span>+</span> New AMA Form
                              </Link>
                            )}
                          </div>
                          {showConsentForms && (
                            <div className="px-4 pb-4 space-y-2">
                              {consentForms.length === 0 ? (
                                <p className="text-gray-600 text-sm">No consent forms. Use Chart Actions above to add one.</p>
                              ) : (
                                <div className="space-y-2">
                                  {consentForms.map(cf => (
                                    <div key={cf.id} className="flex items-center gap-3 text-sm border-t border-gray-800 pt-2 first:border-0 first:pt-0">
                                      <span className="text-gray-500 text-xs whitespace-nowrap">{cf.date_time ? new Date(cf.date_time).toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + new Date(cf.date_time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">{cf.consent_type || 'AMA'}</span>
                                      <span className="flex-1 text-gray-300 text-xs truncate">{cf.provider_of_record || '—'}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${cf.signed ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>{cf.signed ? 'Signed' : 'Unsigned'}</span>
                                      {(consentPdfUrls[cf.id] || cf.pdf_url) && <a href={consentPdfUrls[cf.id] || cf.pdf_url!} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">📄 PDF</a>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </DraggableSection>
                    )

                  case 'comp':
                    return (
                      <DraggableSection key="comp" id="comp">
                        <div className="bg-gray-900 rounded-xl border border-gray-800">
                          <div className="flex items-center justify-between px-4 py-3">
                            <button onClick={() => setShowCompClaims(v => !v)} className="flex items-center gap-2 text-left flex-1">
                              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                Comp Claims
                                {compClaims.length > 0 && <span className="ml-2 text-gray-600 normal-case font-normal">({compClaims.length})</span>}
                              </span>
                              <span className="text-gray-500 text-xs">{showCompClaims ? '▲' : '▼'}</span>
                            </button>
                            {!isLocked && (
                              <Link to={`/comp-claims/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&dob=${encodeURIComponent(enc.patient_dob||'')}&tebw=${encodeURIComponent(enc.time_employee_began_work || (enc.date ? enc.date + "T06:00" : ""))}`}
                                className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
                                <span>+</span> New Comp Claim
                              </Link>
                            )}
                          </div>
                          {showCompClaims && (
                            <div className="px-4 pb-4">
                              {compClaims.length === 0 ? (
                                <p className="text-gray-600 text-sm">No comp claims. Use Chart Actions above to add one.</p>
                              ) : (
                                <div className="space-y-2">
                                  {compClaims.map((cc: any) => (
                                    <div key={cc.id} className="flex items-center gap-3 text-sm border-t border-gray-800 pt-2 first:border-0 first:pt-0">
                                      <span className="flex-1 text-gray-300 text-xs truncate">{cc.patient_name || '—'}</span>
                                      <span className="text-gray-500 text-xs whitespace-nowrap shrink-0">{cc.created_at ? new Date(cc.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + new Date(cc.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${cc.status === 'Complete' ? 'bg-green-900 text-green-300' : cc.status === 'Filed' ? 'bg-blue-900 text-blue-300' : 'bg-gray-700 text-gray-300'}`}>{cc.status || 'Pending'}</span>
                                      {(claimPdfUrls[cc.id] || cc.pdf_url) && <a href={claimPdfUrls[cc.id] || cc.pdf_url!} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">📄 PDF</a>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </DraggableSection>
                    )

                  default:
                    return null
                }
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* ── Progress Notes ── */}
        <div id="notes" className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-slate-800/90">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              📝 Progress Notes {progressNotes.length > 0 && <span className="text-gray-500 font-normal normal-case ml-1">({progressNotes.length})</span>}
            </h3>
            {!showNoteForm && (
              <button onClick={() => setShowNoteForm(true)}
                className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors">
                + Add Note
              </button>
            )}
          </div>
          {showNoteForm && (
            <div className="p-4 border-b border-gray-800 bg-gray-800/40 space-y-3">
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                placeholder="Enter progress note..."
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                autoFocus
              />
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-gray-500 block mb-1">PIN to sign now (optional — leave blank to sign later)</label>
                  <input type="password" value={notePin} onChange={e => setNotePin(e.target.value)}
                    placeholder="Enter PIN to sign immediately"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={saveProgressNote} disabled={!noteDraft.trim() || noteSaving}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg">
                    {noteSaving ? 'Saving...' : notePin ? 'Save & Sign' : 'Save (Unsigned)'}
                  </button>
                  <button onClick={() => { setShowNoteForm(false); setNoteDraft(''); setNotePin('') }}
                    className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            </div>
          )}
          {progressNotes.length === 0 && !showNoteForm ? (
            <p className="px-4 py-6 text-sm text-gray-600 text-center">No progress notes yet.</p>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {progressNotes.map((note: any) => (
                <div key={note.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-medium">{note.author_name}</span>
                    {note.author_role && <span className="text-xs text-gray-600">({note.author_role})</span>}
                    <span className="text-xs text-gray-600">·</span>
                    <span className="text-xs text-gray-500">{new Date(note.note_datetime).toLocaleString()}</span>
                    {note.signed_at ? (
                      <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-400 rounded">✓ Signed {new Date(note.signed_at).toLocaleDateString()}</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-orange-900 text-orange-400 rounded">Unsigned</span>
                    )}
                  </div>
                  <p className="text-sm text-white whitespace-pre-wrap">{note.note_text}</p>
                  {!note.signed_at && note.author_name === currentUser.employee?.name && (
                    <button
                      onClick={async () => {
                        const now = new Date().toISOString()
                        await supabase.from('progress_notes').update({ signed_at: now, signed_by: currentUser.employee?.name }).eq('id', note.id)
                        loadNotes()
                      }}
                      className="text-xs text-green-400 hover:text-green-300 transition-colors">
                      ✍️ Sign this note
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>


      {/* Narrative full-screen modal — outside DndContext */}
      {narrativeExpanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setNarrativeExpanded(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-sm font-bold text-white">📋 Clinical Narrative — {patientName}</h2>
              <button onClick={() => setNarrativeExpanded(false)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {isLocked ? (
                <p className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">{enc.notes || <span className="text-gray-600 italic">No narrative recorded.</span>}</p>
              ) : (
                <textarea
                  className="w-full h-full min-h-[400px] bg-gray-800 text-white text-sm rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 leading-relaxed"
                  value={enc.notes || ''}
                  onChange={e => setEnc(prev => prev ? { ...prev, notes: e.target.value } as Encounter : prev)}
                  onBlur={e => saveField('notes', e.target.value)}
                  placeholder="Enter clinical narrative..."
                />
              )}
            </div>
            {!isLocked && (
              <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
                <button onClick={() => setNarrativeExpanded(false)} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )}
