import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { EmptyState, LoadingSkeleton, UnitFilterPills } from '@/components/ui'
import { getUnitTypeName } from '@/lib/unitColors'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'
import { CatalogItemPanel, CAT_COLORS } from '@/components/inventory/CatalogItemPanel'
import type { CatalogItem } from '@/components/inventory/CatalogItemPanel'

type BurnItem = {
  id: string
  item_name: string
  category: string
  unit_name: string
  current_qty: number
  par_qty: number
  burn_per_day: number
  days_remaining: number | null
  reorder_date: string | null
  status: 'critical' | 'warning' | 'ok'
  catalog_item_id: string | null
}

const STATUS_COLORS = {
  critical: 'text-red-400',
  warning: 'text-yellow-400',
  ok: 'text-green-400',
}

/* ── Main page ── */
export default function BurnRatePage() {
  const supabase = createClient()
  const [items, setItems] = useState<BurnItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      // Get current inventory with unit names
      const { data: inv } = await supabase
        .from('unit_inventory')
        .select('id, item_name, category, quantity, par_qty, catalog_item_id, incident_unit:incident_units(unit:units(name))')
        .gt('quantity', 0)
        .in('category', ['Rx', 'CS', 'OTC'])
        .order('item_name')
        .limit(500)

      // Get MAR entries from last 7 days to calculate burn rate
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { data: mar } = await supabase
        .from('dispense_admin_log')
        .select('item_name, qty_used, med_unit, date')
        .gte('date', sevenDaysAgo.toISOString().split('T')[0])

      // Get supply runs from last 7 days
      const { data: supplyItems } = await supabase
        .from('supply_run_items')
        .select('item_name, quantity, supply_run:supply_runs(run_date, incident_unit:incident_units(unit:units(name)))')
        .gte('created_at', sevenDaysAgo.toISOString())

      // Calculate burn per day per item per unit
      const burnMap: Record<string, number> = {}
      for (const entry of mar || []) {
        const key = `${entry.med_unit}:${entry.item_name}`
        burnMap[key] = (burnMap[key] || 0) + (entry.qty_used || 0)
      }
      for (const entry of supplyItems || []) {
        const unitName = (entry as any).supply_run?.incident_unit?.unit?.name
        if (unitName) {
          const key = `${unitName}:${entry.item_name}`
          burnMap[key] = (burnMap[key] || 0) + (entry.quantity || 0)
        }
      }

      const today = new Date()
      const burnItems: BurnItem[] = []

      for (const item of inv || []) {
        const unitName = (item as any).incident_unit?.unit?.name || 'Unknown'
        const key = `${unitName}:${item.item_name}`
        const totalUsed7d = burnMap[key] || 0
        const burnPerDay = totalUsed7d / 7

        if (burnPerDay <= 0) continue

        const daysRemaining = burnPerDay > 0 ? Math.floor(item.quantity / burnPerDay) : null
        const reorderDate = daysRemaining !== null
          ? new Date(today.getTime() + daysRemaining * 86400000).toISOString().split('T')[0]
          : null

        let status: 'critical' | 'warning' | 'ok' = 'ok'
        if (daysRemaining !== null && daysRemaining <= 3) status = 'critical'
        else if (daysRemaining !== null && daysRemaining <= 7) status = 'warning'

        burnItems.push({
          id: item.id,
          item_name: item.item_name,
          category: item.category,
          unit_name: unitName,
          current_qty: item.quantity,
          par_qty: item.par_qty,
          burn_per_day: Math.round(burnPerDay * 10) / 10,
          days_remaining: daysRemaining,
          reorder_date: reorderDate,
          status,
          catalog_item_id: item.catalog_item_id ?? null,
        })
      }

      burnItems.sort((a, b) => {
        if (a.days_remaining === null) return 1
        if (b.days_remaining === null) return -1
        return a.days_remaining - b.days_remaining
      })

      setItems(burnItems)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const allUnits = Array.from(new Set(items.map(i => i.unit_name))).sort()
  const unitTypeMap = Object.fromEntries(allUnits.map(u => [u, getUnitTypeName(u)]))
  const filtered = items.filter(i => unitFilter === 'All' || i.unit_name === unitFilter)
  const critical = filtered.filter(i => i.status === 'critical').length
  const warning = filtered.filter(i => i.status === 'warning').length
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const selectedItem = selectedId ? items.find(i => i.id === selectedId) ?? null : null

  // Build burn analysis context card — receives catalog item via render prop for cost calc
  const burnContextCard = (burnItem: BurnItem) => (catalogItem: CatalogItem) => {
    const pct = burnItem.par_qty > 0 ? Math.round((burnItem.current_qty / burnItem.par_qty) * 100) : 0
    return (
      <div className="theme-card rounded-xl border p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Burn Rate Analysis</h3>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            burnItem.status === 'critical' ? 'bg-red-900 text-red-300' :
            burnItem.status === 'warning' ? 'bg-yellow-900 text-yellow-300' :
            'bg-green-900 text-green-300'
          }`}>
            {burnItem.status === 'critical' ? '🔴 Critical' : burnItem.status === 'warning' ? '🟡 Warning' : '🟢 OK'}
          </span>
        </div>

        {/* Stock level bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Stock Level</span>
            <span className="text-white font-medium">{burnItem.current_qty} / {burnItem.par_qty} ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct <= 25 ? 'bg-red-500' : pct <= 50 ? 'bg-orange-500' : pct <= 75 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-500">Burn Rate</span>
            <p className="text-lg font-bold text-white">{burnItem.burn_per_day}<span className="text-xs text-gray-400 ml-1">/day</span></p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Days Until Depletion</span>
            <p className={`text-lg font-bold ${STATUS_COLORS[burnItem.status]}`}>
              {burnItem.days_remaining !== null ? `${burnItem.days_remaining}d` : '∞'}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Projected Reorder Date</span>
            <p className="text-sm font-medium text-white">{burnItem.reorder_date || '—'}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">Unit</span>
            <p className="text-sm font-medium text-white">{burnItem.unit_name}</p>
          </div>
        </div>

        {catalogItem.unit_cost != null && burnItem.days_remaining !== null && burnItem.par_qty > burnItem.current_qty && (
          <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between items-center">
            <span className="text-xs text-gray-500">Restock to par cost</span>
            <span className="text-sm font-semibold text-yellow-400">
              ${((burnItem.par_qty - burnItem.current_qty) * Number(catalogItem.unit_cost)).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-950 text-white h-full flex flex-col">
      {/* Header + filters */}
      <div className="flex-shrink-0 p-4 md:px-6 md:pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Inventory Burn Rate</h1>
            <p className="text-gray-400 text-xs mt-0.5">Based on last 7 days usage · items with active consumption only</p>
          </div>
          <Link to="/inventory/reorder" className="text-xs text-red-400 hover:text-red-300">Reorder Report →</Link>
        </div>

        {/* Summary */}
        <div className="flex gap-3">
          <div className="bg-red-950/40 border border-red-800 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-xl font-bold text-red-400">{critical}</span>
            <span className="text-xs text-red-500">≤3 days</span>
          </div>
          <div className="bg-yellow-950/40 border border-yellow-800 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-xl font-bold text-yellow-400">{warning}</span>
            <span className="text-xs text-yellow-500">4–7 days</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-2">
            <span className="text-xl font-bold text-gray-300">{filtered.length}</span>
            <span className="text-xs text-gray-500">tracked</span>
          </div>
        </div>

        {/* Unit filter */}
        <UnitFilterPills
          units={allUnits}
          selected={unitFilter}
          onSelect={setUnitFilter}
          unitTypeMap={unitTypeMap}
        />
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
            <div className="p-8">
              <EmptyState icon="📊" message="No items with active burn rate found." subtitle="Burn rate requires MAR or supply run activity in the last 7 days." />
            </div>
          ) : (
            <div className={`${lc.container} m-3`}>
              {filtered.map(item => {
                const isSelected = item.id === selectedId
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2 ${lc.rowCls(isSelected)}${!isSelected && item.status === 'critical' ? ' bg-red-950/10' : !isSelected && item.status === 'warning' ? ' bg-yellow-950/5' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                        {item.item_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${CAT_COLORS[item.category] ?? CAT_COLORS.OTC}`}>
                          {item.category}
                        </span>
                        <span className="text-[10px] text-gray-600">{item.unit_name}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-mono font-bold ${STATUS_COLORS[item.status]}`}>
                        {item.days_remaining !== null ? `${item.days_remaining}d` : '∞'}
                      </p>
                      <p className="text-[10px] text-gray-500">{item.burn_per_day}/day</p>
                    </div>
                    <div className="text-right flex-shrink-0 w-10">
                      <p className="text-xs font-mono text-gray-400">{item.current_qty}</p>
                      <p className="text-[10px] text-gray-600">/{item.par_qty}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: detail (60%) */}
        <div className="hidden md:block md:w-[60%] overflow-y-auto">
          {selectedItem && selectedItem.catalog_item_id ? (
            <CatalogItemPanel
              catalogItemId={selectedItem.catalog_item_id}
              contextCard={burnContextCard(selectedItem)}
            />
          ) : selectedItem && !selectedItem.catalog_item_id ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              <p>This item has no linked catalog entry.</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm">Select an item to view burn rate details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile detail overlay */}
      {selectedItem && (
        <div className="md:hidden fixed inset-0 z-50 bg-gray-950 flex flex-col">
          <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white truncate">{selectedItem.item_name}</h3>
            <button
              onClick={() => setSelectedId(null)}
              className="text-gray-400 hover:text-white text-sm px-2 py-1"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedItem.catalog_item_id ? (
              <CatalogItemPanel
                catalogItemId={selectedItem.catalog_item_id}
                contextCard={burnContextCard(selectedItem)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm p-8 text-center">
                <p>No linked catalog entry.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
