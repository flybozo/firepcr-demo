import { usePermission, useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'

import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton } from '@/components/ui'

// Fields that live on formulary_templates (thin join table)
const FORMULARY_FIELDS = new Set(['item_name', 'default_par_qty', 'notes'])

type FormularyItem = {
  id: string
  item_name: string
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
  default_par_qty: number | null
  notes: string | null
  is_als: boolean
  unit_type_id: string | null
  catalog_item_id: string | null
  catalog_item: { sku: string; [key: string]: any }[] | { sku: string; [key: string]: any } | null
}

function skuOf(item: { catalog_item: { sku: string; [key: string]: any }[] | { sku: string; [key: string]: any } | null }): string | null {
  const ci = item.catalog_item
  if (!ci) return null
  if (Array.isArray(ci)) return ci[0]?.sku || null
  return ci.sku || null
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
  const fileRef = useRef<HTMLInputElement>(null)

  const id = templateId || paramId
  const [item, setItem] = useState<FormularyItem | null>(null)
  const [unitTypeName, setUnitTypeName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<FormularyItem>>({})
  const [unitStock, setUnitStock] = useState<{ unit_name: string; unit_id: string; quantity: number; lot_number: string | null }[]>([])

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data, error } = await supabase
        .from('formulary_templates')
        .select('*, unit_type:unit_types(name), catalog_item:item_catalog(*)')
        .eq('id', id)
        .single()
      if (error || !data) { setLoading(false); return }

      // Flatten catalog_item fields into the item object for unified form state
      const rawCi = (data as any).catalog_item
      const ci = Array.isArray(rawCi) ? rawCi[0] : rawCi
      const { id: _ciId, ...ciRest } = ci || {}
      const flat = { ...data, ...ciRest, catalog_item: (data as any).catalog_item } as any

      setItem(flat)
      setUnitTypeName((data as any).unit_type?.name || '')
      setForm(flat)

      // Load current stock across all units for this item
      const { data: inv } = await supabase
        .from('unit_inventory')
        .select('quantity, lot_number, unit_id, unit:units(id, name)')
        .eq('item_name', (data as any).item_name)
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

    const formularyUpdates: Record<string, any> = {}
    const catalogUpdates: Record<string, any> = {}

    const fields: (keyof FormularyItem)[] = [
      'item_name', 'category', 'unit_of_measure', 'supplier',
      'units_per_case', 'case_cost', 'unit_cost', 'barcode', 'upc',
      'ndc', 'concentration', 'route', 'default_par_qty', 'notes', 'is_als',
    ]
    for (const f of fields) {
      if (form[f] !== undefined && form[f] !== item[f]) {
        const val = form[f] === '' ? null : form[f]
        if (FORMULARY_FIELDS.has(f)) formularyUpdates[f] = val
        else catalogUpdates[f] = val
      }
    }

    // Convert numeric fields
    for (const nf of ['units_per_case', 'case_cost', 'unit_cost', 'default_par_qty']) {
      if (formularyUpdates[nf] !== undefined && formularyUpdates[nf] !== null)
        formularyUpdates[nf] = parseFloat(formularyUpdates[nf]) || null
      if (catalogUpdates[nf] !== undefined && catalogUpdates[nf] !== null)
        catalogUpdates[nf] = parseFloat(catalogUpdates[nf]) || null
    }

    if (Object.keys(formularyUpdates).length > 0) {
      const { error } = await supabase.from('formulary_templates').update(formularyUpdates).eq('id', id)
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }
    }

    if (Object.keys(catalogUpdates).length > 0 && item.catalog_item_id) {
      const { error } = await supabase.from('item_catalog').update(catalogUpdates).eq('id', item.catalog_item_id)
      if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }
    }

    const allUpdates = { ...formularyUpdates, ...catalogUpdates }
    if (Object.keys(allUpdates).length > 0) {
      setItem(prev => prev ? { ...prev, ...allUpdates } : prev)
    }
    setEditing(false)
    setSaving(false)
    toast.success('Saved')
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id || !item?.catalog_item_id) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `formulary/${id}.${ext}`
    const { data, error } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(data.path)
    const publicUrl = urlData.publicUrl
    await supabase.from('item_catalog').update({ image_url: publicUrl }).eq('id', item.catalog_item_id)
    setItem(prev => prev ? { ...prev, image_url: publicUrl } : prev)
    setForm(prev => ({ ...prev, image_url: publicUrl }))
    setUploading(false)
    toast.success('Photo uploaded')
  }

  const removePhoto = async () => {
    if (!id || !item?.catalog_item_id) return
    await supabase.from('item_catalog').update({ image_url: null }).eq('id', item.catalog_item_id)
    setItem(prev => prev ? { ...prev, image_url: null } : prev)
    setForm(prev => ({ ...prev, image_url: null }))
    toast.success('Photo removed')
  }

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  const getUnitCost = (): string | null => {
    const uc = form.unit_cost ?? item?.unit_cost
    if (uc != null) return Number(uc).toFixed(4)
    const cc = form.case_cost ?? item?.case_cost
    const upc = form.units_per_case ?? item?.units_per_case
    if (cc && upc && upc > 0) return (Number(cc) / Number(upc)).toFixed(4)
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

      {/* Header with photo */}
      <div className="flex gap-6 mb-6">
        {/* Photo */}
        <div className="shrink-0">
          <div className="w-32 h-32 rounded-xl bg-gray-800 overflow-hidden relative group">
            {item.image_url ? (
              <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                <span className="text-3xl mb-1">📷</span>
                <span className="text-xs">No photo</span>
              </div>
            )}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs text-white"
                >
                  {uploading ? '...' : '📷 Upload'}
                </button>
                {item.image_url && (
                  <button onClick={removePhoto} className="px-2 py-1 bg-red-600/60 hover:bg-red-600 rounded text-xs text-white">✕</button>
                )}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white mb-1">{item.item_name}</h1>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[item.category] || 'bg-gray-700 text-gray-300'}`}>
              {item.category}
            </span>
            {item.is_als && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">ALS</span>}
            <span className="text-xs text-gray-500">{unitTypeName}</span>
          </div>
          {item.concentration && <p className="text-sm text-gray-400">{item.concentration}</p>}
          {item.route && <p className="text-sm text-gray-500">Route: {item.route}</p>}
          {isAdmin && !editing && (
            <button onClick={() => setEditing(true)} className="mt-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-white font-medium">
              ✏️ Edit Details
            </button>
          )}
        </div>
      </div>

      {/* Inventory context — shown when accessed from inventory list */}
      {inventoryCtx && (
        <div className="bg-gray-900 rounded-xl border border-blue-800/40 overflow-hidden">
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
        /* Edit form — formulary fields (default_par_qty, notes) go to formulary_templates;
           all other metadata goes to item_catalog */
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Item Name *</label>
              <input value={form.item_name || ''} onChange={e => set('item_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category || ''} onChange={e => set('category', e.target.value)} className={inputCls}>
                {['CS', 'Rx', 'OTC', 'DE', 'RE'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unit of Measure</label>
              <input value={form.unit_of_measure || ''} onChange={e => set('unit_of_measure', e.target.value)} className={inputCls} placeholder="mg, mL, each, etc." />
            </div>
            <div>
              <label className={labelCls}>Concentration</label>
              <input value={form.concentration || ''} onChange={e => set('concentration', e.target.value)} className={inputCls} placeholder="e.g. 10mg/mL" />
            </div>
            <div>
              <label className={labelCls}>Route</label>
              <input value={form.route || ''} onChange={e => set('route', e.target.value)} className={inputCls} placeholder="e.g. IV, IM, PO" />
            </div>
            <div>
              <label className={labelCls}>Supplier</label>
              <input value={form.supplier || ''} onChange={e => set('supplier', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Default Par Qty</label>
              <input type="number" value={form.default_par_qty ?? ''} onChange={e => set('default_par_qty', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Units per Case</label>
              <input type="number" value={form.units_per_case ?? ''} onChange={e => set('units_per_case', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cost per Case ($)</label>
              <input type="number" step="0.01" value={form.case_cost ?? ''} onChange={e => set('case_cost', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unit Cost ($) <span className="normal-case font-normal text-gray-600">— leave blank to auto-calculate</span></label>
              <input type="number" step="0.0001" value={form.unit_cost ?? ''} onChange={e => set('unit_cost', e.target.value)} className={inputCls} placeholder="auto" />
            </div>
            <div>
              <label className={labelCls}>Barcode</label>
              <input value={form.barcode || ''} onChange={e => set('barcode', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>UPC</label>
              <input value={form.upc || ''} onChange={e => set('upc', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>NDC</label>
              <input value={form.ndc || ''} onChange={e => set('ndc', e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>ALS Item</label>
              <input type="checkbox" checked={!!form.is_als} onChange={e => set('is_als', e.target.checked)} className="w-4 h-4 rounded" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className={inputCls + ' h-20'} placeholder="Storage requirements, usage notes, etc." />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => { setEditing(false); setForm(item) }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold text-white">
              {saving ? 'Saving...' : '💾 Save'}
            </button>
          </div>
        </div>
      ) : (
        /* Read-only detail view */
        <div className="space-y-4">
          {/* Cost & Supply Info */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Supply & Cost</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800">
              {[
                { label: 'Supplier', value: item.supplier || '—' },
                { label: 'Units/Case', value: item.units_per_case ?? '—' },
                { label: 'Cost/Case', value: item.case_cost ? `$${item.case_cost.toFixed(2)}` : '—' },
                { label: 'Unit Cost', value: getUnitCost() ? `$${getUnitCost()}` : '—' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-sm text-white font-medium">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Identifiers */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Identifiers & Details</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-800">
              {[
                { label: 'SKU', value: skuOf(item) || '—' },
                { label: 'Default Par', value: item.default_par_qty ?? '—' },
                { label: 'Barcode', value: item.barcode || '—' },
                { label: 'UPC', value: item.upc || '—' },
                { label: 'NDC', value: item.ndc || '—' },
                { label: 'Concentration', value: item.concentration || '—' },
                { label: 'Route', value: item.route || '—' },
              ].map(s => (
                <div key={s.label} className="bg-gray-900 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-sm text-white font-mono">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {item.notes && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</h2>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* Current Stock Across Units */}
          {unitStock.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
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
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center text-gray-600 text-sm">
              No units currently stocking this item.
            </div>
          )}
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
