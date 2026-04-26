import { usePermission, useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton, ConfirmDialog } from '@/components/ui'
import { loadList } from '@/lib/offlineFirst'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type CatalogSnap = {
  category: string
  unit_of_measure: string | null
  image_url: string | null
  concentration: string | null
  route: string | null
  is_als: boolean | null
  reimbursable: boolean | null
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

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

const TABS = ['Ambulance', 'Med Unit', 'REMS', 'Truck', 'Warehouse']

const SELECT_FIELDS = 'id, item_name, default_par_qty, notes, catalog_item_id, catalog_item:item_catalog(category, unit_of_measure, image_url, concentration, route, is_als, reimbursable)'

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
  const [newItem, setNewItem] = useState({ catalog_item_id: '', item_name: '', default_par_qty: '' })
  const [catalogItems, setCatalogItems] = useState<{ id: string; name: string; category: string }[]>([])
  const [catalogSearch, setCatalogSearch] = useState('')
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false)

  // Inline par qty editing
  const [editingParId, setEditingParId] = useState<string | null>(null)
  const [parInput, setParInput] = useState('')

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

  // Load catalog items when add form opens
  useEffect(() => {
    if (!showAdd || catalogItems.length > 0) return
    const loadCatalog = async () => {
      const { data } = await supabase.from('item_catalog').select('id, name, category').order('name')
      setCatalogItems((data || []) as { id: string; name: string; category: string }[])
    }
    loadCatalog()
  }, [showAdd])

  // Filter catalog items: exclude items already on this template + match search
  const existingCatalogIds = new Set(items.map(i => i.catalog_item_id).filter(Boolean))
  const filteredCatalog = catalogItems
    .filter(ci => !existingCatalogIds.has(ci.id))
    .filter(ci => !catalogSearch || ci.name.toLowerCase().includes(catalogSearch.toLowerCase()) || ci.category.toLowerCase().includes(catalogSearch.toLowerCase()))
    .slice(0, 50)

  const handleAdd = async () => {
    if (!newItem.catalog_item_id || !newItem.item_name) return
    await supabase.from('formulary_templates').insert({
      unit_type_id: unitTypes[activeTab],
      item_name: newItem.item_name,
      catalog_item_id: newItem.catalog_item_id,
      default_par_qty: newItem.default_par_qty ? parseFloat(newItem.default_par_qty) : null,
    })
    setNewItem({ catalog_item_id: '', item_name: '', default_par_qty: '' })
    setCatalogSearch('')
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

  const handleParSave = async (item: FormulaItem) => {
    const value = parInput.trim() === '' ? null : parseFloat(parInput)
    if (value !== null && isNaN(value)) { setEditingParId(null); return }
    await supabase.from('formulary_templates').update({ default_par_qty: value }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, default_par_qty: value } : i))
    setEditingParId(null)
    toast.success('Par updated')
  }

  const inputCls = 'bg-gray-800 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-full'

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mt-8 md:mt-0 mb-6">
        <h1 className="text-2xl font-bold">Formulary Templates</h1>
        <p className="text-gray-400 text-sm mt-1">Items carried per unit type with par levels. Item details managed in <button onClick={() => navigate('/catalog')} className="text-red-400 hover:text-red-300 underline">Item Catalog</button>.</p>
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
        {isAdmin && activeTab !== 'Warehouse' && (
          <div className="ml-auto">
            <button onClick={() => setShowAdd(v => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white">
              {showAdd ? '✕ Cancel' : '+ Add Item'}
            </button>
          </div>
        )}
      </div>

      {/* Add Item Form — catalog-linked dropdown */}
      {showAdd && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 mb-4 space-y-3">
          <div className="relative">
            <label className="text-xs text-gray-400">Select Item from Catalog *</label>
            <input
              value={newItem.catalog_item_id ? newItem.item_name : catalogSearch}
              onChange={e => {
                setCatalogSearch(e.target.value)
                setShowCatalogDropdown(true)
                if (newItem.catalog_item_id) setNewItem({ catalog_item_id: '', item_name: '', default_par_qty: newItem.default_par_qty })
              }}
              onFocus={() => setShowCatalogDropdown(true)}
              placeholder="Search catalog items..."
              className={inputCls + ' text-sm mt-1'}
            />
            {newItem.catalog_item_id && (
              <button
                onClick={() => { setNewItem({ catalog_item_id: '', item_name: '', default_par_qty: newItem.default_par_qty }); setCatalogSearch('') }}
                className="absolute right-2 top-7 text-gray-500 hover:text-white text-sm"
              >✕</button>
            )}
            {showCatalogDropdown && !newItem.catalog_item_id && (
              <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
                {filteredCatalog.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500">{catalogSearch ? 'No matching items' : 'Type to search...'}</p>
                ) : (
                  filteredCatalog.map(ci => (
                    <button
                      key={ci.id}
                      onClick={() => {
                        setNewItem(p => ({ ...p, catalog_item_id: ci.id, item_name: ci.name }))
                        setCatalogSearch('')
                        setShowCatalogDropdown(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center gap-2"
                    >
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CAT_COLORS[ci.category] || 'bg-gray-700 text-gray-300'}`}>{ci.category}</span>
                      <span className="text-white truncate">{ci.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 items-end">
            <div className="w-32">
              <label className="text-xs text-gray-400">Par Qty</label>
              <input type="number" value={newItem.default_par_qty} onChange={e => setNewItem(p => ({ ...p, default_par_qty: e.target.value }))} className={inputCls + ' mt-1'} placeholder="0" />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newItem.catalog_item_id}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-semibold text-white transition-colors"
            >
              Add to Formulary
            </button>
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
            <span className="col-span-5 sm:col-span-4">Item</span>
            <span className="col-span-2 sm:col-span-1">Cat</span>
            <span className="col-span-2 hidden sm:block">Details</span>
            <span className="col-span-2 sm:col-span-2 text-right">Par Qty</span>
            <span className="col-span-3 text-right">Actions</span>
          </div>

          {/* Rows */}
          <div>
            {filtered.map(item => {
              const ci = catalogOf(item)
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/formulary/${item.id}`)}
                  className={`grid grid-cols-12 px-4 py-2.5 items-center text-sm cursor-pointer ${lc.rowCls(detailMatch?.params?.id === item.id)}`}>
                  <div className="col-span-5 sm:col-span-4 flex items-center gap-2">
                    {ci?.image_url ? (
                      <img src={ci.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0 bg-gray-800" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-800 shrink-0 flex items-center justify-center text-gray-600 text-xs">📷</div>
                    )}
                    <div className="min-w-0">
                      <span className="text-white hover:text-red-400 transition-colors truncate block">{item.item_name}</span>
                      {ci?.unit_of_measure && <span className="text-gray-500 text-xs">({ci.unit_of_measure})</span>}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-center gap-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${CAT_COLORS[ci?.category || ''] || CAT_COLORS.OTC}`}>
                      {ci?.category || '—'}
                    </span>
                  </div>
                  <div className="col-span-2 hidden sm:flex items-center gap-1.5 text-xs text-gray-500">
                    {ci?.is_als && <span className="px-1.5 py-0.5 rounded-full bg-blue-900 text-blue-300">ALS</span>}
                    {ci?.reimbursable && <span className="px-1.5 py-0.5 rounded-full bg-green-900 text-green-300">💲 Reimb</span>}
                    {ci?.concentration && <span className="text-gray-600">{ci.concentration}</span>}
                  </div>
                  {/* Par Qty — inline editable */}
                  <div className="col-span-2 sm:col-span-2 text-right">
                    {editingParId === item.id ? (
                      <input
                        type="number"
                        autoFocus
                        value={parInput}
                        onChange={e => setParInput(e.target.value)}
                        onBlur={() => handleParSave(item)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleParSave(item)
                          if (e.key === 'Escape') setEditingParId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        className="bg-gray-700 rounded px-1 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-16 text-right"
                      />
                    ) : (
                      <span
                        className="text-sm text-gray-300 font-mono cursor-pointer hover:text-white hover:underline"
                        title="Click to edit par qty"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingParId(item.id)
                          setParInput(item.default_par_qty != null ? String(item.default_par_qty) : '')
                        }}
                      >
                        {item.default_par_qty ?? <span className="text-gray-600">—</span>}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 flex gap-1 justify-end">
                    {item.catalog_item_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/catalog/${item.catalog_item_id}`) }}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
                        title="View in Item Catalog"
                      >
                        📋 Catalog
                      </button>
                    )}
                    {isAdmin && activeTab !== 'Warehouse' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }} className="px-2 py-1 bg-red-900/50 hover:bg-red-900 rounded text-xs text-red-300">Del</button>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-600 py-8 text-sm">No items found.</p>
            )}
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
              <span>{filtered.length} items shown</span>
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
