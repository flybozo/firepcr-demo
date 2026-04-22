
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Employee, EncounterOption, PickerEncounterItem } from './types'

export function useCompClaimInit(
  encounterId: string,
  incidentIdParam: string,
  tebwParam: string,
  formUnit: string,
  assignmentLoading: boolean,
  assignmentUnit: { name: string } | null | undefined,
  setForm: (updater: (prev: any) => any) => void,
) {
  const supabase = createClient()
  const [physicians, setPhysicians] = useState<Employee[]>([])
  const [encounterUUID, setEncounterUUID] = useState('')
  const [incidentIdFromEnc, setIncidentIdFromEnc] = useState<string | null>(null)
  const [encounterOptions, setEncounterOptions] = useState<EncounterOption[]>([])
  const [pickerUnit, setPickerUnit] = useState('')
  const [pickerEncounters, setPickerEncounters] = useState<PickerEncounterItem[]>([])
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('https://jlqpycxguovxnqtkjhzs.supabase.co/storage/v1/object/public/headshots/logo.png')
      .then(r => r.blob())
      .then(blob => { const reader = new FileReader(); reader.onload = () => setLogoDataUrl(reader.result as string); reader.readAsDataURL(blob) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!pickerUnit) { setPickerEncounters([]); return }
    supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, patient_dob: date_of_birth, primary_symptom_text, date, unit, provider_of_record, incident_id')
      .eq('unit', pickerUnit).order('date', { ascending: false }).limit(25)
      .then(({ data }) => setPickerEncounters((data as any) || []))
  }, [pickerUnit])

  useEffect(() => {
    if (!assignmentLoading && assignmentUnit?.name && !pickerUnit)
      setPickerUnit(assignmentUnit.name)
  }, [assignmentLoading, assignmentUnit])

  useEffect(() => {
    if (!formUnit) { setEncounterOptions([]); return }
    supabase.from('patient_encounters')
      .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit, provider_of_record')
      .eq('unit', formUnit).order('date', { ascending: false }).limit(20)
      .then(({ data }) => setEncounterOptions(data || []))
  }, [formUnit])

  useEffect(() => {
    const fillInc = async (incId: string) => {
      const { data: inc } = await supabase.from('incidents')
        .select('name, comp_claims_name, comp_claims_email, comp_claims_phone')
        .eq('id', incId).single()
      if (inc) setForm(p => ({
        ...p, incident: (inc.name as string) || p.incident,
        claims_coordinator_name: (inc as any).comp_claims_name || p.claims_coordinator_name,
        claims_coordinator_email: (inc as any).comp_claims_email || p.claims_coordinator_email,
        claims_coordinator_phone: (inc as any).comp_claims_phone || p.claims_coordinator_phone,
      }))
    }
    const applyEnc = (enc: any) => {
      setEncounterUUID(enc.id)
      const incId = enc.incident_id
      if (incId) setIncidentIdFromEnc(incId)
      setForm(prev => ({
        ...prev,
        patient_name: [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' '),
        date_of_injury: enc.date || '', unit: enc.unit || '',
        clinical_impression: enc.primary_impression_text || enc.primary_symptom_text || '',
        treatment_summary: enc.notes || '', provider_name: enc.provider_of_record || '',
        patient_dob: enc.patient_dob ? String(enc.patient_dob).slice(0, 10) : '',
        time_employee_began_work: (() => { const v = enc.time_employee_began_work || tebwParam || '06:00'; return v.includes('T') ? v.slice(-5) : v })(),
        employee_crew_assignment: enc.crew_resource_number || '',
        employee_agency: enc.patient_agency || '',
      }))
      return incId
    }
    const load = async () => {
      const { data: emps } = await supabase.from('employees').select('id, name, role')
        .in('role', ['MD', 'DO']).eq('status', 'Active').order('name')
      setPhysicians(emps || [])
      if (encounterId) {
        const sel = 'id, patient_first_name, patient_last_name, patient_dob, patient_agency, date, incident_id, unit, primary_impression_text, notes, provider_of_record, crew_resource_number, primary_symptom_text'
        const { data: enc } = await supabase.from('patient_encounters').select(sel).eq('encounter_id', encounterId).single()
        if (enc) { const incId = applyEnc(enc); if (incId) await fillInc(incId) }
        else {
          const { data: enc2 } = await supabase.from('patient_encounters').select(sel).eq('id', encounterId).single()
          if (enc2) { const incId = applyEnc(enc2); if (incId) await fillInc(incId) }
        }
      }
      if (incidentIdParam) {
        const { data: inc } = await supabase.from('incidents')
          .select('name, comp_claims_name, comp_claims_email, comp_claims_phone, location')
          .eq('id', incidentIdParam).single()
        if (inc) setForm(p => ({
          ...p, incident: (inc.name as string) || p.incident,
          claims_coordinator_name: (inc as any).comp_claims_name || p.claims_coordinator_name,
          claims_coordinator_email: (inc as any).comp_claims_email || p.claims_coordinator_email,
          claims_coordinator_phone: (inc as any).comp_claims_phone || p.claims_coordinator_phone,
        }))
      }
    }
    load()
  }, [encounterId, incidentIdParam])

  return { physicians, encounterUUID, incidentIdFromEnc, encounterOptions, pickerUnit, setPickerUnit, pickerEncounters, logoDataUrl }
}
