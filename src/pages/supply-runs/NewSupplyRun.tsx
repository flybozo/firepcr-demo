

import { useEffect, useRef, useState, Suspense } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { getIsOnline } from '@/lib/syncManager'
import { queueOfflineWrite, getCachedData, cacheData } from '@/lib/offlineStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoadingSkeleton } from '@/components/ui'
import { inputCls, labelCls } from '@/components/ui/FormField'

type Incident = {
  id: string
  name: string
  status: string
}

type IncidentUnit = {
  id: string
  incident_id: string
  unit: { id: string; name: string } | null
}

type Employee = {
  id: string
  name: string
  role: string
}

type CrewMember = {
  id: string
  name: string
  role: string
  role_on_unit: string | null
}

type RunItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  barcode?: string | null
  unknown?: boolean
}

type ScanMessage = { text: string; type: 'success' | 'warn' }

function SupplyRunNewInner() {
  const supabase = createClient()
  const userAssignment = useUserAssignment()
  const navigate = useNavigate()
  const requestId = useRef(crypto.randomUUID())
  const [searchParams] = useSearchParams()
  const presetIncidentId = searchParams.get('incidentId') ?? ''
  const presetEncounterId = searchParams.get('encounterId') ?? ''
  const presetResourceNumber = searchParams.get('resourceNumber') ?? ''

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const nowTime = now.toTimeString().slice(0, 5)

  const [mode, setMode] = useState<'loading' | 'crew' | 'admin'>('loading')
  const [submitting, setSubmitting] = useState(false)

  const [lockedIncident, setLockedIncident] = useState<Incident | null>(null)
  const [lockedUnit, setLockedUnit] = useState<{ id: string; name: string } | null>(null)
  const [lockedIncidentUnitId, setLockedIncidentUnitId] = useState('')
  const [autoName, setAutoName] = useState('')

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentUnits, setIncidentUnits] = useState<IncidentUnit[]>([])

  const [crew, setCrew] = useState<CrewMember[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [dispensedByMode, setDispensedByMode] = useState<'auto' | 'dropdown' | 'text'>('auto')

  const [form, setForm] = useState({
    incident_id: presetIncidentId,
    incident_unit_id: '',
    run_date: today,
    time: nowTime,
    resource_number: presetResourceNumber,
    dispensed_by: '',
    notes: '',
    encounter_id: presetEncounterId,
  })

  // Items state
  const [items, setItems] = useState<RunItem[]>([])

  // Barcode scanner state
  const [scanOpen, setScanOpen] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [scanQty, setScanQty] = useState(1)
  const [scanMessage, setScanMessage] = useState<ScanMessage | null>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const inventorySearchRef = useRef<HTMLInputElement>(null)

  // Inventory dropdown state
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCache, setInventoryCache] = useState<any[]>([])

  const isOffline = !getIsOnline()

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // Load inventory from cache, filtered to the selected unit
  useEffect(() => {
    if (!form.incident_unit_id) { setInventoryCache([]); return }

    // Resolve unit_id from the selected incident_unit
    const resolveUnitId = async (): Promise<string | null> => {
      // Check locked unit first (crew mode)
      if (lockedUnit) return lockedUnit.id
      // Check dropdown selection
      const selectedIU = incidentUnits.find(iu => iu.id === form.incident_unit_id)
      const unit = selectedIU?.unit as { id: string; name: string } | null
      if (unit) return unit.id
      // Fallback: look up in cached incident_units
      try {
        const cachedIU = await getCachedData('incident_units') as any[]
        const match = cachedIU.find((iu: any) => iu.id === form.incident_unit_id)
        return match?.unit?.id || match?.unit_id || null
      } catch { return null }
    }

    resolveUnitId().then(unitId => {
      getCachedData('inventory').then(rows => {
        setInventoryCache((rows as any[]).filter(
          (r: any) => {
            // Match by unit_id (covers inventory from any incident assignment)
            const unitMatch = unitId ? r.unit_id === unitId : r.incident_unit_id === form.incident_unit_id
            return unitMatch && ['OTC', 'Supply'].includes(r.category) && r.quantity > 0
          }
        ))
      }).catch(() => {})
    })
  }, [form.incident_unit_id, lockedUnit, incidentUnits])

  // Auto-focus barcode input when scan panel opens
  useEffect(() => {
    if (scanOpen) {
      setTimeout(() => barcodeRef.current?.focus(), 50)
    }
  }, [scanOpen])

  const showScanMsg = (msg: ScanMessage) => {
    setScanMessage(msg)
    setTimeout(() => setScanMessage(null), 2000)
  }

  const handleBarcodeScan = async (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return

    let found: { item_name: string; category: string } | null = null

    // Look up in cached inventory first (filtered to current unit by unit_id)
    const currentUnitId = lockedUnit?.id
      || (incidentUnits.find(iu => iu.id === form.incident_unit_id)?.unit as { id: string } | null)?.id
      || null
    try {
      const inv = await getCachedData('inventory') as any[]
      const match = inv.find((r: any) =>
        (r.barcode === code || r.upc === code)
        && (!currentUnitId || r.unit_id === currentUnitId)
      )
      if (match) found = { item_name: match.item_name, category: match.category }
    } catch {}

    // Then try cached formulary
    if (!found) {
      try {
        const form = await getCachedData('formulary') as any[]
        const match = form.find((r: any) => r.barcode === code || r.upc === code)
        if (match) found = { item_name: match.item_name, category: match.category }
      } catch {}
    }

    if (found) {
      setItems(prev => {
        const existing = prev.find(it => it.item_name === found!.item_name)
        if (existing) {
          return prev.map(it => it.item_name === found!.item_name
            ? { ...it, quantity: it.quantity + scanQty }
            : it
          )
        }
        return [...prev, {
          id: crypto.randomUUID(),
          item_name: found!.item_name,
          category: found!.category,
          quantity: scanQty,
          barcode: code,
        }]
      })
      showScanMsg({ text: `Added: ${found.item_name} x${scanQty}`, type: 'success' })
    } else {
      setItems(prev => [...prev, {
        id: crypto.randomUUID(),
        item_name: `Unknown: ${code}`,
        category: 'Supply',
        quantity: scanQty,
        barcode: code,
        unknown: true,
      }])
      showScanMsg({ text: `Unknown barcode — added as unrecognized`, type: 'warn' })
    }

    setBarcodeInput('')
    setTimeout(() => barcodeRef.current?.focus(), 30)
  }

  const addInventoryItem = (row: any) => {
    setItems(prev => {
      // If item already in list, bump quantity instead of duplicating
      const existing = prev.find(it => it.item_name === row.item_name)
      if (existing) {
        return prev.map(it => it.item_name === row.item_name ? { ...it, quantity: it.quantity + 1 } : it)
      }
      return [...prev, {
        id: crypto.randomUUID(),
        item_name: row.item_name,
        category: row.category,
        quantity: 1,
        barcode: row.barcode ?? row.upc ?? null,
      }]
    })
    setInventorySearch('')
    // Re-focus search input so user can immediately search for next item
    setTimeout(() => inventorySearchRef.current?.focus(), 30)
  }

  const updateQty = (id: string, qty: number) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Math.max(1, qty) } : it))
  }

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const loadCrew = async (incidentUnitId: string) => {
    if (!incidentUnitId) { setCrew([]); return }
    try {
      const { data } = await supabase
        .from('unit_assignments')
        .select('id, role_on_unit, employee:employees(id, name, role)')
        .eq('incident_unit_id', incidentUnitId)
        .is('released_at', null)
      const rows = (data as unknown as Array<{
        id: string
        role_on_unit: string | null
        employee: { id: string; name: string; role: string } | null
      }>) || []
      setCrew(rows
        .filter(r => r.employee)
        .map(r => ({
          id: r.employee!.id,
          name: r.employee!.name,
          role: r.employee!.role,
          role_on_unit: r.role_on_unit,
        }))
      )
    } catch {
      try {
        const cachedUnits = await getCachedData('units') as any[]
        const unit = cachedUnits.find((u: any) =>
          (u.incident_units || []).some((iu: any) => iu.id === incidentUnitId)
        )
        const iu = unit?.incident_units?.find((iu: any) => iu.id === incidentUnitId)
        const assignments = (iu?.unit_assignments || []).filter((a: any) => !a.released_at)
        setCrew(assignments
          .filter((a: any) => a.employee)
          .map((a: any) => ({
            id: a.employee.id,
            name: a.employee.name,
            role: a.employee.role,
            role_on_unit: a.role_on_unit ?? null,
          }))
        )
      } catch {}
    }
  }

  const handleIncidentChange = async (incidentId: string) => {
    set('incident_id', incidentId)
    set('incident_unit_id', '')
    setCrew([])
    if (!incidentId) { setIncidentUnits([]); return }
    try {
      const { data } = await supabase
        .from('incident_units')
        .select('id, incident_id, unit:units(id, name)')
        .eq('incident_id', incidentId)
        .is('released_at', null)
        .order('id')
      setIncidentUnits((data as unknown as IncidentUnit[]) || [])
    } catch {
      try {
        const cachedIU = await getCachedData('incident_units') as any[]
        const filtered = cachedIU.filter((iu: any) => iu.incident_id === incidentId && !iu.released_at)
        setIncidentUnits(filtered as IncidentUnit[])
      } catch {}
    }
  }

  const handleUnitChange = async (incidentUnitId: string) => {
    set('incident_unit_id', incidentUnitId)
    await loadCrew(incidentUnitId)
  }

  useEffect(() => {
    const init = async () => {
      try {
        const cachedInc = await getCachedData('incidents') as any[]
        if (cachedInc.length > 0) setIncidents(cachedInc as Incident[])
        const cachedEmps = await getCachedData('employees') as any[]
        if (cachedEmps.length > 0) setAllEmployees(cachedEmps as Employee[])
      } catch {}

      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null

      if (user) {
        const ctxIU = !userAssignment.loading && userAssignment.unit && userAssignment.incidentUnit
          ? { id: userAssignment.incidentUnit.id, incident_id: userAssignment.incidentUnit.incident_id, unit_id: userAssignment.incidentUnit.unit_id, incident: userAssignment.incident ? { id: userAssignment.incident.id, name: userAssignment.incident.name, status: 'Active' } : null, unit: userAssignment.unit ? { id: userAssignment.unit.id, name: userAssignment.unit.name } : null }
          : null
        const ctxAssignment = ctxIU ? { incident_unit: ctxIU } : null

        let empRecord: { id: string; name: string; role: string } | null = userAssignment.employee ?? null
        if (!empRecord) {
          try {
            const { data } = await supabase.from('employees').select('id, name, role').eq('auth_user_id', user.id).single()
            empRecord = data
          } catch {
            const cachedEmps = await getCachedData('employees') as any[]
            empRecord = cachedEmps.find((e: any) => e.auth_user_id === user.id) ?? null
          }
        }

        const assignmentData = ctxAssignment
          ? { data: ctxAssignment }
          : (!navigator.onLine || !empRecord) ? { data: null }
          : await supabase
              .from('unit_assignments')
              .select('id, role_on_unit, incident_unit:incident_units(id, incident_id, unit_id, incident:incidents(id, name, status), unit:units(id, name))')
              .eq('employee_id', empRecord!.id)
              .is('released_at', null)
              .order('assigned_at', { ascending: false })
              .limit(1)
              .maybeSingle()

        const assignment = assignmentData?.data

        if (assignment) {
          const iu = (assignment as unknown as {
            incident_unit: {
              id: string
              incident_id: string
              unit_id: string
              incident: { id: string; name: string; status: string } | null
              unit: { id: string; name: string } | null
            } | null
          }).incident_unit

          if (iu && iu.incident && iu.unit) {
            setLockedIncident(iu.incident)
            setLockedUnit(iu.unit)
            setLockedIncidentUnitId(iu.id)
            setForm(prev => ({
              ...prev,
              incident_id: iu.incident_id,
              incident_unit_id: iu.id,
            }))
            await loadCrew(iu.id)
            setMode('crew')

            const crewName = empRecord?.name ?? null
            if (crewName) {
              setAutoName(crewName)
              setForm(prev => ({ ...prev, dispensed_by: crewName }))
              setDispensedByMode('auto')
            } else if (navigator.onLine) {
              try {
                const { data: emp } = await supabase
                  .from('employees')
                  .select('name')
                  .eq('auth_user_id', user.id)
                  .maybeSingle()
                if (emp?.name) {
                  setAutoName(emp.name)
                  setForm(prev => ({ ...prev, dispensed_by: emp.name }))
                  setDispensedByMode('auto')
                } else {
                  setDispensedByMode('dropdown')
                }
              } catch {
                setDispensedByMode('dropdown')
              }
            } else {
              setDispensedByMode('dropdown')
            }
            return
          }
        }

        const adminName = empRecord?.name ?? null
        if (adminName) {
          setAutoName(adminName)
          setForm(prev => ({ ...prev, dispensed_by: adminName }))
          setDispensedByMode('auto')
        } else if (navigator.onLine) {
          try {
            const { data: emp } = await supabase
              .from('employees')
              .select('id, name, role')
              .eq('auth_user_id', user.id)
              .maybeSingle()
            if (emp?.name) {
              setAutoName(emp.name)
              setForm(prev => ({ ...prev, dispensed_by: emp.name }))
              setDispensedByMode('auto')
            } else {
              setDispensedByMode('text')
            }
          } catch {
            setDispensedByMode('text')
          }
        } else {
          setDispensedByMode('text')
        }
      }

      setMode('admin')
      if (!navigator.onLine) return
      try {
        const [incResult, empResult] = await Promise.all([
          loadList<Incident>(
            () => supabase.from('incidents').select('id, name, status').in('status', ['Active', 'Closed']).order('status').order('name'),
            'incidents'
          ),
          loadList<Employee>(
            () => supabase.from('employees_sync').select('id, name, role').eq('status', 'Active').order('name'),
            'employees'
          ),
        ])
        setIncidents(incResult.data)
        setAllEmployees(empResult.data)
      } catch {}

      if (presetIncidentId) {
        const { data: iuData } = await supabase
          .from('incident_units')
          .select('id, incident_id, unit:units(id, name)')
          .eq('incident_id', presetIncidentId)
          .is('released_at', null)
          .order('id')
        setIncidentUnits((iuData as unknown as IncidentUnit[]) || [])
        setForm(prev => ({ ...prev, incident_id: presetIncidentId }))
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setMode(m => m === 'loading' ? 'admin' : m), 5000)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async () => {
    if (!form.incident_unit_id) {
      toast.warning('Please select an incident and unit.')
      return
    }
    setSubmitting(true)
    const runPayload = {
      incident_unit_id: form.incident_unit_id,
      incident_id: form.incident_id || null,
      encounter_id: form.encounter_id || null,
      run_date: form.run_date,
      time: form.time || null,
      resource_number: form.resource_number || null,
      dispensed_by: form.dispensed_by || null,
      notes: form.notes || null,
    }

    if (getIsOnline()) {
      try {
        const { data, error } = await supabase
          .from('supply_runs')
          .insert(runPayload)
          .select('id')
          .single()
        if (error) {
          if (error.code === '23505') {
            navigate('/supply-runs?success=1')
            return
          }
          throw new Error(error.message)
        }
        const runId = data.id
        if (items.length > 0) {
          const itemRows = items.map(it => ({
            id: crypto.randomUUID(),
            supply_run_id: runId,
            item_name: it.item_name,
            category: it.category,
            quantity: it.quantity,
            barcode: it.barcode ?? null,
          }))
          const { error: itemErr } = await supabase.from('supply_run_items').insert(itemRows)
          if (itemErr) console.warn('[SupplyRun] items insert error:', itemErr.message)
        }

        // Decrement unit_inventory for each dispensed item
        if (items.length > 0) {
          try {
            // Resolve unit_id from the selected incident_unit
            const resolvedUnitId = lockedUnit?.id
              || (incidentUnits.find(iu => iu.id === form.incident_unit_id)?.unit as { id: string } | null)?.id
              || null
            if (resolvedUnitId) {
              for (const it of items) {
                const { data: invRows } = await supabase
                  .from('unit_inventory')
                  .select('id, quantity')
                  .eq('unit_id', resolvedUnitId)
                  .eq('item_name', it.item_name)
                  .order('quantity', { ascending: false })
                  .limit(1)
                if (invRows && invRows.length > 0) {
                  const newQty = Math.max(0, (invRows[0].quantity || 0) - it.quantity)
                  await supabase.from('unit_inventory').update({ quantity: newQty }).eq('id', invRows[0].id)
                }
              }
            }
          } catch (err) {
            console.warn('[SupplyRun] inventory decrement error:', err)
          }
        }

        navigate(`/supply-runs/${runId}`)
      } catch (err: unknown) {
        setSubmitting(false)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast.error(`Error: ${msg}`)
      }
    } else {
      const tempId = crypto.randomUUID()
      await queueOfflineWrite('supply_runs', 'insert', { id: tempId, ...runPayload })
      for (const it of items) {
        await queueOfflineWrite('supply_run_items', 'insert', {
          id: crypto.randomUUID(),
          supply_run_id: tempId,
          item_name: it.item_name,
          category: it.category,
          quantity: it.quantity,
          barcode: it.barcode ?? null,
        })
      }
      // Write full run to cache so it shows in the list immediately
      // Build incident/unit references for cached display
      const incidentObj = lockedIncident
        || incidents.find(i => i.id === form.incident_id)
        || null
      const unitObj = lockedUnit
        || (incidentUnits.find(iu => iu.id === form.incident_unit_id)?.unit as { id: string; name: string } | null)
        || null

      await cacheData('supply_runs', [{
        id: tempId,
        ...runPayload,
        incident: incidentObj ? { name: incidentObj.name } : null,
        incident_unit: unitObj ? { unit: { name: unitObj.name } } : null,
        supply_run_items: items.map(it => ({
          id: crypto.randomUUID(),
          supply_run_id: tempId,
          item_name: it.item_name,
          category: it.category,
          quantity: it.quantity,
          barcode: it.barcode ?? null,
        })),
      }])

      // Decrement cached inventory + queue updates for sync
      // Use unit_id (inventory belongs to the truck, not the deployment)
      try {
        const cachedInv = await getCachedData('inventory') as any[]
        if (unitObj?.id) {
          for (const it of items) {
            const match = cachedInv.find((inv: any) =>
              inv.unit_id === unitObj.id && inv.item_name === it.item_name
            )
            if (match) {
              const newQty = Math.max(0, (match.quantity || 0) - it.quantity)
              match.quantity = newQty
              await queueOfflineWrite('unit_inventory', 'update', { id: match.id, quantity: newQty })
            }
          }
          // Write updated inventory back to cache
          await cacheData('inventory', cachedInv)
        }
      } catch (err) {
        console.warn('[SupplyRun] offline inventory decrement error:', err)
      }

      setSubmitting(false)
      navigate('/supply-runs?offline=1')
    }
  }

  if (mode === 'loading') {
    return <LoadingSkeleton fullPage message="Loading supply run..." />
  }

  const dispensedByOptions: CrewMember[] = crew.length > 0
    ? crew
    : allEmployees.map(e => ({ id: e.id, name: e.name, role: e.role, role_on_unit: null }))

  const filteredInventory = inventorySearch.length > 0
    ? inventoryCache.filter((r: any) =>
        r.item_name?.toLowerCase().includes(inventorySearch.toLowerCase())
      ).slice(0, 8)
    : []

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-xl font-bold">New Supply Run</h1>
            <p className="text-xs text-gray-500">Fill in details and add items, then save</p>
          </div>
        </div>

        {isOffline && (
          <div className="bg-amber-900/40 border border-amber-600 rounded-xl p-3 text-amber-300 text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>Offline — run will be queued and synced when connection restores.</span>
          </div>
        )}

        <div className="theme-card rounded-xl p-4 border space-y-4">

          {/* Incident */}
          <div>
            <label className={labelCls}>Incident *</label>
            {mode === 'crew' && lockedIncident ? (
              <div className="flex items-center gap-2">
                <div className={`${inputCls} bg-gray-700 text-gray-300 cursor-not-allowed`}>
                  🔥 {lockedIncident.name}
                </div>
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.incident_id}
                onChange={e => handleIncidentChange(e.target.value)}
              >
                <option value="">Select active incident</option>
                {incidents.map(inc => (
                  <option key={inc.id} value={inc.id}>{inc.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Unit */}
          <div>
            <label className={labelCls}>Unit *</label>
            {mode === 'crew' && lockedUnit ? (
              <div className={`${inputCls} bg-gray-700 text-gray-300 cursor-not-allowed`}>
                🚑 {lockedUnit.name}
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.incident_unit_id}
                onChange={e => handleUnitChange(e.target.value)}
                disabled={!form.incident_id}
              >
                <option value="">{form.incident_id ? 'Select unit' : 'Select incident first'}</option>
                {incidentUnits.map(iu => {
                  const unit = iu.unit as unknown as { id: string; name: string } | null
                  return unit ? <option key={iu.id} value={iu.id}>{unit.name}</option> : null
                })}
              </select>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={labelCls}>Date *</label>
              <input type="date" className={inputCls + ' min-w-0'} value={form.run_date} onChange={e => set('run_date', e.target.value)} />
            </div>
            <div className="min-w-0">
              <label className={labelCls}>Time</label>
              <input type="time" className={inputCls + ' min-w-0'} value={form.time} onChange={e => set('time', e.target.value)} />
            </div>
          </div>

          {/* Resource Number */}
          <div>
            <label className={labelCls}>Resource Number</label>
            <input
              type="text"
              className={inputCls}
              value={form.resource_number}
              onChange={e => set('resource_number', e.target.value)}
              placeholder="Crew resource number"
            />
          </div>

          {/* Dispensed By */}
          <div>
            <label className={labelCls}>Dispensed By</label>
            {dispensedByMode === 'auto' ? (
              <div className="flex items-center gap-2">
                <div className={`flex-1 ${inputCls} bg-gray-700 text-gray-200 cursor-default`}>
                  {autoName}
                </div>
                <button
                  type="button"
                  onClick={() => setDispensedByMode('dropdown')}
                  className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Change
                </button>
              </div>
            ) : dispensedByMode === 'dropdown' ? (
              <div className="flex items-center gap-2">
                <select
                  className={`flex-1 ${inputCls}`}
                  value={form.dispensed_by}
                  onChange={e => set('dispensed_by', e.target.value)}
                >
                  <option value="">
                    {dispensedByOptions.length > 0 ? 'Select crew member...' : 'Select employee...'}
                  </option>
                  {dispensedByOptions.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role_on_unit || m.role})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setDispensedByMode('text')}
                  className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Type
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={`flex-1 ${inputCls}`}
                  value={form.dispensed_by}
                  onChange={e => set('dispensed_by', e.target.value)}
                  placeholder="Name of person dispensing"
                />
                {dispensedByOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDispensedByMode('dropdown')}
                    className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Crew
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes"
            />
          </div>
        </div>

        {/* ── Items Section ── */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            Items
            {items.length > 0 && (
              <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{items.length}</span>
            )}
          </h2>

          {/* Barcode Scanner */}
          <div>
            <button
              type="button"
              onClick={() => setScanOpen(v => !v)}
              className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {scanOpen ? '✕ Hide Scanner' : '🔍 Scan Barcode'}
            </button>

            {scanOpen && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-2">
                  <input
                    ref={barcodeRef}
                    type="text"
                    className={`flex-1 ${inputCls}`}
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleBarcodeScan(barcodeInput) } }}
                    placeholder="Scan or type barcode..."
                    autoComplete="off"
                  />
                  <input
                    type="number"
                    min={1}
                    value={scanQty}
                    onChange={e => setScanQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 text-center bg-gray-700 border border-gray-600 rounded-lg px-1 py-2 text-sm"
                    title="Quantity per scan"
                  />
                  <button
                    type="button"
                    onClick={() => handleBarcodeScan(barcodeInput)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                  >
                    Scan
                  </button>
                </div>
                {scanMessage && (
                  <p className={`text-xs px-2 py-1 rounded ${scanMessage.type === 'success' ? 'bg-green-900/40 text-green-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
                    {scanMessage.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Inventory Dropdown Search */}
          <div className="relative">
            <input
              ref={inventorySearchRef}
              type="text"
              className={inputCls}
              value={inventorySearch}
              onChange={e => setInventorySearch(e.target.value)}
              placeholder="Search inventory to add item..."
              autoComplete="off"
            />
            {filteredInventory.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden shadow-lg">
                {filteredInventory.map((row: any) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => addInventoryItem(row)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between gap-2 border-b border-gray-700 last:border-0"
                  >
                    <span className="truncate">{row.item_name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{row.category} · {row.quantity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">No items added yet</p>
          ) : (
            <div className="space-y-1">
              {items.map(it => (
                <div key={it.id} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm truncate">
                    {it.item_name}
                    {it.unknown && (
                      <span className="ml-1.5 text-xs bg-yellow-700/60 text-yellow-200 px-1.5 py-0.5 rounded">unknown</span>
                    )}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={e => updateQty(it.id, parseInt(e.target.value) || 1)}
                    className="w-14 text-center bg-gray-700 border border-gray-600 rounded px-1 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="text-gray-500 hover:text-red-400 text-sm px-1 transition-colors"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors"
        >
          {submitting ? 'Saving...' : `🚚 Save Supply Run${items.length > 0 ? ` + ${items.length} Item${items.length !== 1 ? 's' : ''}` : ''}`}
        </button>
      </div>
    </div>
  )
}

export default function SupplyRunNewPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <SupplyRunNewInner />
    </Suspense>
  )
}
