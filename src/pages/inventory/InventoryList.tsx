
import { FieldGuard } from '@/components/FieldGuard'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { unitFilterButtonClass, UNIT_TYPE_ORDER } from '@/lib/unitColors'

type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  par_qty: number
  lot_number: string | null
  expiration_date: string | null
  incident_unit: { unit: { name: string } } | null
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
}

const PAGE_SIZE = 50

function InventoryPageInner() {
  const supabase = createClient()
  const { isField, loading: roleLoading } = useRole()
  const assignment = useUserAssignment()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState('All')
  // Auto-filter to user's unit when field role
  useEffect(() => {
    if (isField && !assignment.loading && assignment.unit?.name) {
      setUnitFilter(assignment.unit.name)
    }
  }, [roleLoading, isField, assignment.loading, assignment.unit?.name])
  const [catFilter, setCatFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showLowOnly, setShowLowOnly] = useState(false)

  const [isOfflineData, setIsOfflineData] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data, offline } = await loadList(
        () => supabase
          .from('unit_inventory')
          .select(`id, item_name, category, quantity, par_qty, lot_number, expiration_date,
            incident_unit:incident_units(unit:units(name, unit_type:unit_types(name)))`)
          .order('item_name')
          .limit(2000),
        'inventory'
      )
      // If offline data is missing unit joins, reconstruct from incident_units cache
      let enrichedData = data as any[]
      // Enrich ALL items (online or offline) that are missing unit names
      // Build a lookup map from incident_units cache for items missing joins
      const needsEnrichment = enrichedData.some((item: any) => !item.incident_unit?.unit?.name && item.incident_unit_id)
      if (needsEnrichment) {
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cachedIUs = await getCachedData('incident_units')
          // Build fast lookup: incident_unit_id -> { name, unit_type }
          const iuMap: Record<string, { name: string; unit_type: any }> = {}
          cachedIUs.forEach((iu: any) => {
            if (iu.id && iu.unit?.name) iuMap[iu.id] = { name: iu.unit.name, unit_type: iu.unit.unit_type || null }
          })
          enrichedData = enrichedData.map((item: any) => {
            if (item.incident_unit?.unit?.name) return item
            const iuId = item.incident_unit_id
            if (iuId && iuMap[iuId]) {
              return { ...item, incident_unit: { unit: iuMap[iuId] } }
            }
            return item
          })
        } catch {}
      }
      setItems(enrichedData)
      if (offline) setIsOfflineData(true)
      setLoading(false)
    }
    load()
  }, [])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [unitFilter, catFilter, search, showLowOnly])

  // Unit type lookup for color sorting
const unitTypeMap: Record<string, string> = {}
items.forEach(i => {
  const name = (i.incident_unit as any)?.unit?.name
  const type = (i.incident_unit as any)?.unit?.unit_type?.name || ''
  if (name) unitTypeMap[name] = type
})
const units = ['All', ...Array.from(new Set(
  items.map(i => (i.incident_unit as any)?.unit?.name).filter(Boolean)
)).sort((a, b) => {
  const aOrder = UNIT_TYPE_ORDER[unitTypeMap[a]] ?? 99
  const bOrder = UNIT_TYPE_ORDER[unitTypeMap[b]] ?? 99
  return aOrder !== bOrder ? aOrder - bOrder : a.localeCompare(b)
})]

  const filtered = items.filter(item => {
    const unitName = (item.incident_unit as any)?.unit?.name
    const effectiveFilter = isField && assignment.unit?.name ? assignment.unit.name : unitFilter
    if (effectiveFilter !== 'All' && unitName !== effectiveFilter) return false
    if (catFilter !== 'All' && item.category !== catFilter) return false
    if (showLowOnly && item.quantity > item.par_qty) return false
    if (search && !item.item_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const lowCount = items.filter(i => i.quantity <= i.par_qty).length

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-3">
          📦 Showing cached data — changes will sync when back online
        </div>
      )}
      <div className="flex items-center justify-between mb-4 mt-8 md:mt-0">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {filtered.length} items
            {lowCount > 0 && <span className="text-red-400 ml-2">· {lowCount} low stock</span>}
          </p>
        </div>
        <Link to="/inventory/add"
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold transition-colors">
          + Add
        </Link>
      </div>

      {/* Filters - compact */}
      <div className="space-y-2 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600" />

        <div className="flex gap-1.5 flex-wrap">
          {/* Category filter */}
          {['All', 'CS', 'Rx', 'OTC'].map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={'px-2 py-1 rounded text-xs font-medium transition-colors ' + (catFilter === c ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
              {c}
            </button>
          ))}
          <div className="w-px bg-gray-700" />
          {/* Low stock toggle */}
          <button onClick={() => setShowLowOnly(v => !v)}
            className={'px-2 py-1 rounded text-xs font-medium transition-colors ' + (showLowOnly ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
            ⚠ Low
          </button>
        </div>

        {/* Unit filter - scrollable row — hidden for field users */}
        {isField ? (
          assignment.unit?.name && (
            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-gray-500">Unit:</span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit.name}</span>
            </div>
          )
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {units.map(u => (
              <button key={u} onClick={() => setUnitFilter(u)}
                className={'px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ' + unitFilterButtonClass(unitTypeMap[u] || u, unitFilter === u)}>
                {u}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <>
          {/* Table */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800">
              <span className="flex-1 min-w-0">Item</span>
              <span className="w-20 text-center hidden md:block">Unit</span>
              <span className="w-10 text-center">Cat</span>
              <span className="w-12 text-right">Qty</span>
              <span className="w-10 text-right text-gray-600">Par</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-800/60">
              {paginated.map(item => {
                const low = item.quantity <= item.par_qty
                const unitName = (item.incident_unit as any)?.unit?.name
                return (
                  <Link key={item.id} to={`/inventory/${item.id}`}
                    className={`flex items-center px-3 py-1.5 hover:bg-gray-800 transition-colors cursor-pointer ${low ? 'bg-red-950/10' : ''}`}>
                    <span className={`flex-1 min-w-0 text-xs truncate ${low ? 'text-red-300' : 'text-white'}`}>
                      {item.item_name}
                      {low && <span className="ml-1 text-red-500 text-xs">↓</span>}
                      {(item.category === 'CS' || item.category === 'Rx') && item.expiration_date && (() => {
                        const exp = new Date(item.expiration_date)
                        const now = new Date()
                        const days90 = new Date(); days90.setDate(days90.getDate() + 90)
                        if (exp < now) return <span className="ml-1 text-xs bg-red-900 text-red-300 px-1 rounded">EXPIRED</span>
                        if (exp < days90) return <span className="ml-1 text-xs bg-orange-900 text-orange-300 px-1 rounded">⚠ {item.expiration_date}</span>
                        return null
                      })()}
                    </span>
                    <span className="w-20 text-center text-xs text-gray-500 hidden md:block truncate">{unitName}</span>
                    <span className="w-10 text-center">
                      <span className={`text-xs px-1 py-0.5 rounded ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>
                        {item.category}
                      </span>
                    </span>
                    <span className={`w-12 text-right text-xs font-mono font-semibold ${low ? 'text-red-400' : 'text-white'}`}>
                      {item.quantity}
                    </span>
                    <span className="w-10 text-right text-xs text-gray-600">{item.par_qty}</span>
                  </Link>
                )
              })}
              {paginated.length === 0 && (
                <p className="text-center text-gray-600 py-6 text-sm">No items found.</p>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} · {filtered.length} items
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">
                  «
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">
                  ‹ Prev
                </button>
                {/* Page number pills */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                  const pg = start + i
                  return pg <= totalPages ? (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={'px-2 py-1 rounded text-xs transition-colors ' + (pg === page ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
                      {pg}
                    </button>
                  ) : null
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">
                  Next ›
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-400 disabled:opacity-30 hover:bg-gray-700">
                  »
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function InventoryPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => a.unit?.name ? `/inventory?unit=${encodeURIComponent(a.unit.name)}` : null}>
      <InventoryPageInner />
    </FieldGuard>
  )
}
