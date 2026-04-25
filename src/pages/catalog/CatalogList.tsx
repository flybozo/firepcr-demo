import { usePermission } from '@/hooks/usePermission'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMatch, useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { PageHeader, LoadingSkeleton, EmptyState, SortableHeader } from '@/components/ui'
import { useSortable } from '@/hooks/useSortable'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

export type CatalogItem = {
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
  reimbursable: boolean
  unit_types?: string[]
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

const CATEGORIES = ['All', 'CS', 'Rx', 'OTC', 'DE', 'RE', 'Supply']

function nextSku(items: CatalogItem[], category: string): string {
  const prefix = category === 'Supply' ? 'SUP' : category.toUpperCase()
  const existing = items.filter(i => i.sku.startsWith(prefix + '-')).map(i => parseInt(i.sku.split('-')[1]) || 0)
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
  return `${prefix}-${String(next).padStart(4, '0')}`
}

function downloadCSV(data: CatalogItem[], filename: string) {
  const headers = ['sku','item_name','category','is_als','ndc','barcode','upc','concentration','route','unit_of_measure','supplier','units_per_case','case_cost','unit_cost','image_url','notes','unit_types']
  const rows = data.map(item => headers.map(h => {
    if (h === 'unit_types') return (item.unit_types || []).join('; ')
    const val = (item as any)[h]
    if (val === null || val === undefined) return ''
    const s = String(val)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

type EditField = 'supplier' | 'units_per_case' | 'case_cost' | 'unit_cost'
type EditTarget = { id: string; field: EditField } | null

type EditableCellProps = {
  item: CatalogItem
  field: EditField
  editCell: EditTarget
  editValue: string
  savingCell: EditTarget
  onStartEdit: (id: string, field: EditField, value: string) => void
  onChangeValue: (v: string) => void
  onSave: () => void
  onCancel: () => void
  inputType?: 'text' | 'number'
  align?: 'left' | 'right'
  width: string
  isCurrency?: boolean
}

function EditableCell({
  item, field, editCell, editValue, savingCell,
  onStartEdit, onChangeValue, onSave, onCancel,
  inputType = 'text', align = 'right', width, isCurrency = false,
}: EditableCellProps) {
  const isEditing = editCell?.id === item.id && editCell?.field === field
  const isSaving = savingCell?.id === item.id && savingCell?.field === field
  const rawVal = item[field]

  const displayVal = rawVal == null
    ? '—'
    : isCurrency
      ? `$${(rawVal as number).toFixed(2)}`
      : String(rawVal)

  return (
    <span
      className={`${width} hidden lg:block`}
      onClick={e => e.stopPropagation()}
    >
      {isEditing ? (
        <input
          autoFocus
          type={inputType}
          step={inputType === 'number' ? 'any' : undefined}
          min={inputType === 'number' ? '0' : undefined}
          value={editValue}
          onChange={e => onChangeValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); onSave() }
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={onSave}
          className={`w-full bg-gray-900 border border-red-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none ${align === 'right' ? 'text-right' : 'text-left'}`}
        />
      ) : (
        <span
          role="button"
          tabIndex={0}
          onClick={() => {
            const strVal = rawVal == null ? '' :
              isCurrency
                ? String(parseFloat((rawVal as number).toFixed(4)))
                : String(rawVal)
            onStartEdit(item.id, field, strVal)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              const strVal = rawVal == null ? '' :
                isCurrency
                  ? String(parseFloat((rawVal as number).toFixed(4)))
                  : String(rawVal)
              onStartEdit(item.id, field, strVal)
            }
          }}
          className={`block w-full ${isSaving ? 'opacity-40' : 'hover:bg-gray-700/50'} rounded px-1 py-0.5 cursor-pointer transition-colors`}
        >
          <span className={`text-xs block truncate ${align === 'right' ? 'text-right' : 'text-left'} ${rawVal == null ? 'text-gray-600' : isCurrency ? 'text-green-400 tabular-nums' : 'text-gray-300'}`}>
            {isSaving ? '…' : displayVal}
          </span>
        </span>
      )}
    </span>
  )
}

export default function CatalogList() {
  const supabase = createClient()
  const navigate = useNavigate()
  const isAdmin = usePermission('inventory.manage')
  const detailMatch = useMatch('/catalog/:id')
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [alsOnly, setAlsOnly] = useState(false)
  const [reimbursableOnly, setReimbursableOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ item_name: '', category: 'OTC', is_als: false })
  const [adding, setAdding] = useState(false)
  const [editCell, setEditCell] = useState<EditTarget>(null)
  const [editValue, setEditValue] = useState('')
  const [savingCell, setSavingCell] = useState<EditTarget>(null)
  const editCancelRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      const [catalogResult, templateResult] = await Promise.all([
        supabase
          .from('item_catalog')
          .select('*')
          .order('category')
          .order('item_name'),
        supabase
          .from('formulary_templates')
          .select('catalog_item_id, unit_type:unit_types(name)')
      ])

      if (catalogResult.error) {
        console.error('[Catalog] query error:', catalogResult.error)
        setLoading(false)
        return
      }

      const typeMap: Record<string, Set<string>> = {}
      ;(templateResult.data || []).forEach((t: any) => {
        if (!t.catalog_item_id) return
        if (!typeMap[t.catalog_item_id]) typeMap[t.catalog_item_id] = new Set()
        const name = t.unit_type?.name || (Array.isArray(t.unit_type) ? t.unit_type[0]?.name : null)
        if (name) typeMap[t.catalog_item_id].add(name)
      })

      const enriched = (catalogResult.data || []).map((item: any) => ({
        ...item,
        unit_types: Array.from(typeMap[item.id] || []).sort(),
      }))

      setItems(enriched)
      setLoading(false)
    }
    load()
  }, [])

  const handleAddItem = async () => {
    if (!addForm.item_name.trim()) { toast.error('Item name is required'); return }
    if (items.some(i => i.item_name.toLowerCase() === addForm.item_name.trim().toLowerCase())) {
      toast.error('An item with that name already exists'); return
    }
    setAdding(true)
    const sku = nextSku(items, addForm.category)
    const { data, error } = await supabase.from('item_catalog').insert({
      sku,
      item_name: addForm.item_name.trim(),
      category: addForm.category,
      is_als: addForm.is_als,
    }).select().single()
    if (error) { toast.error('Failed to add: ' + error.message); setAdding(false); return }
    const newItem = { ...data, unit_types: [] } as CatalogItem
    setItems(prev => [...prev, newItem].sort((a, b) => a.category.localeCompare(b.category) || a.item_name.localeCompare(b.item_name)))
    setShowAdd(false)
    setAddForm({ item_name: '', category: 'OTC', is_als: false })
    setAdding(false)
    toast.success(`Added ${data.item_name} (${sku})`)
    navigate(`/catalog/${data.id}`)
  }

  const startEdit = (id: string, field: EditField, value: string) => {
    setEditCell({ id, field })
    setEditValue(value)
  }

  const cancelEdit = () => {
    editCancelRef.current = true
    setEditCell(null)
  }

  const saveEdit = async () => {
    if (editCancelRef.current) {
      editCancelRef.current = false
      return
    }
    if (!editCell) return

    const { id, field } = editCell
    const currentValue = editValue
    setEditCell(null)

    const item = items.find(i => i.id === id)
    if (!item) return

    let parsed: string | number | null
    if (field === 'supplier') {
      parsed = currentValue.trim() || null
    } else {
      const n = parseFloat(currentValue)
      parsed = currentValue.trim() === '' ? null : isNaN(n) ? null : n
    }

    if (parsed === item[field as keyof CatalogItem]) return

    const updateData: Record<string, any> = { [field]: parsed }

    if (field === 'case_cost' || field === 'units_per_case') {
      const newCaseCost = field === 'case_cost' ? (parsed as number | null) : item.case_cost
      const newUnitsPer = field === 'units_per_case' ? (parsed as number | null) : item.units_per_case
      if (newCaseCost != null && newUnitsPer != null && newUnitsPer > 0) {
        updateData.unit_cost = Math.round(newCaseCost / newUnitsPer * 10000) / 10000
      }
    }

    setSavingCell({ id, field })
    const { error } = await supabase.from('item_catalog').update(updateData).eq('id', id)
    setSavingCell(null)

    if (error) {
      toast.error('Save failed: ' + error.message)
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updateData } : i))
      toast.success('Saved')
    }
  }

  type CatSortKey = 'item_name' | 'sku' | 'category' | 'supplier' | 'case_cost'
  const { sortKey: catSortKey, sortDir: catSortDir, toggleSort: catToggleSort, sortFn: catSortFn } = useSortable<CatSortKey>('item_name', 'asc')

  const filtered = useMemo(() => {
    const base = items.filter(item => {
      if (catFilter !== 'All' && item.category !== catFilter) return false
      if (alsOnly && !item.is_als) return false
      if (reimbursableOnly && !item.reimbursable) return false
      if (search) {
        const q = search.toLowerCase()
        return item.item_name.toLowerCase().includes(q)
          || item.sku.toLowerCase().includes(q)
          || (item.ndc || '').toLowerCase().includes(q)
      }
      return true
    })
    return catSortFn(base, (item, key) => {
      if (key === 'item_name') return item.item_name
      if (key === 'sku') return item.sku
      if (key === 'category') return item.category
      if (key === 'supplier') return item.supplier ?? ''
      if (key === 'case_cost') return item.case_cost ?? 0
      return ''
    })
  }, [items, catFilter, search, alsOnly, reimbursableOnly, catSortFn])

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Item Catalog"
        subtitle={`${filtered.length} of ${items.length} items`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => downloadCSV(filtered, `item-catalog-${new Date().toISOString().split('T')[0]}.csv`)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
            >
              📥 CSV
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg"
              >
                + Add Item
              </button>
            )}
          </div>
        }
      />

      {/* Add Item Form */}
      {showAdd && (
        <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
          <h3 className="text-sm font-bold text-white mb-3">New Catalog Item</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-400 mb-1">Item Name *</label>
              <input
                className="w-full bg-gray-900 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                value={addForm.item_name}
                onChange={e => setAddForm(prev => ({ ...prev, item_name: e.target.value }))}
                placeholder="e.g. Ondansetron 4mg Injection"
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select
                className="bg-gray-900 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                value={addForm.category}
                onChange={e => setAddForm(prev => ({ ...prev, category: e.target.value }))}
              >
                {['CS', 'Rx', 'OTC', 'Supply', 'DE', 'RE'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">ALS</label>
              <select
                className="bg-gray-900 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                value={addForm.is_als ? 'true' : 'false'}
                onChange={e => setAddForm(prev => ({ ...prev, is_als: e.target.value === 'true' }))}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <button
              onClick={handleAddItem}
              disabled={adding}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg"
            >
              {adding ? 'Adding...' : 'Create'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">SKU will be auto-generated. Edit all other fields in the detail view after creation.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, SKU, or NDC..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm text-white flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
              catFilter === cat
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setAlsOnly(!alsOnly)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
            alsOnly ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          ALS Only
        </button>
        <button
          onClick={() => setReimbursableOnly(!reimbursableOnly)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
            reimbursableOnly ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          💲 Reimb Only
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={10} header />
      ) : filtered.length === 0 ? (
        <EmptyState icon="📦" message="No catalog items found." />
      ) : (
        <div className={lc.container}>
          {/* Header */}
          <div className="flex items-center px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border-b theme-card-header">
            <SortableHeader label="SKU" sortKey="sku" currentKey={catSortKey} currentDir={catSortDir} onToggle={catToggleSort} className="w-20 font-mono" />
            <SortableHeader label="Item Name" sortKey="item_name" currentKey={catSortKey} currentDir={catSortDir} onToggle={catToggleSort} className="flex-1 min-w-0" />
            <SortableHeader label="Cat" sortKey="category" currentKey={catSortKey} currentDir={catSortDir} onToggle={catToggleSort} className="w-10 justify-center" />
            <span className="w-8 text-center hidden sm:block text-gray-500">ALS</span>
            <SortableHeader label="Supplier" sortKey="supplier" currentKey={catSortKey} currentDir={catSortDir} onToggle={catToggleSort} className="w-28 hidden lg:flex" />
            <SortableHeader label="$/Case" sortKey="case_cost" currentKey={catSortKey} currentDir={catSortDir} onToggle={catToggleSort} className="w-20 justify-end hidden lg:flex" />
            <span className="w-20 text-right hidden lg:block text-gray-500">Units/Case</span>
            <span className="w-20 text-right hidden lg:block text-gray-500">$/Unit</span>
          </div>

          {/* Rows */}
          <div>
            {filtered.map(item => (
              <div
                key={item.id}
                onClick={() => navigate(`/catalog/${item.id}`)}
                className={`flex items-center px-3 py-1.5 cursor-pointer ${lc.rowCls(detailMatch?.params?.id === item.id)}`}
              >
                <span className="w-20 text-xs font-mono text-gray-400 truncate">{item.sku}</span>
                <span className="flex-1 min-w-0 flex items-center gap-2">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                  )}
                  <span className="text-xs text-white truncate">{item.item_name}</span>
                </span>
                <span className="w-10 text-center">
                  <span className={`text-xs px-1 py-0.5 rounded ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>
                    {item.category}
                  </span>
                </span>
                <span className="w-8 text-center hidden sm:block">
                  {item.is_als && <span className="text-xs px-1 py-0.5 rounded bg-blue-900 text-blue-300">ALS</span>}
                  {item.reimbursable && <span className="text-xs px-1 py-0.5 rounded bg-green-900 text-green-300 ml-1">💲</span>}
                </span>
                <EditableCell
                  item={item} field="supplier"
                  editCell={editCell} editValue={editValue} savingCell={savingCell}
                  onStartEdit={startEdit} onChangeValue={setEditValue}
                  onSave={saveEdit} onCancel={cancelEdit}
                  inputType="text" align="left" width="w-28"
                />
                <EditableCell
                  item={item} field="case_cost"
                  editCell={editCell} editValue={editValue} savingCell={savingCell}
                  onStartEdit={startEdit} onChangeValue={setEditValue}
                  onSave={saveEdit} onCancel={cancelEdit}
                  inputType="number" align="right" width="w-20" isCurrency
                />
                <EditableCell
                  item={item} field="units_per_case"
                  editCell={editCell} editValue={editValue} savingCell={savingCell}
                  onStartEdit={startEdit} onChangeValue={setEditValue}
                  onSave={saveEdit} onCancel={cancelEdit}
                  inputType="number" align="right" width="w-20"
                />
                <EditableCell
                  item={item} field="unit_cost"
                  editCell={editCell} editValue={editValue} savingCell={savingCell}
                  onStartEdit={startEdit} onChangeValue={setEditValue}
                  onSave={saveEdit} onCancel={cancelEdit}
                  inputType="number" align="right" width="w-20" isCurrency
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 px-1">
        <span className="text-xs text-gray-500">{filtered.length} items</span>
      </div>
    </div>
  )
}
