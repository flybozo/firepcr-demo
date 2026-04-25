import { usePermission, useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'

import { useEffect, useState } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton, ConfirmDialog } from '@/components/ui'
import { loadList } from '@/lib/offlineFirst'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type CatalogSnap = {
  sku: string | null
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
  is_als: boolean | null
}

type FormulaItem = {
  id: string
  item_name: string
  default_par_qty: number | null
  notes: string | null
  catalog_item_id: string | null
  catalog_item: CatalogSnap | CatalogSnap[] | null
}

function catalogOf(item: FormulaItem): CatalogSnap | null {
  const ci = item.catalog_item
  if (!ci) return null
  if (Array.isArray(ci)) return ci[0] || null
  return ci
}

function skuOf(item: FormulaItem): string | null {
  return catalogOf(item)?.sku || null
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

const TABS = ['Ambulance', 'Med Unit', 'REMS', 'Truck', 'Warehouse']

const SELECT_FIELDS = 'id, item_name, default_par_qty, notes, catalog_item_id, catalog_item:item_catalog(sku, category, unit_of_measure, supplier, units_per_case, case_cost, unit_cost, image_url, barcode, ndc, concentration, route, is_als)'

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
  const [newItem, setNewItem] = useState({ item_name: '', default_par_qty: '' })
  const [editItem, setEditItem] = useState<Partial<Record<string, any>>>({})

  // Inline unit_cost editing state
  const [editingUnitCostId, setEditingUnitCostId] = useState<string | null>(null)
  const [unitCostInput, setUnitCostInput] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)

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
    const ci = catalogOf(i)
    if (catFilter !== 'All' && ci?.category !== catFilter) return false
    if (alsFilter && !ci?.is_als) return false
    if (search && !i.item_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleExportCSV = () => {
    const header = 'item_name,category,unit_of_measure,supplier,units_per_case,case_cost,unit_cost'
    const rows = items.map(i => {
      const ci = catalogOf(i)
      return [
        `"${i.item_name}"`,
        ci?.category || '',
        ci?.unit_of_measure || '',
        `"${ci?.supplier || ''}"`,
        ci?.units_per_case ?? '',
        ci?.case_cost ?? '',
        getUnitCost(i) ?? '',
      ].join(',')
    })
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
    if (nameIdx === -1) { toast.warning('CSV must have an item_name column'); return }
    const rows = lines.slice(1).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return {
        unit_type_id: unitTypes[activeTab],
        item_name: cols[nameIdx],
        // category is not on formulary_templates; set via item_catalog
        ...(catIdx >= 0 && cols[catIdx] ? {} : {}),
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
          .eq('unit_type_id', unitTypes[activeTab]).order('item_name')
        setItems(data || []); setLoading(false)
        e.target.value = ''
      },
      title: 'Import Formulary Items',
      message: `Import ${rows.length} items into ${activeTab} formulary? Existing items will not be duplicated.`,
      icon: '⚠️',
    })
  }

  const getUnitCost = (item: FormulaItem): string | null => {
    const ci = catalogOf(item)
    if (!ci) return null
    if (ci.unit_cost != null) return Number(ci.unit_cost).toFixed(4)
    if (ci.case_cost && ci.units_per_case && ci.units_per_case > 0)
      return (ci.case_cost / ci.units_per_case).toFixed(4)
    return null
  }

  const handleAdd = async () => {
    if (!newItem.item_name) return
    await supabase.from('formulary_templates').insert({
      unit_type_id: unitTypes[activeTab],
      item_name: newItem.item_name,
      default_par_qty: newItem.default_par_qty ? parseFloat(newItem.default_par_qty) : null,
    })
    setNewItem({ item_name: '', default_par_qty: '' })
    setShowAdd(false)
    setLoading(true)
    const { data } = await supabase.from('formulary_templates')
      .select(SELECT_FIELDS)
      .eq('unit_type_id', unitTypes[activeTab]).order('item_name')
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
    const item = items.find(i => i.id === id)
    const { item_name, ...catalogFields } = editItem as any
    const catalogUpdates = Object.fromEntries(
      Object.entries(catalogFields).filter(([, v]) => v !== undefined)
    )

    if (item_name !== undefined) {
      await supabase.from('formulary_templates').update({ item_name }).eq('id', id)
    }
    if (Object.keys(catalogUpdates).length > 0 && item?.catalog_item_id) {
      await supabase.from('item_catalog').update(catalogUpdates).eq('id', item.catalog_item_id)
    }

    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const ci = catalogOf(i)
      const updatedCi = ci ? { ...ci, ...catalogUpdates } : null
      return {
        ...i,
        item_name: item_name !== undefined ? item_name : i.item_name,
        catalog_item: updatedCi,
      }
    }))
    setEditingId(null)
    setEditItem({})
  }

  const handleUnitCostSave = async (item: FormulaItem) => {
    const value = unitCostInput.trim() === '' ? null : parseFloat(unitCostInput)
    if (value !== null && isNaN(value)) { setEditingUnitCostId(null); return }
    if (item.catalog_item_id) {
      await supabase.from('item_catalog').update({ unit_cost: value }).eq('id', item.catalog_item_id)
    }
    setItems(prev => prev.map(i => {
      if (i.id !== item.id) return i
      const ci = catalogOf(i)
      return { ...i, catalog_item: ci ? { ...ci, unit_cost: value } : i.catalog_item }
    }))
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
            {c} {c !== 'All' && !loading ? `(${items.filter(i => catalogOf(i)?.category === c).length})` : ''}
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
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400">Item Name *</label>
            <input value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))} className={inputCls + ' text-sm mt-1'} />
          </div>
          <div>
            <label className="text-xs text-gray-400">Default Par Qty</label>
            <input type="number" value={newItem.default_par_qty} onChange={e => setNewItem(p => ({ ...p, default_par_qty: e.target.value }))} className={inputCls + ' mt-1'} />
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
        <div className={lc.container}>
          {/* Header */}
          <div className={`grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${lc.header}`}>
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
          <div>
            {filtered.map(item => {
              const ci = catalogOf(item)
              return (
                <div key={item.id}>
                  {editingId === item.id ? (
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800 items-center">
                      <div className="col-span-4">
                        <input defaultValue={item.item_name}
                          onChange={e => setEditItem(p => ({ ...p, item_name: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-1">
                        <select defaultValue={ci?.category || 'OTC'}
                          onChange={e => setEditItem(p => ({ ...p, category: e.target.value }))}
                          className={inputCls}>
                          <option>OTC</option><option>Rx</option><option>CS</option><option>DE</option><option>RE</option>
                        </select>
                      </div>
                      <div className="col-span-2 hidden md:block">
                        <input defaultValue={ci?.supplier || ''}
                          onChange={e => setEditItem(p => ({ ...p, supplier: e.target.value }))}
                          className={inputCls} placeholder="Supplier" />
                      </div>
                      <div className="col-span-1 hidden md:block">
                        <input type="number" defaultValue={ci?.units_per_case || ''}
                          onChange={e => setEditItem(p => ({ ...p, units_per_case: e.target.value ? parseFloat(e.target.value) : null }))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-1 hidden md:block">
                        <input type="number" step="0.01" defaultValue={ci?.case_cost || ''}
                          onChange={e => setEditItem(p => ({ ...p, case_cost: e.target.value ? parseFloat(e.target.value) : null }))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-1 hidden md:block">
                        <input type="number" step="0.0001" defaultValue={ci?.unit_cost ?? ''}
                          placeholder="auto"
                          onChange={e => setEditItem(p => ({ ...p, unit_cost: e.target.value ? parseFloat(e.target.value) : null }))}
                          className={inputCls} title="Unit Cost (leave blank to auto-calculate)" />
                      </div>
                      {/* Barcode field — shown as extra row below main grid in edit mode */}
                      <div className="col-span-12 hidden md:grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <label className="text-xs text-gray-500">Barcode</label>
                          <input defaultValue={ci?.barcode || ''}
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
                      className={`grid grid-cols-12 px-4 py-2.5 items-center text-sm cursor-pointer ${lc.rowCls(detailMatch?.params?.id === item.id)}`}>
                      <div className="col-span-4 flex items-center gap-2">
                        {ci?.image_url ? (
                          <img src={ci.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-gray-800" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-800 shrink-0 flex items-center justify-center text-gray-600 text-xs">📷</div>
                        )}
                        <div className="min-w-0">
                          <button onClick={() => navigate(`/formulary/${item.id}`)} className="text-white hover:text-red-400 text-left transition-colors truncate block">{item.item_name}</button>
                          {ci?.unit_of_measure && <span className="text-gray-500 text-xs">({ci.unit_of_measure})</span>}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <select
                          value={ci?.category || ''}
                          onChange={async (e) => {
                            e.stopPropagation()
                            const newCat = e.target.value
                            if (item.catalog_item_id) {
                              await supabase.from('item_catalog').update({ category: newCat }).eq('id', item.catalog_item_id)
                            }
                            setItems(prev => prev.map(i => {
                              if (i.id !== item.id) return i
                              const c = catalogOf(i)
                              return { ...i, catalog_item: c ? { ...c, category: newCat } : i.catalog_item }
                            }))
                          }}
                          className={`text-xs px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${CAT_COLORS[ci?.category || ''] || CAT_COLORS.OTC} bg-transparent`}
                          style={{ appearance: 'none', WebkitAppearance: 'none' }}
                          title="Click to change category"
                        >
                          {['CS', 'Rx', 'OTC', 'DE', 'RE'].map(c => (
                            <option key={c} value={c} className="bg-gray-900 text-white">{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1 hidden lg:block text-xs text-gray-600 font-mono truncate">{skuOf(item) || '—'}</div>
                      <div className="col-span-2 hidden md:block text-xs text-gray-400 truncate">{ci?.supplier || '—'}</div>
                      <div className="col-span-1 hidden md:block text-right text-xs text-gray-400">{ci?.units_per_case ?? '—'}</div>
                      <div className="col-span-1 hidden md:block text-right text-xs text-gray-400">{ci?.case_cost ? `$${ci.case_cost.toFixed(2)}` : '—'}</div>
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingUnitCostId(item.id)
                              setUnitCostInput(ci?.unit_cost != null ? String(ci.unit_cost) : '')
                            }}
                          >
                            {getUnitCost(item) ? `$${getUnitCost(item)}` : <span className="text-gray-600">—</span>}
                            {ci?.unit_cost != null && <span className="ml-0.5 text-blue-500 text-xs" title="Custom unit cost set">●</span>}
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 flex gap-1 justify-end">
                        {isAdmin && activeTab !== 'Warehouse' && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditItem({}) }} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300">Edit</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }} className="px-2 py-1 bg-red-900/50 hover:bg-red-900 rounded text-xs text-red-300">Del</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-600 py-8 text-sm">No items found.</p>
            )}
          </div>

          {/* Footer total */}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700 flex justify-between text-xs text-gray-500">
              <span>{filtered.length} items shown</span>
              {filtered.some(i => catalogOf(i)?.case_cost || catalogOf(i)?.unit_cost) && (
                <span>Total catalog cost: $
                  {filtered.reduce((sum, i) => {
                    const ci = catalogOf(i)
                    const uc = ci?.unit_cost != null
                      ? Number(ci.unit_cost)
                      : (ci?.case_cost && ci?.units_per_case ? ci.case_cost / ci.units_per_case : 0)
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
