
import EncounterPicker, { type PickedEncounter } from '@/components/EncounterPicker'
import { generateCompClaimsPDF } from '@/lib/generateCompClaimsPdf'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'

type Employee = { id: string; name: string; role: string }

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-2 mb-2 border-b border-gray-800 pb-1'

const MECHANISM_OPTIONS = [
  'Fall', 'Motor Vehicle', 'Struck By Object', 'Overexertion',
  'Burn', 'Chemical Exposure', 'Animal/Insect', 'Equipment', 'Other',
]
const BODY_PART_OPTIONS = [
  'Head', 'Neck', 'Back', 'Shoulder', 'Arm', 'Hand',
  'Hip', 'Leg', 'Foot', 'Multiple', 'Other',
]

function ToggleButton({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2 mt-1">
      {['Yes', 'No'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === 'Yes')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            (opt === 'Yes' ? value === true : value === false)
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >{opt}</button>
      ))}
    </div>
  )
}

function NewCompClaimInner() {
  const supabase = createClient()
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
            {['GRANITE 1','GRANITE 2','GRANITE MSU','GRANITE REMS'].map(u => <option key={u}>{u}</option>)}
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


  // ─── Encounter picker UI ──────────────────────────────────────────────────
  const EncounterPickerSection = ({ onSelect }: { onSelect: (enc: typeof encounterOptions[0]) => void }) => (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Link to Patient Encounter
      </h2>
      {encounterOptions.length === 0 ? (
        <p className="text-xs text-gray-600">
          {form.unit ? 'No recent encounters on this unit.' : 'Select a unit to see recent patient encounters.'}
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

  const renderEncounterPicker = (onSelect: (enc: typeof encounterOptions[0]) => void) => (
    encounterOptions.length > 0 ? (
      <div>
        <label className="text-xs text-gray-400 block mb-1">Patient Encounter</label>
        <select
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          defaultValue=""
          onChange={e => {
            const enc = encounterOptions.find(x => x.encounter_id === e.target.value || x.id === e.target.value)
            if (enc) onSelect(enc)
          }}>
          <option value="">Select encounter (optional)...</option>
          {encounterOptions.map(enc => (
            <option key={enc.id} value={enc.encounter_id || enc.id}>
              {enc.patient_last_name ? `${enc.patient_last_name}, ${enc.patient_first_name}` : 'Unknown'} — {enc.primary_symptom_text || '—'} ({enc.date || '—'})
            </option>
          ))}
        </select>
      </div>
    ) : null
  )

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''
  const incidentIdParam = searchParams.get('incidentId') || ''
  const dobParam = searchParams.get('dob') || ''
  const tebwParam = searchParams.get('tebw') || ''

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [savedClaimId, setSavedClaimId] = useState<string | null>(null)
  const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(null)
  const [lastClaimData, setLastClaimData] = useState<any>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [physicians, setPhysicians] = useState<Employee[]>([])
  const [encounterUUID, setEncounterUUID] = useState<string>('')

  const [form, setForm] = useState({
    // Section 1 - Incident Info
    date_of_injury: '',
    time_of_event: '',
    incident: '',
    unit: '',
    // Section 2 - Patient/Employee
    patient_name: '',
    employee_agency: '',
    employee_crew_assignment: '',
    employee_supervisor_name: '',
    employee_supervisor_phone: '',
    // Section 3 - Injury
    mechanism_of_injury: '',
    body_part_affected: '',
    activity_prior_to_event: '',
    what_harmed_employee: '',
    // Section 4 - Clinical
    clinical_impression: '',
    treatment_summary: '',
    physician_of_record: '',
    lost_time_expected: null as boolean | null,
    transported_to_hospital: null as boolean | null,
    hospital_name: '',
    facility_city: '',
    facility_state: '',
    hospitalized_overnight: null as boolean | null,
    // Section 5 - Witnesses
    witness_name: '',
    witness_contact: '',
    // Section 6 - Claims Coordinator
    claims_coordinator_name: '',
    claims_coordinator_phone: '',
    claims_coordinator_email: '',
    // Section 7 - Employer
    employer_name: '',
    employer_address: '',
    // Section 8 - Notes
    notes: '',
    // Internal
    provider_name: '',
    patient_dob: dobParam,
    time_employee_began_work: tebwParam ? (tebwParam.includes('T') ? tebwParam.slice(-5) : tebwParam) : '06:00',
  })

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      patient_dob: dobParam || prev.patient_dob,
      time_employee_began_work: tebwParam ? (tebwParam.includes('T') ? tebwParam.slice(-5) : tebwParam) : prev.time_employee_began_work,
    }))
  }, [dobParam, tebwParam])

  useEffect(() => {
    const load = async () => {
      // Load physicians
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name, role')
        .in('role', ['MD', 'MD/DO'])
        .eq('status', 'Active')
        .order('name')
      setPhysicians(emps || [])

      // Pre-fill from encounter
      if (encounterId) {
        const { data: enc } = await supabase
          .from('patient_encounters')
          .select('id, patient_first_name, patient_last_name, patient_dob, date, incident_id, unit, primary_impression_text, notes, provider_of_record, crew_resource_number, primary_symptom_text')
          .eq('encounter_id', encounterId)
          .single()

        if (enc) {
          setEncounterUUID(enc.id as string)
          const encIncId = (enc as any).incident_id
          setForm(prev => ({
            ...prev,
            patient_name: [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' '),
            date_of_injury: (enc.date as string) || '',
            unit: (enc.unit as string) || '',
            clinical_impression: ((enc as any).primary_impression_text || (enc as any).primary_symptom_text || '') as string,
            treatment_summary: ((enc as any).notes || '') as string,
            provider_name: (enc.provider_of_record as string) || '',
            patient_dob: (enc as any).patient_dob ? String((enc as any).patient_dob).slice(0, 10) : '',
            time_employee_began_work: (() => { const v = (enc as any).time_employee_began_work || tebwParam || '06:00'; return v.includes('T') ? v.slice(-5) : v; })(),
            employee_crew_assignment: (enc.crew_resource_number as string) || '',
          }))
          // Load incident from encounter's incident_id
          if (encIncId) {
            const { data: encInc } = await supabase
              .from('incidents')
              .select('name, comp_claims_name, comp_claims_email, comp_claims_phone')
              .eq('id', encIncId)
              .single()
            if (encInc) {
              setForm(prev => ({
                ...prev,
                incident: (encInc.name as string) || prev.incident,
                claims_coordinator_name: (encInc as any).comp_claims_name || prev.claims_coordinator_name,
                claims_coordinator_email: (encInc as any).comp_claims_email || prev.claims_coordinator_email,
                claims_coordinator_phone: (encInc as any).comp_claims_phone || prev.claims_coordinator_phone,
              }))
            }
          }
        } else {
          // Try by UUID
          const { data: enc2 } = await supabase
            .from('patient_encounters')
            .select('id, patient_first_name, patient_last_name, patient_dob, date, incident_id, unit, primary_impression_text, notes, provider_of_record, crew_resource_number, primary_symptom_text')
            .eq('id', encounterId)
            .single()
          if (enc2) {
            setEncounterUUID(enc2.id as string)
            const enc2IncId = (enc2 as any).incident_id
            setForm(prev => ({
              ...prev,
              patient_name: [enc2.patient_first_name, enc2.patient_last_name].filter(Boolean).join(' '),
              date_of_injury: (enc2.date as string) || '',
              unit: (enc2.unit as string) || '',
              clinical_impression: ((enc2 as any).primary_impression_text || (enc2 as any).primary_symptom_text || '') as string,
              treatment_summary: ((enc2 as any).notes || '') as string,
              provider_name: (enc2.provider_of_record as string) || '',
              employee_crew_assignment: (enc2.crew_resource_number as string) || '',
            }))
            if (enc2IncId) {
              const { data: enc2Inc } = await supabase
                .from('incidents')
                .select('name, comp_claims_name, comp_claims_email, comp_claims_phone')
                .eq('id', enc2IncId)
                .single()
              if (enc2Inc) {
                setForm(prev => ({
                  ...prev,
                  incident: (enc2Inc.name as string) || prev.incident,
                  claims_coordinator_name: (enc2Inc as any).comp_claims_name || prev.claims_coordinator_name,
                  claims_coordinator_email: (enc2Inc as any).comp_claims_email || prev.claims_coordinator_email,
                  claims_coordinator_phone: (enc2Inc as any).comp_claims_phone || prev.claims_coordinator_phone,
                }))
              }
            }
          }
        }
      }

      // Load incident data (either from URL param or from the linked encounter)
      const incId = incidentIdParam
      if (incId) {
        const { data: inc } = await supabase
          .from('incidents')
          .select('name, comp_claims_name, comp_claims_email, comp_claims_phone, location')
          .eq('id', incId)
          .single()
        if (inc) {
          setForm(prev => ({
            ...prev,
            incident: (inc.name as string) || prev.incident,
            // Pre-fill comp claims coordinator from incident if available
            claims_coordinator_name: (inc as any).comp_claims_name || prev.claims_coordinator_name,
            claims_coordinator_email: (inc as any).comp_claims_email || prev.claims_coordinator_email,
            claims_coordinator_phone: (inc as any).comp_claims_phone || prev.claims_coordinator_phone,
          }))
        }
      }
    }
    load()
  }, [encounterId, incidentIdParam])

  const set = (field: string, value: string | boolean | null) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = async () => {
    if (!form.patient_name) {
      setError('Patient name is required.')
      return
    }
    setSubmitting(true)
    setError(null)

    const payload: Record<string, unknown> = {
      encounter_id: encounterId || null,
      patient_name: form.patient_name || null,
      patient_dob: form.patient_dob || null,
      date_of_injury: form.date_of_injury || null,
      time_of_event: form.time_of_event || null,
      incident: form.incident || null,
      unit: form.unit || null,
      employee_agency: form.employee_agency || null,
      employee_crew_assignment: form.employee_crew_assignment || null,
      employee_supervisor_name: form.employee_supervisor_name || null,
      employee_supervisor_phone: form.employee_supervisor_phone || null,
      mechanism_of_injury: form.mechanism_of_injury || null,
      body_part_affected: form.body_part_affected || null,
      activity_prior_to_event: form.activity_prior_to_event || null,
      what_harmed_employee: form.what_harmed_employee || null,
      clinical_impression: form.clinical_impression || null,
      treatment_summary: form.treatment_summary || null,
      provider_name: form.provider_name || null,
      physician_of_record: form.physician_of_record || null,
      lost_time_expected: form.lost_time_expected,
      transported_to_hospital: form.transported_to_hospital,
      hospital_name: form.transported_to_hospital ? (form.hospital_name || null) : null,
      facility_city: form.facility_city || null,
      facility_state: form.facility_state || null,
      hospitalized_overnight: form.hospitalized_overnight,
      witness_name: form.witness_name || null,
      witness_contact: form.witness_contact || null,
      claims_coordinator_name: form.claims_coordinator_name || null,
      claims_coordinator_phone: form.claims_coordinator_phone || null,
      claims_coordinator_email: form.claims_coordinator_email || null,
      employer_name: form.employer_name || null,
      employer_address: form.employer_address || null,
      notes: form.notes || null,
      time_employee_began_work: form.time_employee_began_work ? form.time_employee_began_work.slice(-5).padStart(5, '0') : null,
      status: 'Complete',
      incident_id: incidentIdParam || null,
    }

    const { data: insertedClaim, error: insertErr } = await supabase.from('comp_claims').insert(payload).select('id').single()
    setSubmitting(false)

    if (insertErr) {
      setError(`Save failed: ${insertErr.message}`)
    } else {
      setLastClaimData({ ...form })
      setSavedClaimId((insertedClaim as any)?.id || null)
      setSuccess(true)
      // Auto-generate and upload PDF
      try {
        const claimIdStr = ((insertedClaim as any)?.id || Date.now()).toString().slice(-8)
        const doc2 = generateCompClaimsPDF({
          patient_name: form.patient_name,
          employee_agency: form.employee_agency || '',
          employee_crew: form.employee_crew_assignment,
          provider_name: form.physician_of_record,
          hospital_name: form.hospital_name,
          facility_city: form.facility_city,
          facility_state: form.facility_state,
          transported_to_hospital: form.transported_to_hospital ? 'Yes' : 'No',
          hospitalized_overnight: form.hospitalized_overnight ? 'Yes' : 'No',
          date_of_injury: form.date_of_injury,
          time_of_event: form.time_of_event,
          time_employee_began_work: form.time_employee_began_work,
          activity_prior: form.activity_prior_to_event,
          what_harmed: form.what_harmed_employee,
          body_part: form.body_part_affected,
          mechanism: form.mechanism_of_injury,
          lost_time: form.lost_time_expected ? 'Yes' : 'No',
          incident: form.incident,
          unit: form.unit,
          clinical_impression: form.clinical_impression,
          treatment_summary: form.treatment_summary,
          notes: form.notes,
          supervisor_name: form.employee_supervisor_name,
          supervisor_phone: form.employee_supervisor_phone,
          coordinator_name: form.claims_coordinator_name || '',
          coordinator_phone: form.claims_coordinator_phone,
          coordinator_email: form.claims_coordinator_email || '',
          employer_name: form.employer_name,
          employer_address: form.employer_address,
          generated_date: new Date().toLocaleDateString(),
          claim_id: claimIdStr,
        })
        const pdfBlob = new Blob([doc2.output('arraybuffer')], { type: 'application/pdf' })
        const storagePath = `comp-claims/${claimIdStr}.pdf`
        const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
        if (!upErr && (insertedClaim as any)?.id) {
          await supabase.from('comp_claims').update({ pdf_url: storagePath, status: 'Complete' }).eq('id', (insertedClaim as any).id)
          const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24)
          setSavedPdfUrl(signed?.signedUrl || null)
        }
      } catch (pdfErr) { console.error('PDF auto-gen failed:', pdfErr) }
      // No auto-redirect — user downloads PDF first then navigates back
    }
  }

  const handleDownloadOSHA = () => {
    if (!lastClaimData) return
    setPdfGenerating(true)
    try {
      const doc = generateCompClaimsPDF({
        patient_name: lastClaimData.patient_name,
        employee_agency: lastClaimData.employee_agency || '',
        employee_crew: lastClaimData.employee_crew_assignment,
        provider_name: lastClaimData.physician_of_record,
        hospital_name: lastClaimData.hospital_name,
        facility_city: lastClaimData.facility_city,
        facility_state: lastClaimData.facility_state,
        transported_to_hospital: lastClaimData.transported_to_hospital ? 'Yes' : 'No',
        hospitalized_overnight: lastClaimData.hospitalized_overnight ? 'Yes' : 'No',
        date_of_injury: lastClaimData.date_of_injury,
        time_of_event: lastClaimData.time_of_event,
        time_employee_began_work: lastClaimData.time_employee_began_work,
        activity_prior: lastClaimData.activity_prior_to_event,
        what_harmed: lastClaimData.what_harmed_employee,
        body_part: lastClaimData.body_part_affected,
        mechanism: lastClaimData.mechanism_of_injury,
        lost_time: lastClaimData.lost_time_expected ? 'Yes' : 'No',
        incident: lastClaimData.incident,
        unit: lastClaimData.unit,
        clinical_impression: lastClaimData.clinical_impression,
        treatment_summary: lastClaimData.treatment_summary,
        notes: lastClaimData.notes,
        supervisor_name: lastClaimData.employee_supervisor_name,
        supervisor_phone: lastClaimData.employee_supervisor_phone,
        coordinator_name: lastClaimData.claims_coordinator_name || '',
        coordinator_phone: lastClaimData.claims_coordinator_phone,
        coordinator_email: lastClaimData.claims_coordinator_email || '',
        employer_name: lastClaimData.employer_name,
        employer_address: lastClaimData.employer_address,
        generated_date: new Date().toLocaleDateString(),
        claim_id: lastClaimData.patient_name?.slice(0,10).replace(/\s/g,'') + '-' + Date.now().toString().slice(-6),
      })
      doc.save(`OSHA301-${lastClaimData?.patient_name?.replace(/\s+/g,'-') || 'claim'}-${Date.now().toString().slice(-6)}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
    }
    setPdfGenerating(false)
  }

  useEffect(() => {
    if (form.unit) loadEncountersForUnit(form.unit)
  }, [form.unit])

  if (success) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm w-full">
        <p className="text-4xl">✅</p>
        <p className="text-xl font-bold text-green-400">Claim Saved</p>
        <p className="text-gray-400 text-sm">Workers' comp claim has been recorded.</p>
        {savedPdfUrl && (
          <a href={savedPdfUrl} target="_blank" rel="noopener noreferrer"
            className="block w-full py-3 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors text-center">
            📄 View / Download OSHA 301 PDF
          </a>
        )}
        <button onClick={handleDownloadOSHA} disabled={pdfGenerating}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-semibold rounded-xl transition-colors">
          {pdfGenerating ? '⏳ Generating...' : '⬇️ Re-download PDF'}
        </button>
        <Link to={encounterUUID ? `/encounters/${encounterUUID}` : '/encounters'}
          className="block w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors text-sm">
          ← Back to Encounter
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 mt-8 md:mt-0">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={encounterUUID ? `/encounters/${encounterUUID}` : '/comp-claims'} className="text-gray-500 hover:text-gray-300 text-sm">← Back</Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">New Workers&apos; Comp Claim</h1>
            {encounterId && (
              <p className="text-xs text-blue-400">Linked to encounter: {encounterId}</p>
            )}
          </div>
        </div>

        {/* Encounter Picker */}
        {!encounterId && (
          <EncounterPickerSection onSelect={enc => {
            const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
            setForm(prev => ({
              ...prev,
              patient_name: name || prev.patient_name,
              date_of_injury: enc.date || prev.date_of_injury,
              unit: enc.unit || prev.unit,
              encounter_id: enc.encounter_id || '',
              clinical_impression: enc.primary_symptom_text || prev.clinical_impression,
            }))
          }} />
        )}

        {/* Encounter Picker */}
        {!encounterId && (
          <EncounterPicker
            onSelect={(enc) => {
              const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
              setForm(prev => ({
                ...prev,
                patient_name: name || prev.patient_name,
                date_of_injury: enc.date || prev.date_of_injury,
                unit: enc.unit || prev.unit,
                encounter_id: enc.encounter_id || '',
                clinical_impression: enc.primary_symptom_text || prev.clinical_impression,
              }))
            }}
          />
        )}

        {/* ── SECTION 1: Incident Info ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 1 — Incident Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date of Injury *</label>
              <input type="date" className={inputCls} value={form.date_of_injury} onChange={e => set('date_of_injury', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Time of Event</label>
              <input type="time" className={inputCls} value={form.time_of_event} onChange={e => set('time_of_event', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Incident Name</label>
            <input type="text" className={inputCls} value={form.incident} onChange={e => set('incident', e.target.value)} placeholder="e.g. Park Fire" />
          </div>
          <div>
            <label className={labelCls}>Unit</label>
            <input type="text" className={inputCls} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="e.g. GRANITE 1" />
          </div>
          <div>
            <label className={labelCls}>Time Employee Began Work</label>
            <input type="time" className={inputCls} value={form.time_employee_began_work} onChange={e => set('time_employee_began_work', e.target.value)} />
          </div>
        </div>

        {/* ── SECTION 2: Patient/Employee ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 2 — Patient / Employee</p>
          <div>
            <label className={labelCls}>Patient / Employee Name *</label>
            <input type="text" className={inputCls} value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input type="date" className={inputCls} value={form.patient_dob} onChange={e => set('patient_dob', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Employee Agency</label>
            <input type="text" className={inputCls} value={form.employee_agency} onChange={e => set('employee_agency', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Crew / Assignment (Resource Number)</label>
            <input type="text" className={inputCls} value={form.employee_crew_assignment} onChange={e => set('employee_crew_assignment', e.target.value)} placeholder="e.g. CRN-2024-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Supervisor Name</label>
              <input type="text" className={inputCls} value={form.employee_supervisor_name} onChange={e => set('employee_supervisor_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Supervisor Phone</label>
              <input type="tel" className={inputCls} value={form.employee_supervisor_phone} onChange={e => set('employee_supervisor_phone', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Injury Details ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 3 — Injury Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mechanism of Injury</label>
              <select className={inputCls} value={form.mechanism_of_injury} onChange={e => set('mechanism_of_injury', e.target.value)}>
                <option value="">Select</option>
                {MECHANISM_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Body Part Affected</label>
              <select className={inputCls} value={form.body_part_affected} onChange={e => set('body_part_affected', e.target.value)}>
                <option value="">Select</option>
                {BODY_PART_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Activity Prior to Event</label>
            <textarea className={`${inputCls} h-24 resize-none`} value={form.activity_prior_to_event} onChange={e => set('activity_prior_to_event', e.target.value)} placeholder="What was the employee doing before the injury?" />
          </div>
          <div>
            <label className={labelCls}>What Harmed the Employee</label>
            <textarea className={`${inputCls} h-24 resize-none`} value={form.what_harmed_employee} onChange={e => set('what_harmed_employee', e.target.value)} placeholder="Describe the object, substance, or exposure that caused the injury" />
          </div>
        </div>

        {/* ── SECTION 4: Clinical ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 4 — Clinical</p>
          <div>
            <label className={labelCls}>Clinical Impression</label>
            <select className={inputCls} value={CLINICAL_OPTIONS_COMP.includes(form.clinical_impression) ? form.clinical_impression : (form.clinical_impression ? '__custom__' : '')}
              onChange={e => {
                if (e.target.value === '__custom__') set('clinical_impression', '')
                else set('clinical_impression', e.target.value)
              }}>
              <option value="">Select from list...</option>
              {CLINICAL_OPTIONS_COMP.map(o => <option key={o} value={o}>{o}</option>)}
              <option value="__custom__">Other / Type below...</option>
            </select>
            {(!form.clinical_impression || !CLINICAL_OPTIONS_COMP.includes(form.clinical_impression)) && (
              <input
                type="text"
                className={inputCls + ' mt-1'}
                value={form.clinical_impression}
                onChange={e => set('clinical_impression', e.target.value)}
                placeholder="Type clinical impression..."
              />
            )}
          </div>
          <div>
            <label className={labelCls}>Treatment Summary</label>
            <textarea className={`${inputCls} h-28 resize-none`} value={form.treatment_summary} onChange={e => set('treatment_summary', e.target.value)} placeholder="Treatments provided, medications given, interventions..." />
          </div>
          <div>
            <label className={labelCls}>Physician of Record</label>
            <select className={inputCls} value={form.physician_of_record} onChange={e => set('physician_of_record', e.target.value)}>
              <option value="">Select physician</option>
              {physicians.map(p => (
                <option key={p.id} value={p.name}>{p.name} — {p.role}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Lost Time Expected?</label>
            <ToggleButton value={form.lost_time_expected} onChange={v => set('lost_time_expected', v)} />
          </div>
          <div>
            <label className={labelCls}>Transported to Hospital?</label>
            <ToggleButton value={form.transported_to_hospital} onChange={v => set('transported_to_hospital', v)} />
          </div>
          {form.transported_to_hospital && (
            <div>
              <label className={labelCls}>Hospital Name</label>
              <input type="text" className={inputCls} value={form.hospital_name} onChange={e => set('hospital_name', e.target.value)} placeholder="e.g. Mercy Medical Center" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Facility City</label>
              <input type="text" className={inputCls} value={form.facility_city} onChange={e => set('facility_city', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Facility State</label>
              <input type="text" className={inputCls} value={form.facility_state} onChange={e => set('facility_state', e.target.value)} maxLength={2} placeholder="CA" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Hospitalized Overnight?</label>
            <ToggleButton value={form.hospitalized_overnight} onChange={v => set('hospitalized_overnight', v)} />
          </div>
        </div>

        {/* ── SECTION 5: Witnesses ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 5 — Witnesses</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Witness Name</label>
              <input type="text" className={inputCls} value={form.witness_name} onChange={e => set('witness_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Witness Contact</label>
              <input type="tel" className={inputCls} value={form.witness_contact} onChange={e => set('witness_contact', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── SECTION 6: Claims Coordinator ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 6 — Claims Coordinator</p>
          <div>
            <label className={labelCls}>Coordinator Name</label>
            <input type="text" className={inputCls} value={form.claims_coordinator_name} onChange={e => set('claims_coordinator_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" className={inputCls} value={form.claims_coordinator_phone} onChange={e => set('claims_coordinator_phone', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.claims_coordinator_email} onChange={e => set('claims_coordinator_email', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── SECTION 7: Employer ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <p className={sectionCls}>Section 7 — Employer</p>
          <div>
            <label className={labelCls}>Employer Name</label>
            <input type="text" className={inputCls} value={form.employer_name} onChange={e => set('employer_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Employer Address</label>
            <input type="text" className={inputCls} value={form.employer_address} onChange={e => set('employer_address', e.target.value)} />
          </div>
        </div>

        {/* ── SECTION 8: Notes ── */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <p className={sectionCls}>Section 8 — Notes</p>
          <textarea className={`${inputCls} h-28 resize-none`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes, observations, follow-up actions..." />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
        >
          {submitting ? 'Saving Claim...' : '💾 Submit Comp Claim'}
        </button>
        <div className="pb-8" />
      </div>
    </div>
  )
}


const CLINICAL_OPTIONS_COMP = [
  'Traumatic Injury (general)', 'Head Injury', 'Traumatic Brain Injury', 'Laceration', 'Abrasion',
  'Fracture (general)', 'Sprain / Strain', 'Dislocation', 'Burns (general)', 'Smoke Inhalation',
  'Heat Exhaustion', 'Heat Stroke', 'Chest Pain', 'Cardiac Arrest', 'Respiratory Distress',
  'Dyspnea / Shortness of Breath', 'Altered Mental Status', 'Seizure', 'Stroke / CVA',
  'Hypoglycemia', 'Allergic Reaction - Mild', 'Anaphylaxis', 'Drug Overdose (general)',
  'Back Injury', 'Abdominal Trauma', 'Eye Injury / Debris', 'Musculoskeletal Pain',
  'Dehydration', 'Fatigue / Exhaustion', 'Rhabdomyolysis', 'Envenomation - Snake',
  'Envenomation - Bee/Wasp/Insect', 'Falls from Height', 'Rope Rescue Injury',
  'Vehicle Accident (crew transport)', 'No Patient Found', 'Patient Refusal', 'Other / Not Listed',
]

export default function NewCompClaimPage() {
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <NewCompClaimInner />
    </Suspense>
  )
}
