

import { useEffect, useRef, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { LoadingSkeleton } from '@/components/ui'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { queryClinicalStaff, queryUnitsWithIncidents } from '@/lib/services/encounters'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useOfflineWrite } from '@/lib/useOfflineWrite'

import { VitalsSection } from '@/components/encounters/VitalsSection'
import { buildEncounterData } from './buildEncounterData'
import {
  CHIEF_COMPLAINTS, DISPOSITIONS, ACUITY, CARDIAC_RHYTHMS,
  PUPILS_OPTIONS, SCENE_TYPES, CLINICAL_ROLES,
} from '@/data/clinicalOptions'

function SimpleEHRInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { write: offlineWrite, isOffline } = useOfflineWrite()
  const requestId = useRef(crypto.randomUUID())
  const [searchParams] = useSearchParams()
  const urlIncidentId = searchParams.get('incidentId')
  const urlIncidentName = searchParams.get('incidentName') || ''
  const urlUnitId = searchParams.get('unitId') || ''
  const urlUnitName = searchParams.get('unitName') || searchParams.get('unit') || ''
  const urlCRN = searchParams.get('crew_resource_number') || ''

  const assignment = useUserAssignment()
  const currentUser = assignment

  type SimpleUnit = {
    id: string
    name: string
    incident_units?: { id: string; released_at: string | null; incident: { id: string; name: string; status: string } | null }[]
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [incidents, setIncidents] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<SimpleUnit[]>([])
  const [displayedUnits, setDisplayedUnits] = useState<SimpleUnit[]>([])

  const now = new Date()
  const [form, setForm] = useState({
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5),
    unit: urlUnitName,
    unit_id: urlUnitId || '',
    incident_id: urlIncidentId || '',
    crew_resource_number: urlCRN,
    // Patient
    patient_first_name: '',
    patient_last_name: '',
    patient_dob: '',
    patient_age: '',
    patient_age_units: 'Years',
    patient_gender: '',
    // Clinical
    chief_complaint: '',
    chief_complaint_other: '',
    initial_acuity: '',
    // Vitals
    initial_hr: '',
    initial_rr: '',
    initial_spo2: '',
    initial_bp_systolic: '',
    initial_bp_diastolic: '',
    initial_temp_f: '',
    initial_pain_scale: '',
    initial_blood_glucose: '',
    // Additional vitals
    cardiac_rhythm: '',
    pupils: '',
    etco2: '',
    // Scene
    scene_type: '',
    // SOAP Note
    subjective: '',
    objective: '',
    assessment_plan: '',
    provider_of_record: '',
    // Disposition
    patient_disposition: '',
    notes: '',
  })

  const [providers, setProviders] = useState<{id: string; name: string; role: string}[]>([])
  const [assignmentApplied, setAssignmentApplied] = useState(false)

  // Apply assignment once loaded
  useEffect(() => {
    if (!assignment.loading && !assignmentApplied) {
      setAssignmentApplied(true)
      const updates: Partial<typeof form> = {}

      if (assignment.unit && !urlUnitName) {
        updates.unit = assignment.unit.name
        updates.unit_id = assignment.unit.id
      }
      if (assignment.incident && !urlIncidentId) {
        updates.incident_id = assignment.incident.id
      }
      if (assignment.employee && CLINICAL_ROLES.includes(assignment.employee.role)) {
        updates.provider_of_record = assignment.employee.name
      }

      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }))
      }
    }
  }, [assignment.loading, assignmentApplied, assignment.unit, assignment.incident, assignment.employee, urlUnitName, urlIncidentId])

  useEffect(() => {
    const load = async () => {
      // Preload dropdown data from cache
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedEmps = await getCachedData('employees') as any[]
        if (cachedEmps.length > 0) setProviders(cachedEmps.filter((e: any) => CLINICAL_ROLES.includes(e.role)) as any)
        const cachedInc = await getCachedData('incidents') as any[]
        if (cachedInc.length > 0) setIncidents(cachedInc)
        const cachedUnits = await getCachedData('units') as any[]
        if (cachedUnits.length > 0) { setUnits(cachedUnits); setDisplayedUnits(cachedUnits) }
      } catch {}
      const [empResult, incResult, unitResult] = await Promise.all([
        loadList(
          () => queryClinicalStaff(CLINICAL_ROLES) as any,
          'employees',
          (all) => all.filter((e: any) => CLINICAL_ROLES.includes(e.role))
        ),
        loadList(
          () => createClient().from('incidents').select('id, name').order('name'),
          'incidents'
        ),
        loadList(
          () => queryUnitsWithIncidents() as any,
          'units'
        ),
      ])
      setProviders(empResult.data as any)
      setIncidents(incResult.data as any)
      setUnits(unitResult.data as any)
      setDisplayedUnits(unitResult.data as any)
    }
    load()
  }, [])

  const set = (key: string, val: string) => setForm(p => {
    const next = { ...p, [key]: val }
    // Auto-compute age from DOB
    if (key === 'patient_dob' && val) {
      const birth = new Date(val + 'T00:00:00')
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const md = today.getMonth() - birth.getMonth()
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--
      if (age < 0) age = 0
      if (age < 2) {
        const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth()
        next.patient_age = String(Math.max(0, months))
        next.patient_age_units = 'Months'
      } else {
        next.patient_age = String(age)
        next.patient_age_units = 'Years'
      }
    }
    return next
  })

  const handleUnitChange = (unitId: string) => {
    const u = units.find(x => x.id === unitId)
    set('unit_id', unitId)
    set('unit', u?.name || '')
    // Auto-fill incident from active non-released incident_unit
    const activeIU = u?.incident_units?.find(iu => !iu.released_at && iu.incident?.status === 'Active')
    if (activeIU?.incident?.id) {
      set('incident_id', activeIU.incident.id)
    }
  }

  const handleIncidentChange = (incidentId: string) => {
    set('incident_id', incidentId)
    if (incidentId) {
      const filtered = units.filter(u =>
        u.incident_units?.some(iu => !iu.released_at && iu.incident?.id === incidentId)
      )
      setDisplayedUnits(filtered)
      // If current unit is no longer valid for selected incident, clear it
      if (form.unit_id && !filtered.find(u => u.id === form.unit_id)) {
        set('unit_id', '')
        set('unit', '')
      }
    } else {
      setDisplayedUnits(units)
    }
  }

  const hasAssignment = !assignment.loading && !!assignment.unit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.patient_last_name) { setError('Patient last name required'); return }
    if (!form.patient_dob) { setError('Date of birth is required'); return }
    if (!form.chief_complaint) { setError('Chief complaint required'); return }
    if (!form.provider_of_record) { setError('Provider of record required'); return }

    setSubmitting(true)
    setError('')

    try {
      const encounterData = buildEncounterData(form, currentUser.employee?.name)

      // Remove local-id before sending to server (it will get a real UUID)
      const { id: _localId, ...serverData } = encounterData
      const result = await offlineWrite('patient_encounters', 'insert', {
        ...serverData,
        client_request_id: requestId.current,
      })
      if (!result.success) throw new Error(result.error || 'Save failed')
      navigate(`/encounters?success=1`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  const inputClass = "w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
  const labelClass = "text-xs text-gray-400"
  const sectionClass = "bg-gray-900 rounded-xl p-4 space-y-4"
  const readonlyClass = "w-full mt-1 bg-gray-700 rounded-lg px-3 py-2 text-white text-sm border border-gray-600"

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-lg mx-auto p-6 space-y-5">
        <div className="pt-4">
          <h1 className="text-2xl font-bold">Patient Encounter</h1>
          <p className="text-gray-400 text-sm">{form.unit || 'Medical Unit'} · {form.date}</p>
        </div>

        {isOffline && (
          <div className="bg-amber-950/60 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-2">
            📶 <span>You’re offline. This encounter will be saved locally and synced when you reconnect.</span>
          </div>
        )}

        {/* Assignment banner */}
        {!assignment.loading && hasAssignment && (
          <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3 text-sm text-blue-300">
            📋 Pre-filled from your assignment: <strong>{assignment.unit?.name}</strong>
            {assignment.incident ? ` · ${assignment.incident.name}` : ''}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Unit & Time */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Unit & Time</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className={labelClass}>Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputClass + ' w-full'} />
              </div>
              <div className="min-w-0">
                <label className={labelClass}>Time</label>
                <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className={inputClass + ' w-full'} />
              </div>
            </div>

            {/* Unit — locked when coming from step 1 (urlUnitName) or when user has an assignment */}
            <div>
              <label className={labelClass}>Unit</label>
              {(hasAssignment || urlUnitName) ? (
                <div className={readonlyClass}>{form.unit || urlUnitName} <span className="text-gray-500 text-xs ml-1">🔒</span></div>
              ) : (
                <select value={form.unit_id} onChange={e => handleUnitChange(e.target.value)} className={inputClass}>
                  <option value="">Select unit...</option>
                  {displayedUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </div>

            {/* Incident — locked when coming from step 1 (urlIncidentId) or when user has an assignment with incident */}
            <div>
              <label className={labelClass}>Incident</label>
              {(hasAssignment && assignment.incident) || urlIncidentId ? (
                <div className={readonlyClass}>{urlIncidentName || assignment.incident?.name || 'Loading...'} <span className="text-gray-500 text-xs ml-1">🔒</span></div>
              ) : (
                <select value={form.incident_id} onChange={e => handleIncidentChange(e.target.value)} className={inputClass}>
                  <option value="">Select incident...</option>
                  {incidents.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>

          </div>

          {/* Patient */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Patient</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>First Name</label>
                <input value={form.patient_first_name} onChange={e => set('patient_first_name', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input value={form.patient_last_name} onChange={e => set('patient_last_name', e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className={labelClass}>Date of Birth <span className="text-red-400">*</span></label>
                <input type="date" value={form.patient_dob} onChange={e => set('patient_dob', e.target.value)} className={inputClass + ' min-w-0'} required />
              </div>
              <div />
            </div>
            <div>
              <label className={labelClass}>Crew Resource Number</label>
              <input value={form.crew_resource_number} onChange={e => set('crew_resource_number', e.target.value)}
                placeholder="e.g. 2026-RAM-MSU1-001" className={inputClass} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className={labelClass}>Age</label>
                <input type="number" value={form.patient_age} onChange={e => set('patient_age', e.target.value)} className={inputClass} />
              </div>
              <div className="col-span-1">
                <label className={labelClass}>Units</label>
                <select value={form.patient_age_units} onChange={e => set('patient_age_units', e.target.value)} className={inputClass}>
                  <option>Years</option><option>Months</option><option>Days</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className={labelClass}>Gender</label>
                <select value={form.patient_gender} onChange={e => set('patient_gender', e.target.value)} className={inputClass}>
                  <option value="">-</option>
                  <option>Male</option><option>Female</option><option>Other</option><option>Unknown</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chief Complaint & Acuity */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Chief Complaint</h2>
            <div>
              <label className={labelClass}>Chief Complaint *</label>
              <select value={form.chief_complaint} onChange={e => set('chief_complaint', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {CHIEF_COMPLAINTS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {form.chief_complaint === 'Other' && (
              <div>
                <label className={labelClass}>Describe</label>
                <input value={form.chief_complaint_other} onChange={e => set('chief_complaint_other', e.target.value)} className={inputClass} />
              </div>
            )}

            {/* Scene Type */}
            <div>
              <label className={labelClass}>Scene Type</label>
              <select value={form.scene_type} onChange={e => set('scene_type', e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {SCENE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}>Acuity</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ACUITY.map(a => (
                  <button key={a.value} type="button" onClick={() => set('initial_acuity', a.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-bold transition-colors text-white ${
                      form.initial_acuity === a.value ? a.selected : a.base
                    }`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Vitals</h2>
            <VitalsSection form={form} set={set} />

            {/* Additional Vitals */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Cardiac Rhythm</label>
                <select value={form.cardiac_rhythm} onChange={e => set('cardiac_rhythm', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {CARDIAC_RHYTHMS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Pupils</label>
                <select value={form.pupils} onChange={e => set('pupils', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {PUPILS_OPTIONS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>EtCO2 (mmHg)</label>
              <input type="number" value={form.etco2} onChange={e => set('etco2', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Narrative (SOAP) */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Narrative</h2>
            <div>
              <label className={labelClass}>Subjective</label>
              <textarea value={form.subjective} onChange={e => set('subjective', e.target.value)}
                rows={3} placeholder="Chief complaint, history of present illness, patient's account..."
                className={inputClass + " resize-none"} />
            </div>
            <div>
              <label className={labelClass}>Objective</label>
              <textarea value={form.objective} onChange={e => set('objective', e.target.value)}
                rows={3} placeholder="Physical exam findings, vital signs, observations..."
                className={inputClass + " resize-none"} />
            </div>
            <div>
              <label className={labelClass}>Assessment / Plan</label>
              <textarea value={form.assessment_plan} onChange={e => set('assessment_plan', e.target.value)}
                rows={3} placeholder="Clinical impression, treatment provided, disposition plan..."
                className={inputClass + " resize-none"} />
            </div>
          </div>

          {/* Disposition */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Disposition</h2>
            <div className="grid grid-cols-1 gap-2">
              {DISPOSITIONS.map(d => (
                <button key={d} type="button" onClick={() => set('patient_disposition', d)}
                  className={`py-2 px-4 rounded-lg text-sm font-medium text-left transition-colors ${
                    form.patient_disposition === d ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Provider */}
          <div className={sectionClass}>
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Provider</h2>
            <div>
              <label className={labelClass}>Provider of Record *</label>
              {hasAssignment && assignment.employee && CLINICAL_ROLES.includes(assignment.employee.role) ? (
                <div className={readonlyClass}>{form.provider_of_record}</div>
              ) : (
                <select value={form.provider_of_record} onChange={e => set('provider_of_record', e.target.value)} className={inputClass}>
                  <option value="">Select provider...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={labelClass}>Additional Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} className={inputClass + " resize-none"} />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors">
            {submitting ? 'Saving...' : 'Save Encounter'}
          </button>

        </form>
      </div>
    </div>
  )
}

export default function SimpleEHRPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <SimpleEHRInner />
    </Suspense>
  )
}
