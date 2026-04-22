import { useState, useRef, useEffect, type ChangeEvent, type FormEvent, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import type SignatureCanvas from 'react-signature-canvas'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { generateAMAPDF } from '@/lib/generateAMApdf'
import { uploadSignatureFromRef } from '@/lib/signatureUtils'
import type { PickerEncounter, FormState, ConsentData } from './AMAFormTypes'

export function useAMAForm() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [searchParams] = useSearchParams()
  const encounterId = searchParams.get('encounterId') || ''
  const dobParam = searchParams.get('dob') || ''
  const firstNameParam = searchParams.get('firstName') || ''
  const lastNameParam = searchParams.get('lastName') || ''
  const unitParam = searchParams.get('unit') || ''

  const [pickerUnit, setPickerUnit] = useState('')
  const [pickerEncounters, setPickerEncounters] = useState<PickerEncounter[]>([])

  const loadPickerEncounters = async (unitName: string) => {
    if (!unitName) { setPickerEncounters([]); return }
    const { data } = await supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, patient_dob: date_of_birth, primary_symptom_text, date, unit, provider_of_record, incident_id')
      .eq('unit', unitName)
      .order('date', { ascending: false })
      .limit(25)
    setPickerEncounters((data as any) || [])
  }

  useEffect(() => {
    if (pickerUnit) loadPickerEncounters(pickerUnit)
  }, [pickerUnit])

  useEffect(() => {
    if (!assignment.loading && assignment.unit?.name && !pickerUnit) {
      setPickerUnit(assignment.unit.name)
    }
  }, [assignment.loading, assignment.unit])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [encounterOptions, setEncounterOptions] = useState<{id: string, encounter_id: string, patient_first_name: string|null, patient_last_name: string|null, primary_symptom_text: string|null, date: string|null, unit: string|null}[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedUnit, setSelectedUnit] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadEncountersForUnit = async (unitName: string) => {
    if (!unitName) { setEncounterOptions([]); return }
    const { data } = await supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit')
      .eq('unit', unitName).order('date', { ascending: false }).limit(20)
    setEncounterOptions(data || [])
  }

  const [form, setForm] = useState<FormState>({
    patient_first_name: firstNameParam,
    patient_last_name: lastNameParam,
    dob: dobParam,
    unit: unitParam,
    incident: '',
    provider_of_record: '',
  })

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      patient_first_name: firstNameParam || prev.patient_first_name,
      patient_last_name: lastNameParam || prev.patient_last_name,
      dob: dobParam || prev.dob,
      unit: unitParam || prev.unit,
    }))
  }, [firstNameParam, lastNameParam, dobParam, unitParam])

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
        patient_first_name: (enc.patient_first_name as string) || prev.patient_first_name,
        patient_last_name: (enc.patient_last_name as string) || prev.patient_last_name,
        dob: enc.patient_dob ? String(enc.patient_dob).slice(0, 10) : prev.dob,
        unit: (enc.unit as string) || prev.unit,
        provider_of_record: (enc.provider_of_record as string) || prev.provider_of_record,
      }))
      if ((enc as any).unit) setPickerUnit((enc as any).unit)

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

  const patientSigRef = useRef<SignatureCanvas>(null) as RefObject<SignatureCanvas | null>
  const providerSigRef = useRef<SignatureCanvas>(null) as RefObject<SignatureCanvas | null>
  const [submitting, setSubmitting] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('https://jlqpycxguovxnqtkjhzs.supabase.co/storage/v1/object/public/headshots/logo.png')
      .then(r => r.blob())
      .then(blob => { const reader = new FileReader(); reader.onload = () => setLogoDataUrl(reader.result as string); reader.readAsDataURL(blob) })
      .catch(() => {})
  }, [])

  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [lastConsentId, setLastConsentId] = useState('')
  const [lastConsentData, setLastConsentData] = useState<ConsentData | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [copySuccess, setCopySuccess] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showPreview, setShowPreview] = useState(false)

  const now = new Date()
  const formDate = now.toLocaleDateString('en-US')
  const formTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const patientName = `${form.patient_first_name} ${form.patient_last_name}`.trim() || '______________________'

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: FormEvent) => {
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
      const ts = Date.now()
      const [patientSigResult, providerSigResult] = await Promise.all([
        uploadSignatureFromRef(supabase, patientSigRef, `consent/${ts}-patient.png`),
        uploadSignatureFromRef(supabase, providerSigRef, `consent/${ts}-provider.png`),
      ])
      const patientSigUrl = patientSigResult.url
      const providerSigUrl = providerSigResult.url
      const patientSigDataUrl = patientSigResult.dataUrl
      const providerSigDataUrl = providerSigResult.dataUrl

      const consentId = `CONSENT-${Date.now()}`
      let encounterIdText: string | null = null
      if (encounterId) {
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

      if (encounterIdText) {
        await supabase.from('patient_encounters')
          .update({ refusal_signed: true })
          .eq('encounter_id', encounterIdText)
      }

      const amaData: ConsentData = {
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
      setSubmitted(true)

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

  const handleDownloadPDF = async () => {
    if (!lastConsentData || !lastConsentId) return
    setPdfGenerating(true)
    try {
      const doc = await generateAMAPDF({ ...lastConsentData, consent_id: lastConsentId }, logoDataUrl)
      doc.save(`AMA-${lastConsentId}.pdf`)

      const pdfBytes = doc.output('arraybuffer')
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const storagePath = `ama/${lastConsentId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true })

      if (!uploadError) {
        const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24 * 7)
        const displayUrl = signed?.signedUrl || storagePath
        setPdfUrl(displayUrl)
        await supabase.from('consent_forms').update({ pdf_url: storagePath }).eq('consent_id', lastConsentId)
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
        await navigator.share({ url: pdfUrl, title: 'AMA Form', text: 'AMA Refusal of Care form' })
      } catch {
        await handleCopyLink()
      }
    } else {
      await handleCopyLink()
    }
  }
  void handleShare

  const handlePreviewPDF = async () => {
    if (!lastConsentData || !lastConsentId) return
    const doc = await generateAMAPDF({ ...lastConsentData, consent_id: lastConsentId }, logoDataUrl)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    setShowPreview(true)
  }
  void handlePreviewPDF

  useEffect(() => {
    if (!submitted || !lastConsentId || pdfUrl) return
    let attempts = 0
    let cancelled = false
    const poll = setInterval(async () => {
      if (cancelled) return
      attempts++
      try {
        const { data } = await supabase.from('consent_forms').select('pdf_url').eq('consent_id', lastConsentId).single()
        if (data?.pdf_url) {
          const { data: signed } = await supabase.storage.from('documents').createSignedUrl(data.pdf_url, 3600 * 24 * 365)
          if (signed?.signedUrl) setPdfUrl(signed.signedUrl)
          clearInterval(poll)
          return
        }
      } catch {}
      if (attempts >= 10) {
        clearInterval(poll)
        if (!lastConsentData || cancelled) return
        try {
          const doc = generateAMAPDF({ ...lastConsentData, consent_id: lastConsentId }, logoDataUrl)
          const pdfBlob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
          const storagePath = `ama/${lastConsentId}.pdf`
          const { error: uploadErr } = await supabase.storage.from('documents').upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
          if (!uploadErr) {
            const { data: signed } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600 * 24 * 365)
            if (signed?.signedUrl && !cancelled) setPdfUrl(signed.signedUrl)
            await supabase.from('consent_forms').update({ pdf_url: storagePath }).eq('consent_id', lastConsentId)
          }
        } catch (e) {
          console.error('Fallback PDF save failed:', e)
        }
      }
    }, 1000)
    return () => { cancelled = true; clearInterval(poll) }
  }, [submitted, lastConsentId, pdfUrl])

  const handleReset = () => {
    setSubmitted(false)
    setForm({ patient_first_name: '', patient_last_name: '', dob: '', unit: '', incident: '', provider_of_record: '' })
    patientSigRef.current?.clear()
    providerSigRef.current?.clear()
    setPdfUrl(null)
    setLastConsentId('')
    setLastConsentData(null)
  }

  const handleEncounterSelect1 = (enc: PickerEncounter) => {
    setForm(prev => ({
      ...prev,
      patient_first_name: enc.patient_first_name || prev.patient_first_name,
      patient_last_name: enc.patient_last_name || prev.patient_last_name,
      dob: (enc as any).patient_dob || prev.dob,
      unit: enc.unit || prev.unit,
      incident: enc.incident_id || prev.incident,
    }))
  }

  const handleEncounterSelect2 = (enc: PickerEncounter) => {
    setForm(prev => ({
      ...prev,
      patient_first_name: enc.patient_first_name || prev.patient_first_name,
      patient_last_name: enc.patient_last_name || prev.patient_last_name,
      dob: enc.patient_dob || prev.dob,
      unit: enc.unit || prev.unit,
    }))
  }

  return {
    form,
    pickerUnit,
    setPickerUnit,
    pickerEncounters,
    assignment,
    encounterId,
    submitted,
    submitting,
    error,
    pdfUrl,
    pdfGenerating,
    patientSigRef,
    providerSigRef,
    formDate,
    formTime,
    patientName,
    handleChange,
    handleSubmit,
    handleDownloadPDF,
    handleReset,
    handleEncounterSelect1,
    handleEncounterSelect2,
  }
}
