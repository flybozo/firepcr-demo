
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import { queueOfflineWrite } from '@/lib/offlineStore'
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
  const isAmbulance = form.med_unit?.toLowerCase().startsWith('medic') || false
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
          const cached = await getCachedData('encounters') as EncounterOption[]
          setEncounterOptions(cached.filter(e => (e as any).unit === unitName).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 50))
        } catch { setEncounterOptions([]) }
        return
      }
      setEncounterOptions((data || []) as unknown as EncounterOption[])
    } catch {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('encounters') as EncounterOption[]
        setEncounterOptions(cached.filter(e => (e as any).unit === unitName).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 50))
      } catch { setEncounterOptions([]) }
    }
  }

  const resolveUnitId = async (unitName: string): Promise<string | null> => {
    // Try cached units first (works offline)
    try {
      const { getCachedData } = await import('@/lib/offlineStore')
      const cachedUnits = await getCachedData('units') as any[]
      const match = cachedUnits.find((u: any) => u.name?.toLowerCase() === unitName.toLowerCase())
      if (match) return match.id
    } catch {}
    // Fallback to network
    try {
      const { data } = await supabase.from('units').select('id').eq('name', unitName).single()
      return data?.id || null
    } catch {}
    return null
  }

  const loadUnitInventory = async (unitName: string) => {
    if (!unitName) { setUnitInventory([]); return }
    setLoadingInventory(true)
    try {
      const unitId = await resolveUnitId(unitName)
      if (!unitId) { setUnitInventory([]); setLoadingInventory(false); return }

      let inv: any[] | null = null
      try {
        const { data } = await supabase
          .from('unit_inventory')
          .select('id, item_name, category, quantity, unit_id, cs_lot_number, cs_expiration_date')
          .eq('unit_id', unitId)
          .gt('quantity', 0)
          .in('category', ['Rx', 'CS'])
          .order('category')
          .order('item_name')
        inv = data
      } catch {
        // Offline fallback — read from IndexedDB cache, filter by unit_id
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('inventory') as any[]
        inv = cached.filter(item =>
          item.unit_id === unitId &&
          item.quantity > 0 &&
          ['Rx', 'CS'].includes(item.category)
        )
      }

      setUnitInventory((inv || []).map((item: any) => ({
        id: item.id,
        item_name: item.item_name,
        category: item.category,
        quantity: item.quantity,
        unit_id: item.unit_id,
        cs_lot_number: item.cs_lot_number ?? null,
        cs_expiration_date: item.cs_expiration_date ?? null,
      })))
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
      const rxCsFilter = (items: any[]) => items.filter((i: any) => ['Rx', 'CS'].includes(i.category))
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
          'formulary',
          rxCsFilter
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
    if (unit.startsWith('medic') && uType.includes('ambulance')) return true
    if ((unit.startsWith('aid') || unit === 'command 1') && uType.includes('med')) return true
    if (unit.startsWith('rescue') && uType.includes('rems')) return true
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
        providerSignatureUrl = `digital:${(await supabase.auth.getSession()).data?.session?.user?.email ?? assignment?.user?.email ?? 'unknown'}:${new Date().toISOString()}`
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
        const totalUsed = isCS ? qtyUsed + qtyWasted : qtyUsed
        if (form.med_unit && totalUsed > 0) {
          // Try local state first, then fall back to IndexedDB cache
          let invItem = unitInventory.find(i => i.item_name === form.item_name)
          if (!invItem) {
            // unitInventory may be empty if load failed — search the cache directly
            try {
              const { getCachedData } = await import('@/lib/offlineStore')
              const unitId = await resolveUnitId(form.med_unit)
              if (unitId) {
                const cachedInv = await getCachedData('inventory') as any[]
                const match = cachedInv.find((r: any) =>
                  r.item_name === form.item_name && r.unit_id === unitId && r.quantity > 0
                )
                if (match) {
                  invItem = {
                    id: match.id,
                    item_name: match.item_name,
                    category: match.category,
                    quantity: match.quantity,
                    unit_id: match.unit_id,
                  }
                }
              }
            } catch {}
          }
          if (invItem) {
            const newQty = Math.max(0, invItem.quantity - totalUsed)
            await queueOfflineWrite('unit_inventory', 'update', { id: invItem.id, quantity: newQty })
            // Also update IndexedDB cache so subsequent offline MARs see decremented qty
            try {
              const { getCachedData, cacheData } = await import('@/lib/offlineStore')
              const cachedInv = await getCachedData('inventory') as any[]
              const idx = cachedInv.findIndex((r: any) => r.id === invItem!.id)
              if (idx >= 0) {
                cachedInv[idx] = { ...cachedInv[idx], quantity: newQty }
                await cacheData('inventory', cachedInv)
              }
            } catch {}
            // Update local state so the UI reflects the decrement immediately
            setUnitInventory(prev => prev.map(i => i.id === invItem!.id ? { ...i, quantity: newQty } : i))
          }
        }
        if (isCS) {
          await queueOfflineWrite('cs_transactions', 'insert', {
            id: crypto.randomUUID(),
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
        return
      }

      const totalUsed = isCS ? qtyUsed + qtyWasted : qtyUsed
      if (form.med_unit && totalUsed > 0) {
        // Use unit_id directly — inventory belongs to the truck, not the fire deployment
        try {
          const unitId = await resolveUnitId(form.med_unit)
          if (unitId) {
            const { data: invSearch } = await supabase
              .from('unit_inventory')
              .select('id, quantity')
              .eq('item_name', form.item_name)
              .eq('unit_id', unitId)
              .gt('quantity', 0)
              .limit(1)
            const matched = invSearch?.[0]
            if (matched) {
              const newQty = Math.max(0, (matched.quantity || 0) - totalUsed)
              await supabase.from('unit_inventory').update({ quantity: newQty }).eq('id', matched.id)
            }
          }
        } catch (e) {
          console.error('[MAR] Online inventory decrement failed (MAR still saved):', e)
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
