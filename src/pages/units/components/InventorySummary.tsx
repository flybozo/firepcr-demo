import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { InventoryItem } from './types'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type Props = { inventory: InventoryItem[]; unitName: string }

const CATEGORY_ORDER = ['CS', 'Rx', 'OTC', 'Supply', 'Equipment']
const CATEGORY_LABELS: Record<string, string> = {
  CS: '🔒 Controlled Substances',
  Rx: '💊 Prescription Medications',
  OTC: '🩹 OTC Medications',
  Supply: '📦 Supplies',
  Equipment: '🔧 Equipment',
}
const CATEGORY_COLORS: Record<string, string> = {
  CS: 'text-orange-400',
  Rx: 'text-blue-400',
  OTC: 'text-green-400',
  Supply: 'text-purple-400',
  Equipment: 'text-gray-400',
}

export default function InventorySummary({ inventory, unitName }: Props) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const [showAll, setShowAll] = useState(false)

  if (inventory.length === 0) return null

  // Group by category
  const grouped: Record<string, InventoryItem[]> = {}
  for (const item of inventory) {
    const cat = item.category || 'Other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const categories = CATEGORY_ORDER.filter(c => grouped[c]).concat(
    Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c))
  )

  // Reorder items: aggregate quantity by (catalog_item_id || item_name) before comparing
  // to par. This prevents multiple lot rows of the same drug from being individually
  // flagged. Par lives on formulary_templates per unit_type — the unit_inventory.par_qty
  // value is treated here as a per-row hint only.
  const aggregated = new Map<string, { item_name: string; total_qty: number; par_qty: number }>()
  for (const item of inventory) {
    const key = item.catalog_item_id || item.item_name
    const existing = aggregated.get(key)
    if (existing) {
      existing.total_qty += item.quantity
      // Use the max par_qty across rows (should be the same, but be safe)
      if (item.par_qty > existing.par_qty) existing.par_qty = item.par_qty
    } else {
      aggregated.set(key, { item_name: item.item_name, total_qty: item.quantity, par_qty: item.par_qty })
    }
  }
  // Map per-lot row → aggregated low state so individual lot rows can show the unit-level low flag.
  const aggLowByKey = new Map<string, boolean>()
  for (const a of aggregated.values()) {
    aggLowByKey.set(a.item_name, a.par_qty > 0 && a.total_qty < a.par_qty)
  }
  const reorderItems = Array.from(aggregated.values())
    .filter(a => a.par_qty > 0 && a.total_qty < a.par_qty)
    .map(a => ({ id: a.item_name, item_name: a.item_name, quantity: a.total_qty, par_qty: a.par_qty, category: inventory.find(i => i.item_name === a.item_name)?.category || 'Other' }))

  // Collapsed view: show CS + Rx + first 5 of each other category
  const COLLAPSE_LIMIT = 5
  const totalItems = inventory.length
  const hasMore = totalItems > 20

  return (
    <div className="space-y-4">
      {/* Reorder Alert */}
      {reorderItems.length > 0 && (
        <div className="theme-card rounded-xl border border-yellow-800/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-yellow-950/30">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
              ⚠️ Reorder Needed ({reorderItems.length})
            </h2>
            <Link to={`/inventory/reorder?unit=${encodeURIComponent(unitName)}`} className="text-xs text-yellow-400 hover:text-yellow-300">
              Full report →
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {reorderItems.map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="text-red-300 truncate block">{item.item_name}</span>
                  <span className="text-xs text-gray-600">{item.category || ''}</span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-red-400 font-mono font-semibold">{item.quantity}</span>
                  <span className="text-gray-600 text-xs"> / {item.par_qty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Inventory by Category */}
      <div className={lc.container}>
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Inventory ({totalItems} items)
          </h2>
          <Link to={`/inventory?unit=${encodeURIComponent(unitName)}`} className="text-xs text-blue-400 hover:text-blue-300">
            Manage →
          </Link>
        </div>

        {categories.map(cat => {
          const items = grouped[cat]
          const label = CATEGORY_LABELS[cat] || cat
          const color = CATEGORY_COLORS[cat] || 'text-gray-400'
          const displayItems = (!showAll && hasMore && cat !== 'CS' && cat !== 'Rx')
            ? items.slice(0, COLLAPSE_LIMIT)
            : items
          const hasHidden = !showAll && hasMore && items.length > COLLAPSE_LIMIT && cat !== 'CS' && cat !== 'Rx'

          return (
            <div key={cat}>
              <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-800">
                <span className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</span>
                <span className="text-xs text-gray-600 ml-2">({items.length})</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {displayItems.map(item => {
                  // Use aggregated low: a unit with three lots @ 1 each meets a par of 3.
                  const low = aggLowByKey.get(item.item_name) ?? false
                  return (
                    <div key={item.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className={`flex-1 truncate ${low ? 'text-red-300' : 'text-white'}`}>{item.item_name}</span>
                      <span className={`w-8 text-right font-mono font-semibold ${low ? 'text-red-400' : 'text-gray-300'}`}>
                        {item.quantity}
                      </span>
                      {item.par_qty > 0 && (
                        <span className="w-12 text-right text-xs text-gray-600">/ {item.par_qty}</span>
                      )}
                      {low && <span className="ml-1 text-xs text-red-500">⚠</span>}
                    </div>
                  )
                })}
                {hasHidden && (
                  <div className="px-4 py-1.5 text-center">
                    <span className="text-xs text-gray-600">+{items.length - COLLAPSE_LIMIT} more</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-2.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-800/50 transition-colors border-t border-gray-800"
          >
            Show all {totalItems} items
          </button>
        )}
        {showAll && hasMore && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800/50 transition-colors border-t border-gray-800"
          >
            Collapse
          </button>
        )}
      </div>
    </div>
  )
}
