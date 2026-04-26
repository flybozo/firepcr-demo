import { usePermission, useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton } from '@/components/ui'

type CatalogData = {
  id: string
  sku: string | null
  category: string
  unit_of_measure: string | null
  supplier: string | null
  units_per_case: number | null
  case_cost: number | null
  unit_cost: number | null
  image_url: string | null
  barcode: string | null
  upc: string | null
  ndc: string | null
  concentration: string | null
  route: string | null
  is_als: boolean
  reimbursable: boolean | null
  manufacturer_sku: string | null
}

type FormularyItem = {
  id: string
  item_name: string
  default_par_qty: number | null
  notes: string | null
  catalog_item_id: string | null
  catalog_item: CatalogData | CatalogData[] | null
  unit_type_id: string | null
}

function catalogOf(item: FormularyItem): CatalogData | null {
  const ci = item.catalog_item
  if (!ci) return null
  if (Array.isArray(ci)) return ci[0] || null
  return ci
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

export type InventoryContext = {
  inventoryId: string
  unitName: string
  quantity: number
  parQty: number
  lotNumber: string | null
  expirationDate: string | null
}

export function FormularyDetailInner({ inventoryCtx, backPath, templateId }: { inventoryCtx?: InventoryContext; backPath?: string; templateId?: string }) {
  const { id: paramId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const supabase = createClient()
  const isAdmin = usePermission('admin.settings')

  const id = templateId || paramId
  const [item, setItem] = useState<FormularyItem | null>(null)
  const [unitTypeName, setUnitTypeName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<{ default_par_qty: number | null; notes: string | null }>({ default_par_qty: null, notes: null })
  const [unitStock, setUnitStock] = useState<{ unit_name: string; unit_id: string; quantity: number; lot_number: string | null }[]>([])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data, error } = await supabase
        .from('formulary_templates')
        .select('id, item_name, default_par_qty, notes, catalog_item_id, unit_type_id, catalog_item:item_catalog(id, sku, category, unit_of_measure, supplier, units_per_case, case_cost, unit_cost, image_url, barcode, upc, ndc, concentration, route, is_als, reimbursable, manufacturer_sku), unit_type:unit_types(name)')
        .eq('id', id)
        .single()
      if (error || !data) { setLoading(false); return }

      const parsed = data as any
      setItem({
        id: parsed.id,
        item_name: parsed.item_name,
        default_par_qty: parsed.default_par_qty,
        notes: parsed.notes,
        catalog_item_id: parsed.catalog_item_id,
        catalog_item: parsed.catalog_item,
        unit_type_id: parsed.unit_type_id,
      })
      setUnitTypeName(parsed.unit_type?.name || '')
      setForm({ default_par_qty: parsed.default_par_qty, notes: parsed.notes })

      // Load current stock across all units for this item
      const { data: inv } = await supabase
        .from('unit_inventory')
        .select('quantity, lot_number, unit_id, unit:units(id, name)')
        .eq('item_name', parsed.item_name)
        .gt('quantity', 0)
        .order('quantity', { ascending: false })
      setUnitStock((inv || []).map((r: any) => ({
        unit_name: r.unit?.name || 'Unknown',
        unit_id: r.unit?.id || r.unit_id,
        quantity: r.quantity,
        lot_number: r.lot_number,
      })))

      setLoading(false)
    }
    load()
  }, [id])

  const save = async () => {
    if (!id || !item) return
    setSaving(true)
    const updates: Record<string, any> = {}
    if (form.default_par_qty !== item.default_par_qty) {
      updates.default_par_qty = form.default_par_qty
    }
    if (form.notes !== item.notes) {
      updates.notes = form.notes
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('formulary_templates').update(updates).eq('id', id)
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }
      setItem(prev => prev ? { ...prev, ...updates } : prev)
    }
    setEditing(false)
    setSaving(false)
    toast.success('Saved')
  }

  const ci = item ? catalogOf(item) : null

  const getUnitCost = (): string | null => {
    if (!ci) return null
    if (ci.unit_cost != null) return Number(ci.unit_cost).toFixed(4)
    if (ci.case_cost && ci.units_per_case && ci.units_per_case > 0)
      return (ci.case_cost / ci.units_per_case).toFixed(4)
    return null
  }

  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} /></div>
  if (!item) return (
    <div className="p-6 text-center text-gray-500">
      <p>Item not found</p>
      <button onClick={() => navigate(backPath || '/formulary')} className="text-red-400 hover:text-red-300 text-sm mt-2">← Back</button>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
      <button onClick={() => navigate(backPath || '/formulary')} className="text-gray-500 hover:text-white text-sm mb-4">← {backPath === '/inventory' ? 'Inventory' : 'Formulary'}</button>

      {/* Header */}
      <div className="flex gap-6 mb-6">
        <div className="shrink-0">
          <div className="w-32 h-32 rounded-xl bg-gray-800 overflow-hidden">
            {ci?.image_url ? (
              <img src={ci.image_url} alt={item.item_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                <span className="text-3xl mb-1">📷</span>
                <span className="text-xs">No photo</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white mb-1">{item.item_name}</h1>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[ci?.category || ''] || 'bg-gray-700 text-gray-300'}`}>
              {ci?.category || '—'}
            </span>
            {ci?.is_als && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">ALS</span>}
            {ci?.reimbursable && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">💲 Reimb</span>}
            <span className="text-xs text-gray-500">{unitTypeName}</span>
          </div>
          {ci?.concentration && <p className="text-sm text-gray-400">{ci.concentration}</p>}
          {ci?.route && <p className="text-sm text-gray-500">Route: {ci.route}</p>}
          <div className="flex gap-2 mt-3">
            {item.catalog_item_id && (
              <button onClick={() => navigate(`/catalog/${item.catalog_item_id}`)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white font-medium">
                📋 View in Catalog
              </button>
            )}
            {isAdmin && !editing && (
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white font-medium">
                ✏️ Edit Par / Notes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inventory context — shown when accessed from inventory list */}
      {inventoryCtx && (
        <div className="bg-gray-900 rounded-xl border border-blue-800/40 overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-blue-950/30 border-b border-blue-800/30">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              📦 {inventoryCtx.unitName} — On-Hand
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800">
            <div className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Quantity</p>
              <p className={`text-2xl font-mono font-bold ${inventoryCtx.quantity <= inventoryCtx.parQty ? 'text-red-400' : 'text-white'}`}>
                {inventoryCtx.quantity}
              </p>
              <p className="text-xs text-gray-600">par: {inventoryCtx.parQty}</p>
            </div>
            <div className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Lot #</p>
              <p className="text-sm text-white font-mono">{inventoryCtx.lotNumber || '—'}</p>
            </div>
            <div className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Expiration</p>
              <p className={`text-sm font-mono ${
                inventoryCtx.expirationDate && new Date(inventoryCtx.expirationDate) < new Date() ? 'text-red-400' : 'text-white'
              }`}>{inventoryCtx.expirationDate || '—'}</p>
            </div>
            <div className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Unit</p>
              <p className="text-sm text-white font-medium">{inventoryCtx.unitName}</p>
            </div>
          </div>
        </div>
      )}

      {editing ? (
        /* Edit form — ONLY formulary_templates fields */
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4 mb-4">
          <h2 className="text-sm font-semibold text-white">Edit Formulary Settings</h2>
          <p className="text-xs text-gray-500">To edit item details (cost, supplier, identifiers), use the <button onClick={() => navigate(`/catalog/${item.catalog_item_id}`)} className="text-red-400 hover:text-red-300 underline">Item Catalog</button>.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Default Par Qty</label>
              <input type="number" value={form.default_par_qty ?? ''} onChange={e => setForm(prev => ({ ...prev, default_par_qty: e.target.value ? parseFloat(e.target.value) : null }))} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes || ''} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value || null }))} className={inputCls + ' h-20'} placeholder="Storage requirements, usage notes, etc." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setEditing(false); setForm({ default_par_qty: item.default_par_qty, notes: item.notes }) }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold text-white">
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>
      ) : (
        /* Formulary-specific info card */
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Formulary Settings</h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-800">
            <div className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Default Par Qty</p>
              <p className="text-lg text-white font-mono font-bold">{item.default_par_qty ?? '—'}</p>
            </div>
            <div className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Unit Type</p>
              <p className="text-sm text-white font-medium">{unitTypeName}</p>
            </div>
          </div>
          {item.notes && (
            <div className="px-4 py-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Read-only catalog info */}
      {ci && (
        <div className="space-y-4">
          {/* Supply & Cost (read-only, sourced from Item Catalog) */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Supply & Cost</h2>
              <span className="text-xs text-gray-600">from Item Catalog</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800">
              {[
                { label: 'Supplier', value: ci.supplier || '—' },
                { label: 'Units/Case', value: ci.units_per_case ?? '—' },
                { label: 'Cost/Case', value: ci.case_cost ? `$${ci.case_cost.toFixed(2)}` : '—' },
                { label: 'Unit Cost', value: getUnitCost() ? `$${getUnitCost()}` : '—' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-sm text-white font-medium">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Identifiers (read-only) */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Identifiers & Details</h2>
              <span className="text-xs text-gray-600">from Item Catalog</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-800">
              {[
                { label: 'SKU', value: ci.sku || '—' },
                { label: 'Mfr SKU', value: ci.manufacturer_sku || '—' },
                { label: 'Barcode', value: ci.barcode || '—' },
                { label: 'UPC', value: ci.upc || '—' },
                { label: 'NDC', value: ci.ndc || '—' },
                { label: 'Unit of Measure', value: ci.unit_of_measure || '—' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-sm text-white font-mono">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Current Stock Across Units */}
      {unitStock.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mt-4">
          <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              📦 Current Stock ({unitStock.reduce((s, u) => s + u.quantity, 0)} total)
            </h2>
          </div>
          <div className="divide-y divide-gray-800">
            {unitStock.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="text-white font-medium">{row.unit_name}</span>
                  {row.lot_number && <span className="text-gray-600 text-xs ml-2">Lot: {row.lot_number}</span>}
                </div>
                <span className={`font-mono font-semibold shrink-0 ml-3 ${row.quantity <= (item.default_par_qty || 0) ? 'text-red-400' : 'text-green-400'}`}>
                  {row.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {unitStock.length === 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center text-gray-600 text-sm mt-4">
          No units currently stocking this item.
        </div>
      )}
    </div>
  )
}

function FormularyDetailPermGuard({ children }: { children: React.ReactNode }) {
  const loading = usePermissionLoading()
  const hasAccess = useAnyPermission('inventory.manage', 'inventory.view', 'inventory.*', 'admin.settings')
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-500 text-sm">Loading...</p></div>
  if (!hasAccess) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400 text-sm">Access denied.</p></div>
  return <>{children}</>
}

export default function FormularyDetailPage() {
  return (
    <FormularyDetailPermGuard>
      <FormularyDetailInner />
    </FormularyDetailPermGuard>
  )
}
