

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { getCachedById, cacheData, queueOfflineWrite } from '@/lib/offlineStore'
import { getIsOnline } from '@/lib/syncManager'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'

type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  par_qty: number
  lot_number: string | null
  expiration_date: string | null
  unit: string | null
  barcode: string | null
  upc: string | null
  incident_unit_id: string | null
  incident_unit: {
    unit: { name: string; id: string }
  } | null
}

type UnitCarrying = {
  id: string
  quantity: number
  incident_unit_id: string
  incident_unit: {
    unit: { name: string; id: string } | null
  } | null
}

const CAT_COLORS: Record<string, string> = {
  CS: 'bg-orange-900 text-orange-300',
  Rx: 'bg-blue-900 text-blue-300',
  OTC: 'bg-gray-700 text-gray-300',
  Supply: 'bg-gray-700 text-gray-300',
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-white">
        {value !== null && value !== undefined && value !== '' ? String(value) : <span className="text-gray-600">—</span>}
      </dd>
    </div>
  )
}

export default function InventoryDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const id = params.id as string

  const [item, setItem] = useState<InventoryItem | null>(null)
  const [unitsCarrying, setUnitsCarrying] = useState<UnitCarrying[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isOfflineData, setIsOfflineData] = useState(false)

  const load = async () => {
    // Show cached data instantly
    try {
      const cached = await getCachedById('inventory', id) as any
      if (cached) {
        setItem(cached as InventoryItem)
        setLoading(false)
      }
    } catch {}
    const { data: inv, offline } = await loadSingle<InventoryItem>(
      () => supabase
        .from('unit_inventory')
        .select(`
          id, item_name, category, quantity, par_qty, lot_number, expiration_date, unit,
          barcode, upc, incident_unit_id,
          incident_unit:incident_units(unit:units(id, name))
        `)
        .eq('id', id)
        .single() as any,
      'inventory',
      id
    )
    setItem(inv)
    if (offline) setIsOfflineData(true)

    // Load all units carrying same item
    if (inv?.item_name) {
      const { data: carrying } = await supabase
        .from('unit_inventory')
        .select(`
          id, quantity, incident_unit_id,
          incident_unit:incident_units(unit:units(id, name))
        `)
        .eq('item_name', inv.item_name)
        .order('quantity', { ascending: false })
      setUnitsCarrying((carrying as unknown as UnitCarrying[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const updateQuantity = async (delta: number) => {
    if (!item) return
    const newQty = Math.max(0, item.quantity + delta)
    setSaving(true)
    if (getIsOnline()) {
      const { error } = await supabase
        .from('unit_inventory')
        .update({ quantity: newQty })
        .eq('id', item.id)
      if (!error) {
        setItem({ ...item, quantity: newQty })
        await cacheData('inventory', [{ ...item, quantity: newQty }])
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } else {
      await queueOfflineWrite('unit_inventory', 'update', { id: item.id, quantity: newQty })
      setItem({ ...item, quantity: newQty })
      await cacheData('inventory', [{ ...item, quantity: newQty }])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!item) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Item not found.</p>
        <Link to="/inventory" className="text-red-400 underline">← Back</Link>
      </div>
    </div>
  )

  const low = item.quantity <= item.par_qty
  const unitName = (item.incident_unit as unknown as { unit: { name: string; id: string } } | null)?.unit?.name
  const unitId = (item.incident_unit as unknown as { unit: { name: string; id: string } } | null)?.unit?.id

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 mt-8 md:mt-0">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">

        <Link to="/inventory" className="text-gray-500 hover:text-gray-300 text-sm">← Inventory</Link>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Expiry warning banner */}
        {(item.category === 'CS' || item.category === 'Rx') && item.expiration_date && (() => {
          const exp = new Date(item.expiration_date)
          const now = new Date()
          const days90 = new Date(); days90.setDate(days90.getDate() + 90)
          if (exp < now) return (
            <div className="bg-red-900/60 border border-red-600 rounded-xl px-4 py-3 text-red-300 text-sm font-semibold">
              ⚠️ EXPIRED — This item expired on {item.expiration_date}. Do not use.
            </div>
          )
          if (exp < days90) return (
            <div className="bg-orange-900/40 border border-orange-600 rounded-xl px-4 py-3 text-orange-300 text-sm font-semibold">
              ⚠️ Expiring Soon — Expires {item.expiration_date}. Review and replace.
            </div>
          )
          return null
        })()}

        {/* Header */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{item.item_name}</h1>
              {unitName && <p className="text-gray-400 text-sm mt-0.5">{unitName}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>
                {item.category}
              </span>
              {low && <span className="text-xs text-red-400">⚠ Low Stock</span>}
            </div>
          </div>
        </div>

        {/* Quantity editor */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Quantity</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => updateQuantity(-1)}
              disabled={saving || item.quantity <= 0}
              className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xl font-bold transition-colors flex items-center justify-center"
            >
              −
            </button>
            <span className={`text-3xl font-mono font-bold w-16 text-center ${low ? 'text-red-400' : 'text-white'}`}>
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(1)}
              disabled={saving}
              className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-xl font-bold transition-colors flex items-center justify-center"
            >
              +
            </button>
            {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
            {saving && <span className="text-gray-500 text-sm">Saving...</span>}
          </div>
          <p className="text-xs text-gray-500">Par level: {item.par_qty}</p>
        </div>

        {/* Details */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Details</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Category" value={item.category} />
            <Field label="Unit" value={item.unit} />
            <Field label="Unit / Platform" value={unitName} />
            <Field label="Lot Number" value={item.lot_number} />
            <Field label="Expiration Date" value={item.expiration_date} />
            {item.barcode && <Field label="Barcode" value={item.barcode} />}
            {item.upc && <Field label="UPC" value={item.upc} />}
          </dl>
        </div>

        {/* Units carrying this item */}
        {unitsCarrying.length > 1 && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Units Carrying This Item</h2>
              <p className="text-xs text-gray-600 mt-0.5">Items may appear on multiple units</p>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/50">
                <span className="flex-1">Unit</span>
                <span className="w-24 text-right">Qty on Hand</span>
              </div>
              {unitsCarrying.map(uc => {
                const ucUnit = (uc.incident_unit as unknown as { unit?: { name?: string; id?: string } } | null)?.unit
                const isCurrent = uc.id === item.id
                return (
                  <div key={uc.id} className={`flex items-center px-3 py-2.5 border-b border-gray-800/50 last:border-0 text-sm ${isCurrent ? 'bg-gray-800/30' : ''}`}>
                    <span className="flex-1 font-medium text-white">
                      {ucUnit?.name || '—'}
                      {isCurrent && <span className="ml-2 text-xs text-gray-500">(this item)</span>}
                    </span>
                    <span className={`w-24 text-right text-xs font-mono ${uc.quantity <= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {uc.quantity}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Link to unit inventory */}
        {unitId && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <Link to={`/inventory?unitId=${unitId}`}
              className="text-blue-400 hover:text-blue-300 text-sm underline">
              → View all inventory for {unitName}
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
