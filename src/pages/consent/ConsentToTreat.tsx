import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { generateConsentToTreatPDF } from '@/lib/generateConsentPdf'

const PROVIDERS = [
  'Aaron Stutz, MD',
  'Rodney Look, MD',
  'Robert K. Evans, MD',
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

function ConsentToTreatInner() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''
  const firstNameParam = searchParams.get('firstName') || ''
  const lastNameParam = searchParams.get('lastName') || ''
  const dobParam = searchParams.get('dob') || ''
  const unitParam = searchParams.get('unit') || ''

  const patientSigRef = useRef<SignatureCanvas>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [lastConsentId, setLastConsentId] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  const [form, setForm] = useState({
    patient_first_name: firstNameParam,
    patient_last_name: lastNameParam,
    dob: dobParam,
    unit: unitParam,
    incident: '',
    provider_of_record: '',
  })

  const [lastConsentData, setLastConsentData] = useState<{
    patient_name: string
    patient_dob: string
    unit: string
    incident: string
    provider_name: string
    form_date: string
    form_time: string
    patient_signature_url?: string | null
  } | null>(null)

  // Sync search params
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      patient_first_name: firstNameParam || prev.patient_first_name,
      patient_last_name: lastNameParam || prev.patient_last_name,
      dob: dobParam || prev.dob,
      unit: unitParam || prev.unit,
    }))
  }, [firstNameParam, lastNameParam, dobParam, unitParam])

  // Fetch encounter data if linked
  useEffect(() => {
    if (!encounterId) return
    const fetchEncounter = async () => {
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

      setForm(prev => ({
        ...prev,
        patient_first_name: enc.patient_first_name || prev.patient_first_name,
        patient_last_name: enc.patient_last_name || prev.patient_last_name,
        dob: enc.patient_dob ? String(enc.patient_dob).slice(0, 10) : prev.dob,
        unit: enc.unit || prev.unit,
        provider_of_record: enc.provider_of_record || prev.provider_of_record,
      }))

      if (enc.incident_id) {
        const { data: inc } = await supabase.from('incidents').select('name').eq('id', enc.incident_id).single()
        if (inc?.name) setForm(prev => ({ ...prev, incident: inc.name }))
      }
    }
    fetchEncounter()
  }, [encounterId])

  // Preload logo
  useEffect(() => {
    fetch('/ram-logo.svg')
      .then(r => r.text())
      .then(svg => {
        const b64 = btoa(unescape(encodeURIComponent(svg)))
        setLogoDataUrl('data:image/svg+xml;base64,' + b64)
      })
      .catch(() => {})
  }, [])

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
    const { error } = await supabase.storage.from('signatures').upload(fileName, blob, { contentType: 'image/png', upsert: false })
    if (error) { console.error('Upload error:', error); return { url: null, dataUrl } }
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

    setSubmitting(true)
    try {
      const patientSigResult = await uploadSignature(patientSigRef, 'patient-consent')

      const consentId = `CTT-${Date.now()}`

      // Resolve encounter_id text
      let encounterIdText: string | null = null
      if (encounterId) {
        const { data: encRow } = await supabase.from('patient_encounters')
          .select('encounter_id')
          .or(`encounter_id.eq.${encounterId},id.eq.${encounterId}`)
          .single()
        encounterIdText = (encRow as any)?.encounter_id || encounterId
      }

      const { error: insertError } = await supabase.from('consent_forms').insert({
        consent_id: consentId,
        consent_type: 'Consent to Treat',
        encounter_id: encounterIdText,
        date_time: new Date().toISOString(),
        patient_first_name: form.patient_first_name,
        patient_last_name: form.patient_last_name,
        dob: form.dob || null,
        unit: form.unit,
        incident: form.incident,
        provider_of_record: form.provider_of_record,
        patient_signature_url: patientSigResult.url,
        signed: true,
      })

      if (insertError) throw insertError

      const consentData = {
        patient_name: `${form.patient_first_name} ${form.patient_last_name}`.trim(),
        patient_dob: form.dob || '',
        unit: form.unit,
        incident: form.incident,
        provider_name: form.provider_of_record,
        form_date: formDate,
        form_time: formTime,
        patient_signature_url: patientSigResult.dataUrl || patientSigResult.url,
      }
      setLastConsentId(consentId)
      setLastConsentData(consentData)

      // Auto-save PDF to storage on submit
      try {
        const doc = generateConsentToTreatPDF({ ...consentData, consent_id: consentId }, logoDataUrl)
        const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
        const storagePath = `consent-to-treat/${consentId}.pdf`
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

      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePreviewPDF = async () => {
    if (!lastConsentData || !lastConsentId) return
    const doc = await generateConsentToTreatPDF({ ...lastConsentData, consent_id: lastConsentId }, logoDataUrl)
    const blob = doc.output('blob')
    setPreviewUrl(URL.createObjectURL(blob))
    setShowPreview(true)
  }

  const handleDownloadPDF = async () => {
    if (!lastConsentData || !lastConsentId) return
    setPdfGenerating(true)
    try {
      const doc = await generateConsentToTreatPDF({ ...lastConsentData, consent_id: lastConsentId }, logoDataUrl)
      doc.save(`ConsentToTreat-${lastConsentId}.pdf`)

      // Upload to Supabase
      const pdfBytes = doc.output('arraybuffer')
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const storagePath = `consent-to-treat/${lastConsentId}.pdf`
      const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, blob, { contentType: 'application/pdf', upsert: true })

      if (!uploadError) {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24 * 7)
        setPdfUrl(signed?.signedUrl || storagePath)
        await supabase.from('consent_forms').update({ pdf_url: storagePath }).eq('consent_id', lastConsentId)
      }
    } catch (err) {
      console.error('PDF error:', err)
    } finally {
      setPdfGenerating(false)
    }
  }

  const inp = 'w-full bg-gray-800 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const lbl = 'text-xs text-gray-400 block mb-1'

  // ── Success Screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white pb-16">
        <div className="max-w-lg mx-auto p-4 md:p-6 space-y-6 mt-8 md:mt-0">
          <div className="text-center space-y-4 py-8">
            <p className="text-5xl">✅</p>
            <h1 className="text-xl font-bold">Consent to Treat Signed</h1>
            <p className="text-gray-400 text-sm">
              {patientName} has consented to treatment.
            </p>
            <p className="text-gray-500 text-xs">Consent ID: {lastConsentId}</p>
          </div>

          <div className="space-y-3">
            <button onClick={handlePreviewPDF}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors text-sm">
              👁️ Preview PDF
            </button>
            <button onClick={handleDownloadPDF} disabled={pdfGenerating}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors text-sm">
              {pdfGenerating ? 'Generating...' : '📄 Download & Save PDF'}
            </button>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                className="block bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm text-center hover:bg-green-900/50 transition-colors">
                ✅ PDF saved — tap to open
              </a>
            )}
          </div>

          {encounterId && (
            <Link to={`/encounters/${encounterId}`}
              className="block text-center text-blue-400 hover:text-blue-300 text-sm mt-4">
              ← Back to Encounter
            </Link>
          )}

          {/* PDF Preview Modal */}
          {showPreview && previewUrl && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
              <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <span className="text-sm font-bold text-white">Consent to Treat — PDF Preview</span>
                  <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <iframe src={previewUrl} className="flex-1 min-h-[70vh] bg-white rounded-b-2xl" />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-lg mx-auto p-4 md:p-6 space-y-6 mt-8 md:mt-0">
        <div>
          <h1 className="text-xl font-bold">Consent to Treat</h1>
          <p className="text-gray-500 text-xs mt-0.5">Patient consent for emergency medical treatment</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Patient Info */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Patient Information</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>First Name *</label>
                <input name="patient_first_name" value={form.patient_first_name} onChange={handleChange} className={inp} required />
              </div>
              <div>
                <label className={lbl}>Last Name *</label>
                <input name="patient_last_name" value={form.patient_last_name} onChange={handleChange} className={inp} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Date of Birth</label>
                <input name="dob" type="date" value={form.dob} onChange={handleChange} className={inp} />
              </div>
              <div>
                <label className={lbl}>Unit</label>
                <input name="unit" value={form.unit} onChange={handleChange} className={inp} readOnly={!!unitParam} />
              </div>
            </div>
            <div>
              <label className={lbl}>Provider of Record *</label>
              <select name="provider_of_record" value={form.provider_of_record} onChange={handleChange} className={inp} required>
                <option value="">Select provider...</option>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Consent Text */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Consent Statement</h2>
            <div className="text-xs text-gray-300 space-y-2 leading-relaxed max-h-48 overflow-y-auto pr-2">
              <p>
                I, <span className="text-white font-medium">{patientName}</span>, hereby consent to emergency medical
                treatment and care provided by Remote Area Medicine (Mossbrae Medical Group P.C.) personnel, including
                physicians, physician assistants, nurse practitioners, registered nurses, EMTs, and paramedics.
              </p>
              <p className="font-semibold text-gray-200">I understand and acknowledge:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li>I consent to examination, assessment, and emergency medical treatment as deemed necessary</li>
                <li>Emergency treatment involves inherent risks including pain, infection, allergic reaction, and medication side effects</li>
                <li>I have the right to refuse any or all treatment at any time</li>
                <li>I consent to medication administration as prescribed by the treating provider</li>
                <li>I consent to clinical photographs for medical documentation</li>
                <li>My medical information will be kept confidential per HIPAA</li>
                <li>If transport is recommended, I consent to transport by the most appropriate means available</li>
                <li><span className="text-gray-200 font-medium">Artificial Intelligence:</span> Remote Area Medicine utilizes AI-assisted technology to support clinical documentation, medical record management, and administrative coordination of my care. AI tools do not make clinical decisions — all medical decisions are made by licensed healthcare providers. My health information processed by AI systems is subject to the same privacy protections as all other medical records.</li>
              </ul>
              <p>
                I have read or had read to me the above consent. I understand its contents and voluntarily consent
                to the described treatment.
              </p>
            </div>
          </div>

          {/* Patient Signature */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Patient Signature *</h2>
              <button type="button" onClick={() => patientSigRef.current?.clear()}
                className="text-xs text-gray-500 hover:text-white transition-colors">Clear</button>
            </div>
            <div
              className="bg-white rounded-lg overflow-hidden"
              style={{ touchAction: 'none' }}
              ref={(el) => {
                // Sync canvas pixel dimensions to CSS dimensions on mount
                // Fixes touch/mouse coordinate offset when canvas is CSS-stretched
                if (el) {
                  const canvas = el.querySelector('canvas')
                  if (canvas) {
                    const rect = el.getBoundingClientRect()
                    if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                      canvas.width = Math.round(rect.width)
                      canvas.height = 150
                    }
                  }
                }
              }}
            >
              <SignatureCanvas
                ref={patientSigRef}
                penColor="black"
                canvasProps={{
                  style: { width: '100%', height: '150px', display: 'block' },
                }}
                onBegin={() => {
                  // Re-sync dimensions each time drawing begins (handles resize/scroll)
                  const canvas = patientSigRef.current?.getCanvas()
                  if (canvas) {
                    const rect = canvas.getBoundingClientRect()
                    if (rect.width > 0 && canvas.width !== Math.round(rect.width)) {
                      const data = patientSigRef.current?.toData()
                      canvas.width = Math.round(rect.width)
                      canvas.height = 150
                      if (data) patientSigRef.current?.fromData(data)
                    }
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-gray-600 text-center">Sign with finger or stylus above</p>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors">
            {submitting ? 'Submitting...' : '✍️ Sign Consent to Treat'}
          </button>

          <div className="text-center">
            {encounterId ? (
              <Link to={`/encounters/${encounterId}`} className="text-gray-500 text-sm hover:text-gray-400">← Back to Encounter</Link>
            ) : (
              <Link to="/encounters" className="text-gray-500 text-sm hover:text-gray-400">← Back to Encounters</Link>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ConsentToTreatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <ConsentToTreatInner />
    </Suspense>
  )
}
