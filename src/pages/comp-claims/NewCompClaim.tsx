import { useState, Suspense } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EncounterPicker from '@/components/EncounterPicker'
import { generateCompClaimsPDF } from '@/lib/generateCompClaimsPdf'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import type { EncounterOption } from './components/types'
import { useCompClaimInit } from './components/useCompClaimInit'
import { EncounterPickerSection } from './components/EncounterPickerSection'
import { SuccessScreen } from './components/SuccessScreen'
import { Section1IncidentInfo } from './components/Section1IncidentInfo'
import { Section2PatientEmployee } from './components/Section2PatientEmployee'
import { Section3InjuryDetails } from './components/Section3InjuryDetails'
import { Section4Clinical } from './components/Section4Clinical'
import { Section5Witnesses } from './components/Section5Witnesses'
import { Section6ClaimsCoordinator } from './components/Section6ClaimsCoordinator'
import { Section7Employer } from './components/Section7Employer'
import { Section8Notes } from './components/Section8Notes'

function NewCompClaimInner() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''
  const incidentIdParam = searchParams.get('incidentId') || ''
  const dobParam = searchParams.get('dob') || ''
  const tebwParam = searchParams.get('tebw') || ''

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [savedPdfUrl, setSavedPdfUrl] = useState<string | null>(null)
  const [lastClaimData, setLastClaimData] = useState<any>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tebw = tebwParam ? (tebwParam.includes('T') ? tebwParam.slice(-5) : tebwParam) : '06:00'
  const [form, setForm] = useState({
    date_of_injury: '', time_of_event: '', incident: '', unit: '',
    patient_name: '', employee_agency: '', employee_crew_assignment: '',
    employee_supervisor_name: '', employee_supervisor_phone: '',
    mechanism_of_injury: '', body_part_affected: '',
    activity_prior_to_event: '', what_harmed_employee: '',
    clinical_impression: '', treatment_summary: '', physician_of_record: '',
    lost_time_expected: null as boolean | null,
    transported_to_hospital: null as boolean | null,
    hospital_name: '', facility_city: '', facility_state: '',
    hospitalized_overnight: null as boolean | null,
    witness_name: '', witness_contact: '',
    claims_coordinator_name: '', claims_coordinator_phone: '', claims_coordinator_email: '',
    employer_name: '', employer_address: '', notes: '',
    provider_name: '', patient_dob: dobParam, time_employee_began_work: tebw,
  })

  const set = (field: string, value: string | boolean | null) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const { physicians, encounterUUID, incidentIdFromEnc, encounterOptions, logoDataUrl } =
    useCompClaimInit(encounterId, incidentIdParam, tebwParam, form.unit,
      assignment.loading, assignment.unit, setForm)

  const buildPdfArgs = (d: typeof form) => ({
    patient_name: d.patient_name, employee_agency: d.employee_agency || '',
    employee_crew: d.employee_crew_assignment, provider_name: d.physician_of_record,
    hospital_name: d.hospital_name, facility_city: d.facility_city, facility_state: d.facility_state,
    transported_to_hospital: d.transported_to_hospital ? 'Yes' : 'No',
    hospitalized_overnight: d.hospitalized_overnight ? 'Yes' : 'No',
    date_of_injury: d.date_of_injury, time_of_event: d.time_of_event,
    time_employee_began_work: d.time_employee_began_work,
    activity_prior: d.activity_prior_to_event, what_harmed: d.what_harmed_employee,
    body_part: d.body_part_affected, mechanism: d.mechanism_of_injury,
    lost_time: d.lost_time_expected ? 'Yes' : 'No', incident: d.incident, unit: d.unit,
    clinical_impression: d.clinical_impression, treatment_summary: d.treatment_summary, notes: d.notes,
    supervisor_name: d.employee_supervisor_name, supervisor_phone: d.employee_supervisor_phone,
    coordinator_name: d.claims_coordinator_name || '', coordinator_phone: d.claims_coordinator_phone,
    coordinator_email: d.claims_coordinator_email || '',
    employer_name: d.employer_name, employer_address: d.employer_address,
    generated_date: new Date().toLocaleDateString(),
  })

  const handleSubmit = async () => {
    if (!form.patient_name) { setError('Patient name is required.'); return }
    setSubmitting(true); setError(null)
    const { data: insertedClaim, error: insertErr } = await supabase.from('comp_claims').insert({
      encounter_id: encounterId || null, patient_name: form.patient_name || null,
      patient_dob: form.patient_dob || null, date_of_injury: form.date_of_injury || null,
      time_of_event: form.time_of_event || null, incident: form.incident || null,
      unit: form.unit || null, employee_agency: form.employee_agency || null,
      employee_crew_assignment: form.employee_crew_assignment || null,
      employee_supervisor_name: form.employee_supervisor_name || null,
      employee_supervisor_phone: form.employee_supervisor_phone || null,
      mechanism_of_injury: form.mechanism_of_injury || null,
      body_part_affected: form.body_part_affected || null,
      activity_prior_to_event: form.activity_prior_to_event || null,
      what_harmed_employee: form.what_harmed_employee || null,
      clinical_impression: form.clinical_impression || null,
      treatment_summary: form.treatment_summary || null,
      provider_name: form.provider_name || null, physician_of_record: form.physician_of_record || null,
      lost_time_expected: form.lost_time_expected, transported_to_hospital: form.transported_to_hospital,
      hospital_name: form.transported_to_hospital ? (form.hospital_name || null) : null,
      facility_city: form.facility_city || null, facility_state: form.facility_state || null,
      hospitalized_overnight: form.hospitalized_overnight,
      witness_name: form.witness_name || null, witness_contact: form.witness_contact || null,
      claims_coordinator_name: form.claims_coordinator_name || null,
      claims_coordinator_phone: form.claims_coordinator_phone || null,
      claims_coordinator_email: form.claims_coordinator_email || null,
      employer_name: form.employer_name || null, employer_address: form.employer_address || null,
      notes: form.notes || null,
      time_employee_began_work: form.time_employee_began_work ? form.time_employee_began_work.slice(-5).padStart(5, '0') : null,
      status: 'Complete', incident_id: incidentIdParam || incidentIdFromEnc || null,
    }).select('id').single()
    setSubmitting(false)
    if (insertErr) { setError(`Save failed: ${insertErr.message}`); return }
    setLastClaimData({ ...form }); setSuccess(true)
    try {
      const claimIdStr = ((insertedClaim as any)?.id || Date.now()).toString().slice(-8)
      const doc2 = await generateCompClaimsPDF({ ...buildPdfArgs(form), claim_id: claimIdStr }, logoDataUrl)
      const pdfBlob = new Blob([doc2.output('arraybuffer')], { type: 'application/pdf' })
      const storagePath = `comp-claims/${claimIdStr}.pdf`
      const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
      if (!upErr && (insertedClaim as any)?.id) {
        await supabase.from('comp_claims').update({ pdf_url: storagePath, status: 'Complete' }).eq('id', (insertedClaim as any).id)
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24)
        setSavedPdfUrl(signed?.signedUrl || null)
      }
    } catch (pdfErr) { console.error('PDF auto-gen failed:', pdfErr) }
  }

  const handleDownloadOSHA = async () => {
    if (!lastClaimData) return
    setPdfGenerating(true)
    try {
      const claimId = lastClaimData.patient_name?.slice(0,10).replace(/\s/g,'') + '-' + Date.now().toString().slice(-6)
      const doc = await generateCompClaimsPDF({ ...buildPdfArgs(lastClaimData), claim_id: claimId }, logoDataUrl)
      doc.save(`OSHA301-${lastClaimData?.patient_name?.replace(/\s+/g,'-') || 'claim'}-${Date.now().toString().slice(-6)}.pdf`)
    } catch (err) { console.error('PDF generation failed:', err) }
    setPdfGenerating(false)
  }

  const handleEncounterSelect = (enc: EncounterOption) => {
    const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
    setForm(prev => ({
      ...prev, patient_name: name || prev.patient_name,
      date_of_injury: enc.date || prev.date_of_injury, unit: enc.unit || prev.unit,
      encounter_id: enc.encounter_id || '',
      clinical_impression: enc.primary_symptom_text || prev.clinical_impression,
    }))
  }

  if (success) return (
    <SuccessScreen savedPdfUrl={savedPdfUrl} pdfGenerating={pdfGenerating}
      encounterUUID={encounterUUID} onDownloadOSHA={handleDownloadOSHA} />
  )

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link to={encounterUUID ? `/encounters/${encounterUUID}` : '/comp-claims'} className="text-gray-500 hover:text-gray-300 text-sm">← Back</Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">New Workers&apos; Comp Claim</h1>
            {encounterId && <p className="text-xs text-blue-400">Linked to encounter: {encounterId}</p>}
          </div>
        </div>
        {!encounterId && (
          <EncounterPickerSection encounterOptions={encounterOptions} unit={form.unit} onSelect={handleEncounterSelect} />
        )}
        {!encounterId && (
          <EncounterPicker onSelect={enc => handleEncounterSelect(enc as EncounterOption)} />
        )}
        <Section1IncidentInfo form={form as any} set={set} />
        <Section2PatientEmployee form={form as any} set={set} />
        <Section3InjuryDetails form={form as any} set={set} />
        <Section4Clinical form={form as any} physicians={physicians} set={set} />
        <Section5Witnesses form={form as any} set={set} />
        <Section6ClaimsCoordinator form={form as any} set={set} />
        <Section7Employer form={form as any} set={set} />
        <Section8Notes form={form as any} set={set} />
        {error && <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>}
        <button type="button" onClick={handleSubmit} disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg">
          {submitting ? 'Saving Claim...' : '💾 Submit Comp Claim'}
        </button>
        <div className="pb-8" />
      </div>
    </div>
  )
}

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
