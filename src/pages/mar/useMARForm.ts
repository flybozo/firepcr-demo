
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import type { Employee, FormularyItem, InventoryItem, FormState } from './types'
import { ROUTE_SUGGESTIONS, DOSAGE_UNIT_SUGGESTIONS } from './types'

export type EncounterOption = {
  id: string
  encounter_id?: string
  patient_first_name?: string
  patient_last_name?: string
  primary_symptom_text?: string
  date?: string
  provider_of_record?: string
  incident?: { name?: string | null } | null
  incident_name?: string
}

export function useMARForm() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { write: offlineWrite, isOffline } = useOfflineWrite()
  const [searchParams] = useSearchParams()
  const [providerPin, setProviderPin] = useState('')
  const [witnessPin, setWitnessPin] = useState('')

  const encounterId = searchParams.get('encounterId') || ''
  const unitParam = searchParams.get('unit') || ''
  const dobParam = searchParams.get('dob') || ''
  const patientNameParam = searchParams.get('patientName') || ''

  const assignment = useUserAssignment()
  const isField = !['MD', 'DO', 'Admin'].includes(assignment.employee?.role || '')
  const [assignmentApplied, setAssignmentApplied] = useState(false)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowTime = now.toTimeString().slice(0, 5)

  const requestId = useRef(crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [unitCrew, setUnitCrew] = useState<Employee[]>([])
  const [encounterOptions, setEncounterOptions] = useState<EncounterOption[]>([])
  const [formulary, setFormulary] = useState<FormularyItem[]>([])
  const [unitInventory, setUnitInventory] = useState<InventoryItem[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [entryType, setEntryType] = useState<'Administered' | 'Dispensed'>('Administered')
  const [daysSupply, setDaysSupply] = useState('')
  const [routeAutoSuggested, setRouteAutoSuggested] = useState(false)
  const [dosageAutoSuggested, setDosageAutoSuggested] = useState(false)

  const [form, setForm] = useState<FormState>({
    date: todayStr,
    time: nowTime,
    med_unit: unitParam || '',
    item_name: '',
    category: '',
    lot_number: '',
    exp_date: '',
    qty_used: '',
    qty_wasted: '0',
    dosage_units: '',
    patient_name: patientNameParam || '',
    dob: dobParam,
    indication: '',
    sig_directions: '',
    dispensed_by: '',
    prescribing_provider: '',
    encounter_id: encounterId || '',
    medication_route: '',
    response_to_medication: '',
    medication_authorization: '',
    waste_witness: '',
  })

  const isProviderMatch =
    !!(form.prescribing_provider &&
      assignment.employee?.name &&
      form.prescribing_provider === assignment.employee.name)
  const isSelfOrder = !!(form.dispensed_by && form.prescribing_provider && form.dispensed_by === form.prescribing_provider)
  // Med units (MSU/REMS) require provider authorization for Rx and CS meds
  // Ambulances (Medic units) allow autonomous dispensing by paramedics/EMTs
  const isAmbulance = form.med_unit?.toLowerCase().startsWith('rambo') || false
  const isMedUnit = !isAmbulance && form.med_unit?.length > 0
  const isCS = form.category === 'CS'
  const isRx = form.category === 'Rx'
  const requiresProviderAuth = isMedUnit && (isCS || isRx)
  const requiresCosign = !!(form.prescribing_provider) || requiresProviderAuth
  const hasUnitInventory = unitInventory.length > 0

  // Provider roles who can authorize Rx/CS on med units
  // On ambulances (Medic units), crew dispenses autonomously — no provider signature needed
  // On med units (MSU/REMS), Rx and CS require an authorized provider
  const providerRoles = ['MD', 'DO', 'NP', 'PA']
  const providerEmployees = employees.filter(e => providerRoles.includes(e.role))
  const witnessOptions = unitCrew.length > 0 ? unitCrew : employees

  const adminRoles = ['MD', 'DO', 'NP', 'PA', 'Paramedic']
  const dispensers = isField
    ? employees.filter(e => e.name === assignment.employee?.name || adminRoles.includes(e.role))
    : employees

  useEffect(() => {
    if (!assignment.loading && !assignmentApplied) {
      setAssignmentApplied(true)
      if (!unitParam) {
        if (assignment.unit) {
          setForm(prev => ({ ...prev, med_unit: assignment.unit!.name }))
          loadUnitInventory(assignment.unit.name)
        }
      }
      if (assignment.employee) {
        setForm(prev => ({ ...prev, dispensed_by: prev.dispensed_by || assignment.employee!.name }))
      }
    }
  }, [assignment.loading, assignmentApplied, assignment.unit, assignment.employee, unitParam])

  const loadEncountersForUnit = async (unitName: string) => {
    if (!unitName) { setEncounterOptions([]); return }
    try {
      const { data, error } = await supabase
        .from('patient_encounters')
        .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit, unit_id, incident_id, provider_of_record, incident:incidents(name)')
        .eq('unit', unitName)
        .not('patient_last_name', 'is', null)
        .order('date', { ascending: false })
        .limit(50)
      if (error) {
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cached = await getCachedData('patient_encounters') as EncounterOption[]
          setEncounterOptions(cached.filter(e => (e as any).unit === unitName).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 50))
        } catch { setEncounterOptions([]) }
        return
      }
      setEncounterOptions((data || []) as unknown as EncounterOption[])
    } catch {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('patient_encounters') as EncounterOption[]
        setEncounterOptions(cached.filter(e => (e as any).unit === unitName).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 50))
      } catch { setEncounterOptions([]) }
    }
  }

  const loadUnitInventory = async (unitName: string) => {
    if (!unitName) { setUnitInventory([]); return }
    setLoadingInventory(true)
    try {
      const { data: inv } = await supabase
        .from('unit_inventory')
        .select('id, item_name, category, quantity, incident_unit_id, cs_lot_number, cs_expiration_date, incident_unit:incident_units(unit:units(name))')
        .gt('quantity', 0)
        .in('category', ['Rx', 'CS'])
        .order('category')
        .order('item_name')

      const rawItems = (inv || []) as unknown as Array<{
        id: string
        item_name: string
        category: string
        quantity: number
        incident_unit_id: string
        cs_lot_number?: string | null
        cs_expiration_date?: string | null
        incident_unit: { unit: { name: string } | null } | null
      }>

      setUnitInventory(rawItems
        .filter(item => item.incident_unit?.unit?.name?.toLowerCase() === unitName.toLowerCase())
        .map(item => ({
          id: item.id,
          item_name: item.item_name,
          category: item.category,
          quantity: item.quantity,
          incident_unit_id: item.incident_unit_id,
          cs_lot_number: item.cs_lot_number ?? null,
          cs_expiration_date: item.cs_expiration_date ?? null,
        }))
      )
    } catch (e) {
      console.error('loadUnitInventory error', e)
      setUnitInventory([])
    }
    setLoadingInventory(false)
  }

  const loadUnitCrew = async (unitName: string) => {
    if (!unitName) { setUnitCrew([]); return }
    try {
      const { data: unitData } = await supabase.from('units').select('id').eq('name', unitName).single()
      if (!unitData) return
      const { data: iuData } = await supabase.from('incident_units').select('id').eq('unit_id', unitData.id).limit(1).single()
      if (!iuData) return
      const { data: crew } = await supabase
        .from('unit_assignments')
        .select('employee:employees(id, name, role)')
        .eq('incident_unit_id', iuData.id)
        .is('released_at', null)
      setUnitCrew((crew || []).map((c: any) => c.employee).filter(Boolean))
    } catch {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        setUnitCrew(await getCachedData('employees') as any[])
      } catch {}
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedEmps = await getCachedData('employees') as any[]
        if (cachedEmps.length > 0) setEmployees(cachedEmps.map((e: any) => ({ ...e, name: e.name || e.full_name })) as Employee[])
        const cachedFormulary = await getCachedData('formulary') as any[]
        if (cachedFormulary.length > 0) setFormulary(cachedFormulary.filter((i: any) => ['Rx', 'CS'].includes(i.category)) as FormularyItem[])
      } catch {}
      if (unitParam) await loadUnitInventory(unitParam)
      const [empResult, formularyResult] = await Promise.all([
        loadList(
          () => supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name'),
          'employees'
        ),
        loadList(
          () => supabase.from('formulary_templates')
            .select('id, item_name, category, unit_type')
            .in('category', ['Rx', 'CS'])
            .order('category')
            .order('item_name'),
          'formulary'
        ),
      ])
      setEmployees(empResult.data.map((e: any) => ({ ...e, name: e.name || e.full_name })))
      setFormulary(formularyResult.data as any[])
    }
    load()
  }, [])

  useEffect(() => {
    if (form.med_unit) {
      loadEncountersForUnit(form.med_unit)
      loadUnitCrew(form.med_unit)
    } else {
      setEncounterOptions([])
      setUnitCrew([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.med_unit])

  const set = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleUnitChange = async (unitName: string) => {
    set('med_unit', unitName)
    set('item_name', '')
    set('category', '')
    await loadUnitInventory(unitName)
  }

  const handleItemSelect = (itemName: string) => {
    const invItem = unitInventory.find(i => i.item_name === itemName)
    const baseUpdates: Partial<FormState> = { item_name: itemName }

    if (invItem) {
      baseUpdates.category = invItem.category || ''
      if (invItem.cs_lot_number) baseUpdates.lot_number = invItem.cs_lot_number
      if (invItem.cs_expiration_date) baseUpdates.exp_date = invItem.cs_expiration_date
    } else {
      const item = formulary.find(f => f.item_name === itemName)
      baseUpdates.category = item?.category || ''
    }

    const suggestedRoute = ROUTE_SUGGESTIONS[itemName]
    if (suggestedRoute) {
      baseUpdates.medication_route = suggestedRoute
      setRouteAutoSuggested(true)
    }

    const suggestedDosage = DOSAGE_UNIT_SUGGESTIONS[itemName]
    if (suggestedDosage) {
      baseUpdates.dosage_units = suggestedDosage
      setDosageAutoSuggested(true)
    }

    setForm(prev => {
      const next = { ...prev, ...baseUpdates }
      if (suggestedRoute && prev.medication_route && !routeAutoSuggested) {
        next.medication_route = prev.medication_route
      }
      if (suggestedDosage && prev.dosage_units && !dosageAutoSuggested) {
        next.dosage_units = prev.dosage_units
        setDosageAutoSuggested(false)
      }
      return next
    })
  }

  const handleEncounterSelect = (enc: EncounterOption) => {
    const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
    setForm(prev => ({
      ...prev,
      patient_name: name || prev.patient_name,
      encounter_id: enc.encounter_id || '',
      prescribing_provider: enc.provider_of_record || prev.prescribing_provider,
    }))
  }

  const filteredFormulary = formulary.filter(item => {
    if (!form.med_unit) return true
    if (!item.unit_type) return true
    const unit = form.med_unit.toLowerCase()
    const uType = item.unit_type.toLowerCase()
    if (unit.startsWith('rambo') && uType.includes('ambulance')) return true
    if ((unit.startsWith('msu') || unit === 'the beast') && uType.includes('med')) return true
    if (unit.startsWith('rems') && uType.includes('rems')) return true
    return uType === '' || uType === 'all'
  })

  const handleSubmit = async () => {
    if (!form.item_name || !form.patient_name || !form.dispensed_by) {
      toast.warning('Please fill in required fields: medication, patient name, and dispensed by.')
      return
    }
    const _qtyWasted = parseFloat(form.qty_wasted) || 0
    if (isCS && _qtyWasted > 0 && !form.waste_witness) {
      toast.warning('A waste witness is required when controlled substance wastage > 0.')
      return
    }

    const qtyUsedCheck = parseFloat(form.qty_used) || 0
    const qtyWastedCheck = parseFloat(form.qty_wasted) || 0
    const totalNeeded = qtyUsedCheck + qtyWastedCheck
    if (totalNeeded > 0 && form.med_unit) {
      const invItem = unitInventory.find(i => i.item_name === form.item_name)
      if (invItem && invItem.quantity < totalNeeded) {
        toast.warning(`Insufficient stock: only ${invItem.quantity} units available on this unit`)
        return
      }
    }

    setSubmitting(true)

    try {
      let providerSignatureUrl: string | null = null
      let providerSignedAt: string | null = null
      let providerSignedBy: string | null = null
      let finalRequiresCosign = requiresCosign
      let finalEntryType = entryType as string

      if ((isProviderMatch || isSelfOrder) && providerPin.length >= 4) {
        providerSignatureUrl = `digital:${(await supabase.auth.getUser()).data?.user?.email ?? 'unknown'}:${new Date().toISOString()}`
        if (providerSignatureUrl) {
          providerSignedAt = new Date().toISOString()
          providerSignedBy = assignment.user?.email || null
          finalRequiresCosign = false
          if (isSelfOrder) finalEntryType = 'Provider Order'
        }
      } else if (form.prescribing_provider && providerPin.length < 4) {
        finalRequiresCosign = true
        finalEntryType = 'Verbal Order'
      }

      const qtyUsed = parseFloat(form.qty_used) || 0
      const qtyWasted = parseFloat(form.qty_wasted) || 0

      const deriveIncident = () => {
        const enc = encounterOptions.find(x => x.encounter_id === form.encounter_id || x.id === form.encounter_id)
        return enc?.incident?.name || enc?.incident_name || null
      }

      const logData = {
        date: form.date,
        time: form.time,
        med_unit: form.med_unit || null,
        item_name: form.item_name,
        item_type: form.category || null,
        lot_number: form.lot_number || null,
        exp_date: form.exp_date || null,
        qty_used: qtyUsed,
        qty_wasted: qtyWasted,
        dosage_units: form.dosage_units || null,
        patient_name: form.patient_name,
        dob: form.dob || null,
        indication: form.indication || null,
        sig_directions: form.sig_directions || null,
        dispensed_by: form.dispensed_by,
        prescribing_provider: form.prescribing_provider || null,
        encounter_id: form.encounter_id || null,
        incident: deriveIncident(),
        medication_route: form.medication_route || null,
        response_to_medication: form.response_to_medication || null,
        medication_authorization: form.medication_authorization || null,
        notes: isCS && form.waste_witness ? `Waste witness: ${form.waste_witness}` : null,
        entry_type: finalEntryType,
        requires_cosign: finalRequiresCosign,
        provider_signature_url: providerSignatureUrl,
        provider_signed_at: providerSignedAt,
        provider_signed_by: providerSignedBy,
        signature_method: providerSignatureUrl ? 'image' : null,
        client_request_id: requestId.current,
      }

      const logResult = await offlineWrite('dispense_admin_log', 'insert', logData)
      if (!logResult.success) throw new Error(`Log insert failed: ${logResult.error}`)

      if (logResult.offline) {
        navigate('/mar?success=1')
        return
      }

      const totalUsed = isCS ? qtyUsed + qtyWasted : qtyUsed
      if (form.med_unit && totalUsed > 0) {
        const { data: invSearch } = await supabase
          .from('unit_inventory')
          .select('id, quantity, incident_unit:incident_units(unit:units(name))')
          .eq('item_name', form.item_name)
          .gt('quantity', 0)
          .limit(20)
        const matched = (invSearch || []).find((r: any) => r.incident_unit?.unit?.name === form.med_unit)
        if (matched) {
          const newQty = Math.max(0, (matched.quantity || 0) - totalUsed)
          await supabase.from('unit_inventory').update({ quantity: newQty }).eq('id', matched.id)
        }
      }

      if (isCS) {
        await supabase.from('cs_transactions').insert({
          transaction_type: 'Administration',
          transfer_type: 'Administration',
          drug_name: form.item_name,
          lot_number: form.lot_number || null,
          from_unit: form.med_unit || null,
          quantity: qtyUsed + qtyWasted,
          date: form.date,
          performed_by: form.dispensed_by,
          witness: form.waste_witness || null,
          encounter_id: form.encounter_id || null,
          incident: deriveIncident(),
        })
      }

      navigate('/mar?success=1')
    } catch (err: unknown) {
      setSubmitting(false)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Error: ${msg}`)
    }
  }

  return {
    form,
    set,
    entryType,
    setEntryType,
    daysSupply,
    setDaysSupply,
    providerPin,
    setProviderPin,
    witnessPin,
    setWitnessPin,
    submitting,
    isCS,
    isRx,
    isAmbulance,
    isMedUnit,
    requiresProviderAuth,
    hasUnitInventory,
    isProviderMatch,
    isSelfOrder,
    isField,
    isOffline,
    employees,
    dispensers,
    unitInventory,
    filteredFormulary,
    providerEmployees,
    witnessOptions,
    encounterOptions,
    loadingInventory,
    routeAutoSuggested,
    dosageAutoSuggested,
    setRouteAutoSuggested,
    setDosageAutoSuggested,
    handleUnitChange,
    handleItemSelect,
    handleEncounterSelect,
    handleSubmit,
    encounterId,
    unitParam,
    patientNameParam,
  }
}
