import { usePermission } from '@/hooks/usePermission'
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton } from '@/components/ui'

type CatalogItem = {
  id: string
  sku: string
  item_name: string
  category: string
  is_als: boolean
  ndc: string | null
  barcode: string | null
  upc: string | null
  concentration: string | null
  route: string | null
  unit_of_measure: string | null
  supplier: string | null
  units_per_case: number | null
  case_cost: number | null
  unit_cost: number | null
  image_url: string | null
  notes: string | null
}

type UnitTypeEntry = {
  unit_type_name: string
  default_par_qty: number | null
  template_id: string
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
const CATEGORIES = ['CS', 'Rx', 'OTC', 'Supply', 'DE', 'RE']

export default function CatalogDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const supabase = createClient()
  const isAdmin = usePermission('inventory.manage')
  const fileRef = useRef<HTMLInputElement>(null)

  const [item, setItem] = useState<CatalogItem | null>(null)
  const [unitTypes, setUnitTypes] = useState<UnitTypeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      const [itemResult, templatesResult] = await Promise.all([
        supabase.from('item_catalog').select('*').eq('id', id).single(),
        supabase
          .from('formulary_templates')
          .select('id, default_par_qty, unit_type:unit_types(name)')
          .eq('catalog_item_id', id),
      ])

      if (itemResult.error || !itemResult.data) {
        toast.error('Item not found')
        navigate('/catalog')
        return
      }

      setItem(itemResult.data as CatalogItem)
      setForm(itemResult.data)

      const types = (templatesResult.data || []).map((t: any) => ({
        unit_type_name: Array.isArray(t.unit_type) ? t.unit_type[0]?.name : t.unit_type?.name || 'Unknown',
        default_par_qty: t.default_par_qty,
        template_id: t.id,
      }))
      setUnitTypes(types.sort((a: UnitTypeEntry, b: UnitTypeEntry) => a.unit_type_name.localeCompare(b.unit_type_name)))
      setLoading(false)
    }
    load()
  }, [id])

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!id || !item) return
    setSaving(true)
    const updates: Record<string, any> = {}
    const editableFields = [
      'item_name', 'category', 'is_als', 'ndc', 'barcode', 'upc',
      'concentration', 'route', 'unit_of_measure', 'supplier',
      'units_per_case', 'case_cost', 'unit_cost', 'notes',
    ]
    for (const f of editableFields) {
      if (form[f] !== (item as any)[f]) {
        let val = form[f]
        if (['units_per_case', 'case_cost', 'unit_cost'].includes(f)) {
          val = val === '' || val === null ? null : Number(val)
        }
        updates[f] = val
      }
    }
    if (Object.keys(updates).length === 0) {
      setEditing(false)
      setSaving(false)
      return
    }

    // Update catalog item
    const { error } = await supabase.from('item_catalog').update(updates).eq('id', id)
    if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }

    // Also propagate name/category/is_als changes to formulary_templates + unit_inventory
    // so old columns stay in sync during migration period
    const syncFields: Record<string, any> = {}
    if (updates.item_name) syncFields.item_name = updates.item_name
    if (updates.category) syncFields.category = updates.category
    if (updates.is_als !== undefined) syncFields.is_als = updates.is_als
    if (updates.ndc !== undefined) syncFields.ndc = updates.ndc
    if (updates.image_url !== undefined) syncFields.image_url = updates.image_url

    if (Object.keys(syncFields).length > 0) {
      await Promise.all([
        supabase.from('formulary_templates').update(syncFields).eq('catalog_item_id', id),
        supabase.from('unit_inventory').update(
          // unit_inventory only has item_name, category, is_als
          Object.fromEntries(
            Object.entries(syncFields).filter(([k]) => ['item_name', 'category', 'is_als'].includes(k))
          )
        ).eq('catalog_item_id', id),
      ])
    }

    setItem(prev => prev ? { ...prev, ...updates } : prev)
    setEditing(false)
    setSaving(false)
    toast.success('Saved — changes propagated to all templates & inventory')
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `catalog/${id}.${ext}`
    const { data, error } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(data.path)
    const publicUrl = urlData.publicUrl
    // Update catalog + propagate to templates
    await Promise.all([
      supabase.from('item_catalog').update({ image_url: publicUrl }).eq('id', id),
      supabase.from('formulary_templates').update({ image_url: publicUrl }).eq('catalog_item_id', id),
    ])
    setItem(prev => prev ? { ...prev, image_url: publicUrl } : prev)
    setForm(prev => ({ ...prev, image_url: publicUrl }))
    setUploading(false)
    toast.success('Photo uploaded')
  }

  const removePhoto = async () => {
    if (!id) return
    await Promise.all([
      supabase.from('item_catalog').update({ image_url: null }).eq('id', id),
      supabase.from('formulary_templates').update({ image_url: null }).eq('catalog_item_id', id),
    ])
    setItem(prev => prev ? { ...prev, image_url: null } : prev)
    setForm(prev => ({ ...prev, image_url: null }))
    toast.success('Photo removed')
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    // Delete formulary_templates that reference this catalog item
    await supabase.from('formulary_templates').delete().eq('catalog_item_id', id)
    // Delete unit_inventory that reference this catalog item
    await supabase.from('unit_inventory').delete().eq('catalog_item_id', id)
    // Delete the catalog item itself
    const { error } = await supabase.from('item_catalog').delete().eq('id', id)
    if (error) { toast.error('Delete failed: ' + error.message); setDeleting(false); return }
    toast.success('Item deleted from catalog, templates, and inventory')
    navigate('/catalog')
  }

  if (loading) return <div className="p-6"><LoadingSkeleton rows={8} /></div>
  if (!item) return <div className="p-6 text-gray-500">Item not found</div>

  const unitCost = item.unit_cost ?? (item.case_cost && item.units_per_case ? Number(item.case_cost) / Number(item.units_per_case) : null)

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* Back link */}
      <button onClick={() => navigate('/catalog')} className="text-xs text-gray-500 hover:text-white mb-3 flex items-center gap-1">
        ← Item Catalog
      </button>

      {/* Header with photo */}
      <div className="flex items-start gap-4 mb-6">
        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 flex items-center justify-center">
          {item.image_url ? (
            <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-gray-600 text-center">
              <span className="text-xs">No photo</span>
            </div>
          )}
          {isAdmin && (
            <div className="absolute bottom-0 left-0 right-0 flex">
              <button onClick={() => fileRef.current?.click()} className="flex-1 bg-black/60 text-white text-xs py-0.5 hover:bg-black/80">
                {uploading ? '...' : '📷'}
              </button>
              {item.image_url && (
                <button onClick={removePhoto} className="bg-black/60 text-red-400 text-xs py-0.5 px-1 hover:bg-black/80">✕</button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>{item.category}</span>
            {item.is_als && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">ALS</span>}
            <span className="text-xs font-mono text-gray-500">{item.sku}</span>
          </div>
          <h2 className="text-lg font-bold text-white truncate">{item.item_name}</h2>
          {item.concentration && <p className="text-xs text-gray-400">{item.concentration}</p>}
        </div>
      </div>

      {/* Unit Types that carry this item */}
      {unitTypes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Carried By</h3>
          <div className="flex flex-wrap gap-2">
            {unitTypes.map(ut => (
              <div key={ut.template_id} className="bg-gray-800 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-white font-medium">{ut.unit_type_name}</span>
                {ut.default_par_qty !== null && (
                  <span className="text-gray-500 ml-1">(par: {ut.default_par_qty})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail fields */}
      {!editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'SKU', value: item.sku },
              { label: 'Category', value: item.category },
              { label: 'NDC', value: item.ndc },
              { label: 'Barcode', value: item.barcode },
              { label: 'UPC', value: item.upc },
              { label: 'Concentration', value: item.concentration },
              { label: 'Route', value: item.route },
              { label: 'Unit of Measure', value: item.unit_of_measure },
              { label: 'Supplier', value: item.supplier },
              { label: 'Units/Case', value: item.units_per_case },
              { label: '$/Case', value: item.case_cost != null ? `$${Number(item.case_cost).toFixed(2)}` : null },
              { label: '$/Unit', value: unitCost != null ? `$${Number(unitCost).toFixed(2)}` : null },
            ].map(({ label, value }) => (
              <div key={label}>
                <span className="text-xs text-gray-500">{label}</span>
                <p className="text-sm text-white">{value || '—'}</p>
              </div>
            ))}
          </div>
          {item.notes && (
            <div>
              <span className="text-xs text-gray-500">Notes</span>
              <p className="text-sm text-white whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {isAdmin && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg"
              >
                ✏️ Edit Item
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm rounded-lg"
                >
                  🗑️ Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete item + all templates & inventory?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 bg-red-800 hover:bg-red-900 disabled:opacity-50 text-white text-xs rounded-lg"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Edit form */
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Item Name</label>
            <input className={inputCls} value={form.item_name || ''} onChange={e => set('item_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={form.category || ''} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>ALS Item</label>
              <select className={inputCls} value={form.is_als ? 'true' : 'false'} onChange={e => set('is_als', e.target.value === 'true')}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>NDC</label>
              <input className={inputCls} value={form.ndc || ''} onChange={e => set('ndc', e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>Barcode</label>
              <input className={inputCls} value={form.barcode || ''} onChange={e => set('barcode', e.target.value || null)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Concentration</label>
              <input className={inputCls} value={form.concentration || ''} onChange={e => set('concentration', e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>Route</label>
              <input className={inputCls} value={form.route || ''} onChange={e => set('route', e.target.value || null)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Unit of Measure</label>
              <input className={inputCls} value={form.unit_of_measure || ''} onChange={e => set('unit_of_measure', e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>Supplier</label>
              <input className={inputCls} value={form.supplier || ''} onChange={e => set('supplier', e.target.value || null)} />
            </div>
            <div>
              <label className={labelCls}>UPC</label>
              <input className={inputCls} value={form.upc || ''} onChange={e => set('upc', e.target.value || null)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Units/Case</label>
              <input type="number" className={inputCls} value={form.units_per_case ?? ''} onChange={e => set('units_per_case', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>$/Case</label>
              <input type="number" step="0.01" className={inputCls} value={form.case_cost ?? ''} onChange={e => set('case_cost', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>$/Unit</label>
              <input type="number" step="0.01" className={inputCls} value={form.unit_cost ?? ''} onChange={e => set('unit_cost', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value || null)} />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg"
            >
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setForm(item as any) }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
