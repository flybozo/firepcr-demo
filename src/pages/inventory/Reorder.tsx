import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingSkeleton, UnitFilterPills } from '@/components/ui'
import { getUnitTypeName } from '@/lib/unitColors'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type ReorderItem = {
  id: string
  item_name: string
  category: string | null
  quantity: number
  par_qty: number
  reorder_qty: number | null
  unit_name: string
  incident_unit_id: string
  catalog_item_id: string | null
}

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
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

/* ── Right panel: catalog detail ── */
function CatalogDetailPanel({
  catalogItemId,
  shortageItems,
}: {
  catalogItemId: string
  shortageItems: ReorderItem[]
}) {
  const supabase = createClient()
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [unitTypes, setUnitTypes] = useState<UnitTypeEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [itemResult, templatesResult] = await Promise.all([
        supabase.from('item_catalog').select('*').eq('id', catalogItemId).single(),
        supabase
          .from('formulary_templates')
          .select('default_par_qty, unit_type:unit_types(name)')
          .eq('catalog_item_id', catalogItemId),
      ])
      if (cancelled) return
      if (itemResult.error || !itemResult.data) {
        setItem(null)
        setLoading(false)
        return
      }
      setItem(itemResult.data as CatalogItem)
      const types = (templatesResult.data || []).map((t: any) => ({
        unit_type_name: Array.isArray(t.unit_type) ? t.unit_type[0]?.name : t.unit_type?.name || 'Unknown',
        default_par_qty: t.default_par_qty,
      }))
      setUnitTypes(types.sort((a: UnitTypeEntry, b: UnitTypeEntry) => a.unit_type_name.localeCompare(b.unit_type_name)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [catalogItemId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} /></div>
  if (!item) return <div className="p-6 text-gray-500">Item not found in catalog.</div>

  const unitCost = item.unit_cost ?? (item.case_cost && item.units_per_case ? Number(item.case_cost) / Number(item.units_per_case) : null)
  const totalShortage = shortageItems.reduce((sum, i) => sum + (i.par_qty - i.quantity), 0)

  return (
    <div className="p-4 md:p-6 overflow-y-auto h-full">
      {/* Header with photo */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 flex items-center justify-center">
          {item.image_url ? (
            <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">📦</span>
          )}
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
        <Link
          to={`/catalog/${item.id}`}
          className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          Open in Catalog →
        </Link>
      </div>

      {/* Shortage summary for this item across units */}
      <div className="theme-card rounded-xl border p-4 mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Shortage by Unit</h3>
        <div className="space-y-2">
          {shortageItems.map(si => {
            const shortage = si.par_qty - si.quantity
            const pct = si.par_qty > 0 ? Math.round((si.quantity / si.par_qty) * 100) : 0
            return (
              <div key={si.id} className="flex items-center gap-3">
                <span className="text-sm text-white font-medium w-28 truncate">{si.unit_name}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct <= 25 ? 'bg-red-500' : pct <= 50 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-20 text-right">{si.quantity}/{si.par_qty}</span>
                <span className="text-xs text-red-400 font-semibold w-12 text-right">−{shortage}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-500">Total shortage</span>
          <span className="text-sm font-bold text-red-400">−{totalShortage} units</span>
        </div>
        {unitCost != null && totalShortage > 0 && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">Estimated restock cost</span>
            <span className="text-sm font-semibold text-yellow-400">${(totalShortage * Number(unitCost)).toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Carried by unit types */}
      {unitTypes.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Carried By</h3>
          <div className="flex flex-wrap gap-2">
            {unitTypes.map((ut, i) => (
              <div key={i} className="bg-gray-800 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-white font-medium">{ut.unit_type_name}</span>
                {ut.default_par_qty !== null && (
                  <span className="text-gray-500 ml-1">(par: {ut.default_par_qty})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item details grid */}
      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Item Details</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {([
            ['NDC', item.ndc],
            ['Barcode', item.barcode],
            ['UPC', item.upc],
            ['Route', item.route],
            ['Unit of Measure', item.unit_of_measure],
            ['Supplier', item.supplier],
            ['Units/Case', item.units_per_case],
            ['$/Case', item.case_cost != null ? `$${Number(item.case_cost).toFixed(2)}` : null],
            ['$/Unit', unitCost != null ? `$${Number(unitCost).toFixed(2)}` : null],
          ] as [string, any][]).map(([label, value]) => (
            <div key={label}>
              <span className="text-xs text-gray-500">{label}</span>
              <p className="text-sm text-white">{value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {item.notes && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Notes</h3>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */
function ReorderPageInner() {
  const [searchParams] = useSearchParams()
  const preselectedUnit = searchParams.get('unit') ?? ''

  const supabase = createClient()
  const [items, setItems] = useState<ReorderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState(preselectedUnit || 'All')
  const [catFilter, setCatFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)

  useEffect(() => {
    const load = async () => {
      const { data: allData } = await supabase
        .from('unit_inventory')
        .select(`
          id,
          item_name,
          category,
          quantity,
          par_qty,
          catalog_item_id,
          incident_unit:incident_units(
            id,
            unit:units(name)
          )
        `)
        .order('item_name')
        .limit(5000)

      const lowItems: ReorderItem[] = ((allData as any[]) || [])
        .filter((row: any) => row.quantity <= row.par_qty)
        .map((row: any) => ({
          id: row.id,
          item_name: row.item_name,
          category: row.category ?? null,
          quantity: row.quantity,
          par_qty: row.par_qty ?? 0,
          reorder_qty: null,
          unit_name: row.incident_unit?.unit?.name ?? 'Unknown',
          incident_unit_id: row.incident_unit?.id ?? '',
          catalog_item_id: row.catalog_item_id ?? null,
        }))
        .sort((a: ReorderItem, b: ReorderItem) => {
          const unitCmp = a.unit_name.localeCompare(b.unit_name)
          if (unitCmp !== 0) return unitCmp
          return a.item_name.localeCompare(b.item_name)
        })

      setItems(lowItems)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allUnits = Array.from(new Set(items.map(i => i.unit_name))).sort()
  const unitTypeMap = Object.fromEntries(allUnits.map(u => [u, getUnitTypeName(u)]))

  const filtered = items.filter(item => {
    const unitOk = unitFilter === 'All' || item.unit_name === unitFilter
    const catOk = catFilter === 'All' || item.category === catFilter
    return unitOk && catOk
  })

  const totalLow = filtered.length
  const unitsAffected = new Set(filtered.map(i => i.unit_name)).size

  // Group by unit for list display
  const grouped: Record<string, ReorderItem[]> = {}
  for (const item of filtered) {
    if (!grouped[item.unit_name]) grouped[item.unit_name] = []
    grouped[item.unit_name].push(item)
  }

  // Items with same catalog_item_id as selected (for detail panel shortage view)
  const selectedCatalogId = selectedId
    ? items.find(i => i.id === selectedId)?.catalog_item_id ?? null
    : null
  const shortageItemsForSelected = selectedCatalogId
    ? items.filter(i => i.catalog_item_id === selectedCatalogId && i.quantity <= i.par_qty)
    : []

  const exportCSV = () => {
    const rows: string[] = []
    rows.push('Unit,Item Name,Category,Current Qty,Par Qty,Shortage,Reorder Qty')
    filtered.forEach(item => {
      const shortage = item.par_qty - item.quantity
      rows.push([
        item.unit_name,
        item.item_name,
        item.category ?? '',
        item.quantity,
        item.par_qty,
        shortage,
        item.reorder_qty ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reorder-Report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-gray-950 text-white h-full flex flex-col">
      {/* Header + filters — full width */}
      <div className="flex-shrink-0 p-4 md:px-6 md:pt-6 space-y-3">
        <div className="flex items-center gap-3">
          <Link to="/inventory" className="text-gray-500 hover:text-white text-sm">← Inventory</Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-xl font-bold">Reorder Report</h1>
        </div>

        <div className="theme-card rounded-xl border p-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-0">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Unit</label>
              <UnitFilterPills
                units={allUnits}
                selected={unitFilter}
                onSelect={setUnitFilter}
                unitTypeMap={unitTypeMap}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Category</label>
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="All">All</option>
                <option value="CS">CS</option>
                <option value="Rx">Rx</option>
                <option value="OTC">OTC</option>
              </select>
            </div>
            <button
              onClick={exportCSV}
              disabled={loading || filtered.length === 0}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
            >
              CSV ↓
            </button>
          </div>
        </div>

        {/* Summary pills */}
        {!loading && (
          <div className="flex gap-3">
            <div className="theme-card rounded-xl border px-4 py-2 flex items-center gap-2">
              <span className="text-xl font-bold text-red-400">{totalLow}</span>
              <span className="text-xs text-gray-500 uppercase">Below Par</span>
            </div>
            <div className="theme-card rounded-xl border px-4 py-2 flex items-center gap-2">
              <span className="text-xl font-bold text-yellow-400">{unitsAffected}</span>
              <span className="text-xs text-gray-500 uppercase">Units</span>
            </div>
          </div>
        )}
      </div>

      {/* Split panel */}
      <div className="flex-1 flex min-h-0 border-t border-gray-800">
        {/* Left: list (40%) */}
        <div className="w-full md:w-[40%] md:border-r border-gray-800 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No items below par level — great job! 🎉</p>
            </div>
          ) : (
            Object.entries(grouped).map(([unitName, unitItems]) => (
              <div key={unitName}>
                <div className="px-3 py-2 bg-gray-800/40 border-b border-gray-800 flex items-center justify-between sticky top-0 z-10">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide">{unitName}</h3>
                  <span className="text-xs text-gray-600">{unitItems.length}</span>
                </div>
                <div className="divide-y divide-gray-800/50">
                  {unitItems.map(item => {
                    const shortage = item.par_qty - item.quantity
                    const isSelected = item.id === selectedId
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2 ${lc.rowCls(isSelected)}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                            {item.item_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.category && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${CAT_COLORS[item.category] ?? CAT_COLORS.OTC}`}>
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-mono font-semibold ${item.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                            {item.quantity}<span className="text-gray-600">/{item.par_qty}</span>
                          </p>
                          <p className="text-xs text-red-400">−{shortage}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: detail (60%) — hidden on mobile unless selected */}
        <div className="hidden md:block md:w-[60%] overflow-y-auto">
          {selectedId && selectedCatalogId ? (
            <CatalogDetailPanel
              catalogItemId={selectedCatalogId}
              shortageItems={shortageItemsForSelected}
            />
          ) : selectedId && !selectedCatalogId ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              <p>This item has no linked catalog entry.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">Select an item to view catalog details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile detail: slide-up panel when selected */}
      {selectedId && selectedCatalogId && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-950/95 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Item Detail</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-white text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>
          <CatalogDetailPanel
            catalogItemId={selectedCatalogId}
            shortageItems={shortageItemsForSelected}
          />
        </div>
      )}
    </div>
  )
}

export default function ReorderPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <ReorderPageInner />
    </Suspense>
  )
}
