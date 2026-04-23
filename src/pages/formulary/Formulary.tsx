import { usePermission, useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'

import { useEffect, useState } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton, ConfirmDialog } from '@/components/ui'
import { loadList } from '@/lib/offlineFirst'

type FormulaItem = {
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
  ndc: string | null
  concentration: string | null
  route: string | null
  catalog_item_id: string | null
  catalog_item: { sku: string }[] | { sku: string } | null
}

// PostgREST may return FK joins as array or object depending on cardinality detection
function skuOf(item: FormulaItem): string | null {
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

const TABS = ['Ambulance', 'Med Unit', 'REMS', 'Truck', 'Warehouse']

const SELECT_FIELDS = 'id, item_name, category, unit_of_measure, supplier, units_per_case, case_cost, unit_cost, image_url, barcode, ndc, concentration, route, catalog_item_id, catalog_item:item_catalog(sku)'

function FormularyPageInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const detailMatch = useMatch('/formulary/:id')
  const isAdmin = usePermission('admin.settings')
  const [activeTab, setActiveTab] = useState('Ambulance')
  const [items, setItems] = useState<FormulaItem[]>([])
  const [unitTypes, setUnitTypes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [catFilter, setCatFilter] = useState('All')
  const [alsFilter, setAlsFilter] = useState(false)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ item_name: '', category: 'OTC', unit_of_measure: '', supplier: '', units_per_case: '', case_cost: '' })
  const [editItem, setEditItem] = useState<Partial<FormulaItem>>({})

  // Inline unit_cost editing state
  const [editingUnitCostId, setEditingUnitCostId] = useState<string | null>(null)
  const [unitCostInput, setUnitCostInput] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: uts, error } = await supabase.from('unit_types').select('id, name')
        if (error) throw error
        const utMap: Record<string, string> = {}
        uts?.forEach(u => { utMap[u.name] = u.id })
        setUnitTypes(utMap)
      } catch {
        setIsOfflineData(true)
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!unitTypes[activeTab]) return
    setLoading(true)
    const load = async () => {
      // Show cached data only when offline
      if (!navigator.onLine) {
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cached = await getCachedData('formulary') as any[]
          if (cached.length > 0) {
            setItems(cached as FormulaItem[])
            setLoading(false)
            return
          }
        } catch {}
      }
      const { data, offline } = await loadList<FormulaItem>(
        () => supabase
          .from('formulary_templates')
          .select(SELECT_FIELDS)
          .eq('unit_type_id', unitTypes[activeTab])
          .order('category')
          .order('item_name'),
        'formulary'
      )
      setItems(data)
      setIsOfflineData(offline)
      setLoading(false)
    }
    load()
  }, [activeTab, unitTypes])

  const filtered = items.filter(i => {
    if (catFilter !== 'All' && i.category !== catFilter) return false
    if (alsFilter && !(i as any).is_als) return false
    if (search && !i.item_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleExportCSV = () => {
    const header = 'item_name,category,unit_of_measure,supplier,units_per_case,case_cost,unit_cost'
    const rows = items.map(i => [
      `"${i.item_name}"`,
      i.category,
      i.unit_of_measure || '',
      `"${i.supplier || ''}"`,
      i.units_per_case ?? '',
      i.case_cost ?? '',
      getUnitCost(i) ?? '',
    ].join(','))
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${activeTab}-formulary.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
    const nameIdx = headers.indexOf('item_name')
    const catIdx = headers.indexOf('category')
    const uomIdx = headers.indexOf('unit_of_measure')
    const supIdx = headers.indexOf('supplier')
    const upcIdx = headers.indexOf('units_per_case')
    const ccIdx = headers.indexOf('case_cost')
    if (nameIdx === -1 || catIdx === -1) { toast.warning('CSV must have item_name and category columns'); return }
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return {
        unit_type_id: unitTypes[activeTab],
        item_name: cols[nameIdx],
        category: cols[catIdx] || 'OTC',
        unit_of_measure: uomIdx >= 0 ? cols[uomIdx] || null : null,
        supplier: supIdx >= 0 ? cols[supIdx] || null : null,
        units_per_case: upcIdx >= 0 && cols[upcIdx] ? parseFloat(cols[upcIdx]) : null,
        case_cost: ccIdx >= 0 && cols[ccIdx] ? parseFloat(cols[ccIdx]) : null,
      }
    }).filter(r => r.item_name)
    setConfirmAction({
      action: async () => {
        const { error } = await supabase.from('formulary_templates').upsert(rows, { onConflict: 'unit_type_id,item_name' })
        if (error) { toast.error('Import error: ' + error.message); return }
        toast.success(`Imported ${rows.length} items successfully`)
        setLoading(true)
        const { data } = await supabase.from('formulary_templates')
          .select(SELECT_FIELDS)
          .eq('unit_type_id', unitTypes[activeTab]).order('category').order('item_name')
        setItems(data || []); setLoading(false)
        e.target.value = ''
      },
      title: 'Import Formulary Items',
      message: `Import ${rows.length} items into ${activeTab} formulary? Existing items will not be duplicated.`,
      icon: '⚠️',
    })
  }

  /** Returns the effective unit cost: explicit unit_cost if set, otherwise calculated */
  const getUnitCost = (item: FormulaItem): string | null => {
    if (item.unit_cost != null) return Number(item.unit_cost).toFixed(4)
    if (item.case_cost && item.units_per_case && item.units_per_case > 0)
      return (item.case_cost / item.units_per_case).toFixed(4)
    return null
  }

  const handleAdd = async () => {
    if (!newItem.item_name) return
    await supabase.from('formulary_templates').insert({
      unit_type_id: unitTypes[activeTab],
      item_name: newItem.item_name,
      category: newItem.category,
      unit_of_measure: newItem.unit_of_measure || null,
      supplier: newItem.supplier || null,
      units_per_case: newItem.units_per_case ? parseFloat(newItem.units_per_case) : null,
      case_cost: newItem.case_cost ? parseFloat(newItem.case_cost) : null,
    })
    setNewItem({ item_name: '', category: 'OTC', unit_of_measure: '', supplier: '', units_per_case: '', case_cost: '' })
    setShowAdd(false)
    setLoading(true)
    const { data } = await supabase.from('formulary_templates')
      .select(SELECT_FIELDS)
      .eq('unit_type_id', unitTypes[activeTab]).order('category').order('item_name')
    setItems(data || [])
    setLoading(false)
  }

  const handleDelete = (id: string) => {
    setConfirmAction({
      action: async () => {
        await supabase.from('formulary_templates').delete().eq('id', id)
        setItems(prev => prev.filter(i => i.id !== id))
      },
      title: 'Remove Item',
      message: 'Remove this item from the formulary?',
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  const handleEditSave = async (id: string) => {
    await supabase.from('formulary_templates').update(editItem).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...editItem } : i))
    setEditingId(null)
    setEditItem({})
  }

  const handleUnitCostSave = async (item: FormulaItem) => {
    const value = unitCostInput.trim() === '' ? null : parseFloat(unitCostInput)
    if (value !== null && isNaN(value)) { setEditingUnitCostId(null); return }
    await supabase.from('formulary_templates').update({ unit_cost: value }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, unit_cost: value } : i))
    setEditingUnitCostId(null)
  }

  const inputCls = 'bg-gray-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-full'

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mt-8 md:mt-0 mb-6">
        <h1 className="text-2xl font-bold">Formulary Templates</h1>
        <p className="text-gray-400 text-sm mt-1">Canonical item list per unit type. Supplier and cost data visible here only.</p>
      </div>

      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-4 flex items-center gap-2">
          📶 Formulary templates require a connection to load. Reconnect to view.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setCatFilter('All'); setSearch('') }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {tab}
            {!loading && activeTab === tab && <span className="ml-2 text-xs opacity-60">{items.length}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 flex-1 min-w-48" />
        {['All', 'CS', 'Rx', 'OTC', 'DE', 'RE'].map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${catFilter === c ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {c} {c !== 'All' && !loading ? `(${items.filter(i => i.category === c).length})` : ''}
          </button>
        ))}
        <button onClick={() => setAlsFilter(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${alsFilter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
          ALS Only
        </button>
        <div className="ml-auto flex gap-1.5">
          <button onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white">
            ⬇ Export CSV
          </button>
          {/* Edit actions — admin only, not for Warehouse (auto-populated from others) */}
          {isAdmin && activeTab !== 'Warehouse' && (
            <>
              <label className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white cursor-pointer">
                ⬆ Import CSV
                <input type="file" accept=".csv,.xlsx,.numbers" className="hidden" onChange={handleImportCSV} />
              </label>
              <button onClick={() => setShowAdd(v => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white">
                {showAdd ? '✕ Cancel' : '+ Add Item'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Item Form */}
      {showAdd && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-3">
            <label className="text-xs text-gray-400">Item Name *</label>
            <input value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))} className={inputCls + ' text-sm mt-1'} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Category</label>
            <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))} className={inputCls + ' mt-1'}>
              <option>OTC</option><option>Rx</option><option>CS</option><option>DE</option><option>RE</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Unit of Measure</label>
            <input value={newItem.unit_of_measure} onChange={e => setNewItem(p => ({ ...p, unit_of_measure: e.target.value }))} placeholder="e.g. mg, mL, each" className={inputCls + ' mt-1'} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Supplier</label>
            <input value={newItem.supplier} onChange={e => setNewItem(p => ({ ...p, supplier: e.target.value }))} className={inputCls + ' mt-1'} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Units/Case</label>
            <input type="number" value={newItem.units_per_case} onChange={e => setNewItem(p => ({ ...p, units_per_case: e.target.value }))} className={inputCls + ' mt-1'} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Cost/Case ($)</label>
            <input type="number" step="0.01" value={newItem.case_cost} onChange={e => setNewItem(p => ({ ...p, case_cost: e.target.value }))} className={inputCls + ' mt-1'} />
          </div>
          <div className="flex items-end">
            <button onClick={handleAdd} className="w-full py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition-colors">Add</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={8} header />
      ) : (
        <div className="theme-card rounded-xl border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700">
            <span className="col-span-4">Item</span>
            <span className="col-span-1">Cat</span>
            <span className="col-span-1 hidden lg:block text-gray-600">SKU</span>
            <span className="col-span-2 hidden md:block">Supplier</span>
            <span className="col-span-1 text-right hidden md:block">Qty/Case</span>
            <span className="col-span-1 text-right hidden md:block">$/Case</span>
            <span className="col-span-1 text-right hidden md:block">$/Unit</span>
            <span className="col-span-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-800">
            {filtered.map(item => (
              <div key={item.id}>
                {editingId === item.id ? (
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800 items-center">
                    <div className="col-span-4">
                      <input defaultValue={item.item_name}
                        onChange={e => setEditItem(p => ({ ...p, item_name: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div className="col-span-1">
                      <select defaultValue={item.category}
                        onChange={e => setEditItem(p => ({ ...p, category: e.target.value }))}
                        className={inputCls}>
                        <option>OTC</option><option>Rx</option><option>CS</option><option>DE</option><option>RE</option>
                      </select>
                    </div>
                    <div className="col-span-2 hidden md:block">
                      <input defaultValue={item.supplier || ''}
                        onChange={e => setEditItem(p => ({ ...p, supplier: e.target.value }))}
                        className={inputCls} placeholder="Supplier" />
                    </div>
                    <div className="col-span-1 hidden md:block">
                      <input type="number" defaultValue={item.units_per_case || ''}
                        onChange={e => setEditItem(p => ({ ...p, units_per_case: e.target.value ? parseFloat(e.target.value) : null }))}
                        className={inputCls} />
                    </div>
                    <div className="col-span-1 hidden md:block">
                      <input type="number" step="0.01" defaultValue={item.case_cost || ''}
                        onChange={e => setEditItem(p => ({ ...p, case_cost: e.target.value ? parseFloat(e.target.value) : null }))}
                        className={inputCls} />
                    </div>
                    <div className="col-span-1 hidden md:block">
                      <input type="number" step="0.0001" defaultValue={item.unit_cost ?? ''}
                        placeholder="auto"
                        onChange={e => setEditItem(p => ({ ...p, unit_cost: e.target.value ? parseFloat(e.target.value) : null }))}
                        className={inputCls} title="Unit Cost (leave blank to auto-calculate)" />
                    </div>
                    {/* Barcode field — shown as extra row below main grid in edit mode */}
                    <div className="col-span-12 hidden md:grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <label className="text-xs text-gray-500">Barcode</label>
                        <input defaultValue={item.barcode || ''}
                          onChange={e => setEditItem(p => ({ ...p, barcode: e.target.value || null }))}
                          className={inputCls + ' mt-0.5'} placeholder="Barcode" />
                      </div>
                    </div>
                    <div className="col-span-12 flex gap-1 justify-end mt-1">
                      <button onClick={() => handleEditSave(item.id)} className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs text-white">Save</button>
                      <button onClick={() => { setEditingId(null); setEditItem({}) }} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => navigate(`/formulary/${item.id}`)}
                    className={`grid grid-cols-12 px-4 py-2.5 items-center text-sm cursor-pointer transition-colors ${
                      detailMatch?.params?.id === item.id ? 'bg-gray-700' : 'hover:bg-gray-800/50'
                    }`}>
                    <div className="col-span-4 flex items-center gap-2">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-gray-800" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-800 shrink-0 flex items-center justify-center text-gray-600 text-xs">📷</div>
                      )}
                      <div className="min-w-0">
                        <button onClick={() => navigate(`/formulary/${item.id}`)} className="text-white hover:text-red-400 text-left transition-colors truncate block">{item.item_name}</button>
                        {item.unit_of_measure && <span className="text-gray-500 text-xs">({item.unit_of_measure})</span>}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <select
                        value={item.category}
                        onChange={async (e) => {
                          const newCat = e.target.value
                          await supabase.from('formulary_templates').update({ category: newCat }).eq('id', item.id)
                          setItems(prev => prev.map(i => i.id === item.id ? { ...i, category: newCat } : i))
                        }}
                        className={`text-xs px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${CAT_COLORS[item.category] || CAT_COLORS.OTC} bg-transparent`}
                        style={{ appearance: 'none', WebkitAppearance: 'none' }}
                        title="Click to change category"
                      >
                        {['CS', 'Rx', 'OTC', 'DE', 'RE'].map(c => (
                          <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 hidden lg:block text-xs text-gray-600 font-mono truncate">{skuOf(item) || '—'}</div>
                    <div className="col-span-2 hidden md:block text-xs text-gray-400 truncate">{item.supplier || '—'}</div>
                    <div className="col-span-1 hidden md:block text-right text-xs text-gray-400">{item.units_per_case ?? '—'}</div>
                    <div className="col-span-1 hidden md:block text-right text-xs text-gray-400">{item.case_cost ? `$${item.case_cost.toFixed(2)}` : '—'}</div>
                    {/* $/Unit — inline editable */}
                    <div className="col-span-1 hidden md:block text-right">
                      {editingUnitCostId === item.id ? (
                        <input
                          type="number"
                          step="0.0001"
                          autoFocus
                          value={unitCostInput}
                          onChange={e => setUnitCostInput(e.target.value)}
                          onBlur={() => handleUnitCostSave(item)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleUnitCostSave(item)
                            if (e.key === 'Escape') setEditingUnitCostId(null)
                          }}
                          className="bg-gray-700 rounded px-1 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-20 text-right"
                          placeholder="0.0000"
                        />
                      ) : (
                        <span
                          className="text-xs text-gray-300 font-mono cursor-pointer hover:text-white hover:underline"
                          title="Click to set unit cost"
                          onClick={() => {
                            setEditingUnitCostId(item.id)
                            setUnitCostInput(item.unit_cost != null ? String(item.unit_cost) : '')
                          }}
                        >
                          {getUnitCost(item) ? `$${getUnitCost(item)}` : <span className="text-gray-600">—</span>}
                          {item.unit_cost != null && <span className="ml-0.5 text-blue-500 text-xs" title="Custom unit cost set">●</span>}
                        </span>
                      )}
                    </div>
                    <div className="col-span-1 flex gap-1 justify-end">
                      {isAdmin && activeTab !== 'Warehouse' && (
                        <>
                          <button onClick={() => { setEditingId(item.id); setEditItem({}) }} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300">Edit</button>
                          <button onClick={() => handleDelete(item.id)} className="px-2 py-1 bg-red-900/50 hover:bg-red-900 rounded text-xs text-red-300">Del</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-gray-600 py-8 text-sm">No items found.</p>
            )}
          </div>

          {/* Footer total */}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700 flex justify-between text-xs text-gray-500">
              <span>{filtered.length} items shown</span>
              {filtered.some(i => i.case_cost || i.unit_cost) && (
                <span>Total catalog cost: $
                  {filtered.reduce((sum, i) => {
                    const uc = i.unit_cost != null
                      ? Number(i.unit_cost)
                      : (i.case_cost && i.units_per_case ? i.case_cost / i.units_per_case : 0)
                    return sum + uc
                  }, 0).toFixed(2)} / unit avg
                </span>
              )}
            </div>
          )}
        </div>
      )}
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

function FormularyPermissionGuard({ children }: { children: React.ReactNode }) {
  const loading = usePermissionLoading()
  const hasAccess = useAnyPermission('inventory.manage', 'inventory.view', 'inventory.*', 'admin.settings')
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">You don't have permission to view formulary templates.</p>
      </div>
    )
  }
  return <>{children}</>
}

export default function FormularyPageWrapped() {
  return (
    <FormularyPermissionGuard>
      <FormularyPageInner />
    </FormularyPermissionGuard>
  )
}
