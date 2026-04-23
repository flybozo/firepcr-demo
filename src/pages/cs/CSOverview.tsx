
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { FieldGuard } from '@/components/FieldGuard'
import { queryActiveUnits } from '@/lib/services/cs'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { unitFilterButtonClass, UNIT_TYPE_ORDER } from '@/lib/unitColors'
import { loadList } from '@/lib/offlineFirst'
import { getCachedData } from '@/lib/offlineStore'

type UnitInventoryItem = {
  id: string
  item_name: string
  quantity: number
  cs_lot_number: string | null
  cs_expiration_date: string | null
}

type CSTransaction = {
  id: string
  transfer_type: string
  drug_name: string
  lot_number: string | null
  from_unit: string | null
  to_unit: string | null
  quantity: number
  performed_by: string | null
  created_at: string
}

type UnitData = {
  unitName: string
  incidentUnitId: string | null
  items: UnitInventoryItem[]
}

const CS_UNIT_TYPE: Record<string, string> = {
  'Warehouse': 'Warehouse',
  'Unit 1': 'Ambulance', 'Unit 2': 'Ambulance', 'Unit 3': 'Ambulance', 'Unit 4': 'Ambulance',
  'Med 1': 'Med Unit', 'Med 2': 'Med Unit', 'Cache': 'Med Unit',
  'REMS 1': 'REMS', 'REMS 2': 'REMS',
}

const UNITS = ['Warehouse', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Med 1', 'Med 2', 'REMS 1', 'REMS 2']

const TYPE_COLORS: Record<string, string> = {
  Receive: 'text-green-400',
  Transfer: 'text-blue-400',
  Administer: 'text-orange-400',
  Waste: 'text-red-400',
  Audit: 'text-gray-400',
  Return: 'text-purple-400',
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false
  const exp = new Date(dateStr)
  const now = new Date()
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff < 90
}

function CSOverviewPageInner() {
  const supabase = createClient()
  const roleLoading = usePermissionLoading()
  const canCSView = usePermission('cs.view')
  const isField = !canCSView
  const assignment = useUserAssignment()
  const [units, setUnits] = useState<UnitData[]>([])
  const [transactions, setTransactions] = useState<CSTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUnit, setSelectedUnit] = useState<string>('All')
  const [isOfflineData, setIsOfflineData] = useState(false)

  // Phase 1: show cache only when offline
  useEffect(() => {
    if (!navigator.onLine) {
      const preload = async () => {
        try {
          const cached = await getCachedData('inventory') as any[]
          const csItems = cached.filter((i: any) => i.category === 'CS')
          if (csItems.length > 0) {
            const grouped: Record<string, UnitInventoryItem[]> = {}
            for (const item of csItems) {
              const key = (item as any).unit_id || 'unknown'
              if (!grouped[key]) grouped[key] = []
              grouped[key].push(item)
            }
            const offlineUnits: UnitData[] = Object.entries(grouped).map(([iuid, items]) => ({
              unitName: UNITS.find(n => n) || 'Unit',
              incidentUnitId: iuid,
              items,
            }))
            if (offlineUnits.length > 0) {
              setUnits(offlineUnits)
              setIsOfflineData(true)
              setLoading(false)
            }
          }
        } catch {}
      }
      preload()
    }
  }, [])

  // Phase 2: network fetch (runs after role resolves, refreshes over cache)
  useEffect(() => {
    if (roleLoading || assignment.loading) return
    loadData()
  }, [isField, assignment.loading, assignment.unit?.name])

  async function loadData() {
    // Phase 2 network fetch — don't reset loading to true if cache already rendered
    try {
      // Load units for name lookup
      const unitsResult = await loadList(
        () => queryActiveUnits() as any,
        'units'
      )
      const unitIdToName: Record<string, string> = {}
      const unitMap: Record<string, string> = {}
      if (unitsResult.data) {
        for (const u of unitsResult.data) {
          unitIdToName[u.id] = u.name
          unitMap[u.name] = u.id
        }
      }

      // Load CS inventory for field units (unit_inventory)
      const { data: inventory } = await loadList(
        () => supabase
          .from('unit_inventory')
          .select('id, item_name, quantity, cs_lot_number, cs_expiration_date, unit_id, catalog_item_id')
          .eq('category', 'CS')
          .gt('quantity', 0),
        'inventory',
        (items) => items.filter((i: any) => i.category === 'CS' && (i.quantity || 0) > 0)
      )

      // Load CS inventory for warehouse (warehouse_inventory)
      let warehouseInventory: any[] = []
      try {
        const { data } = await supabase
          .from('warehouse_inventory')
          .select('id, item_name, quantity, cs_lot_number, cs_expiration_date')
          .eq('category', 'CS')
          .gt('quantity', 0)
        warehouseInventory = data || []
      } catch {}

      // Group field units by unit name
      const unitDataMap: Record<string, UnitInventoryItem[]> = {}
      if (inventory) {
        for (const item of inventory) {
          const unitName = unitIdToName[item.unit_id] || 'Unknown'
          if (unitName === 'Warehouse') continue // skip — warehouse uses separate table
          if (!unitDataMap[unitName]) unitDataMap[unitName] = []
          unitDataMap[unitName].push(item)
        }
      }

      const unitsData: UnitData[] = UNITS.map(name => ({
        unitName: name,
        incidentUnitId: unitMap[name] || null,
        items: name === 'Warehouse'
          ? (warehouseInventory || []).map(i => ({ ...i, unit_id: unitMap["Warehouse"] || null }))
          : (unitDataMap[name] || []),
      }))

      // Field users: only show their unit's CS inventory
      const filteredUnits = isField && !assignment.loading && assignment.unit?.name
        ? unitsData.filter(u => u.unitName === assignment.unit!.name)
        : unitsData
      setUnits(filteredUnits)

      // Load recent transactions
      let txns: any[] = []
      try {
        const { data } = await supabase
          .from('cs_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)
        txns = data || []
      } catch {}

      // Field users: filter transactions to their unit
      const filteredTxns = isField && !assignment.loading && assignment.unit?.name
        ? (txns || []).filter((t: any) => t.unit_name === assignment.unit?.name || t.from_unit === assignment.unit?.name || t.to_unit === assignment.unit?.name)
        : (txns || [])
      setTransactions(filteredTxns)
    } catch {
      // Offline — load cached CS inventory
      const cached = await getCachedData('inventory')
      const csItems = cached.filter((i: any) => i.category === 'CS') as UnitInventoryItem[]
      if (csItems.length > 0) {
        // Group by incident_unit_id as best we can without unit name lookup
        const grouped: Record<string, UnitInventoryItem[]> = {}
        for (const item of csItems) {
          const key = (item as any).unit_id || 'unknown'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(item)
        }
        const offlineUnits: UnitData[] = Object.entries(grouped).map(([iuid, items]) => ({
          unitName: UNITS.find(n => n) || 'Unit',
          incidentUnitId: iuid,
          items,
        }))
        setUnits(offlineUnits)
        setIsOfflineData(true)
      }
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const warehouse = units.find(u => u.unitName === 'Warehouse')
  const fieldUnits = units.filter(u => u.unitName !== 'Warehouse')
  const displayedFieldUnits = (!isField && selectedUnit !== 'All')
    ? fieldUnits.filter(u => u.unitName === selectedUnit)
    : fieldUnits

  return (
    <div className="p-4 md:p-6 mt-8 md:mt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🔐 Controlled Substances</h1>
          <p className="text-gray-400 text-sm mt-1">Inventory status across all units</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/cs/receive" className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg font-medium">+ Receive</Link>
          <Link to="/cs/transfer" className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg font-medium">⇄ Transfer</Link>
          <Link to="/cs/count" className="px-3 py-2 bg-orange-700 hover:bg-orange-600 text-white text-sm rounded-lg font-medium">📋 Count</Link>
        </div>
      </div>

      {isOfflineData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-4 flex items-center gap-2">
          📶 Showing cached data — changes will sync when back online
        </div>
      )}

      {/* Unit filter — admin sees all + filter; field user sees locked chip */}
      {!loading && (
        <div className="mb-4">
          {isField ? (
            assignment.unit?.name && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Showing:</span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-900 text-blue-300">{assignment.unit.name}</span>
              </div>
            )
          ) : (
            <>
              {/* Desktop: unit pills */}
              <div className="hidden md:flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Filter:</span>
                <button onClick={() => setSelectedUnit('All')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilterButtonClass('All', selectedUnit === 'All')}`}>
                  All Units
                </button>
                {[...fieldUnits].sort((a,b) => {
                  const aO = UNIT_TYPE_ORDER[CS_UNIT_TYPE[a.unitName] || ''] ?? 99
                  const bO = UNIT_TYPE_ORDER[CS_UNIT_TYPE[b.unitName] || ''] ?? 99
                  return aO !== bO ? aO - bO : a.unitName.localeCompare(b.unitName)
                }).map(u => (
                  <button key={u.unitName} onClick={() => setSelectedUnit(u.unitName)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${unitFilterButtonClass(CS_UNIT_TYPE[u.unitName] || '', selectedUnit === u.unitName)}`}>
                    {u.unitName}
                  </button>
                ))}
              </div>
              {/* Mobile: unit dropdown */}
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                <option value="All">All Units</option>
                {[...fieldUnits].sort((a,b) => {
                  const aO = UNIT_TYPE_ORDER[CS_UNIT_TYPE[a.unitName] || ''] ?? 99
                  const bO = UNIT_TYPE_ORDER[CS_UNIT_TYPE[b.unitName] || ''] ?? 99
                  return aO !== bO ? aO - bO : a.unitName.localeCompare(b.unitName)
                }).map(u => (
                  <option key={u.unitName} value={u.unitName}>{u.unitName}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading CS inventory...</p>
      ) : (
        <>
          {/* Warehouse Card — admin only */}
          {!isField && (
            <div className="bg-gray-900 rounded-xl border border-orange-700 bg-orange-900/20 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white">🏭 Warehouse</h2>
                <Link to="/cs/receive" className="text-xs text-green-400 hover:text-green-300">+ Receive CS</Link>
              </div>
              {warehouse && warehouse.items.length > 0 ? (
                <div className="space-y-2">
                  {warehouse.items.map(item => (
                    <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg ${isExpiringSoon(item.cs_expiration_date) ? 'bg-red-900/30 border border-red-700' : 'bg-gray-800/60'}`}>
                      <div>
                        <span className="text-white text-sm font-medium">{item.item_name}</span>
                        <span className="text-gray-400 text-xs ml-2">Lot: {item.cs_lot_number || '—'}</span>
                        <span className="text-gray-400 text-xs ml-2">Exp: {item.cs_expiration_date || '—'}</span>
                        {isExpiringSoon(item.cs_expiration_date) && <span className="text-red-400 text-xs ml-2">⚠ Expiring</span>}
                      </div>
                      <span className="text-orange-300 font-bold text-sm">{item.quantity} units</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No CS inventory in warehouse</p>
              )}
            </div>
          )}

          {/* Unit Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {displayedFieldUnits.map(unit => (
              <div key={unit.unitName} className={`bg-gray-900 rounded-xl p-4 border ${unit.items.length > 0 ? 'border-orange-700 bg-orange-900/10' : 'border-gray-700'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white text-sm">{unit.unitName}</h3>
                  <div className="flex gap-2">
                    <Link to={`/cs/transfer?from=${encodeURIComponent(unit.unitName)}`} className="text-xs text-blue-400 hover:text-blue-300">Transfer</Link>
                    <Link to={`/cs/count?unit=${encodeURIComponent(unit.unitName)}`} className="text-xs text-orange-400 hover:text-orange-300">Count</Link>
                  </div>
                </div>
                {unit.items.length > 0 ? (
                  <div className="space-y-1">
                    {unit.items.map(item => (
                      <div key={item.id} className={`text-xs flex justify-between items-center gap-2 p-1.5 rounded ${isExpiringSoon(item.cs_expiration_date) ? 'bg-red-900/30' : 'bg-gray-800/50'}`}>
                        <div>
                          <span className="text-white">{item.item_name}</span>
                          <span className="text-gray-500 ml-2">Lot: {item.cs_lot_number || '—'}</span>
                        </div>
                        <span className="text-orange-300 font-bold">{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs">No CS on unit</p>
                )}
              </div>
            ))}
          </div>

          {/* Recent Transactions */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-white">Recent CS Transactions</h2>
              <Link to="/cs/audit" className="text-xs text-gray-400 hover:text-gray-300">View all →</Link>
            </div>
            {transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2 pr-3">Date</th>
                      <th className="text-left py-2 pr-3">Type</th>
                      <th className="text-left py-2 pr-3">Drug</th>
                      <th className="text-left py-2 pr-3">From → To</th>
                      <th className="text-left py-2 pr-3">Qty</th>
                      <th className="text-left py-2">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id} className="border-b border-gray-800/50 hover:theme-card-footer">
                        <td className="py-2 pr-3 text-gray-400">{formatDate(t.created_at)}</td>
                        <td className={`py-2 pr-3 font-medium ${TYPE_COLORS[t.transfer_type] || 'text-gray-400'}`}>{t.transfer_type}</td>
                        <td className="py-2 pr-3 text-white">{t.drug_name}</td>
                        <td className="py-2 pr-3 text-gray-400">{t.from_unit || '—'} → {t.to_unit || '—'}</td>
                        <td className="py-2 pr-3 text-orange-300 font-bold">{t.quantity}</td>
                        <td className="py-2 text-gray-400">{t.performed_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recent CS transactions</p>
            )}
          </div>

        </>
      )}
    </div>
  )
}

export default function CSOverviewPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => a.unit?.name ? `/cs?unit=${encodeURIComponent(a.unit.name)}` : null}>
      <CSOverviewPageInner />
    </FieldGuard>
  )
}
