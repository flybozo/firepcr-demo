import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navigate, useSearchParams } from 'react-router-dom'
import { PageHeader, LoadingSkeleton, EmptyState, UnitFilterPills } from '@/components/ui'
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { getUnitTypeName } from '@/lib/unitColors'
import DisposeModal, { type DisposeItem } from '@/components/inventory/DisposeModal'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type ExpiringItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  lot_number: string | null
  effective_expiry: string
  unit_id: string | null
  unit_name: string
  sku: string | null
  days_until_expiry: number
  catalog_item_id: string | null
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
  'Controlled Substance': 'bg-orange-900 text-orange-300',
  Prescription: 'bg-blue-900 text-blue-300',
  'Durable Equipment': 'bg-amber-900 text-amber-300',
  'Rescue Equipment': 'bg-green-900 text-green-300',
}

const WINDOWS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: 'All', days: Infinity },
]

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + 'T00:00:00' : dateStr
  const exp = new Date(normalized)
  exp.setHours(0, 0, 0, 0)
  return Math.floor((exp.getTime() - today.getTime()) / 86400000)
}

function rowUrgency(days: number) {
  if (days < 0) return 'bg-red-950/40 hover:bg-red-950/50'
  if (days < 30) return 'bg-orange-950/25 hover:bg-orange-950/40'
  if (days < 90) return 'bg-yellow-950/15 hover:bg-yellow-950/25'
  return 'hover:bg-gray-800/40'
}

function isHighPriority(cat: string) {
  return cat === 'CS' || cat === 'Rx' || cat === 'Controlled Substance' || cat === 'Prescription'
}

export default function ExpirationDashboard() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const canView = usePermission('inventory')
  const permLoading = usePermissionLoading()
  const [searchParams] = useSearchParams()

  const [items, setItems] = useState<ExpiringItem[]>([])
  const [loading, setLoading] = useState(true)
  const [windowDays, setWindowDays] = useState<number>(90)
  const [unitFilter, setUnitFilter] = useState('All')
  const [catFilter, setCatFilter] = useState(() => searchParams.get('cat') || 'All')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [csRxFirst, setCsRxFirst] = useState(true)
  const [disposeItem, setDisposeItem] = useState<DisposeItem | null>(null)

  useEffect(() => {
    const load = async () => {
      const [invResult, unitsResult] = await Promise.all([
        supabase
          .from('unit_inventory')
          .select('id, item_name, category, quantity, lot_number, expiration_date, unit_id, catalog_item_id, catalog_item:item_catalog(sku)')
          .not('expiration_date', 'is', null),
        supabase
          .from('units')
          .select('id, name')
          .eq('active', true),
      ])

      if (invResult.error) {
        console.error('[ExpirationDashboard]', invResult.error)
        setLoading(false)
        return
      }

      const unitMap: Record<string, string> = {}
      ;(unitsResult.data || []).forEach((u: any) => { unitMap[u.id] = u.name })

      const processed: ExpiringItem[] = ((invResult.data as any[]) || [])
        .map(row => {
          const effectiveExpiry = row.expiration_date
          if (!effectiveExpiry) return null
          return {
            id: row.id,
            item_name: row.item_name,
            category: row.category || 'OTC',
            quantity: row.quantity ?? 0,
            lot_number: row.lot_number || null,
            effective_expiry: effectiveExpiry,
            unit_id: row.unit_id || null,
            unit_name: row.unit_id ? (unitMap[row.unit_id] || 'Unknown') : 'Unknown',
            sku: (row.catalog_item as any)?.sku || null,
            days_until_expiry: daysUntil(effectiveExpiry),
            catalog_item_id: row.catalog_item_id || null,
          }
        })
        .filter(Boolean) as ExpiringItem[]

      setItems(processed)
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return items
      .filter(item => {
        if (item.quantity <= 0) return false
        if (unitFilter !== 'All' && item.unit_name !== unitFilter) return false
        if (catFilter !== 'All' && item.category !== catFilter) return false
        if (isFinite(windowDays) && item.days_until_expiry > windowDays) return false
        return true
      })
      .sort((a, b) => a.days_until_expiry - b.days_until_expiry)
  }, [items, unitFilter, catFilter, windowDays])

  const allUnits = useMemo(
    () => ['All', ...Array.from(new Set(items.filter(i => i.quantity > 0).map(i => i.unit_name))).sort()],
    [items]
  )
  const unitTypeMap = useMemo(
    () => Object.fromEntries(allUnits.filter(u => u !== 'All').map(u => [u, getUnitTypeName(u)])),
    [allUnits]
  )
  const allCats = useMemo(
    () => ['All', ...Array.from(new Set(items.filter(i => i.quantity > 0).map(i => i.category))).sort()],
    [items]
  )

  const grouped = useMemo(() => {
    const map: Record<string, ExpiringItem[]> = {}
    filtered.forEach(item => {
      if (!map[item.unit_name]) map[item.unit_name] = []
      map[item.unit_name].push(item)
    })
    Object.keys(map).forEach(unit => {
      map[unit].sort((a, b) => {
        if (csRxFirst) {
          const aP = isHighPriority(a.category) ? 0 : 1
          const bP = isHighPriority(b.category) ? 0 : 1
          if (aP !== bP) return aP - bP
        }
        return a.days_until_expiry - b.days_until_expiry
      })
    })
    return map
  }, [filtered, csRxFirst])

  const expiredCount = useMemo(() => filtered.filter(i => i.days_until_expiry < 0).length, [filtered])
  const expiring30Count = useMemo(
    () => filtered.filter(i => i.days_until_expiry >= 0 && i.days_until_expiry < 30).length,
    [filtered]
  )
  const expiring90Count = useMemo(
    () => filtered.filter(i => i.days_until_expiry >= 30 && i.days_until_expiry < 90).length,
    [filtered]
  )

  if (permLoading) return <LoadingSkeleton rows={6} header />
  if (!canView) return <Navigate to="/" replace />

  const toggleUnit = (name: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleDisposeSuccess = (itemId: string, disposedQty: number) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity: item.quantity - disposedQty } : item
    ))
    setDisposeItem(null)
  }

  const openDispose = (item: ExpiringItem) => {
    setDisposeItem({
      id: item.id,
      item_name: item.item_name,
      category: item.category,
      quantity: item.quantity,
      lot_number: item.lot_number,
      effective_expiry: item.effective_expiry,
      unit_id: item.unit_id,
      unit_name: item.unit_name,
      catalog_item_id: item.catalog_item_id,
    })
  }

  return (
    <div className="p-4 md:p-6 pb-16">
      <PageHeader
        title="Expiration Dashboard"
        subtitle={loading ? 'Loading…' : `${filtered.length} item${filtered.length !== 1 ? 's' : ''} expiring`}
        className="mb-4 mt-8 md:mt-0"
      />

      {/* Time window pills + CS/Rx toggle */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {WINDOWS.map(opt => (
          <button
            key={opt.label}
            onClick={() => setWindowDays(opt.days)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              windowDays === opt.days ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="w-px bg-gray-700 mx-0.5" />
        <button
          onClick={() => setCsRxFirst(v => !v)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            csRxFirst ? 'bg-orange-900 text-orange-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          CS/Rx First
        </button>
      </div>

      {/* Category + unit filter pills */}
      <div className="space-y-2 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {allCats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                catFilter === c ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <UnitFilterPills
          units={allUnits}
          selected={unitFilter}
          onSelect={setUnitFilter}
          unitTypeMap={unitTypeMap}
        />
      </div>

      {loading ? (
        <LoadingSkeleton rows={8} header />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{expiredCount}</p>
              <p className="text-xs text-red-500 mt-0.5">Expired</p>
            </div>
            <div className="bg-orange-950/40 border border-orange-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{expiring30Count}</p>
              <p className="text-xs text-orange-500 mt-0.5">&lt;30 days</p>
            </div>
            <div className="bg-yellow-950/40 border border-yellow-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{expiring90Count}</p>
              <p className="text-xs text-yellow-500 mt-0.5">30–90 days</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="✅"
              message="No expiring items in this window."
              subtitle="Try expanding the time window or adjusting filters."
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([unitName, unitItems]) => {
                  const isCollapsed = collapsed.has(unitName)
                  const unitExpired = unitItems.filter(i => i.days_until_expiry < 0).length
                  const unitUrgent = unitItems.filter(i => i.days_until_expiry >= 0 && i.days_until_expiry < 30).length

                  return (
                    <div key={unitName} className={lc.container}>
                      {/* Unit section header */}
                      <button
                        onClick={() => toggleUnit(unitName)}
                        className="w-full px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <svg
                            className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-bold text-white">{unitName}</span>
                          {unitExpired > 0 && (
                            <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              {unitExpired} expired
                            </span>
                          )}
                          {unitUrgent > 0 && (
                            <span className="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                              {unitUrgent} urgent
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">
                          {unitItems.length} item{unitItems.length !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {!isCollapsed && (
                        <>
                          {/* Desktop column header */}
                          <div className="hidden md:flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-800/20">
                            <span className="flex-1 min-w-0">Item</span>
                            <span className="w-16 shrink-0 text-center">Cat</span>
                            <span className="w-28 shrink-0 text-center hidden lg:block">Lot #</span>
                            <span className="w-24 shrink-0 text-right">Expiry Date</span>
                            <span className="w-20 shrink-0 text-right">Days</span>
                            <span className="w-12 shrink-0 text-right">Qty</span>
                            <span className="w-16 shrink-0 text-right">Action</span>
                          </div>

                          <div>
                            {unitItems.map(item => {
                              const days = item.days_until_expiry
                              const daysLabel = days < 0
                                ? `${Math.abs(days)}d ago`
                                : days === 0 ? 'Today' : `${days}d`
                              const daysColor = days < 0
                                ? 'text-red-400 font-bold'
                                : days < 30 ? 'text-orange-400 font-semibold'
                                : days < 90 ? 'text-yellow-400'
                                : 'text-gray-400'

                              return (
                                <div
                                  key={item.id}
                                  className={`px-4 py-2.5 transition-colors ${lc.row} ${rowUrgency(days)}`}
                                >
                                  {/* Mobile layout */}
                                  <div className="md:hidden">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-xs font-medium text-white truncate flex-1 mr-2">
                                        {item.item_name}
                                      </span>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs ${daysColor}`}>{daysLabel}</span>
                                        <button
                                          onClick={() => openDispose(item)}
                                          className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/60 hover:bg-red-800 text-red-300 transition-colors"
                                        >
                                          Dispose
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                      <span className={`px-1 py-0.5 rounded ${CAT_COLORS[item.category] || 'bg-gray-700 text-gray-300'}`}>
                                        {item.category}
                                      </span>
                                      {item.sku && <span className="text-gray-600 font-mono">{item.sku}</span>}
                                      {item.lot_number && <span className="text-gray-500">Lot: {item.lot_number}</span>}
                                      <span className="ml-auto text-gray-500">{item.effective_expiry} · Qty {item.quantity}</span>
                                    </div>
                                  </div>

                                  {/* Desktop layout */}
                                  <div className="hidden md:flex items-center">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <span className="text-xs text-white">{item.item_name}</span>
                                      {item.sku && (
                                        <span className="ml-1.5 text-gray-600 font-mono text-xs">{item.sku}</span>
                                      )}
                                    </div>
                                    <span className="w-16 shrink-0 text-center">
                                      <span className={`text-xs px-1 py-0.5 rounded ${CAT_COLORS[item.category] || 'bg-gray-700 text-gray-300'}`}>
                                        {item.category}
                                      </span>
                                    </span>
                                    <span className="w-28 shrink-0 text-center text-xs text-gray-500 font-mono hidden lg:block truncate">
                                      {item.lot_number || '—'}
                                    </span>
                                    <span className="w-24 shrink-0 text-right text-xs text-gray-400">
                                      {item.effective_expiry}
                                    </span>
                                    <span className={`w-20 shrink-0 text-right text-xs ${daysColor}`}>
                                      {daysLabel}
                                    </span>
                                    <span className="w-12 shrink-0 text-right text-xs font-mono text-white">
                                      {item.quantity}
                                    </span>
                                    <span className="w-16 shrink-0 text-right">
                                      <button
                                        onClick={() => openDispose(item)}
                                        className="px-2 py-0.5 rounded text-xs font-medium bg-red-900/60 hover:bg-red-800 text-red-300 transition-colors"
                                      >
                                        Dispose
                                      </button>
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </>
      )}

      {disposeItem && (
        <DisposeModal
          item={disposeItem}
          onClose={() => setDisposeItem(null)}
          onSuccess={handleDisposeSuccess}
        />
      )}
    </div>
  )
}
