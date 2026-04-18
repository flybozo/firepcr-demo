
import EncounterPicker, { type PickedEncounter } from '@/components/EncounterPicker'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { generateAMAPDF } from '@/lib/generateAMApdf'

const PROVIDERS = [
  'Dr. A. Mitchell, MD',
  'Dr. R. Chen, MD',
  'Dr. R. Evans, MD',
  'Paul Bailey, NP',
  'Matt Butler, PA',
  'Stephanie Casteele, NP',
  'Heidi Johnson, NP',
  'Delores Meehan, NP',
  'Manichanh Ratts, PA',
  'Troy Bainbridge, PA',
  'Ali Schmitz, NP',
  'Jenn Shealy, NP',
]

const UNITS = ['Medic 1', 'Medic 2', 'Medic 3', 'Medic 4', 'Command 1', 'Aid 1', 'Aid 2', 'Rescue 1', 'Rescue 2']

function AMAFormInner() {
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

  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''
  const dobParam = searchParams.get('dob') || ''
  const firstNameParam = searchParams.get('firstName') || ''
  const lastNameParam = searchParams.get('lastName') || ''
  const unitParam = searchParams.get('unit') || ''
  const [encounterOptions, setEncounterOptions] = useState<{id: string, encounter_id: string, patient_first_name: string|null, patient_last_name: string|null, primary_symptom_text: string|null, date: string|null, unit: string|null}[]>([])
  const [selectedUnit, setSelectedUnit] = useState('')

  const loadEncountersForUnit = async (unitName: string) => {
    if (!unitName) { setEncounterOptions([]); return }
    const { data } = await supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit')
      .eq('unit', unitName).order('date', { ascending: false }).limit(20)
    setEncounterOptions(data || [])
  }

  // Fetch incident name from linked encounter
  useEffect(() => {
    if (!encounterId) return
    const fetchEncounter = async () => {
      // Fetch all needed fields from encounter directly — don't rely on URL params for name/DOB
      let enc: any = null
      const r1 = await supabase.from('patient_encounters')
        .select('id, patient_first_name, patient_last_name, patient_dob, incident_id, unit, provider_of_record')
        .eq('encounter_id', encounterId).single()
      if (r1.data) { enc = r1.data } else {
        const r2 = await supabase.from('patient_encounters')
          .select('id, patient_first_name, patient_last_name, patient_dob, incident_id, unit, provider_of_record')
          .eq('id', encounterId).single()
        enc = r2.data
      }
      if (!enc) return

      // Populate name, DOB, unit, provider directly from DB — source of truth
      setForm(prev => ({
        ...prev,
        patient_first_name: (enc.patient_first_name as string) || prev.patient_first_name,
        patient_last_name: (enc.patient_last_name as string) || prev.patient_last_name,
        dob: enc.patient_dob ? String(enc.patient_dob).slice(0, 10) : prev.dob,
        unit: (enc.unit as string) || prev.unit,
        provider_of_record: (enc.provider_of_record as string) || prev.provider_of_record,
      }))
      if ((enc as any).unit) setPickerUnit((enc as any).unit)

      // Fetch incident name
      if ((enc as any).incident_id) {
        const { data: inc } = await supabase
          .from('incidents')
          .select('name')
          .eq('id', (enc as any).incident_id)
          .single()
        if (inc?.name) setForm(prev => ({ ...prev, incident: inc.name }))
      }
    }
    fetchEncounter()
  }, [encounterId])

  const patientSigRef = useRef<SignatureCanvas>(null)
  const providerSigRef = useRef<SignatureCanvas>(null)
  const [submitting, setSubmitting] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  // Preload logo as base64 for PDF embedding
  useEffect(() => {
    fetch('/firepcr-logo.svg')
      .then(r => r.blob())
      .then(blob => { const reader = new FileReader(); reader.onload = () => setLogoDataUrl(reader.result as string); reader.readAsDataURL(blob) })
      .catch(() => {})
  }, [])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [lastConsentId, setLastConsentId] = useState('')
  const [lastConsentData, setLastConsentData] = useState<{
    patient_name: string
    patient_dob: string
    unit: string
    incident: string
    provider_name: string
    form_date: string
    form_time: string
    patient_signature_url?: string | null
    provider_signature_url?: string | null
  } | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const [form, setForm] = useState({
    patient_first_name: firstNameParam,
    patient_last_name: lastNameParam,
    dob: dobParam,
    unit: unitParam,
    incident: '',
    provider_of_record: '',
  })

  // Sync from searchParams once they resolve (Next.js 15 may be null on first render)
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      patient_first_name: firstNameParam || prev.patient_first_name,
      patient_last_name: lastNameParam || prev.patient_last_name,
      dob: dobParam || prev.dob,
      unit: unitParam || prev.unit,
    }))
  }, [firstNameParam, lastNameParam, dobParam, unitParam])

  const now = new Date()
  const formDate = now.toLocaleDateString('en-US')
  const formTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const patientName = `${form.patient_first_name} ${form.patient_last_name}`.trim() || '______________________'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const uploadSignature = async (sigRef: React.RefObject<SignatureCanvas | null>, label: string): Promise<{ url: string | null; dataUrl: string | null }> => {
    if (!sigRef.current || sigRef.current.isEmpty()) return { url: null, dataUrl: null }
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
    const blob = await (await fetch(dataUrl)).blob()
    const fileName = `consent/${Date.now()}-${label}.png`
    const { error } = await supabase.storage
      .from('signatures')
      .upload(fileName, blob, { contentType: 'image/png', upsert: false })
    if (error) { console.error('Upload error:', error); return { url: null, dataUrl } }
    // Store the storage path (bucket is private — use signed URLs when displaying)
    return { url: fileName, dataUrl }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.patient_first_name || !form.patient_last_name) {
      setError('Patient name is required.'); return
    }
    if (!form.provider_of_record) {
      setError('Provider of record is required.'); return
    }
    if (patientSigRef.current?.isEmpty()) {
      setError('Patient signature is required.'); return
    }
    if (providerSigRef.current?.isEmpty()) {
      setError('Provider signature is required.'); return
    }

    setSubmitting(true)
    try {
      const [patientSigResult, providerSigResult] = await Promise.all([
        uploadSignature(patientSigRef, 'patient'),
        uploadSignature(providerSigRef, 'provider'),
      ])
      const patientSigUrl = patientSigResult.url
      const providerSigUrl = providerSigResult.url
      const patientSigDataUrl = patientSigResult.dataUrl
      const providerSigDataUrl = providerSigResult.dataUrl

      const consentId = `CONSENT-${Date.now()}`
      // Resolve encounter_id text value for FK (consent_forms.encounter_id → patient_encounters.encounter_id)
      let encounterIdText: string | null = null
      if (encounterId) {
        // encounterId may be text (ENC-TEST-005) or UUID — look up the text encounter_id
        const { data: encRow } = await supabase
          .from('patient_encounters')
          .select('encounter_id')
          .or(`encounter_id.eq.${encounterId},id.eq.${encounterId}`)
          .single()
        encounterIdText = (encRow as any)?.encounter_id || encounterId
      }

      const { error: insertError } = await supabase.from('consent_forms').insert({
        consent_id: consentId,
        consent_type: 'AMA',
        encounter_id: encounterIdText,
        date_time: new Date().toISOString(),
        patient_first_name: form.patient_first_name,
        patient_last_name: form.patient_last_name,
        dob: form.dob || null,
        unit: form.unit,
        incident: form.incident,
        provider_of_record: form.provider_of_record,
        patient_signature_url: patientSigUrl,
        provider_signature_url: providerSigUrl,
        signed: true,
      })

      if (insertError) throw insertError

      // Auto-update refusal_signed on the linked encounter
      if (encounterIdText) {
        await supabase.from('patient_encounters')
          .update({ refusal_signed: true })
          .eq('encounter_id', encounterIdText)
      }
      const amaData = {
        patient_name: `${form.patient_first_name} ${form.patient_last_name}`.trim(),
        patient_dob: form.dob || '',
        unit: form.unit,
        incident: form.incident,
        provider_name: form.provider_of_record,
        form_date: formDate,
        form_time: formTime,
        patient_signature_url: patientSigDataUrl || patientSigUrl,
        provider_signature_url: providerSigDataUrl || providerSigUrl,
      }
      setLastConsentId(consentId)
      setLastConsentData(amaData)
      setSubmitted(true) // Show success screen immediately — PDF saves in background

      // Auto-save PDF to storage (background — success screen already shown)
      ;(async () => {
        try {
          const doc = generateAMAPDF({ ...amaData, consent_id: consentId }, logoDataUrl)
          const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
          const storagePath = `ama/${consentId}.pdf`
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
          if (!uploadErr) {
            const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24 * 365)
            const url = signed?.signedUrl || storagePath
            setPdfUrl(url)
            await supabase.from('consent_forms').update({ pdf_url: storagePath }).eq('consent_id', consentId)
          }
        } catch (pdfErr) {
          console.error('Auto-save PDF error:', pdfErr)
        }
      })()
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handlePreviewPDF = async () => {
    if (!lastConsentData || !lastConsentId) return
    const doc = await generateAMAPDF({
      ...lastConsentData,
      consent_id: lastConsentId,
    }, logoDataUrl)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    setShowPreview(true)
  }

  const handleDownloadPDF = async () => {
    if (!lastConsentData || !lastConsentId) return
    setPdfGenerating(true)
    try {
      const doc = await generateAMAPDF({
        ...lastConsentData,
        consent_id: lastConsentId,
      }, logoDataUrl)

      // Trigger browser download
      doc.save(`AMA-${lastConsentId}.pdf`)

      // Upload to Supabase Storage (documents bucket)
      const pdfBytes = doc.output('arraybuffer')
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const storagePath = `ama/${lastConsentId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true })

      if (!uploadError) {
        // Store path (private bucket — generate signed URL for display)
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24 * 7)
        const displayUrl = signed?.signedUrl || storagePath
        setPdfUrl(displayUrl)

        // Save storage path back to consent_forms
        await supabase.from('consent_forms')
          .update({ pdf_url: storagePath })
          .eq('consent_id', lastConsentId)
      }
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setPdfGenerating(false)
    }
  }

  const handleCopyLink = async () => {
    if (!pdfUrl) return
    try {
      await navigator.clipboard.writeText(pdfUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // fallback
      const el = document.createElement('textarea')
      el.value = pdfUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleShare = async () => {
    if (!pdfUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          url: pdfUrl,
          title: 'AMA Form',
          text: 'AMA Refusal of Care form',
        })
      } catch {
        await handleCopyLink()
      }
    } else {
      await handleCopyLink()
    }
  }

  // On success screen, poll DB for pdf_url if not set yet (background save may still be running)
  useEffect(() => {
    if (!submitted || !lastConsentId || pdfUrl) return
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const { data } = await supabase.from('consent_forms').select('pdf_url').eq('consent_id', lastConsentId).single()
        if (data?.pdf_url) {
          const { data: signed } = await supabase.storage.from('documents').createSignedUrl(data.pdf_url, 3600 * 24 * 365)
          if (signed?.signedUrl) setPdfUrl(signed.signedUrl)
          clearInterval(poll)
        }
      } catch {}
      if (attempts >= 10) clearInterval(poll) // give up after 10s
    }, 1000)
    return () => clearInterval(poll)
  }, [submitted, lastConsentId, pdfUrl])

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="text-6xl">✅</div>
          <h1 className="text-2xl font-bold text-white">Refusal Documented</h1>
          <p className="text-gray-400">AMA form saved successfully.</p>

          {/* PDF link — appears once background save completes */}
          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="block bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm text-center hover:bg-green-900/50 transition-colors">
              ✅ AMA PDF saved — tap to open
            </a>
          ) : (
            <p className="text-xs text-gray-500">⏳ Saving PDF...</p>
          )}

          {/* Manual download fallback */}
          <button
            onClick={handleDownloadPDF}
            disabled={pdfGenerating}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {pdfGenerating ? '⏳ Generating...' : '📄 Download PDF'}
          </button>

          <button
            onClick={() => {
              setSubmitted(false)
              setForm({ patient_first_name: '', patient_last_name: '', dob: '', unit: '', incident: '', provider_of_record: '' })
              patientSigRef.current?.clear()
              providerSigRef.current?.clear()
              setPdfUrl(null)
              setLastConsentId('')
              setLastConsentData(null)
            }}
            className="w-full mt-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold"
          >
            New AMA Form
          </button>
          <div><a href="/" className="text-gray-500 text-sm underline">Back to Home</a></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-lg mx-auto p-6 space-y-6">

        {/* Encounter Picker */}
        {!encounterId && (
          <EncounterPicker onSelect={enc => {
            setForm(prev => ({
              ...prev,
              patient_first_name: enc.patient_first_name || prev.patient_first_name,
              patient_last_name: enc.patient_last_name || prev.patient_last_name,
              dob: (enc as any).patient_dob || prev.dob,
              unit: enc.unit || prev.unit,
              incident: enc.incident_id || prev.incident,
            }))
          }} />
        )}

                {/* Encounter Picker — clean implementation */}
        {!encounterId && (
          <EncounterPicker
            onSelect={(enc) => {
              setForm(prev => ({
                ...prev,
                patient_first_name: enc.patient_first_name || prev.patient_first_name,
                patient_last_name: enc.patient_last_name || prev.patient_last_name,
                dob: enc.patient_dob || prev.dob,
                unit: enc.unit || prev.unit,
              }))
            }}
          />
        )}

        {/* Header */}
        <div className="text-center pt-4">
          <h1 className="text-xl font-bold text-red-500">REMOTE AREA MEDICINE</h1>
          <p className="text-sm text-gray-400">Ridgeline Medical Group | DBA Ridgeline EMS</p>
          <p className="text-xs text-gray-500">Medical Director: Dr. A. Mitchell, MD</p>
          <p className="text-sm font-semibold mt-2">REFUSAL OF EMERGENCY MEDICAL CARE / AMA</p>
          <p className="text-xs text-gray-400 mt-1">{formDate} — {formTime}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Patient Info */}
          <section className="bg-gray-900 rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Patient Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">First Name *</label>
                <input name="patient_first_name" value={form.patient_first_name} onChange={handleChange}
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Last Name *</label>
                <input name="patient_last_name" value={form.patient_last_name} onChange={handleChange}
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Date of Birth</label>
                <input name="dob" type="date" value={form.dob} onChange={handleChange}
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Unit</label>
                <select name="unit" value={form.unit} onChange={handleChange}
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select...</option>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Incident</label>
              <input name="incident" value={form.incident} onChange={handleChange}
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </section>

          {/* Capacity Assessment */}
          <section className="bg-gray-900 rounded-xl p-4 space-y-2">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Capacity Assessment</h2>
            <p className="text-xs text-gray-400">The EMS provider certifies that the patient:</p>
            {[
              'Is alert and oriented to person, place, time, and event',
              'Understands their medical condition as explained',
              'Understands the risks of refusing care, including serious injury or DEATH',
              'Does NOT appear impaired by alcohol, drugs, or medical/psychiatric condition',
              'Is ≥ 18 years of age (or emancipated minor)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5 text-sm">✓</span>
                <span className="text-sm text-gray-300">{item}</span>
              </div>
            ))}
          </section>

          {/* Refusal */}
          <section className="bg-gray-900 rounded-xl p-4 space-y-2">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Refusal</h2>
            {['All emergency medical treatment', 'Transport to a medical facility'].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-red-400 text-sm">✓</span>
                <span className="text-sm text-gray-300">{item}</span>
              </div>
            ))}
          </section>

          {/* Patient Statement */}
          <section className="bg-gray-900 rounded-xl p-4">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300 mb-2">Patient Statement & Release</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              I, <span className="text-white font-medium">{patientName}</span>, have been informed of my medical condition, the recommended treatment and/or transport, and the risks of refusal — including serious injury or death. I am voluntarily refusing the emergency medical care described above and release Ridgeline EMS (Ridgeline Medical Group), its medical director, and all EMS providers from any liability arising from this refusal. I have been advised to call 911 or seek emergency care immediately if my condition worsens.
            </p>
          </section>

          {/* Patient Signature */}
          <section className="bg-gray-900 rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Patient Signature *</h2>
            <p className="text-xs text-gray-500">{formDate} {formTime}</p>
            <div
              className="bg-white rounded-lg overflow-hidden"
              style={{ touchAction: 'none' }}
              ref={(el) => {
                if (el) {
                  const canvas = el.querySelector('canvas')
                  if (canvas) {
                    const rect = el.getBoundingClientRect()
                    if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                      canvas.width = Math.round(rect.width)
                      canvas.height = 140
                    }
                  }
                }
              }}
            >
              <SignatureCanvas
                ref={patientSigRef}
                backgroundColor="white"
                penColor="black"
                canvasProps={{ style: { width: '100%', height: '140px', display: 'block' } }}
                onBegin={() => {
                  const canvas = patientSigRef.current?.getCanvas()
                  if (canvas) {
                    const rect = canvas.getBoundingClientRect()
                    if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                      const data = patientSigRef.current?.toData()
                      canvas.width = Math.round(rect.width)
                      canvas.height = 140
                      if (data) patientSigRef.current?.fromData(data)
                    }
                  }
                }}
              />
            </div>
            <button type="button" onClick={() => patientSigRef.current?.clear()}
              className="text-xs text-gray-500 underline">Clear</button>
          </section>

          {/* Provider */}
          <section className="bg-gray-900 rounded-xl p-4 space-y-3">
            <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">EMS Provider *</h2>
            <div>
              <label className="text-xs text-gray-400">Provider of Record *</label>
              <select name="provider_of_record" value={form.provider_of_record} onChange={handleChange}
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select provider...</option>
                {PROVIDERS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-500">{formDate} {formTime}</p>
            <div
              className="bg-white rounded-lg overflow-hidden"
              style={{ touchAction: 'none' }}
              ref={(el) => {
                if (el) {
                  const canvas = el.querySelector('canvas')
                  if (canvas) {
                    const rect = el.getBoundingClientRect()
                    if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                      canvas.width = Math.round(rect.width)
                      canvas.height = 140
                    }
                  }
                }
              }}
            >
              <SignatureCanvas
                ref={providerSigRef}
                backgroundColor="white"
                penColor="black"
                canvasProps={{ style: { width: '100%', height: '140px', display: 'block' } }}
                onBegin={() => {
                  const canvas = providerSigRef.current?.getCanvas()
                  if (canvas) {
                    const rect = canvas.getBoundingClientRect()
                    if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                      const data = providerSigRef.current?.toData()
                      canvas.width = Math.round(rect.width)
                      canvas.height = 140
                      if (data) providerSigRef.current?.fromData(data)
                    }
                  }
                }}
              />
            </div>
            <button type="button" onClick={() => providerSigRef.current?.clear()}
              className="text-xs text-gray-500 underline">Clear</button>
          </section>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors">
            {submitting ? 'Saving...' : 'Submit AMA Form'}
          </button>

        </form>
      </div>
    </div>
  )

}

export default function AMAForm() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <AMAFormInner />
    </Suspense>
  )
}
