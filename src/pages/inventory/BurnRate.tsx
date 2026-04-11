

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'

type BurnItem = {
  item_name: string
  category: string
  unit_name: string
  current_qty: number
  par_qty: number
  burn_per_day: number
  days_remaining: number | null
  reorder_date: string | null
  status: 'critical' | 'warning' | 'ok'
}

export default function BurnRatePage() {
  const supabase = createClient()
  const [items, setItems] = useState<BurnItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      // Get current inventory with unit names
      const { data: inv } = await supabase
        .from('unit_inventory')
        .select('id, item_name, category, quantity, par_qty, incident_unit:incident_units(unit:units(name))')
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
      const burnMap: Record<string, number> = {}  // "unit:item" -> total used in 7 days

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

        if (burnPerDay <= 0) continue  // Skip items with no usage

        const daysRemaining = burnPerDay > 0 ? Math.floor(item.quantity / burnPerDay) : null
        const reorderDate = daysRemaining !== null
          ? new Date(today.getTime() + daysRemaining * 86400000).toISOString().split('T')[0]
          : null

        let status: 'critical' | 'warning' | 'ok' = 'ok'
        if (daysRemaining !== null && daysRemaining <= 3) status = 'critical'
        else if (daysRemaining !== null && daysRemaining <= 7) status = 'warning'

        burnItems.push({
          item_name: item.item_name,
          category: item.category,
          unit_name: unitName,
          current_qty: item.quantity,
          par_qty: item.par_qty,
          burn_per_day: Math.round(burnPerDay * 10) / 10,
          days_remaining: daysRemaining,
          reorder_date: reorderDate,
          status,
        })
      }

      // Sort by days remaining (critical first)
      burnItems.sort((a, b) => {
        if (a.days_remaining === null) return 1
        if (b.days_remaining === null) return -1
        return a.days_remaining - b.days_remaining
      })

      setItems(burnItems)
      setLoading(false)
    }
    load()
  }, [])

  const units = ['All', ...Array.from(new Set(items.map(i => i.unit_name))).sort()]
  const filtered = items.filter(i => unitFilter === 'All' || i.unit_name === unitFilter)
  const critical = filtered.filter(i => i.status === 'critical').length
  const warning = filtered.filter(i => i.status === 'warning').length

  return (
    <div className="p-4 md:p-6 max-w-4xl mt-8 md:mt-0 pb-16">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Inventory Burn Rate</h1>
          <p className="text-gray-400 text-xs mt-0.5">Based on last 7 days usage · items with active consumption only</p>
        </div>
        <Link to="/inventory/reorder" className="text-xs text-red-400 hover:text-red-300">Reorder Report →</Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{critical}</p>
          <p className="text-xs text-red-500">≤3 days</p>
        </div>
        <div className="bg-yellow-950/40 border border-yellow-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{warning}</p>
          <p className="text-xs text-yellow-500">4–7 days</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-gray-300">{filtered.length}</p>
          <p className="text-xs text-gray-500">total tracked</p>
        </div>
      </div>

      {/* Unit filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
        {units.map(u => (
          <button key={u} onClick={() => setUnitFilter(u)}
            className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${unitFilter === u ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {u}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Calculating burn rates...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-gray-500 text-sm">No items with active burn rate found.<br />Burn rate requires MAR or supply run activity in the last 7 days.</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center px-4 py-2 bg-gray-800 border-b border-gray-700 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span className="flex-1 min-w-0">Item</span>
            <span className="w-20 shrink-0 hidden sm:block">Unit</span>
            <span className="w-16 shrink-0 text-right">In Stock</span>
            <span className="w-20 shrink-0 text-right">Per Day</span>
            <span className="w-20 shrink-0 text-right">Days Left</span>
            <span className="w-28 shrink-0 text-right hidden md:block">Reorder By</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {filtered.map((item, i) => (
              <div key={i} className={`flex items-center px-4 py-2.5 text-sm ${
                item.status === 'critical' ? 'bg-red-950/20' : item.status === 'warning' ? 'bg-yellow-950/10' : ''
              }`}>
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs text-white truncate">{item.item_name}</p>
                  <span className={`text-xs px-1 rounded ${
                    item.category === 'CS' ? 'text-orange-400' : item.category === 'Rx' ? 'text-blue-400' : 'text-gray-500'
                  }`}>{item.category}</span>
                </div>
                <span className="w-20 text-xs text-gray-500 hidden sm:block truncate">{item.unit_name}</span>
                <span className="w-16 text-right text-xs font-mono text-white">{item.current_qty}</span>
                <span className="w-20 text-right text-xs text-gray-400">{item.burn_per_day}/day</span>
                <span className={`w-20 text-right text-xs font-bold ${
                  item.status === 'critical' ? 'text-red-400' :
                  item.status === 'warning' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {item.days_remaining !== null ? `${item.days_remaining}d` : '∞'}
                </span>
                <span className="w-28 text-right text-xs text-gray-500 hidden md:block">
                  {item.reorder_date || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
