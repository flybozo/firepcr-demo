import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link, useSearchParams } from 'react-router-dom'
import { LoadingSkeleton, UnitFilterPills } from '@/components/ui'
import { getUnitTypeName } from '@/lib/unitColors'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'
import { CatalogItemPanel, CAT_COLORS } from '@/components/inventory/CatalogItemPanel'
import type { CatalogItem } from '@/components/inventory/CatalogItemPanel'

type ReorderItem = {
  id: string
  item_name: string
  category: string | null
  quantity: number
  par_qty: number
  reorder_qty: number | null
  unit_name: string
  catalog_item_id: string | null
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
      // Use aggregated view: sums all lot rows per (unit, item), par from formulary_templates
      const { data: allData } = await supabase
        .from('unit_inventory_aggregated')
        .select('unit_id, unit_name, catalog_item_id, item_name, category, total_quantity, par_qty, formulary_template_id')
        .gt('par_qty', 0)
        .order('unit_name')
        .order('item_name')

      const lowItems: ReorderItem[] = ((allData as any[]) || [])
        .filter((row: any) => row.total_quantity < row.par_qty)
        .map((row: any) => ({
          id: `${row.unit_id}-${row.catalog_item_id || row.item_name}`,
          item_name: row.item_name,
          category: row.category ?? null,
          quantity: row.total_quantity,
          par_qty: row.par_qty,
          reorder_qty: null,
          unit_name: row.unit_name ?? 'Unknown',
          catalog_item_id: row.catalog_item_id ?? null,
        }))

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
    ? items.filter(i => i.catalog_item_id === selectedCatalogId && i.quantity < i.par_qty)
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

  // Shortage context card — receives catalog item via render prop
  const shortageContextCard = (item: CatalogItem) => {
    const unitCost = item.unit_cost ?? (item.case_cost && item.units_per_case ? Number(item.case_cost) / Number(item.units_per_case) : null)
    const totalShortage = shortageItemsForSelected.reduce((sum, si) => sum + (si.par_qty - si.quantity), 0)
    return (
      <div className="theme-card rounded-xl border p-4 mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Shortage by Unit</h3>
        <div className="space-y-2">
          {shortageItemsForSelected.map(si => {
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
    )
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
            <div className="p-3 space-y-3">
            {Object.entries(grouped).map(([unitName, unitItems]) => (
              <div key={unitName} className={`${lc.container} mb-3`}>
                <div className="px-3 py-2 bg-gray-800/40 border-b border-gray-800 flex items-center justify-between sticky top-0 z-10">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide">{unitName}</h3>
                  <span className="text-xs text-gray-600">{unitItems.length}</span>
                </div>
                <div>
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
            ))}
            </div>
          )}
        </div>

        {/* Right: detail (60%) — hidden on mobile unless selected */}
        <div className="hidden md:block md:w-[60%] overflow-y-auto">
          {selectedId && selectedCatalogId ? (
            <CatalogItemPanel
              catalogItemId={selectedCatalogId}
              contextCard={shortageContextCard}
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
          <CatalogItemPanel
            catalogItemId={selectedCatalogId}
            contextCard={shortageContextCard}
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
