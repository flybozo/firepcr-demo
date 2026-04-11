
import EncounterPicker, { type PickedEncounter } from '@/components/EncounterPicker'

import { useEffect, useRef, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useRole } from '@/lib/useRole'
import { useOfflineWrite } from '@/lib/useOfflineWrite'

type Employee = {
  id: string
  name: string
  full_name?: string
  role: string
}

type FormularyItem = {
  id: string
  item_name: string
  category: string
  unit_type?: string | null
}

type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  incident_unit_id: string
  cs_lot_number?: string | null
  cs_expiration_date?: string | null
}

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-4 mb-2'

const ROUTES = [
  'Intravenous (IV)', 'Intramuscular (IM)', 'Oral', 'Intranasal',
  'Subcutaneous', 'Intraosseous (IO)', 'Inhalation', 'Nebulizer',
  'Sublingual', 'Topical', 'Endotracheal Tube (ET)', 'CPAP', 'BVM',
  'Auto Injector', 'Other/miscellaneous',
]
const RESPONSES = ['Improved', 'Unchanged', 'Worse', 'Unknown']

const ROUTE_SUGGESTIONS: Record<string, string> = {
  'Morphine Sulfate': 'Intravenous (IV)',
  'Fentanyl': 'Intravenous (IV)',
  'Midazolam (Versed)': 'Intramuscular (IM)',
  'Ketamine': 'Intramuscular (IM)',
  'Naloxone': 'Intranasal',
  'Albuterol Solution': 'Nebulizer',
  'Albuterol Inhaler': 'Inhalation',
  'Normal Saline 1L': 'Intravenous (IV)',
  'Lactated Ringers': 'Intravenous (IV)',
  'Ondansetron (Zofran) 4mg Injection': 'Intravenous (IV)',
  'Ondansetron (Zofran) 4mg Tablet': 'Oral',
  'Dexamethasone 10mg Injection': 'Intravenous (IV)',
  'Dexamethasone 4mg Tablet': 'Oral',
  'Diphenhydramine 50mg Injection': 'Intravenous (IV)',
  'Diphenhydramine (Benadryl)': 'Oral',
  'Ketorolac (Toradol) 30mg Injection': 'Intramuscular (IM)',
  'Amoxicillin': 'Oral',
  'Doxycycline 100mg': 'Oral',
  'Cephalexin': 'Oral',
  'Epinephrine 1:1000': 'Intramuscular (IM)',
  'Epinephrine 1:10000': 'Intravenous (IV)',
  'Adenosine': 'Intravenous (IV)',
  'Amiodarone': 'Intravenous (IV)',
  'Atropine Sulfate': 'Intravenous (IV)',
  'Lidocaine': 'Intravenous (IV)',
  'Magnesium Sulfate': 'Intravenous (IV)',
}

const DOSAGE_UNIT_SUGGESTIONS: Record<string, string> = {
  'Morphine Sulfate': 'mg',
  'Fentanyl': 'mcg',
  'Midazolam (Versed)': 'mg',
  'Ketamine': 'mg',
  'Naloxone': 'mg',
}

function MARNewFormInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { write: offlineWrite, isOffline } = useOfflineWrite()
  const [searchParams] = useSearchParams()
  const [providerPin, setProviderPin] = useState('')
  const [witnessPin, setWitnessPin] = useState('')

  // URL params
  const encounterId = searchParams.get('encounterId') || ''
  const unitParam = searchParams.get('unit') || ''
  const dobParam = searchParams.get('dob') || ''
  const patientNameParam = searchParams.get('patientName') || ''

  const assignment = useUserAssignment()
  const { isField } = { isField: !['MD','MD/DO','Admin'].includes(assignment.employee?.role || '') }
  const [assignmentApplied, setAssignmentApplied] = useState(false)

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
  const nowTime = now.toTimeString().slice(0, 5)

  const [submitting, setSubmitting] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [unitCrew, setUnitCrew] = useState<Employee[]>([])

  const [encounterOptions, setEncounterOptions] = useState<any[]>([])

  const loadEncountersForUnit = async (unitName: string) => {
    if (!unitName) { setEncounterOptions([]); return }
    try {
      const { data } = await supabase
        .from('patient_encounters')
        .select('id, encounter_id, patient_first_name, patient_last_name, primary_symptom_text, date, unit, provider_of_record, incident:incidents(name)')
        .eq('unit', unitName)
        .order('date', { ascending: false })
        .limit(20)
      setEncounterOptions(data || [])
    } catch {
      // Offline — load encounters from IndexedDB
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('encounters')
        setEncounterOptions((cached as any[]).filter((e: any) => e.unit === unitName).slice(0, 20))
      } catch {}
    }
  }

  const [formulary, setFormulary] = useState<FormularyItem[]>([])
  const [unitInventory, setUnitInventory] = useState<InventoryItem[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)

  // Entry type state
  const [entryType, setEntryType] = useState<'Administered' | 'Dispensed'>('Administered')
  const [daysSupply, setDaysSupply] = useState('')

  // Track whether the current route/dosage_units values were auto-suggested
  const [routeAutoSuggested, setRouteAutoSuggested] = useState(false)
  const [dosageAutoSuggested, setDosageAutoSuggested] = useState(false)

  const [form, setForm] = useState({
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

  // Provider signature state
  const isProviderMatch =
    !!(form.prescribing_provider &&
      assignment.employee?.name &&
      form.prescribing_provider === assignment.employee.name)
  // Same person dispensing and prescribing
  const isSelfOrder = !!(form.dispensed_by && form.prescribing_provider && form.dispensed_by === form.prescribing_provider)
  // requiresCosign: any order with a named prescriber that hasn't been signed needs cosign
  const requiresCosign = !!(form.prescribing_provider)

  // Apply assignment once loaded
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

      const filtered: InventoryItem[] = rawItems
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

      setUnitInventory(filtered)
    } catch (e) {
      console.error('loadUnitInventory error', e)
      setUnitInventory([])
    }
    setLoadingInventory(false)
  }

  useEffect(() => {
    const load = async () => {
      if (unitParam) await loadUnitInventory(unitParam)
      try {
        const { data: emps } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('status', 'Active')
          .order('name')
        setEmployees((emps || []).map((e: any) => ({...e, name: e.name || e.full_name})))

        const { data: items } = await supabase
          .from('formulary_templates')
          .select('id, item_name, category, unit_type')
          .in('category', ['Rx', 'CS'])
          .order('category')
          .order('item_name')
        setFormulary(items || [])
      } catch {
        // Offline — load from IndexedDB
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cachedEmps = await getCachedData('employees')
          setEmployees((cachedEmps as any[]).map((e: any) => ({...e, name: e.name || e.full_name})))
          const cachedFormulary = await getCachedData('formulary')
          setFormulary(cachedFormulary as any[])
        } catch {}
      }
    }
    load()
  }, [])

  // Load encounters + crew when unit changes
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

  const set = (field: string, value: string) => {
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
    const baseUpdates: Partial<typeof form> = { item_name: itemName }

    if (invItem) {
      baseUpdates.category = invItem.category || ''
      if (invItem.cs_lot_number) baseUpdates.lot_number = invItem.cs_lot_number
      if (invItem.cs_expiration_date) baseUpdates.exp_date = invItem.cs_expiration_date
    } else {
      const item = formulary.find(f => f.item_name === itemName)
      baseUpdates.category = item?.category || ''
    }

    // Auto-suggest route
    const suggestedRoute = ROUTE_SUGGESTIONS[itemName]
    if (suggestedRoute) {
      baseUpdates.medication_route = suggestedRoute
      setRouteAutoSuggested(true)
    }

    // Auto-suggest dosage_units
    const suggestedDosage = DOSAGE_UNIT_SUGGESTIONS[itemName]
    if (suggestedDosage) {
      baseUpdates.dosage_units = suggestedDosage
      setDosageAutoSuggested(true)
    }

    setForm(prev => {
      const next = { ...prev, ...baseUpdates }
      // Don't overwrite user-manually-set route
      if (suggestedRoute && prev.medication_route && !routeAutoSuggested) {
        next.medication_route = prev.medication_route
      }
      // Don't overwrite user-manually-set dosage_units
      if (suggestedDosage && prev.dosage_units && !dosageAutoSuggested) {
        next.dosage_units = prev.dosage_units
        setDosageAutoSuggested(false)
      }
      return next
    })
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

  const isCS = form.category === 'CS'
  const hasUnitInventory = unitInventory.length > 0

  // Load crew assigned to the current unit
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
      const crewList = (crew || []).map((c: any) => c.employee).filter(Boolean)
      setUnitCrew(crewList)
    } catch {
      // Offline — load employees from cache as fallback crew
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedEmps = await getCachedData('employees')
        setUnitCrew(cachedEmps as any[])
      } catch {}
    }
  }

    // Provider employees: always show ALL active providers (prescriber may not be on the unit)
  const providerRoles = ['MD', 'MD/DO', 'NP', 'PA', 'DO']
  const providerEmployees = employees.filter(e => providerRoles.includes(e.role))
  const witnessOptions = unitCrew.length > 0 ? unitCrew : employees


  // ─── Encounter picker UI ──────────────────────────────────────────────────
  const EncounterPickerSection = ({ onSelect }: { onSelect: (enc: typeof encounterOptions[0]) => void }) => (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Link to Patient Encounter
      </h2>
      {encounterOptions.length === 0 ? (
        <p className="text-xs text-gray-600">
          {form.med_unit ? 'No recent encounters on this unit.' : 'Select a unit to see patient encounters.'}
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


  const uploadSignature = async (ref: React.RefObject<any>, path: string): Promise<string | null> => {
    if (!ref.current || ref.current.isEmpty()) return null
    const dataUrl = ref.current.toDataURL('image/png')
    const base64 = dataUrl.split(',')[1]
    const byteChars = atob(base64)
    const byteArr = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
    const blob = new Blob([byteArr], { type: 'image/png' })
    const { error } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
    if (error) return null
    const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(path)
    return urlData.publicUrl
  }

  const handleSubmit = async () => {
    if (!form.item_name || !form.patient_name || !form.dispensed_by) {
      alert('Please fill in required fields: medication, patient name, and dispensed by.')
      return
    }
    const _qtyWasted = parseFloat(form.qty_wasted) || 0
    if (isCS && _qtyWasted > 0 && !form.waste_witness) {
      alert('A waste witness is required when controlled substance wastage > 0.')
      return
    }

    const qtyUsedCheck = parseFloat(form.qty_used) || 0
    const qtyWastedCheck = parseFloat(form.qty_wasted) || 0
    const totalNeeded = qtyUsedCheck + qtyWastedCheck
    if (totalNeeded > 0 && form.med_unit) {
      const invItem = unitInventory.find(i => i.item_name === form.item_name)
      if (invItem && invItem.quantity < totalNeeded) {
        alert(`Insufficient stock: only ${invItem.quantity} units available on this unit`)
        return
      }
    }

    setSubmitting(true)

    try {
      const ts = Date.now()

      // Upload CS witness signature
      let witnessSignatureUrl: string | null = null
      if (isCS) {
        if (witnessPin.length >= 4) {
          witnessSignatureUrl = `digital:${form.waste_witness}:${new Date().toISOString()}`
        }
      }

      // Upload provider signature (if provider signed directly)
      let providerSignatureUrl: string | null = null
      let providerSignedAt: string | null = null
      let providerSignedBy: string | null = null
      let finalRequiresCosign = requiresCosign
      let finalEntryType = entryType as string

      if ((isProviderMatch || isSelfOrder) && providerPin.length >= 4) {
        // Digital signature — provider signed directly with PIN
        providerSignatureUrl = `digital:${(await supabase.auth.getUser()).data.user?.email}:${new Date().toISOString()}`
        if (providerSignatureUrl) {
          providerSignedAt = new Date().toISOString()
          providerSignedBy = assignment.user?.email || null
          finalRequiresCosign = false
          if (isSelfOrder) finalEntryType = 'Provider Order'
        }
      } else if (form.prescribing_provider && providerPin.length < 4) {
        // Prescriber named but no PIN entered — goes to unsigned queue regardless of who is logged in
        // (Zach dispenses with Aaron as prescriber but Aaron isn't here to sign → needs cosign)
        finalRequiresCosign = true
        finalEntryType = isSelfOrder ? 'Verbal Order' : 'Verbal Order'
      }

      const qtyUsed = parseFloat(form.qty_used) || 0
      const qtyWasted = parseFloat(form.qty_wasted) || 0

      const logData = {
        date: form.date,
        time: form.time,
        med_unit: form.med_unit || null,
        item_name: form.item_name,
        item_type: form.category || null,      // DB column is item_type
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
        incident: (() => {
          // Derive incident name from selected encounter
          const enc = encounterOptions.find(x => x.encounter_id === form.encounter_id || x.id === form.encounter_id)
          return (enc as any)?.incident_name || null
        })(),
        medication_route: form.medication_route || null,
        response_to_medication: form.response_to_medication || null,
        medication_authorization: form.medication_authorization || null,
        // CS waste witness stored in notes field
        notes: isCS && form.waste_witness ? `Waste witness: ${form.waste_witness}` : null,
        entry_type: finalEntryType,
        requires_cosign: finalRequiresCosign,
        provider_signature_url: providerSignatureUrl,
        provider_signed_at: providerSignedAt,
        provider_signed_by: providerSignedBy,
        signature_method: providerSignatureUrl ? 'image' : null,
      }

      const logResult = await offlineWrite('dispense_admin_log', 'insert', logData)
      if (!logResult.success) throw new Error(`Log insert failed: ${logResult.error}`)

      // If offline, skip secondary operations (inventory deduction, CS transaction) — they need connectivity
      if (logResult.offline) {
        navigate('/mar?success=1')
        return
      }

      const totalUsed = isCS ? qtyUsed + qtyWasted : qtyUsed
      if (form.med_unit && totalUsed > 0) {
        // Deduct from unit_inventory — find by unit name match
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
        incident: (() => {
          // Derive incident name from selected encounter
          const enc = encounterOptions.find(x => x.encounter_id === form.encounter_id || x.id === form.encounter_id)
          return (enc as any)?.incident_name || null
        })(),
        })
      }

      navigate('/mar?success=1')
    } catch (err: unknown) {
      setSubmitting(false)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert(`Error: ${msg}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-xl font-bold">New MAR Entry</h1>
            <p className="text-xs text-gray-500">Medication Administration Record</p>
          </div>
        </div>

        {isOffline && (
          <div className="mb-4 bg-amber-950/60 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-2">
            📶 <span>You’re offline. This entry will be saved locally and synced when you reconnect. Inventory deduction will be applied on sync.</span>
          </div>
        )}

        {/* Encounter Picker — shown when not coming from encounter detail */}
        {!encounterId && (
          <EncounterPickerSection onSelect={enc => {
            const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
            setForm(prev => ({
              ...prev,
              patient_name: name || prev.patient_name,
              encounter_id: enc.encounter_id || '',
              prescribing_provider: enc.provider_of_record || prev.prescribing_provider,
            }))
          }} />
        )}

        {/* Encounter Picker */}
        {!encounterId && (
          <EncounterPicker
            onSelect={(enc) => {
              const name = [enc.patient_first_name, enc.patient_last_name].filter(Boolean).join(' ')
              setForm(prev => ({ ...prev, patient_name: name || prev.patient_name, encounter_id: enc.encounter_id || '', prescribing_provider: enc.provider_of_record || prev.prescribing_provider, med_unit: enc.unit || prev.med_unit }))
              if (enc.unit) { loadUnitInventory(enc.unit); loadUnitCrew(enc.unit) }
            }}
          />
        )}

        {/* Linked Encounter Banner */}
        {encounterId && (
          <div className="bg-blue-950 border border-blue-700 rounded-xl p-3 mb-4 flex items-center gap-3">
            <span className="text-blue-400 text-lg">🔗</span>
            <div>
              <p className="text-blue-300 font-semibold text-sm">Linked Encounter</p>
              <p className="text-blue-400 text-xs font-mono">{encounterId}</p>
            </div>
          </div>
        )}

        {/* ─── Entry Type Toggle ─── */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4">
          <p className={sectionCls}>Entry Type</p>
          <div className="flex gap-2 mt-2">
            {(['Administered', 'Dispensed'] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setEntryType(type)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${
                  entryType === type
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {entryType === 'Administered'
              ? 'Provider personally gave the medication to the patient.'
              : 'Provider gave a course of medication for the patient to take themselves.'}
          </p>
          {entryType === 'Dispensed' && (
            <div className="mt-3 bg-yellow-950 border border-yellow-700 rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-bold">⚕️ Dispensed medications require physician order and signature.</p>
            </div>
          )}
        </div>

        {/* CS Warning Banner */}
        {isCS && (
          <div className="bg-orange-950 border border-orange-600 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="text-orange-400 font-bold text-sm">CONTROLLED SUBSTANCE</p>
              {form.lot_number || form.exp_date ? (
                <p className="text-orange-300 text-xs mt-1 font-mono">
                  {form.lot_number ? `Lot: ${form.lot_number}` : ''}
                  {form.lot_number && form.exp_date ? ' | ' : ''}
                  {form.exp_date ? `Exp: ${form.exp_date}` : ''}
                </p>
              ) : null}
              <p className="text-orange-300 text-xs mt-1">Waste witness and signature required. All CS transactions are logged.</p>
            </div>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-4 space-y-4">
          {/* Date & Time */}
          <p className={sectionCls}>Administration Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Time *</label>
              <input type="time" className={inputCls} value={form.time} onChange={e => set('time', e.target.value)} />
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className={labelCls}>Unit *</label>
            {unitParam ? (
              <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm">{form.med_unit}</div>
            ) : (
              <select className={inputCls} value={form.med_unit} onChange={e => handleUnitChange(e.target.value)}>
                <option value="">Select unit</option>
                {['RAMBO 1', 'RAMBO 2', 'RAMBO 3', 'RAMBO 4', 'MSU 1', 'MSU 2', 'The Beast', 'REMS 1', 'REMS 2'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            )}
          </div>

          {/* Medication */}
          <p className={sectionCls}>Medication</p>
          <div>
            <label className={labelCls}>
              Medication *
              {form.med_unit && hasUnitInventory && (
                <span className="ml-2 text-green-400 font-normal normal-case">
                  ({unitInventory.length} in stock on {form.med_unit})
                </span>
              )}
              {form.med_unit && loadingInventory && (
                <span className="ml-2 text-gray-500 font-normal normal-case">Loading inventory...</span>
              )}
            </label>
            <select className={inputCls} value={form.item_name} onChange={e => handleItemSelect(e.target.value)}>
              <option value="">Select medication</option>
              {hasUnitInventory ? (
                unitInventory.map(item => (
                  <option key={item.id} value={item.item_name}>
                    {item.item_name} — {item.category} (qty: {item.quantity})
                  </option>
                ))
              ) : (
                filteredFormulary.map(item => (
                  <option key={item.id} value={item.item_name}>{item.item_name}</option>
                ))
              )}
            </select>
          </div>

          {form.category && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Category:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${form.category === 'CS' ? 'bg-orange-500 text-white' : form.category === 'Rx' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'}`}>
                {form.category}
              </span>
            </div>
          )}

          {(() => {
            // Get all inventory rows for this drug (may be multiple lots)
            const matchingItems = unitInventory.filter(i => i.item_name === form.item_name && i.quantity > 0)
            const hasMultipleLots = isCS && matchingItems.length > 1
            const selectedInvItem = form.lot_number
              ? matchingItems.find(i => i.cs_lot_number === form.lot_number) || matchingItems[0]
              : matchingItems[0]
            const csAutoFilled = isCS && matchingItems.length > 0
            return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Lot Number{csAutoFilled ? ' — select from inventory' : ''}</label>
                  {hasMultipleLots ? (
                    <select
                      className={inputCls}
                      value={form.lot_number}
                      onChange={e => {
                        const item = matchingItems.find(i => i.cs_lot_number === e.target.value)
                        set('lot_number', e.target.value)
                        if (item?.cs_expiration_date) set('exp_date', item.cs_expiration_date)
                      }}
                    >
                      <option value="">Select lot...</option>
                      {matchingItems.map(i => (
                        <option key={i.cs_lot_number || i.id} value={i.cs_lot_number || ''}>
                          {i.cs_lot_number || 'No lot'} (qty: {i.quantity}{i.cs_expiration_date ? `, exp ${i.cs_expiration_date}` : ''})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={`${inputCls} ${csAutoFilled ? 'opacity-70 cursor-not-allowed' : ''}`}
                      value={form.lot_number}
                      onChange={e => !csAutoFilled && set('lot_number', e.target.value)}
                      readOnly={!!csAutoFilled}
                    />
                  )}
                </div>
                <div>
                  <label className={labelCls}>Expiration Date{csAutoFilled ? ' (auto-filled)' : ''}</label>
                  <input
                    type="date"
                    className={`${inputCls} ${csAutoFilled ? 'opacity-70 cursor-not-allowed' : ''}`}
                    value={form.exp_date}
                    onChange={e => !csAutoFilled && set('exp_date', e.target.value)}
                    readOnly={!!csAutoFilled}
                  />
                </div>
              </div>
            )
          })()}

          <div className={`grid gap-3 ${entryType === 'Dispensed' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <label className={labelCls}>{entryType === 'Dispensed' ? 'Qty Dispensed' : 'Qty Used'} *</label>
              <input type="number" className={inputCls} value={form.qty_used} onChange={e => set('qty_used', e.target.value)} min="0" step="0.5" />
            </div>
            <div>
              <label className={labelCls}>Qty Wasted</label>
              <input type="number" className={inputCls} value={form.qty_wasted} onChange={e => set('qty_wasted', e.target.value)} min="0" step="0.5" />
            </div>
            {entryType === 'Dispensed' && (
              <div>
                <label className={labelCls}>Days Supply</label>
                <input type="number" className={inputCls} value={daysSupply} onChange={e => setDaysSupply(e.target.value)} min="1" step="1" placeholder="e.g. 7" />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Dosage Units</label>
            <input
              type="text"
              className={inputCls}
              value={form.dosage_units}
              onChange={e => { setDosageAutoSuggested(false); set('dosage_units', e.target.value) }}
              placeholder="mg, mcg, mL, etc."
            />
          </div>

          <div>
            <label className={labelCls}>Route of Administration</label>
            <select className={inputCls} value={form.medication_route} onChange={e => { setRouteAutoSuggested(false); set('medication_route', e.target.value) }}>
              <option value="">Select route</option>
              {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Sig / Directions</label>
            <input type="text" className={inputCls} value={form.sig_directions} onChange={e => set('sig_directions', e.target.value)} placeholder="e.g. 0.5mg IV push over 2 min" />
          </div>

          <div>
            <label className={labelCls}>Medication Authorization</label>
            <input type="text" className={inputCls} value={form.medication_authorization} onChange={e => set('medication_authorization', e.target.value)} placeholder="Protocol / order reference" />
          </div>

          {/* Patient */}
          <p className={sectionCls}>Patient</p>
          <div>
            <label className={labelCls}>Patient Name *</label>
            {patientNameParam ? (
              <div className="bg-gray-700 rounded-lg px-3 py-2 text-white text-sm">{form.patient_name}</div>
            ) : (
              <input type="text" className={inputCls} value={form.patient_name} onChange={e => set('patient_name', e.target.value)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls} value={form.dob} onChange={e => set('dob', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Encounter ID</label>
              {encounterId ? (
                <div className="bg-gray-700 rounded-lg px-3 py-2 text-blue-300 text-sm font-mono">{encounterId}</div>
              ) : (
                <input type="text" className={inputCls} value={form.encounter_id} onChange={e => set('encounter_id', e.target.value)} placeholder="PCR-xxx (optional)" />
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Indication</label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={form.indication}
              onChange={e => set('indication', e.target.value)}
              placeholder="Clinical indication for administration"
            />
          </div>

          <div>
            <label className={labelCls}>Response to Medication</label>
            <div className="grid grid-cols-2 gap-2">
              {RESPONSES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set('response_to_medication', r)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors ${form.response_to_medication === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Providers */}
          <p className={sectionCls}>Providers</p>
          <div>
            <label className={labelCls}>Administered By *</label>
            <select className={inputCls} value={form.dispensed_by} onChange={e => set('dispensed_by', e.target.value)}>
              <option value="">Select provider</option>
              {(() => {
                // Field users: show themselves + MDs/NPs/PAs on unit; admins see all
                const adminRoles = ['MD', 'MD/DO', 'NP', 'PA', 'Paramedic']
                const dispensers = isField
                  ? employees.filter(e => e.name === assignment.employee?.name || adminRoles.includes(e.role))
                  : employees
                return dispensers.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
                ))
              })()}
            </select>
          </div>
          <div>
            <label className={labelCls}>Prescribing Provider (MD/DO/NP/PA)</label>
            <select className={inputCls} value={form.prescribing_provider} onChange={e => set('prescribing_provider', e.target.value)}>
              <option value="">Select (optional)</option>
              {providerEmployees.map(emp => (
                <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
              ))}
            </select>
          </div>

          {/* ─── Physician Order & Signature ─── */}
          {form.prescribing_provider && (
            <div className="border border-gray-700 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Physician Order &amp; Signature</p>
              {isSelfOrder ? (
                // Same person is both dispensing and prescribing — signature optional
                <>
                  <div className="bg-blue-950 border border-blue-700 rounded-lg p-3">
                    <p className="text-blue-300 text-xs">
                      ℹ️ You are both dispensing and prescribing. You may sign now or this will appear in your Unsigned Orders queue.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Electronic Signature (PIN / Password) — Optional</label>
                    <input
                      type="password"
                      value={providerPin}
                      onChange={e => setProviderPin(e.target.value)}
                      placeholder="Enter PIN to sign now (optional)"
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Sign now to create a Provider Order. Leave blank to create a Verbal Order in your Unsigned queue.
                    </p>
                  </div>
                </>
              ) : isProviderMatch ? (
                <>
                  <p className="text-xs text-green-400">✓ You are the prescribing provider. Please sign below to authorize this order.</p>
                  <div>
                    <label className={labelCls}>Electronic Signature (PIN / Password)</label>
                    <input
                      type="password"
                      value={providerPin}
                      onChange={e => setProviderPin(e.target.value)}
                      placeholder="Enter your signing PIN or password (min 4 chars)"
                      className={inputCls}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      By entering your PIN you electronically attest this order is appropriate and within your scope.
                    </p>
                  </div>
                </>
              ) : (
                <div className="bg-yellow-950 border border-yellow-700 rounded-lg p-3">
                  <p className="text-yellow-300 text-xs">
                    ⚠️ This order requires co-signature from <strong>{form.prescribing_provider}</strong>. They will be notified to sign.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CS: Waste Witness + Signature */}
          {isCS && parseFloat(form.qty_wasted) > 0 && (
            <>
              <p className={sectionCls}>⚠️ CS Wastage Witness Required</p>
              <div>
                <label className={labelCls}>Waste Witness *</label>
                <select className={inputCls} value={form.waste_witness} onChange={e => set('waste_witness', e.target.value)}>
                  <option value="">Select witness...</option>
                  {witnessOptions.filter(w => w.name !== form.dispensed_by).map(w => (
                    <option key={w.id} value={w.name}>{w.name} ({w.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Witness Electronic Signature *</label>
                <input
                  type="password"
                  value={witnessPin}
                  onChange={e => setWitnessPin(e.target.value)}
                  placeholder="Witness PIN or password"
                  className={inputCls}
                />
                <p className="text-xs text-gray-600 mt-1">Witness attests to observing the wastage.</p>
              </div>
            </>
          )}
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
        >
          {submitting ? 'Recording...' : `💾 Record ${entryType}${isCS ? ' (CS)' : ''}`}
        </button>

        <p className="text-center text-gray-600 text-xs mt-4 pb-8">
          All medication administrations are permanently logged.
        </p>
      </div>
    </div>
  )
}

export default function MARNewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <MARNewFormInner />
    </Suspense>
  )
}
