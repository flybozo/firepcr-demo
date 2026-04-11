

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'

type ReorderItem = {
  id: string
  item_name: string
  category: string | null
  quantity: number
  par_qty: number
  reorder_qty: number | null
  unit_name: string
  incident_unit_id: string
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
}

function ReorderPageInner() {
  const [searchParams] = useSearchParams()
  const preselectedIncident = searchParams.get('incidentId') ?? ''

  const supabase = createClient()
  const [items, setItems] = useState<ReorderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState('All')
  const [catFilter, setCatFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      // Filter where quantity <= par_qty client-side (Supabase can't compare two columns)
      const { data: allData } = await supabase
        .from('unit_inventory')
        .select(`
          id,
          item_name,
          category,
          quantity,
          par_qty,
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
  const allCats = Array.from(new Set(items.map(i => i.category ?? 'Other'))).sort()

  const filtered = items.filter(item => {
    const unitOk = unitFilter === 'All' || item.unit_name === unitFilter
    const catOk = catFilter === 'All' || item.category === catFilter
    return unitOk && catOk
  })

  const totalLow = filtered.length
  const unitsAffected = new Set(filtered.map(i => i.unit_name)).size

  // Group by unit
  const grouped: Record<string, ReorderItem[]> = {}
  for (const item of filtered) {
    if (!grouped[item.unit_name]) grouped[item.unit_name] = []
    grouped[item.unit_name].push(item)
  }

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
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <Link to="/inventory" className="text-gray-500 hover:text-white text-sm">← Inventory</Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-xl font-bold">Reorder Report</h1>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Unit</label>
              <select
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="All">All Units</option>
                {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Category</label>
              <select
                value={catFilter}
                onChange={e => setCatFilter(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="All">All Categories</option>
                <option value="CS">CS</option>
                <option value="Rx">Rx</option>
                <option value="OTC">OTC</option>
              </select>
            </div>
            <div className="flex-1" />
            <button
              onClick={exportCSV}
              disabled={loading || filtered.length === 0}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg text-sm font-semibold transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{totalLow}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Items Below Par</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{unitsAffected}</p>
              <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Units Affected</p>
            </div>
          </div>
        )}

        {/* Table grouped by unit */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
            <p className="text-gray-500 text-sm">No items below par level — great job! 🎉</p>
          </div>
        ) : (
          Object.entries(grouped).map(([unitName, unitItems]) => (
            <div key={unitName} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-800/40">
                <h3 className="text-sm font-bold text-white">{unitName}</h3>
                <span className="text-xs text-gray-500">{unitItems.length} item{unitItems.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-gray-600 bg-gray-800/20">
                      <th className="px-4 py-2 text-left">Item Name</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-right">Current</th>
                      <th className="px-4 py-2 text-right">Par</th>
                      <th className="px-4 py-2 text-right">Shortage</th>
                      <th className="px-4 py-2 text-right">Reorder Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {unitItems.map(item => {
                      const shortage = item.par_qty - item.quantity
                      return (
                        <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-2 font-medium">{item.item_name}</td>
                          <td className="px-4 py-2">
                            {item.category ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[item.category] ?? 'bg-gray-700 text-gray-300'}`}>
                                {item.category}
                              </span>
                            ) : '—'}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${item.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400">{item.par_qty}</td>
                          <td className="px-4 py-2 text-right text-red-400 font-semibold">{shortage}</td>
                          <td className="px-4 py-2 text-right text-gray-300">
                            {item.reorder_qty ?? <span className="text-gray-600">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function ReorderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <ReorderPageInner />
    </Suspense>
  )
}
