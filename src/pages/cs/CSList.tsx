/**
 * CSList — left-panel list of all CS inventory items, filterable by unit.
 * Clicking a row opens CSItemDetail in the right split-pane panel.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useMatch, Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { usePermission } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { unitFilterButtonClass, UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { PageHeader, LoadingSkeleton, EmptyState } from '@/components/ui'
import { getCachedData } from '@/lib/offlineStore'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'

type CSItem = {
  id: string
  item_name: string
  quantity: number
  par_qty: number
  cs_lot_number: string | null
  cs_expiration_date: string | null
  unit_id: string | null
  unitName: string
}

const ALL_UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Med 1', 'Med 2', 'REMS 1', 'REMS 2', 'Cache', 'Warehouse']

function unitType(name: string) {
  if (name.startsWith('Unit')) return 'Ambulance'
  if (name.startsWith('Med') || name === 'Cache') return 'Med Unit'
  if (name.startsWith('REMS')) return 'REMS'
  if (name === 'Warehouse') return 'Warehouse'
  return ''
}

function isExpired(date: string | null) {
  if (!date) return false
  return new Date(date) < new Date()
}

function isExpiringSoon(date: string | null) {
  if (!date) return false
  const exp = new Date(date)
  const warn = new Date(); warn.setDate(warn.getDate() + 90)
  return exp < warn && !isExpired(date)
}

export default function CSList() {
  const supabase = createClient()
  const navigate = useNavigate()
  const detailMatch = useMatch('/cs/item/:id')
  const isField = !usePermission('cs.view')
  const assignment = useUserAssignment()

  const [items, setItems] = useState<CSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unitFilter, setUnitFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [isOfflineData, setIsOfflineData] = useState(false)

  // Field users locked to their unit
  useEffect(() => {
    if (isField && !assignment.loading && assignment.unit?.name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnitFilter(assignment.unit.name)
    }
  }, [isField, assignment.loading, assignment.unit?.name])

  useEffect(() => {
    const load = async () => {
      // Show cached CS inventory only when offline
      if (!navigator.onLine) {
        try {
          const cached = await getCachedData('inventory') as any[]
          const csItems = cached.filter((i: any) => i.category === 'CS')
          if (csItems.length > 0) {
            setItems(csItems.map((r: any) => ({
              ...r,
              unitName: r.unit?.name || r.unit_name || 'Unknown',
            })))
            setIsOfflineData(true)
            setLoading(false)
            return
          }
        } catch {}
      }

      // Try network refresh
      try {
        const { data } = await supabase
          .from('unit_inventory')
          .select('id, item_name, quantity, par_qty, cs_lot_number, cs_expiration_date, unit_id, catalog_item_id, unit:units(name)')
          .eq('category', 'CS')
          .order('item_name')
        const mapped: CSItem[] = (data || []).map((r: any) => ({
          ...r,
          unitName: r.unit?.name || 'Unknown',
        }))
        setItems(mapped)
        setIsOfflineData(false)
      } catch {
        setIsOfflineData(typeof navigator !== 'undefined' && !navigator.onLine)
      }
      setLoading(false)
    }
    load()

    const handleOnline = () => { load() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const availableUnits = [...new Set(items.map(i => i.unitName))]
    .sort((a, b) => {
      const aO = UNIT_TYPE_ORDER[unitType(a)] ?? 99
      const bO = UNIT_TYPE_ORDER[unitType(b)] ?? 99
      return aO !== bO ? aO - bO : a.localeCompare(b)
    })

  const filtered = items.filter(i => {
    if (unitFilter !== 'All' && i.unitName !== unitFilter) return false
    if (search && !i.item_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col min-h-full">
      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 px-3 py-2 text-amber-300 text-xs flex items-center gap-2">
          📶 Offline — showing cached CS inventory. Transfers are unavailable until you reconnect.
        </div>
      )}
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-800 mt-8 md:mt-0 space-y-3">
        <PageHeader
          title="🔐 CS Inventory"
          subtitle={`${filtered.length} items`}
          actions={
            <div className="flex gap-2">
              <Link to="/cs/receive" className="px-2.5 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg font-medium">+ Receive</Link>
              <Link to="/cs/transfer" className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg font-medium">⇄ Transfer</Link>
              <Link to="/cs/count" className="px-2.5 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded-lg font-medium">📋 Count</Link>
            </div>
          }
        />

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search medications..."
          className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-gray-600"
        />

        {/* Unit filter */}
        {isField ? (
          assignment.unit?.name && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Unit:</span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit.name}</span>
            </div>
          )
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setUnitFilter('All')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilterButtonClass('', unitFilter === 'All')}`}>
              All
            </button>
            {availableUnits.map(u => (
              <button key={u} onClick={() => setUnitFilter(u)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilterButtonClass(unitType(u), unitFilter === u)}`}>
                {u}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <LoadingSkeleton rows={5} header />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔐" message="No CS items found." />
      ) : (
        <div className="flex-1">
          {/* Column header */}
          <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 border-b border-gray-800 bg-gray-900/40">
            <span className="flex-1 min-w-0">Medication</span>
            <span className="w-16 text-center shrink-0">Qty</span>
            <span className="w-20 shrink-0 hidden sm:block">Expiry</span>
            {unitFilter === 'All' && <span className="w-20 shrink-0 text-right hidden md:block">Unit</span>}
          </div>
          {filtered.map(item => {
            const expired = isExpired(item.cs_expiration_date)
            const expiring = isExpiringSoon(item.cs_expiration_date)
            const low = item.quantity <= item.par_qty
            const selected = detailMatch?.params?.id === item.id
            return (
              <div
                key={item.id}
                onClick={() => navigate(`/cs/item/${item.id}`)}
                className={`flex items-center px-4 py-2.5 cursor-pointer border-b border-gray-800/50 text-sm transition-colors ${
                  selected ? 'bg-gray-700' : expired ? 'bg-red-950/10 hover:bg-gray-800' : 'hover:bg-gray-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${expired ? 'text-red-300' : expiring ? 'text-yellow-300' : 'text-white'}`}>
                    {item.item_name}
                  </span>
                  {item.cs_lot_number && (
                    <span className="ml-2 text-xs text-gray-600 font-mono">{item.cs_lot_number}</span>
                  )}
                  {expired && <span className="ml-2 text-xs bg-red-900 text-red-300 px-1 rounded">EXPIRED</span>}
                  {expiring && !expired && <span className="ml-2 text-xs bg-yellow-900 text-yellow-300 px-1 rounded">⚠</span>}
                </div>
                <span className={`w-16 text-center text-sm font-bold shrink-0 ${low ? 'text-red-400' : 'text-orange-300'}`}>
                  {item.quantity}
                  {low && <span className="text-xs text-red-600 ml-0.5">↓</span>}
                </span>
                <span className={`w-20 text-xs shrink-0 hidden sm:block font-mono ${expired ? 'text-red-400' : expiring ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {item.cs_expiration_date || '—'}
                </span>
                {unitFilter === 'All' && (
                  <span className="w-20 text-xs text-gray-500 text-right shrink-0 hidden md:block truncate">{item.unitName}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
