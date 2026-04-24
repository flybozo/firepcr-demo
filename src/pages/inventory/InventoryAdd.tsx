

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { inputCls, labelCls } from '@/components/ui/FormField'

type Unit = {
  id: string
  name: string
  unit_type: { name: string } | null
}

type FormularyItem = {
  id: string
  item_name: string
  category: string  // normalized from catalog_item join at load time
  unit_type: string | null
  catalog_item_id: string | null
}

type Employee = { id: string; name: string; role: string }

const sectionCls = 'text-xs font-bold uppercase tracking-wide text-gray-400 mt-2 mb-2 border-b border-gray-800 pb-1'

function AddInventoryInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const assignment = useUserAssignment()
  const [assignmentApplied, setAssignmentApplied] = useState(false)
  const isAdmin = ['MD', 'DO', 'Admin', 'NP', 'PA', 'PA-C'].some(r => (assignment.employee?.role || '').toUpperCase().includes(r.toUpperCase()))
  const isField = !isAdmin && !!assignment.unit

  const [units, setUnits] = useState<Unit[]>([])
  const [formulary, setFormulary] = useState<FormularyItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingFormulary, setLoadingFormulary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    unit_id: '',
    item_name: '',
    category: '',
    catalog_item_id: null as string | null,
    quantity_added: '',
    lot_number: '',
    expiration_date: '',
    notes: '',
    received_by: '',
  })

  useEffect(() => {
    const load = async () => {
      // Load non-Warehouse units (try network, fall back to cache)
      try {
        const { data: unitsData } = await supabase
          .from('units')
          .select('id, name, unit_type:unit_types(name)')
          .eq('active', true)
          .eq('is_storage', false)
          .order('name')
        if (unitsData && unitsData.length > 0) {
          setUnits(unitsData as any)
        } else {
          throw new Error('no data')
        }
      } catch {
        // Offline fallback: load from cached units
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cached = await getCachedData('units') as any[]
          setUnits(cached.filter((u: any) => u.active !== false && !u.is_storage))
        } catch {}
      }

      // Load employees (try network, fall back to cache)
      try {
        const { data: emps } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('status', 'Active')
          .order('name')
        if (emps && emps.length > 0) {
          setEmployees(emps)
        } else {
          throw new Error('no data')
        }
      } catch {
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cached = await getCachedData('employees') as any[]
          setEmployees(cached.filter((e: any) => e.status === 'Active').sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')))
        } catch {}
      }
    }
    load()
  }, [])

  useEffect(() => {
    // Wait for both assignment AND units to be loaded before auto-populating
    if (assignment.loading || units.length === 0 || assignmentApplied) return
    setAssignmentApplied(true)
    if (assignment.employee) {
      setForm(prev => ({ ...prev, received_by: prev.received_by || assignment.employee!.name }))
    }
    if (assignment.unit) {
      const matchedUnit = units.find(u => u.name === assignment.unit?.name)
      if (matchedUnit) {
        handleUnitChange(matchedUnit.id)
      }
    }
  }, [assignment.loading, assignmentApplied, assignment.employee, assignment.unit, units])

  const handleUnitChange = async (unitId: string) => {
    setForm(prev => ({ ...prev, unit_id: unitId, item_name: '', category: '' }))
    if (!unitId) {
      setFormulary([])
      return
    }
    setLoadingFormulary(true)
    const selectedUnit = units.find(u => u.id === unitId)
    const unitTypeName = (selectedUnit?.unit_type as any)?.name || ''

    try {
      // Get unit type ID
      const { data: utData } = await supabase
        .from('unit_types').select('id').eq('name', unitTypeName).single()
      const utId = utData?.id

      // Load formulary for this unit type, NO CS (those go through CS receive/transfer)
      // category lives on item_catalog now; join and normalize at load time
      const { data: items } = await supabase
        .from('formulary_templates')
        .select('id, item_name, unit_type_id, catalog_item_id, catalog_item:item_catalog(category)')
        .eq('unit_type_id', utId || '')
        .order('item_name')
      if (items && items.length > 0) {
        const normalized = (items as any[]).map((f: any) => {
          const ci = Array.isArray(f.catalog_item) ? f.catalog_item[0] : f.catalog_item
          return { ...f, category: ci?.category || '' }
        }).filter((f: any) => f.category !== 'CS')
        setFormulary(normalized as any)
      } else {
        throw new Error('no data')
      }
    } catch {
      // Offline fallback: filter cached formulary by unit type name
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('formulary') as any[]
        // Formulary cache may have unit_type_name or we match by convention
        const filtered = cached.filter((f: any) =>
          f.category !== 'CS'
          && (f.unit_type_name === unitTypeName || f.unit_type === unitTypeName)
        ).sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '') || (a.item_name || '').localeCompare(b.item_name || ''))
        if (filtered.length > 0) {
          setFormulary(filtered)
        } else {
          // If no type match, show all non-CS formulary items
          setFormulary(cached.filter((f: any) => f.category !== 'CS')
            .sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '') || (a.item_name || '').localeCompare(b.item_name || '')))
        }
      } catch {}
    }
    setLoadingFormulary(false)
  }

  const handleItemSelect = (itemName: string) => {
    const item = formulary.find(f => f.item_name === itemName)
    setForm(prev => ({ ...prev, item_name: itemName, category: item?.category || '', catalog_item_id: item?.catalog_item_id || null }))
  }

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isRxOrCS = form.category === 'Rx' || form.category === 'CS'

  const handleSubmit = async () => {
    if (!form.unit_id || !form.item_name || !form.quantity_added) {
      setError('Unit, item, and quantity are required.')
      return
    }
    if (isRxOrCS && !form.expiration_date) {
      setError('Expiration date is required for Rx and Controlled Substance items.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const qty = parseFloat(form.quantity_added) || 0

      // Get active incident_unit for selected unit
      const { data: iuData } = await supabase
        .from('incident_units')
        .select('id')
        .eq('unit_id', form.unit_id)
        .limit(1)
        .single()

      if (!iuData) {
        setError('Unit must be assigned to an active incident first.')
        setSubmitting(false)
        return
      }

      const incidentUnitId = iuData.id

      // Check if item exists — match by unit_id + item_name + lot_number (if provided)
      let existingQuery = supabase
        .from('unit_inventory')
        .select('id, quantity')
        .eq('unit_id', form.unit_id)
        .eq('item_name', form.item_name)
      if (form.lot_number) {
        existingQuery = existingQuery.eq('lot_number', form.lot_number)
      }
      const { data: existing } = await existingQuery.limit(1)

      if (existing && existing.length > 0) {
        // UPDATE — same item + same lot (or no lot)
        const inv = existing[0]
        const newQty = (inv.quantity || 0) + qty
        const updatePayload: Record<string, unknown> = { quantity: newQty }
        if (form.lot_number) updatePayload.lot_number = form.lot_number
        if (form.expiration_date) updatePayload.expiration_date = form.expiration_date

        const { error: upErr } = await supabase
          .from('unit_inventory')
          .update(updatePayload)
          .eq('id', inv.id)

        if (upErr) throw new Error(upErr.message)
      } else {
        // INSERT
        const selectedUnit = units.find(u => u.id === form.unit_id)
        const insertPayload: Record<string, unknown> = {
          incident_unit_id: incidentUnitId,
          unit_id: form.unit_id,
          item_name: form.item_name,
          category: form.category || null,
          catalog_item_id: form.catalog_item_id || null,
          quantity: qty,
          unit_name: selectedUnit?.name || null,
        }
        if (form.lot_number) insertPayload.lot_number = form.lot_number
        if (form.expiration_date) insertPayload.expiration_date = form.expiration_date

        const { error: insErr } = await supabase
          .from('unit_inventory')
          .insert(insertPayload)

        if (insErr) throw new Error(insErr.message)
      }

      setSuccess(true)
      setTimeout(() => navigate('/inventory'), 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setError(msg)
      setSubmitting(false)
    }
  }

  // Group units by type
  const unitGroups = units.reduce<Record<string, Unit[]>>((acc, u) => {
    const key = (u.unit_type?.name) || 'Other'
    if (!acc[key]) acc[key] = []
    acc[key].push(u)
    return acc
  }, {})

  if (success) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-3xl">✅</p>
        <p className="text-xl font-bold text-green-400">Inventory Updated</p>
        <p className="text-gray-400 text-sm">Redirecting...</p>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/inventory" className="text-gray-500 hover:text-gray-300 text-sm">← Inventory</Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Add Inventory</h1>
            <p className="text-xs text-gray-500">Receive resupply to a unit</p>
          </div>
        </div>

        <div className="theme-card rounded-xl p-4 border space-y-4">
          {/* Unit */}
          <p className={sectionCls}>Unit & Item</p>
          <div>
            <label className={labelCls}>Unit *</label>
            {isField && form.unit_id ? (
              <div className={`${inputCls} bg-gray-700 text-gray-300 cursor-not-allowed`}>
                🚑 {units.find(u => u.id === form.unit_id)?.name || assignment.unit?.name || 'Assigned Unit'}
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.unit_id}
                onChange={e => handleUnitChange(e.target.value)}
              >
                <option value="">Select unit</option>
                {Object.entries(unitGroups).map(([groupName, groupUnits]) => (
                  <optgroup key={groupName} label={groupName}>
                    {groupUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Item */}
          <div>
            <label className={labelCls}>
              Item Name *
              {loadingFormulary && <span className="ml-2 text-gray-500 font-normal normal-case">Loading...</span>}
            </label>
            {formulary.length > 0 ? (
              <select
                className={inputCls}
                value={form.item_name}
                onChange={e => handleItemSelect(e.target.value)}
              >
                <option value="">Select item</option>
                {formulary.map(item => (
                  <option key={item.id} value={item.item_name}>
                    {item.item_name}{item.category ? ` (${item.category})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-500 text-sm px-3 py-2 bg-gray-800 rounded-lg">Select a unit above to load available items</p>
            )}
          </div>

          {form.category && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Category:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                form.category === 'CS' ? 'bg-orange-500 text-white' :
                form.category === 'Rx' ? 'bg-blue-600 text-white' :
                'bg-gray-600 text-white'
              }`}>{form.category}</span>
            </div>
          )}

          {/* Quantity */}
          <p className={sectionCls}>Stock Details</p>
          <div>
            <label className={labelCls}>Quantity Added *</label>
            <input
              type="number"
              className={inputCls}
              value={form.quantity_added}
              onChange={e => set('quantity_added', e.target.value)}
              min="0"
              step="1"
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={labelCls}>Lot Number</label>
              <input type="text" className={inputCls + ' min-w-0'} value={form.lot_number} onChange={e => set('lot_number', e.target.value)} />
            </div>
            <div className="min-w-0">
              <label className={labelCls}>
                Expiration Date
                {isRxOrCS && <span className="text-orange-400 ml-1">*</span>}
              </label>
              <input type="date" className={inputCls + ' min-w-0'} value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} />
            </div>
          </div>

          {isRxOrCS && !form.expiration_date && (
            <div className="bg-orange-950 border border-orange-700 rounded-lg p-3 flex items-start gap-2">
              <span className="text-orange-400">⚠️</span>
              <p className="text-orange-300 text-xs">Expiration date required for {form.category} items.</p>
            </div>
          )}

          {/* Received By */}
          <p className={sectionCls}>Received By</p>
          <div>
            <label className={labelCls}>Received By</label>
            {isField && form.received_by ? (
              <div className={`${inputCls} bg-gray-700 text-gray-300 cursor-not-allowed`}>
                {form.received_by}
              </div>
            ) : (
              <select className={inputCls} value={form.received_by} onChange={e => set('received_by', e.target.value)}>
                <option value="">Select employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
                ))}
              </select>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <input type="text" className={inputCls} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. resupply from cache, supply run #123" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors text-lg"
        >
          {submitting ? 'Updating...' : '📦 Add to Inventory'}
        </button>
        <div className="pb-8" />
      </div>
    </div>
  )
}

export default function AddInventoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <AddInventoryInner />
    </Suspense>
  )
}
