import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/authFetch'
import * as encounterService from '@/lib/services/encounters'
import { getIsOnline } from '@/lib/syncManager'
import { getCachedData, getCachedById, cacheData, queueOfflineWrite } from '@/lib/offlineStore'
import type {
  Encounter, EncounterVitals, PatientPhoto, EncounterProcedure,
  ConsentForm, CompClaim,
} from '@/types/encounters'
import type { SignatureRecord } from '@/components/PinSignature'
import type { NavigateFunction } from 'react-router-dom'

export function useEncounterData(id: string, currentUser: any, navigate?: NavigateFunction) {
  const supabase = createClient()

  const [enc, setEnc] = useState<Encounter | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [incidentName, setIncidentName] = useState<string | null>(null)

  const [additionalVitals, setAdditionalVitals] = useState<EncounterVitals[]>([])
  const [crewOptions, setCrewOptions] = useState<{ id: string; name: string }[]>([])
  const [providerOptions, setProviderOptions] = useState<string[]>([])

  const [photos, setPhotos] = useState<PatientPhoto[]>([])
  const [procedures, setProcedures] = useState<EncounterProcedure[]>([])

  const [consentForms, setConsentForms] = useState<ConsentForm[]>([])
  const [compClaims, setCompClaims] = useState<CompClaim[]>([])
  const [marEntries, setMarEntries] = useState<any[]>([])
  const [progressNotes, setProgressNotes] = useState<any[]>([])

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Record<string, string>>({})
  const [formPdfUrls, setFormPdfUrls] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    // Show cached data instantly
    try {
      let cached = await getCachedById('encounters', id) as any
      if (!cached) {
        const allCached = await getCachedData('encounters') as any[]
        cached = allCached.find((e: any) => e.encounter_id === id) || null
      }
      if (cached) {
        setEnc(cached)
        setLoading(false)
      }
    } catch {}

    let rpcData: any = null
    let offline = false
    try {
      const { data: rpc, error: rpcErr } = await supabase.rpc('get_encounter_detail', { p_encounter_id: id }) as any
      if (rpcErr || !rpc || rpc.error === 'not_found') throw new Error(rpcErr?.message || 'not found')
      rpcData = rpc
    } catch {
      offline = true
    }

    if (offline) {
      const allCached = await getCachedData('encounters') as any[]
      let cached = allCached.find((e: any) => e.id === id) || null
      if (!cached) cached = allCached.find((e: any) => e.encounter_id === id) || null
      if (cached) {
        setIsOfflineData(true)
        const cachedVitals = await getCachedData('vitals')
        setAdditionalVitals(cachedVitals.filter((v: any) => v.encounter_id === id))
        const cachedMar = await getCachedData('mar_entries')
        if (cached.encounter_id) {
          setMarEntries(cachedMar.filter((m: any) => m.encounter_id === cached.encounter_id))
        }
        setEnc(cached)
      }
      setLoading(false)
      return
    }

    const encData = rpcData.encounter
    setEnc(encData)
    if (rpcData.incident_name) setIncidentName(rpcData.incident_name)

    setAdditionalVitals(rpcData.vitals || [])
    if (rpcData.vitals?.length) await cacheData('vitals', rpcData.vitals)

    setProcedures(rpcData.procedures || [])
    setMarEntries(rpcData.mar || [])
    setProgressNotes(rpcData.progress_notes || [])
    setConsentForms(rpcData.consent_forms || [])
    setCompClaims(rpcData.comp_claims || [])

    const photoData = rpcData.photos || []
    setPhotos(photoData)

    if (photoData.length > 0) {
      const urlMap: Record<string, string> = {}
      await Promise.all(photoData.map(async (ph: any) => {
        if (!ph.photo_url) return
        const raw = ph.photo_url as string
        if (raw.startsWith('http')) {
          urlMap[ph.id] = raw
        } else {
          const { data: signed } = await supabase.storage.from('patient-photos').createSignedUrl(raw, 3600)
          if (signed?.signedUrl) urlMap[ph.id] = signed.signedUrl
          else {
            const { data: pub } = supabase.storage.from('patient-photos').getPublicUrl(raw)
            if (pub?.publicUrl) urlMap[ph.id] = pub.publicUrl
          }
        }
      }))
      setPhotoSignedUrls(urlMap)
    }

    const allFormDocs = [
      ...(rpcData.consent_forms || []).map((cf: any) => ({ id: cf.id, pdf_url: cf.pdf_url })),
      ...(rpcData.comp_claims || []).map((cc: any) => ({ id: cc.id, pdf_url: cc.pdf_url })),
    ].filter((d: any) => d.pdf_url)
    if (allFormDocs.length > 0) {
      const urlMap: Record<string, string> = {}
      await Promise.all(allFormDocs.map(async (doc: any) => {
        if (doc.pdf_url.startsWith('http')) { urlMap[doc.id] = doc.pdf_url; return }
        try {
          const res = await authFetch(`/api/pdf/sign?path=${encodeURIComponent(doc.pdf_url)}&bucket=documents`)
          if (res.ok) { const { url } = await res.json(); if (url) urlMap[doc.id] = url }
        } catch { /* silent */ }
      }))
      setFormPdfUrls(urlMap)
    }

    setCrewOptions(rpcData.crew || [])
    setProviderOptions((rpcData.providers || []) as string[])

    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || null)
    } catch {}

    setLoading(false)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const saveField = useCallback(async (key: string, val: string) => {
    const coerced: Record<string, unknown> = {}
    const boolFields = ['possible_injury']
    const arrayFields = ['secondary_impression', 'advance_directive', 'arrest_witnessed',
      'cpr_type', 'resuscitation_attempted', 'dispatch_delay', 'response_delay',
      'scene_delay', 'transport_delay', 'turnaround_delay', 'transport_mode_descriptors']
    const numericFields = ['num_patients_at_scene', 'patient_age']
    if (boolFields.includes(key)) {
      coerced[key] = val === 'true' ? true : val === 'false' ? false : null
    } else if (arrayFields.includes(key)) {
      coerced[key] = val === '' ? [] : [val]
    } else if (numericFields.includes(key)) {
      coerced[key] = val === '' ? null : Number(val)
    } else {
      coerced[key] = val === '' ? null : val
    }
    if (key === 'patient_dob' && val) {
      const birth = new Date(val + 'T00:00:00')
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const md = today.getMonth() - birth.getMonth()
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--
      if (age < 0) age = 0
      if (age < 2) {
        const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth()
        coerced.patient_age = Math.max(0, months)
        coerced.patient_age_units = 'Months'
      } else {
        coerced.patient_age = age
        coerced.patient_age_units = 'Years'
      }
    }

    const updatedBy = currentUser.employee?.name || 'Unknown'
    const updatePayload = { ...coerced, updated_by: updatedBy }

    if (getIsOnline()) {
      const { data, error } = await encounterService.updateEncounter(id, updatePayload).select('updated_at')
      if (!error && data && data.length > 0) {
        setEnc(prev => prev ? { ...prev, [key]: coerced[key], updated_at: (data[0] as any).updated_at } as Encounter : prev)
        encounterService.logClinicalAudit({
          record_id: id,
          field_name: key,
          old_value: enc ? String(enc[key as keyof Encounter] ?? '') : '',
          new_value: String(coerced[key] ?? ''),
          performed_by: updatedBy,
          performed_by_employee_id: currentUser.employee?.id || null,
        }).then(() => {}, () => {})
      } else if (error) {
        console.error('saveField error:', error.message)
        toast.error('Save failed: ' + error.message)
      }
    } else {
      await queueOfflineWrite('patient_encounters', 'update', { id, ...updatePayload })
      setEnc(prev => prev ? { ...prev, [key]: coerced[key] } as Encounter : prev)
    }
  }, [id, enc, currentUser]) // eslint-disable-line react-hooks/exhaustive-deps

  const markComplete = useCallback(async (nemsisErrorCount: number, nemsisErrors: any[]) => {
    if (enc?.unit?.toUpperCase().startsWith('RAMBO') && nemsisErrorCount > 0) {
      const errorList = nemsisErrors.slice(0, 3).map((e: any) => e.message).join('; ')
      const moreMsg = nemsisErrorCount > 3 ? ' (and ' + (nemsisErrorCount - 3) + ' more)' : ''
      toast.error('Cannot complete: ' + nemsisErrorCount + ' NEMSIS error' + (nemsisErrorCount > 1 ? 's' : '') + ' must be fixed first. ' + errorList + moreMsg, 8000)
      return
    }
    if (getIsOnline()) {
      await encounterService.updateEncounter(id, { pcr_status: 'Complete' })
    } else {
      await queueOfflineWrite('patient_encounters', 'update', { id, pcr_status: 'Complete' })
    }
    setEnc(prev => prev ? { ...prev, pcr_status: 'Complete' } : prev)
    if (getIsOnline() && enc?.unit?.startsWith('RAMBO')) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const xmlResp = await fetch(`/api/encounters/${id}/nemsis-export`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        })
        if (xmlResp.ok) {
          const xmlText = await xmlResp.text()
          const blob = new Blob([xmlText], { type: 'application/xml' })
          const filename = `nemsis/${enc.encounter_id || id}-NEMSIS.xml`
          const { error: uploadErr } = await supabase.storage.from('documents').upload(filename, blob, { contentType: 'application/xml', upsert: true })
          if (!uploadErr) {
            await supabase.from('patient_encounters').update({ nemsis_xml_url: filename } as any).eq('id', id)
            setEnc(prev => prev ? { ...prev, nemsis_xml_url: filename } as any : prev)
          }
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `${enc.encounter_id || id}-NEMSIS.xml`
          document.body.appendChild(a); a.click(); document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } catch (err) { console.error('NEMSIS XML generation failed:', err) }
    }
  }, [id, enc]) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteDraft = useCallback(async () => {
    if (!enc) return
    const now = new Date().toISOString()
    const deletedBy = currentUser.employee?.name || 'Unknown'
    if (getIsOnline()) {
      const { error } = await encounterService.updateEncounter(id, { deleted_at: now, deleted_by: deletedBy })
      if (error) { toast.error('Delete failed: ' + error.message); return }
    } else {
      await queueOfflineWrite('patient_encounters', 'update', { id, deleted_at: now, deleted_by: deletedBy })
    }
    try { const { refreshUnsignedCounts } = await import('@/lib/useUnsignedPCRCount'); refreshUnsignedCounts() } catch {}
    navigate?.('/encounters')
  }, [id, enc, currentUser, navigate])

  const signAndLock = useCallback(async (record: SignatureRecord) => {
    if (!enc) return
    const { error } = await encounterService.updateEncounter(id, {
      pcr_status: 'Signed', signed_at: record.signedAt, signed_by: record.employeeName,
    })
    if (error) {
      await encounterService.updateEncounter(id, { pcr_status: 'Signed' })
      setEnc(prev => prev ? { ...prev, pcr_status: 'Signed' } : prev)
    } else {
      setEnc(prev => prev ? { ...prev, pcr_status: 'Signed', signed_at: record.signedAt, signed_by: record.employeeName } : prev)
    }
    try { const { refreshUnsignedCounts } = await import('@/lib/useUnsignedPCRCount'); refreshUnsignedCounts() } catch {}
  }, [id, enc])

  return {
    enc,
    setEnc,
    loading,
    isOfflineData,
    incidentName,
    additionalVitals,
    setAdditionalVitals,
    crewOptions,
    providerOptions,
    photos,
    procedures,
    consentForms,
    compClaims,
    marEntries,
    setMarEntries,
    progressNotes,
    setProgressNotes,
    userEmail,
    photoSignedUrls,
    formPdfUrls,
    saveField,
    markComplete,
    deleteDraft,
    signAndLock,
    reload: load,
  }
}
