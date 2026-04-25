import { usePermission } from '@/hooks/usePermission'
import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { CatalogItemPanel } from '@/components/inventory/CatalogItemPanel'
import type { CatalogItem } from '@/components/inventory/CatalogItemPanel'

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'
const CATEGORIES = ['CS', 'Rx', 'OTC', 'Supply', 'DE', 'RE']

export default function CatalogDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const supabase = createClient()
  const isAdmin = usePermission('inventory.manage')
  const fileRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState<Record<string, any>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  // Store item ref for edit form initialization
  const [currentItem, setCurrentItem] = useState<CatalogItem | null>(null)

  const set = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!id || !currentItem) return
    setSaving(true)
    const updates: Record<string, any> = {}
    const editableFields = [
      'item_name', 'category', 'is_als', 'reimbursable', 'ndc', 'barcode', 'upc', 'manufacturer_sku',
      'concentration', 'route', 'unit_of_measure', 'supplier',
      'units_per_case', 'case_cost', 'unit_cost', 'notes',
    ]
    for (const f of editableFields) {
      if (form[f] !== (currentItem as any)[f]) {
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

    const { error } = await supabase.from('item_catalog').update(updates).eq('id', id)
    if (error) { toast.error('Save failed: ' + error.message); setSaving(false); return }

    // Propagate name/category/is_als changes to formulary_templates + unit_inventory
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
          Object.fromEntries(
            Object.entries(syncFields).filter(([k]) => ['item_name', 'category', 'is_als'].includes(k))
          )
        ).eq('catalog_item_id', id),
      ])
    }

    setCurrentItem(prev => prev ? { ...prev, ...updates } : prev)
    setEditing(false)
    setSaving(false)
    setRefreshKey(k => k + 1)
    toast.success('Saved — changes propagated to all templates & inventory')
  }

  const handlePhotoUpload = async (file: File) => {
    if (!id) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `catalog/${id}.${ext}`
    const { data, error } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); return }
    const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(data.path)
    const publicUrl = urlData.publicUrl
    await Promise.all([
      supabase.from('item_catalog').update({ image_url: publicUrl }).eq('id', id),
      supabase.from('formulary_templates').update({ image_url: publicUrl }).eq('catalog_item_id', id),
    ])
    toast.success('Photo uploaded')
  }

  const handlePhotoRemove = async () => {
    if (!id) return
    await Promise.all([
      supabase.from('item_catalog').update({ image_url: null }).eq('id', id),
      supabase.from('formulary_templates').update({ image_url: null }).eq('catalog_item_id', id),
    ])
    toast.success('Photo removed')
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    await supabase.from('formulary_templates').delete().eq('catalog_item_id', id)
    await supabase.from('unit_inventory').delete().eq('catalog_item_id', id)
    const { error } = await supabase.from('item_catalog').delete().eq('id', id)
    if (error) { toast.error('Delete failed: ' + error.message); setDeleting(false); return }
    toast.success('Item deleted from catalog, templates, and inventory')
    navigate('/catalog')
  }

  if (!id) return <div className="p-6 text-gray-500">No item selected</div>

  // Edit mode — full form
  if (editing) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
        <button onClick={() => navigate('/catalog')} className="text-gray-500 hover:text-white text-sm mb-4">← Item Catalog</button>
        <h1 className="text-xl font-bold text-white mb-4">Edit Item</h1>
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
            <div>
              <label className={labelCls}>Reimbursable (USDA Contract)</label>
              <select className={inputCls} value={form.reimbursable ? 'true' : 'false'} onChange={e => set('reimbursable', e.target.value === 'true')}>
                <option value="false">No</option>
                <option value="true">Yes — 💲 Reimbursable</option>
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
            <div>
              <label className={labelCls}>Manufacturer SKU</label>
              <input className={inputCls} value={form.manufacturer_sku || ''} onChange={e => set('manufacturer_sku', e.target.value || null)} placeholder="Mfr product/catalog #" />
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
              onClick={() => { setEditing(false); setForm(currentItem as any || {}) }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Read mode — use shared CatalogItemPanel
  return (
    <CatalogItemPanel
      catalogItemId={id}
      refreshKey={refreshKey}
      showPhotoActions={isAdmin}
      onPhotoUpload={handlePhotoUpload}
      onPhotoRemove={handlePhotoRemove}
      showCatalogLink={false}
      contextCard={(item) => {
        // Store item ref for edit initialization
        if (!currentItem || currentItem.id !== item.id || currentItem.sku !== item.sku) {
          // Use setTimeout to avoid setState during render
          setTimeout(() => {
            setCurrentItem(item)
            setForm(item as any)
          }, 0)
        }
        return isAdmin ? (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setCurrentItem(item); setForm(item as any); setEditing(true) }}
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
        ) : null
      }}
    />
  )
}
