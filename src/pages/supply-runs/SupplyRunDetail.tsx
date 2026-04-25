

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { LoadingSkeleton, EmptyState, ConfirmDialog } from '@/components/ui'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { inputCls, labelCls } from '@/components/ui/FormField'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'
import { getIsOnline } from '@/lib/syncManager'
import { queueOfflineWrite, getCachedData } from '@/lib/offlineStore'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type SupplyRun = {
  id: string
  run_date: string
  time: string | null
  resource_number: string | null
  dispensed_by: string | null
  crew_member: string | null
  notes: string | null
  incident_unit_id: string | null
  raw_barcodes: string[] | null
  incident_unit: {
    unit: { name: string; id: string } | null
    incident: { name: string } | null
  } | null
}

type SupplyRunItem = {
  id: string
  supply_run_id: string
  item_name: string
  category: string
  quantity: number
  unit_cost: number
  barcode?: string | null
}

type FormularyTemplate = {
  id: string
  item_name: string
  category: string
  barcode?: string | null
  upc?: string | null
}

type UnitInventoryRow = {
  id: string
  item_name: string
  quantity: number
  barcode?: string | null
  upc?: string | null
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
}

export default function SupplyRunDetailPage() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment.employee?.role || '')
  const params = useParams()
  const id = params.id as string

  const [run, setRun] = useState<SupplyRun | null>(null)

  // Field users can edit their own unit's supply runs created within the last 24 hours
  const canEdit = useMemo(() => {
    if (isAdmin) return true
    if (!run || assignment.loading) return false
    const runUnit = run.incident_unit?.unit?.name
    const myUnit = assignment.unit?.name
    if (!runUnit || !myUnit || runUnit !== myUnit) return false
    const runDate = new Date(`${run.run_date}${run.time ? 'T' + run.time : 'T00:00:00'}`)
    const ageHours = (Date.now() - runDate.getTime()) / 3600000
    return ageHours < 24
  }, [isAdmin, run, assignment.loading, assignment.unit?.name])

  const [items, setItems] = useState<SupplyRunItem[]>([])
  const [formulary, setFormulary] = useState<FormularyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null)
  const [editingQtyValue, setEditingQtyValue] = useState<string>('')

  const [newItem, setNewItem] = useState({
    item_name: '',
    category: '',
    quantity: '',
  })
  const [itemSearch, setItemSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  const loadData = useCallback(async () => {
    // Show cached data instantly
    try {
      const { getCachedById } = await import('@/lib/offlineStore')
      const cached = await getCachedById('supply_runs', id) as any
      if (cached) {
        setRun(cached as SupplyRun)
        setLoading(false)
      }
    } catch {}
    const { data: runData, offline } = await loadSingle<SupplyRun>(
      () => supabase
        .from('supply_runs')
        .select(`
          id, run_date, time, resource_number, dispensed_by, crew_member, notes, incident_unit_id, raw_barcodes,
          incident_unit:incident_units(unit:units(id, name), incident:incidents(name))
        `)
        .eq('id', id)
        .single() as any,
      'supply_runs',
      id
    )
    if (offline || !runData) {
      if (runData) {
        setIsOfflineData(true)
        setRun(runData as unknown as SupplyRun)
        // Load items from embedded supply_run_items in cached run
        if ((runData as any).supply_run_items) {
          setItems((runData as any).supply_run_items)
        }
      }
      setLoading(false)
      return
    }
    let itemData: any[] | null = null
    let inventoryData: any[] | null = null
    try {
    // Load supply run items + this unit's current inventory (for the add-item dropdown)
    const unitId = (runData as any)?.incident_unit?.unit?.id || null
    const [{ data: _items }, invResult] = await Promise.all([
      supabase
        .from('supply_run_items')
        .select('*')
        .eq('supply_run_id', id)
        .is('deleted_at', null)
        .order('item_name'),
      // Get inventory items with qty > 0, only OTC + Supply categories
      unitId
        ? supabase
            .from('unit_inventory')
            .select('id, item_name, category, quantity, lot_number, barcode, upc, incident_unit_id, catalog_item_id')
            .eq('unit_id', unitId)
            .gt('quantity', 0)
            .in('category', ['OTC', 'Supply'])
            .order('item_name')
        : Promise.resolve({ data: [] as any[] }),
    ])
    itemData = _items
    inventoryData = (invResult as any).data || []
    } catch {
      // Offline — try cached supply run embedded items first, then filtered cache
      if (runData && (runData as any).supply_run_items) {
        itemData = (runData as any).supply_run_items
      }
      if (!itemData || (itemData as any[]).length === 0) {
        try {
          const cachedItems = await getCachedData('supply_run_items') as any[]
          itemData = cachedItems.filter((i: any) => i.supply_run_id === id && !i.deleted_at)
        } catch {}
      }
    }
    setRun(runData as unknown as SupplyRun)
    setItems(itemData || [])
    // Deduplicate inventory items by name (may have multiple incident_unit rows)
    const seen = new Set<string>()
    const deduped = (inventoryData || []).filter((inv: any) => {
      if (seen.has(inv.item_name)) return false
      seen.add(inv.item_name)
      return true
    })
    setFormulary(deduped)
    setLoading(false)
  }, [id, supabase])

  useEffect(() => { loadData() }, [loadData])

  // Extract unit_id from nested incident_unit for barcode hook
  const runWithUnitId = run ? {
    ...run,
    unit_id: (run.incident_unit as unknown as { unit?: { id?: string } } | null)?.unit?.id ?? null,
  } : null

  const {
    scanMode, setScanMode, barcodeInput, setBarcodeInput,
    scanMessage, scanning, barcodeRef, handleBarcodeScan,
  } = useBarcodeScan({
    supplyRunId: id,
    run: runWithUnitId,
    formulary,
    onScanComplete: loadData,
    onRunUpdate: setRun,
    supabase,
  })

  const setNew = (field: string, value: string) => {
    setNewItem(prev => ({ ...prev, [field]: value }))
  }


  // ── Manual add item ───────────────────────────────────────────────────────

  const handleAddItem = async () => {
    if (!newItem.item_name || !newItem.quantity) {
      toast.warning('Please enter item name and quantity.')
      return
    }
    setAddingItem(true)
    try {
      const qty = parseFloat(newItem.quantity) || 0

      if (!getIsOnline()) {
        const itemId = crypto.randomUUID()
        await queueOfflineWrite('supply_run_items', 'insert', {
          id: itemId,
          supply_run_id: id,
          item_name: newItem.item_name,
          category: newItem.category || 'OTC',
          quantity: qty,
        })
        const unitId = run?.incident_unit?.unit?.id
        if (unitId) {
          const inv = await getCachedData('inventory') as any[]
          const invItem = inv.find((i: any) => i.item_name === newItem.item_name && i.unit_id === unitId)
          if (invItem) {
            await queueOfflineWrite('unit_inventory', 'update', { id: invItem.id, quantity: Math.max(0, (invItem.quantity || 0) - qty) })
          }
        }
        setItems(prev => [...prev, { id: itemId, supply_run_id: id, item_name: newItem.item_name, category: newItem.category || 'OTC', quantity: qty, unit_cost: 0 }])
        setNewItem({ item_name: '', category: '', quantity: '' })
        setItemSearch('')
        setShowAddForm(false)
        setAddingItem(false)
        return
      }

      const { error: itemErr } = await supabase.from('supply_run_items').insert({
        supply_run_id: id,
        item_name: newItem.item_name,
        category: newItem.category || 'OTC',
        quantity: qty,
      })
      if (itemErr) throw new Error(itemErr.message)

      // Zero-quantity guard + subtract from unit inventory
      // Query by unit_id directly — inventory belongs to the truck, not the incident deployment
      const unitId = run?.incident_unit?.unit?.id
      if (unitId) {
        const { data: existing } = await supabase
          .from('unit_inventory')
          .select('id, quantity')
          .eq('unit_id', unitId)
          .eq('item_name', newItem.item_name)
          .order('quantity', { ascending: false })
          .limit(1)

        if (existing && existing.length > 0) {
          const currentQty = existing[0].quantity || 0
          if (currentQty < qty) {
            toast.warning(`Insufficient stock: only ${currentQty} available. Cannot dispense ${qty}.`)
            setAddingItem(false)
            return
          }
          const newQty = currentQty - qty
          await supabase.from('unit_inventory').update({ quantity: newQty }).eq('id', existing[0].id)
        }
      }

      setNewItem({ item_name: '', category: '', quantity: '' })
      setItemSearch('')
      setShowAddForm(false)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Error: ${msg}`)
    }
    setAddingItem(false)
  }

  // ── Delete item ───────────────────────────────────────────────────────────

  const handleDeleteItem = (itemId: string) => {
    setConfirmAction({
      action: async () => { await _doDeleteItem(itemId) },
      title: 'Delete Item',
      message: 'Delete this item? Quantity will be restored to unit inventory.',
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  const _doDeleteItem = async (itemId: string) => {
    setDeletingId(itemId)
    try {
      const deletedItem = items.find(i => i.id === itemId)

      if (!getIsOnline()) {
        await queueOfflineWrite('supply_run_items', 'update', { id: itemId, deleted_at: new Date().toISOString() })
        if (deletedItem) {
          const unitId = run?.incident_unit?.unit?.id
          if (unitId) {
            const inv = await getCachedData('inventory') as any[]
            const invItem = inv.find((i: any) => i.item_name === deletedItem.item_name && i.unit_id === unitId)
            if (invItem) {
              await queueOfflineWrite('unit_inventory', 'update', { id: invItem.id, quantity: (invItem.quantity || 0) + deletedItem.quantity })
            }
          }
        }
        setItems(prev => prev.filter(i => i.id !== itemId))
        setDeletingId(null)
        return
      }

      // Soft delete — mark as deleted, don't actually remove
      await supabase.from('supply_run_items').update({ deleted_at: new Date().toISOString() }).eq('id', itemId)

      // Add quantity BACK using unit_id (inventory belongs to the truck, not the deployment)
      if (deletedItem) {
        const unitId = run?.incident_unit?.unit?.id
        if (unitId) {
          const { data: invRows } = await supabase
            .from('unit_inventory')
            .select('id, quantity')
            .eq('unit_id', unitId)
            .eq('item_name', deletedItem.item_name)
            .order('quantity', { ascending: false })
            .limit(1)
          if (invRows?.length) {
            await supabase.from('unit_inventory')
              .update({ quantity: (invRows[0].quantity || 0) + deletedItem.quantity })
              .eq('id', invRows[0].id)
          }
        }
      }

      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Error: ${msg}`)
    }
    setDeletingId(null)
  }

  // ── Inline quantity update on supply run item ─────────────────────────────

  const handleUpdateItemQty = async (item: SupplyRunItem, newQtyStr: string) => {
    const newQty = parseFloat(newQtyStr)
    if (isNaN(newQty) || newQty < 0) { setEditingQtyId(null); return }
    if (newQty === item.quantity) { setEditingQtyId(null); return }

    const delta = newQty - item.quantity // positive = used more, negative = used less

    try {
      if (!getIsOnline()) {
        await queueOfflineWrite('supply_run_items', 'update', { id: item.id, quantity: newQty })
        const unitId = run?.incident_unit?.unit?.id
        if (unitId && delta !== 0) {
          const inv = await getCachedData('inventory') as any[]
          const invItem = inv.find((i: any) => i.item_name === item.item_name && i.unit_id === unitId)
          if (invItem) {
            const newInvQty = Math.max(0, (invItem.quantity || 0) - delta)
            await queueOfflineWrite('unit_inventory', 'update', { id: invItem.id, quantity: newInvQty })
          }
        }
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i))
        setEditingQtyId(null)
        return
      }

      await supabase.from('supply_run_items').update({ quantity: newQty }).eq('id', item.id)

      // Adjust inventory by delta — query by unit_id (truck-level inventory)
      const unitId = run?.incident_unit?.unit?.id
      if (unitId) {
        const { data: invRows } = await supabase
          .from('unit_inventory')
          .select('id, quantity')
          .eq('unit_id', unitId)
          .eq('item_name', item.item_name)
          .order('quantity', { ascending: false })
          .limit(1)
        if (invRows?.length) {
          const newInvQty = Math.max(0, (invRows[0].quantity || 0) - delta)
          await supabase.from('unit_inventory')
            .update({ quantity: newInvQty })
            .eq('id', invRows[0].id)
        }
      }

      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Error updating quantity: ${msg}`)
    }
    setEditingQtyId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton fullPage />

  if (!run) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <EmptyState icon="📦" message="Supply run not found." actionHref="/supply-runs" actionLabel="← Back" />
    </div>
  )

  const incidentUnitData = run.incident_unit as unknown as { unit?: { name?: string }; incident?: { name?: string } } | null
  const unitName = incidentUnitData?.unit?.name
  const incidentName = incidentUnitData?.incident?.name
  const scannedCount = items.filter(i => i.barcode).length

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-4">

        <Link to="/supply-runs" className="text-gray-500 hover:text-gray-300 text-sm">← Supply Runs</Link>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes require connectivity
          </div>
        )}

        {/* Header */}
        <div className="theme-card rounded-xl p-4 border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Supply Run</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                <span>📅 {run.run_date}{run.time ? ` · ${run.time}` : ''}</span>
                {unitName && <span>🚑 {unitName}</span>}
                {incidentName && <span>🔥 {incidentName}</span>}
                {run.resource_number && <span>🪪 {run.resource_number}</span>}
                {run.dispensed_by && <span>👤 {run.dispensed_by}</span>}
              </div>
              {run.notes && <p className="mt-2 text-sm text-gray-400">{run.notes}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xs text-gray-500">Items: {items.length}</p>
            </div>
          </div>
        </div>

        {/* ── Barcode Scan Section ── */}
        <div className={lc.container}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Barcode Scanner</h2>
              {scannedCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full">
                  {scannedCount} scanned
                </span>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setScanMode(v => {
                    const next = !v
                    if (next) setTimeout(() => barcodeRef.current?.focus(), 50)
                    return next
                  })
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  scanMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                🔍 Scan Mode {scanMode ? 'ON' : 'OFF'}
              </button>
            )}
          </div>

          {scanMode && (
            <div className="p-4 space-y-3 theme-card-footer">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className={labelCls}>Scan Barcode</label>
                  <input
                    ref={barcodeRef}
                    type="text"
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleBarcodeScan(barcodeInput)
                      }
                    }}
                    placeholder="Scan or type barcode, then press Enter"
                    className={`${inputCls} ${scanning ? 'opacity-50' : ''}`}
                    disabled={scanning}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBarcodeScan(barcodeInput)}
                  disabled={!barcodeInput.trim() || scanning}
                  className="mt-5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-semibold transition-colors"
                >
                  {scanning ? '...' : '→'}
                </button>
              </div>

              {scanMessage && (
                <div className={`text-sm px-3 py-2 rounded-lg ${
                  scanMessage.type === 'success' ? 'bg-green-900/60 text-green-300' :
                  scanMessage.type === 'warn' ? 'bg-yellow-900/60 text-yellow-300' :
                  'bg-red-900/60 text-red-300'
                }`}>
                  {scanMessage.text}
                </div>
              )}

              {run.raw_barcodes && run.raw_barcodes.length > 0 && (
                <div className="text-xs text-gray-500">
                  Unrecognized barcodes: {run.raw_barcodes.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Items ── */}
        <div className={lc.container}>
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Items ({items.length})
              {scannedCount > 0 && (
                <span className="ml-2 text-blue-400 normal-case font-normal">
                  · {scannedCount} via barcode
                </span>
              )}
            </h2>
            {canEdit && (
              <button
                onClick={() => setShowAddForm(prev => !prev)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold transition-colors"
              >
                {showAddForm ? '✕ Cancel' : '+ Add Item'}
              </button>
            )}
          </div>

          {/* Manual Add Item Form */}
          {showAddForm && (
            <div className="p-4 border-b theme-card-header space-y-3">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Add Item from Formulary</p>
              <div>
                <label className={labelCls}>Item</label>
                <input
                  type="text"
                  className={inputCls}
                  value={itemSearch}
                  onChange={e => { setItemSearch(e.target.value); if (newItem.item_name) { setNew('item_name', ''); setNew('category', '') } }}
                  placeholder="Search formulary..."
                />
                {itemSearch && !newItem.item_name && (
                  <div className="mt-1 max-h-40 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg">
                    {formulary
                      .filter(f => f.item_name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .slice(0, 15)
                      .map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setNew('item_name', f.item_name)
                            setNew('category', f.category)
                            setItemSearch(f.item_name)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors flex justify-between"
                        >
                          <span className="text-white">{f.item_name}</span>
                          <span className="text-gray-500 text-xs">{f.category}</span>
                        </button>
                      ))}
                    {formulary.filter(f => f.item_name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-gray-500 text-xs">No matching items in formulary</p>
                    )}
                  </div>
                )}
                {newItem.item_name && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-green-400">✓ {newItem.item_name}</span>
                    <span className="text-xs text-gray-500">({newItem.category})</span>
                    <button type="button" onClick={() => { setNew('item_name', ''); setNew('category', ''); setItemSearch('') }}
                      className="text-xs text-gray-500 hover:text-red-400">✕ change</button>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Qty</label>
                <input type="number" className={inputCls} value={newItem.quantity} onChange={e => setNew('quantity', e.target.value)} min="0" step="1" />
              </div>
              <button
                onClick={handleAddItem}
                disabled={addingItem}
                className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
              >
                {addingItem ? 'Adding...' : 'Add Item'}
              </button>
            </div>
          )}

          {/* Items table */}
          {items.length === 0 ? (
            <div className="text-center text-gray-600 py-8">
              <p>No items yet.</p>
              {canEdit && (
                <div className="flex justify-center gap-3 mt-3">
                  <button onClick={() => setScanMode(true)} className="text-blue-400 text-sm">
                    🔍 Start scanning
                  </button>
                  <span className="text-gray-700">or</span>
                  <button onClick={() => setShowAddForm(true)} className="text-red-400 text-sm">
                    + Add manually
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700">
                <span className="flex-1 min-w-0">Item</span>
                <span className="w-20 shrink-0 hidden sm:block">Category</span>
                <span className="w-20 shrink-0 text-center">Qty</span>
                <span className="w-16 shrink-0"></span>
              </div>
              {items.map(item => (
                <div key={item.id} className="flex items-center px-4 py-2.5 border-b border-gray-800/50 text-sm">
                  <span className="flex-1 min-w-0 pr-2">
                    <span className="font-medium truncate block">{item.item_name}</span>
                    {item.barcode && (
                      <span className="text-xs text-blue-400 font-mono">📷 {item.barcode}</span>
                    )}
                  </span>
                  <span className="w-20 shrink-0 hidden sm:block">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>
                      {item.category}
                    </span>
                  </span>
                  <span className="w-20 shrink-0 text-center text-gray-300">
                    {canEdit && editingQtyId === item.id ? (
                      <input
                        type="number"
                        min="0"
                        autoFocus
                        className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-white"
                        value={editingQtyValue}
                        onChange={e => setEditingQtyValue(e.target.value)}
                        onBlur={() => handleUpdateItemQty(item, editingQtyValue)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateItemQty(item, editingQtyValue)
                          if (e.key === 'Escape') setEditingQtyId(null)
                        }}
                      />
                    ) : canEdit ? (
                      <button
                        onClick={() => { setEditingQtyId(item.id); setEditingQtyValue(String(item.quantity)) }}
                        className="hover:text-white transition-colors"
                        title="Click to edit quantity"
                      >
                        {item.quantity}
                      </button>
                    ) : (
                      <span>{item.quantity}</span>
                    )}
                  </span>

                  <span className="w-16 shrink-0 text-right">
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={deletingId === item.id}
                        className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
                      >
                        {deletingId === item.id ? '...' : 'Delete'}
                      </button>
                    )}
                  </span>
                </div>
              ))}

            </>
          )}
        </div>

      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
