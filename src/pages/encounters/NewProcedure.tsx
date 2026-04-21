
import EncounterPicker, { type PickedEncounter } from '@/components/EncounterPicker'

import { useEffect, useRef, useState, Suspense } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton } from '@/components/ui'
import { insertProcedure } from '@/lib/services/encounters'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useNavigate, useSearchParams } from 'react-router-dom'

const PROCEDURES: Record<string, string[]> = {
  'Airway': [
    'Bag-Valve-Mask Ventilation', 'CPAP', 'Endotracheal Intubation (RSI)',
    'Needle Decompression', 'Surgical Airway', 'Nasopharyngeal Airway',
    'Oropharyngeal Airway', 'Supraglottic Airway',
  ],
  'Vascular Access': [
    'IV Access - Peripheral', 'IV Access - Central', 'Intraosseous (IO) Access', 'Arterial Line',
  ],
  'Cardiac': [
    'Defibrillation', 'Cardioversion (Synchronized)', 'External Pacing',
    'CPR - Manual', 'CPR - Mechanical Device', '12-Lead ECG', 'AED Application',
  ],
  'Hemorrhage Control': [
    'Tourniquet Application', 'Wound Packing (Hemostatic)', 'Pressure Dressing',
    'Chest Seal Application', 'Pelvic Binder',
  ],
  'Splinting/Immobilization': [
    'Traction Splint', 'SAM Splint', 'Backboard/Spinal Immobilization',
    'Cervical Collar', 'KED Device',
  ],
  'Assessment': [
    '12-Lead ECG', 'Capnography (EtCO2)', 'Pulse Oximetry', 'Blood Glucose Check', 'FAST Ultrasound',
  ],
  'Other': [
    'Wound Irrigation', 'Wound Closure (Staples/Sutures/Steri-strips)', 'Urinary Catheter',
    'Gastric Tube', 'Eye Irrigation', 'Tourniquet - Junctional',
  ],
}

const OUTCOMES = ['Successful', 'Unsuccessful', 'Partially Successful', 'Complication']
const COMPLICATIONS = ['None', 'Bleeding', 'Esophageal Intubation', 'Hypoxia', 'Hypotension', 'Other']

const CLINICAL_ROLES = ['MD', 'DO', 'NP', 'PA', 'RN', 'Paramedic']

type Employee = {
  id: string
  name: string
  role: string
}

function ProcedureNewInner() {
  const supabase = createClient()
  const requestId = useRef(crypto.randomUUID())
  const assignment = useUserAssignment()
  const unitParamFromUrl = ''

  // ── Encounter picker state and loader ──────────────────────────────────────
  const [pickerUnit, setPickerUnit] = useState(unitParamFromUrl || '')
  const [pickerEncounters, setPickerEncounters] = useState<{
    id: string; encounter_id: string
    patient_first_name: string|null; patient_last_name: string|null
    patient_dob: string|null; primary_symptom_text: string|null
    date: string|null; unit: string|null; provider_of_record: string|null
    incident_id: string|null
  }[]>([])

  const loadPickerEncounters = async (unitName: string) => {
    if (!unitName) { setPickerEncounters([]); return }
    const { data } = await supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, patient_dob: date_of_birth, primary_symptom_text, date, unit, provider_of_record, incident_id')
      .eq('unit', unitName)
      .order('date', { ascending: false })
      .limit(25)
    // patient_dob is date_of_birth column — handle gracefully
    setPickerEncounters((data as any) || [])
  }

  useEffect(() => {
    if (pickerUnit) loadPickerEncounters(pickerUnit)
  }, [pickerUnit])

  // Auto-fill pickerUnit from assignment
  useEffect(() => {
    if (!assignment.loading && assignment.unit?.name && !pickerUnit) {
      setPickerUnit(assignment.unit.name)
    }
  }, [assignment.loading, assignment.unit])

  const EncounterPicker = ({ onSelect }: { 
    onSelect: (enc: typeof pickerEncounters[0]) => void 
  }) => (
    <div className="bg-gray-900 rounded-xl p-4 border border-blue-900/50 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-blue-400">
        🔗 Link to Patient Encounter
      </h2>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Unit</label>
        {assignment.unit?.name && !assignment.loading ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
            <span className="text-sm text-white font-medium">{assignment.unit.name}</span>
            <span className="text-xs text-gray-500">(your unit)</span>
          </div>
        ) : (
          <select
            value={pickerUnit}
            onChange={e => setPickerUnit(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select unit...</option>
            {['Medic 1','Medic 2','Medic 3','Medic 4','Command 1','Aid 1','Aid 2','Rescue 1','Rescue 2'].map(u => <option key={u}>{u}</option>)}
          </select>
        )}
      </div>
      {pickerUnit && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Patient Encounter</label>
          {pickerEncounters.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No recent encounters on {pickerUnit}.</p>
          ) : (
            <select
              defaultValue=""
              onChange={e => {
                const enc = pickerEncounters.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
                if (enc) onSelect(enc)
              }}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select patient...</option>
              {pickerEncounters.map(enc => (
                <option key={enc.id} value={enc.encounter_id || enc.id}>
                  {enc.patient_last_name 
                    ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                    : 'Unknown'
                  } — {enc.primary_symptom_text || '—'} ({enc.date || '—'})
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )


  const [encounterOptions, setEncounterOptions] = useState<{id: string, encounter_id: string, patient_first_name: string|null, patient_last_name: string|null, primary_symptom_text: string|null, date: string|null, unit: string|null, provider_of_record: string|null}[]>([])


  // ─── Encounter picker UI ──────────────────────────────────────────────────
  const EncounterPickerSection = ({ onSelect }: { onSelect: (enc: typeof encounterOptions[0]) => void }) => (
    <div className="theme-card rounded-xl p-4 border space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Link to Patient Encounter
      </h2>
      {encounterOptions.length === 0 ? (
        <p className="text-xs text-gray-600">
          {'Select a unit above to see recent encounters.'}
        </p>
      ) : (
        <div>
          <label className="text-xs text-gray-400 block mb-1">Select Patient</label>
          <select
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            defaultValue=""
            onChange={e => {
              const enc = encounterOptions.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
              if (enc) onSelect(enc)
            }}>
            <option value="">Select patient encounter...</option>
            {encounterOptions.map(enc => (
              <option key={enc.id} value={enc.encounter_id || enc.id}>
                {enc.patient_last_name
                  ? `${enc.patient_last_name}, ${enc.patient_first_name || ''}`
                  : 'Unknown Patient'
                } — {enc.primary_symptom_text || 'No complaint'} ({enc.date || '—'})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )

  const loadEncountersForUnit = async (unitName: string) => {
    if (!unitName) { setEncounterOptions([]); return }
    const { data } = await supabase
      .from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit, provider_of_record')
      .eq('unit', unitName)
      .order('date', { ascending: false })
      .limit(20)
    setEncounterOptions(data || [])
  }

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''

  const [employees, setEmployees] = useState<Employee[]>([])
  const [linkedEncUUID, setLinkedEncUUID] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)

  const [form, setForm] = useState({
    procedure_name: '',
    performed_at: localNow,
    performed_by: '',
    body_site: '',
    outcome: '',
    complications: 'None',
    notes: '',
  })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('status', 'Active')
        .order('name')
      const clinical = (data || []).filter(e =>
        CLINICAL_ROLES.some(r => e.role?.includes(r))
      )
      setEmployees(clinical)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = async () => {
    if (!form.procedure_name) { setError('Please select a procedure.'); return }
    if (!form.outcome) { setError('Please select an outcome.'); return }
    setSubmitting(true)
    setError('')

    try {
      const { getIsOnline } = await import('@/lib/syncManager')
      const { queueOfflineWrite } = await import('@/lib/offlineStore')

      const procData = {
        procedure_name: form.procedure_name,
        performed_at: new Date(form.performed_at).toISOString(),
        performed_by: form.performed_by || null,
        body_site: form.body_site || null,
        outcome: form.outcome,
        notes: [
          form.complications !== 'None' ? 'Complications: ' + form.complications : '',
          form.notes || ''
        ].filter(Boolean).join(' | ') || null,
      }

      if (getIsOnline()) {
        const { data: enc, error: encErr } = await supabase
          .from('patient_encounters')
          .select('id')
          .eq('encounter_id', encounterId)
          .single()
        if (encErr || !enc) throw new Error(`Encounter not found: ${encounterId}`)

        const { error: insertErr } = await insertProcedure({
          encounter_id: enc.id,
          ...procData,
          client_request_id: requestId.current,
        })
        if (insertErr) {
          if (insertErr.code === '23505') {
            console.warn('[Procedure] Duplicate client_request_id — already saved')
            navigate(`/encounters/${enc.id}`)
            return
          }
          throw new Error(insertErr.message)
        }
        navigate(`/encounters/${enc.id}`)
      } else {
        await queueOfflineWrite('encounter_procedures', 'insert', {
          id: crypto.randomUUID(),
          encounter_id: encounterId,
          ...procData,
          client_request_id: requestId.current,
        })
        toast.info('Procedure saved offline — will sync when back online.')
        navigate(-1)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSubmitting(false)
    }
  }

  const inp = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const lbl = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-xl font-bold">Add Procedure</h1>
            {encounterId && (
              <p className="text-xs text-gray-400">Encounter <span className="font-mono text-blue-400">{encounterId}</span></p>
            )}
          </div>
        </div>

        {!encounterId && (
          <EncounterPickerSection onSelect={enc => {
            // store encounter UUID for procedures FK
          }} />
        )}

        <div className="theme-card rounded-xl p-4 border space-y-4">
          {/* Procedure name - grouped dropdown */}
          <div>
            <label className={lbl}>Procedure *</label>
            <select className={inp} value={form.procedure_name} onChange={e => set('procedure_name', e.target.value)}>
              <option value="">Select procedure...</option>
              {Object.entries(PROCEDURES).map(([category, procs]) => (
                <optgroup key={category} label={category}>
                  {procs.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Performed At */}
          <div>
            <label className={lbl}>Performed At *</label>
            <input
              type="datetime-local"
              className={inp}
              value={form.performed_at}
              onChange={e => set('performed_at', e.target.value)}
            />
          </div>

          {/* Performed By */}
          <div>
            <label className={lbl}>Performed By</label>
            <select className={inp} value={form.performed_by} onChange={e => set('performed_by', e.target.value)}>
              <option value="">Select clinician...</option>
              {employees.map(e => (
                <option key={e.id} value={e.name}>{e.name} — {e.role}</option>
              ))}
            </select>
          </div>

          {/* Body Site */}
          <div>
            <label className={lbl}>Body Site (optional)</label>
            <input
              type="text"
              className={inp}
              value={form.body_site}
              onChange={e => set('body_site', e.target.value)}
              placeholder="e.g. Left antecubital, Right thigh"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className={lbl}>Outcome *</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => set('outcome', o)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                    form.outcome === o
                      ? o === 'Successful' ? 'bg-green-600 text-white'
                      : o === 'Unsuccessful' ? 'bg-red-700 text-white'
                      : 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Complications */}
          <div>
            <label className={lbl}>Complications</label>
            <select className={inp} value={form.complications} onChange={e => set('complications', e.target.value)}>
              {COMPLICATIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={lbl}>Notes</label>
            <textarea
              className={`${inp} resize-none h-20`}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Additional clinical notes"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/30 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors"
        >
          {submitting ? 'Saving...' : '💾 Save Procedure'}
        </button>
      </div>
    </div>
  )
}

export default function ProcedureNewPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <ProcedureNewInner />
    </Suspense>
  )
}
