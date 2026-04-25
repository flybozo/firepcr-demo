
import { FieldGuard } from '@/components/FieldGuard'
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState, useMemo } from 'react'
import { useSortable } from '@/hooks/useSortable'
import { SortableHeader } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { getCachedData } from '@/lib/offlineStore'
import { Link, useMatch, useSearchParams } from 'react-router-dom'
import { PageHeader, LoadingSkeleton, EmptyState, UnitFilterPills } from '@/components/ui'
import { UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  par_qty: number
  lot_number: string | null
  expiration_date: string | null
  unit_id: string | null
  unit: { id: string; name: string; unit_type?: { name: string } | null } | null
  incident_unit?: { unit: { name: string; unit_type?: { name: string } | null } } | null
  catalog_item_id?: string | null
  sku?: string | null
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
  DE: 'bg-amber-900 text-amber-300',
  RE: 'bg-green-900 text-green-300',
}

// No pagination — all data is loaded client-side and filtered in-memory

function InventoryPageInner() {
  const supabase = createClient()
  const roleLoading = usePermissionLoading()
  const isField = !usePermission('inventory.view')
  const assignment = useUserAssignment()
  const detailMatch = useMatch('/inventory/:id')
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const urlUnit = searchParams.get('unit') || ''
  const [unitFilter, setUnitFilter] = useState(urlUnit || 'All')
  // Auto-filter to user's unit when field role, or from URL param
  useEffect(() => {
    if (urlUnit) {
      setUnitFilter(urlUnit)
    } else if (isField && !assignment.loading && assignment.unit?.name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnitFilter(assignment.unit.name)
    }
  }, [roleLoading, isField, assignment.loading, assignment.unit?.name, urlUnit])
  const [catFilter, setCatFilter] = useState('All')
  const [search, setSearch] = useState('')
  // Page state kept for compat but unused — all items render
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [showAlsOnly, setShowAlsOnly] = useState(false)
  type InvSortKey = 'item_name' | 'category' | 'quantity' | 'par_qty' | 'unit'
  const { sortKey, sortDir, toggleSort, sortFn } = useSortable<InvSortKey>('item_name', 'asc')

  const [isOfflineData, setIsOfflineData] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Only show cached data when offline — never flash stale cache over live data
      const isOnline = navigator.onLine
      if (!isOnline) {
        try {
          const cached = await getCachedData('inventory') as any[]
          if (cached.length > 0) { setItems(cached); setLoading(false) }
        } catch {}
      }

      // Offline reconstruction — used when offline or when live query throws
      const buildFromCache = async () => {
        const [cachedInv, cachedFormulary, cachedUnits] = await Promise.all([
          getCachedData('inventory') as Promise<any[]>,
          getCachedData('formulary') as Promise<any[]>,
          getCachedData('units') as Promise<any[]>,
        ])
        const invData = cachedInv
        const formularyData = cachedFormulary
        const unitsData = cachedUnits as any[]
        const formularyByType: Record<string, any[]> = {}
        formularyData.forEach((f: any) => {
          if (!f.unit_type_id) return
          if (!formularyByType[f.unit_type_id]) formularyByType[f.unit_type_id] = []
          formularyByType[f.unit_type_id].push(f)
        })
        const invByUnit: Record<string, Record<string, any[]>> = {}
        invData.forEach((inv: any) => {
          const uid = inv.unit_id || ''
          const key = inv.catalog_item_id || inv.item_name
          if (!invByUnit[uid]) invByUnit[uid] = {}
          if (!invByUnit[uid][key]) invByUnit[uid][key] = []
          invByUnit[uid][key].push(inv)
        })
        const mergedItems: any[] = []
        unitsData.forEach((unit: any) => {
          const typeId = unit.unit_type_id
          const templateItems = formularyByType[typeId] || []
          const unitInv = invByUnit[unit.id] || {}
          templateItems.forEach((tmpl: any) => {
            const key = tmpl.catalog_item_id || tmpl.item_name
            const invRows = unitInv[key] || []
            const cat = tmpl.catalog_item?.category || tmpl.category || ''
            const als = tmpl.catalog_item?.is_als || tmpl.is_als || false
            if ((cat === 'CS' || cat === 'Rx') && invRows.length > 0) {
              invRows.forEach((inv: any) => {
                mergedItems.push({ id: inv.id, item_name: tmpl.item_name, category: cat, quantity: inv.quantity ?? 0, par_qty: inv.par_qty ?? tmpl.default_par_qty ?? 0, lot_number: inv.lot_number || null, expiration_date: inv.expiration_date || null, unit_id: unit.id, unit: unit, is_als: als, catalog_item_id: tmpl.catalog_item_id || null, sku: tmpl.catalog_item?.sku || null })
              })
            } else if (cat === 'CS' || cat === 'Rx') {
              mergedItems.push({ id: `tmpl-${unit.id}-${tmpl.id}`, item_name: tmpl.item_name, category: cat, quantity: 0, par_qty: tmpl.default_par_qty ?? 0, lot_number: null, expiration_date: null, unit_id: unit.id, unit: unit, is_als: als, catalog_item_id: tmpl.catalog_item_id || null, sku: tmpl.catalog_item?.sku || null })
            } else {
              const inv = invRows[0] || null
              mergedItems.push({ id: inv?.id || `tmpl-${unit.id}-${tmpl.id}`, item_name: tmpl.item_name, category: cat, quantity: inv?.quantity ?? 0, par_qty: inv?.par_qty ?? tmpl.default_par_qty ?? 0, lot_number: inv?.lot_number || null, expiration_date: inv?.expiration_date || null, unit_id: unit.id, unit: unit, is_als: als, catalog_item_id: tmpl.catalog_item_id || null, sku: tmpl.catalog_item?.sku || null })
            }
          })
        })
        setItems(mergedItems)
        setIsOfflineData(true)
        setLoading(false)
      }

      if (!navigator.onLine) {
        await buildFromCache()
        return
      }

      // Load inventory + formulary templates + units in parallel
      try {
      // Paginate formulary and inventory — PostgREST caps single responses at 1000 rows
      // regardless of the client .limit() value, so order-based queries drop tail rows.
      const paginate = async (fetch: (from: number, to: number) => any): Promise<any[]> => {
        const rows: any[] = []
        for (let from = 0; ; from += 1000) {
          const { data } = await fetch(from, from + 999)
          if (!data || data.length === 0) break
          rows.push(...data)
          if (data.length < 1000) break
        }
        return rows
      }
      const [formularyData, invData, unitsResult] = await Promise.all([
        paginate((from, to) => supabase
          .from('formulary_templates')
          .select('id, item_name, default_par_qty, unit_type_id, catalog_item_id, catalog_item:item_catalog(sku, category, is_als)')
          .order('id')
          .range(from, to)),
        paginate((from, to) => supabase
          .from('unit_inventory')
          .select('id, item_name, category, quantity, par_qty, lot_number, expiration_date, unit_id, catalog_item_id')
          .order('id')
          .range(from, to)),
        supabase
          .from('units')
          .select('id, name, unit_type_id, unit_type:unit_types(name)')
          .eq('active', true),
      ])

      if (unitsResult.error) console.error('[Inventory] units query error:', unitsResult.error)
      const unitsData = (unitsResult.data || []) as any[]

      console.log('[Inventory] loaded:', { inv: invData.length, formulary: formularyData.length, units: unitsData.length })

      // Build unit lookup maps
      const unitMap: Record<string, any> = {}
      const unitTypeByUnitId: Record<string, string> = {}
      unitsData.forEach((u: any) => {
        unitMap[u.id] = u
        if (u.unit_type_id) unitTypeByUnitId[u.id] = u.unit_type_id
      })

      // Group formulary by unit_type_id
      const formularyByType: Record<string, any[]> = {}
      formularyData.forEach((f: any) => {
        if (!f.unit_type_id) return
        if (!formularyByType[f.unit_type_id]) formularyByType[f.unit_type_id] = []
        formularyByType[f.unit_type_id].push(f)
      })

      // Build inventory index keyed by catalog_item_id (preferred) or item_name fallback.
      // catalog_item_id is the stable join key; item_name fallback handles items added after migration.
      const invByUnit: Record<string, Record<string, any[]>> = {}
      invData.forEach((inv: any) => {
        const uid = inv.unit_id || ''
        const key = inv.catalog_item_id || inv.item_name
        if (!invByUnit[uid]) invByUnit[uid] = {}
        if (!invByUnit[uid][key]) invByUnit[uid][key] = []
        invByUnit[uid][key].push(inv)
      })

      // For each unit, merge formulary template with actual inventory
      const mergedItems: any[] = []
      unitsData.forEach((unit: any) => {
        const typeId = unit.unit_type_id
        const templateItems = formularyByType[typeId] || []
        const unitInv = invByUnit[unit.id] || {}

        templateItems.forEach((tmpl: any) => {
          const key = tmpl.catalog_item_id || tmpl.item_name
          const invRows = unitInv[key] || []

          const cat = (tmpl.catalog_item as any)?.category || ''
          const als = (tmpl.catalog_item as any)?.is_als || false
          if ((cat === 'CS' || cat === 'Rx') && invRows.length > 0) {
            // CS and Rx items: one row per lot number in inventory
            invRows.forEach((inv: any) => {
              mergedItems.push({
                id: inv.id,
                item_name: tmpl.item_name,
                category: cat,
                quantity: inv.quantity ?? 0,
                par_qty: inv.par_qty ?? tmpl.default_par_qty ?? 0,
                lot_number: inv.lot_number || null,
                expiration_date: inv.expiration_date || null,
                unit_id: unit.id,
                unit: unit,
                is_als: als,
                catalog_item_id: tmpl.catalog_item_id || null,
                sku: (tmpl.catalog_item as any)?.sku || null,
              })
            })
          } else if ((cat === 'CS' || cat === 'Rx') && invRows.length === 0) {
            // CS/Rx item with no inventory yet — show one row at qty 0
            mergedItems.push({
              id: `tmpl-${unit.id}-${tmpl.id}`,
              item_name: tmpl.item_name,
              category: cat,
              quantity: 0,
              par_qty: tmpl.default_par_qty ?? 0,
              lot_number: null,
              expiration_date: null,
              unit_id: unit.id,
              unit: unit,
              is_als: als,
              catalog_item_id: tmpl.catalog_item_id || null,
              sku: (tmpl.catalog_item as any)?.sku || null,
            })
          } else {
            // OTC/Supply/Equipment: one row per template item, merge with first inventory match
            const inv = invRows[0] || null
            mergedItems.push({
              id: inv?.id || `tmpl-${unit.id}-${tmpl.id}`,
              item_name: tmpl.item_name,
              category: cat,
              quantity: inv?.quantity ?? 0,
              par_qty: inv?.par_qty ?? tmpl.default_par_qty ?? 0,
              lot_number: inv?.lot_number || null,
              expiration_date: inv?.expiration_date || null,
              unit_id: unit.id,
              unit: unit,
              is_als: als,
              catalog_item_id: tmpl.catalog_item_id || null,
              sku: (tmpl.catalog_item as any)?.sku || null,
            })
          }
        })
      })

      // No orphaned rows — formulary is the sole source of truth for item types.
      // Any inventory rows not matching a template are ignored.
      console.log('[Inventory] merge result:', mergedItems.length, 'items.',
        'By category:', Object.entries(mergedItems.reduce((acc: Record<string, number>, i: any) => {
          acc[i.category] = (acc[i.category] || 0) + 1; return acc
        }, {})))

      setItems(mergedItems)
      setIsOfflineData(false)
      setLoading(false)
      } catch (err) {
        console.error('[Inventory] online load failed, falling back to cache:', err)
        await buildFromCache()
      }
    }
    load()
  }, [])

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  // Filter changes no longer need page reset

  // Unit type lookup map — only recomputes when items changes
  const unitTypeMap = useMemo(() => {
    const map: Record<string, string> = {}
    items.forEach(i => {
      const name = (i as any)?.unit?.name
      const type = (i as any)?.unit?.unit_type?.name || ''
      if (name) map[name] = type
    })
    return map
  }, [items])

  const units = useMemo(() => ['All', ...Array.from(new Set(
    items.map(i => (i as any)?.unit?.name).filter(Boolean)
  )).sort((a, b) => {
    const aOrder = UNIT_TYPE_ORDER[unitTypeMap[a]] ?? 99
    const bOrder = UNIT_TYPE_ORDER[unitTypeMap[b]] ?? 99
    return aOrder !== bOrder ? aOrder - bOrder : a.localeCompare(b)
  })], [items, unitTypeMap])

  const filtered = useMemo(() => items.filter(item => {
    const unitName = (item as any)?.unit?.name
    const effectiveFilter = isField && assignment.unit?.name ? assignment.unit.name : unitFilter
    if (effectiveFilter !== 'All' && unitName !== effectiveFilter) return false
    if (catFilter !== 'All' && item.category !== catFilter) return false
    if (showLowOnly && item.quantity > item.par_qty) return false
    if (showAlsOnly && !(item as any).is_als) return false
    if (search && !item.item_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [items, unitFilter, catFilter, search, showLowOnly, showAlsOnly, isField, assignment.unit])

  const sorted = useMemo(() => sortFn(filtered, (item, key) => {
    if (key === 'item_name') return item.item_name
    if (key === 'category') return item.category
    if (key === 'quantity') return item.quantity
    if (key === 'par_qty') return item.par_qty
    if (key === 'unit') return (item as any)?.unit?.name ?? ''
    return ''
  }), [filtered, sortFn])
  const paginated = sorted
  const lowCount = useMemo(
    () => items.filter(i => i.quantity <= i.par_qty).length,
    [items]
  )

  return (
    <div className="p-4 md:p-6">
      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-3">
          📦 Showing cached data — changes will sync when back online
        </div>
      )}
      <PageHeader
        title="Inventory"
        subtitle={`${filtered.length} items${lowCount > 0 ? ` · ${lowCount} low stock` : ''}`}
        actions={
          <Link to="/inventory/add"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-semibold transition-colors">
            + Add
          </Link>
        }
        className="mb-4 mt-8 md:mt-0"
      />

      {/* Filters - compact */}
      <div className="space-y-2 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600" />

        {/* Desktop: category pills */}
        <div className="hidden md:flex gap-1.5 flex-wrap">
          {['All', 'CS', 'Rx', 'OTC', 'DE', 'RE'].map(c => (
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
          {/* ALS only toggle */}
          <button onClick={() => setShowAlsOnly(v => !v)}
            className={'px-2 py-1 rounded text-xs font-medium transition-colors ' + (showAlsOnly ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
            ALS
          </button>
        </div>
        {/* Mobile: category dropdown + low stock toggle */}
        <div className="md:hidden flex gap-2">
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="All">All Categories</option>
            <option value="CS">CS</option>
            <option value="Rx">Rx</option>
            <option value="OTC">OTC</option>
          </select>
          <button onClick={() => setShowLowOnly(v => !v)}
            className={'px-3 py-2 rounded-lg text-xs font-medium transition-colors ' + (showLowOnly ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
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
          <UnitFilterPills
            units={units}
            selected={unitFilter}
            onSelect={setUnitFilter}
            unitTypeMap={unitTypeMap}
          />
        )}
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} header />
      ) : (
        <>
          {/* Table */}
          <div className={lc.container}>
            {/* Header */}
            <div className="flex items-center px-3 py-1.5 text-xs font-semibold uppercase tracking-wide border-b theme-card-header">
              <SortableHeader label="Item" sortKey="item_name" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} className="flex-1 min-w-0" />
              <SortableHeader label="Unit" sortKey="unit" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} className="w-20 justify-center hidden md:flex" />
              <span className="w-16 text-center hidden lg:block text-gray-500">SKU</span>
              <SortableHeader label="Cat" sortKey="category" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} className="w-10 justify-center" />
              <SortableHeader label="Qty" sortKey="quantity" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} className="w-12 justify-end" />
              <SortableHeader label="Par" sortKey="par_qty" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} className="w-10 justify-end text-gray-600" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-800/60">
              {paginated.map(item => {
                const low = item.quantity <= item.par_qty
                const unitName = (item as any)?.unit?.name
                return (
                  <Link key={item.id} to={`/inventory/${item.id}`}
                    className={`flex items-center px-3 py-1.5 cursor-pointer ${lc.rowCls(detailMatch?.params?.id === item.id)}${detailMatch?.params?.id !== item.id && low ? ' bg-red-950/10' : ''}`}>
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
                    {item.sku && <span className="w-16 text-center text-xs text-gray-600 font-mono hidden lg:block truncate">{item.sku}</span>}
                    {!item.sku && <span className="w-16 hidden lg:block" />}
                    <span className="w-10 text-center">
                      <span className={`text-xs px-1 py-0.5 rounded ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>
                        {item.category}
                      </span>
                    </span>
                    {(item as any).is_als && (
                      <span className="w-8 text-center hidden sm:block">
                        <span className="text-xs px-1 py-0.5 rounded bg-blue-900 text-blue-300">ALS</span>
                      </span>
                    )}
                    {!(item as any).is_als && <span className="w-8 hidden sm:block" />}
                    <span className={`w-12 text-right text-xs font-mono font-semibold ${low ? 'text-red-400' : 'text-white'}`}>
                      {item.quantity}
                    </span>
                    <span className="w-10 text-right text-xs text-gray-600">{item.par_qty}</span>
                  </Link>
                )
              })}
              {paginated.length === 0 && (
                <EmptyState icon="📦" message="No items found." className="py-6" />
              )}
            </div>
          </div>

          {/* Item count */}
          <div className="mt-2 px-1">
            <span className="text-xs text-gray-500">{filtered.length} items</span>
          </div>
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
