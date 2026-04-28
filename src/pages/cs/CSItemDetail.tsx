/**
 * CSItemDetail — right-panel detail for a controlled substance inventory item.
 * Shows item info, lot/expiry, quantity vs par, and transaction history.
 * If the item has a catalog_item_id, uses CatalogItemPanel with a contextCard.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { CatalogItemPanel } from '@/components/inventory/CatalogItemPanel'
import type { CatalogItem } from '@/components/inventory/CatalogItemPanel'

type CSItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  par_qty: number
  lot_number: string | null
  expiration_date: string | null
  unit_of_measure: string | null
  unit_id: string | null
  incident_unit_id: string | null
  catalog_item_id: string | null
  unit: { name: string } | null
}

type Transaction = {
  id: string
  date: string | null
  time: string | null
  patient_name: string | null
  item_name: string | null
  qty_used: number | null
  qty_wasted: number | null
  dispensed_by: string | null
  lot_number: string | null
  indication: string | null
  witness_name: string | null
  entry_type: string | null
}

function isExpiringSoon(date: string | null) {
  if (!date) return false
  const exp = new Date(date)
  const warn = new Date(); warn.setDate(warn.getDate() + 90)
  return exp < warn
}

function isExpired(date: string | null) {
  if (!date) return false
  return new Date(date) < new Date()
}

export default function CSItemDetail() {
  const supabase = createClient()
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<CSItem | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  // Aggregated par/qty for (unit, item) — par lives on formulary_templates per unit_type.
  const [agg, setAgg] = useState<{ total: number; par: number } | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data: itemData } = await supabase
        .from('unit_inventory')
        .select('*, unit:units(name)')
        .eq('id', id)
        .single()
      setItem(itemData as CSItem)

      // Pull aggregated par from the canonical view (formulary_templates source of truth)
      if (itemData?.unit_id && itemData.item_name) {
        const aggQ = supabase
          .from('unit_inventory_aggregated')
          .select('total_quantity, par_qty')
          .eq('unit_id', itemData.unit_id)
        const { data: aggRows } = itemData.catalog_item_id
          ? await aggQ.eq('catalog_item_id', itemData.catalog_item_id).limit(1)
          : await aggQ.eq('item_name', itemData.item_name).limit(1)
        const a = (aggRows as any[])?.[0]
        if (a) setAgg({ total: a.total_quantity ?? 0, par: a.par_qty ?? 0 })
      }

      // Fetch transactions matching this item name + lot
      if (itemData) {
        const lot = (itemData as CSItem).lot_number
        let q = supabase.from('dispense_admin_log')
          .select('id, date, time, patient_name, item_name, qty_used, qty_wasted, dispensed_by, lot_number, indication, witness_name, entry_type')
          .eq('item_name', itemData.item_name)
          .order('date', { ascending: false })
          .order('time', { ascending: false })
          .limit(50)
        if (lot) q = q.eq('lot_number', lot)
        const { data: tx } = await q
        setTransactions((tx || []) as Transaction[])
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Loading…</div>
  if (!item) return <div className="flex items-center justify-center h-64 text-gray-500 text-sm">Item not found.</div>

  const lot = item.lot_number
  const exp = item.expiration_date
  const expired = isExpired(exp)
  const expiring = !expired && isExpiringSoon(exp)
  // "Below par" is per (unit, item), not per lot row. A unit with three lots @ 1 each meets a par of 3.
  const totalOnUnit = agg?.total ?? item.quantity
  const parOnUnit = agg?.par ?? 0
  const low = parOnUnit > 0 && totalOnUnit < parOnUnit

  // CS-specific context card — rendered above the catalog detail inside CatalogItemPanel
  const csContextCard = (_catalogItem: CatalogItem) => (
    <div className="theme-card rounded-xl border mb-5 p-4 space-y-4">
      {/* Quantity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="theme-card rounded-xl p-4 border">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">On Hand (this lot)</p>
          <p className={`text-3xl font-bold text-white`}>{item.quantity}</p>
          {item.unit_of_measure && <p className="text-xs text-gray-600 mt-0.5">{item.unit_of_measure}</p>}
        </div>
        <div className="theme-card rounded-xl p-4 border">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Unit Total / Par</p>
          <p className={`text-3xl font-bold ${low ? 'text-red-400' : 'text-white'}`}>
            {totalOnUnit}<span className="text-gray-500 text-xl">/{parOnUnit}</span>
          </p>
          {low ? (
            <p className="text-xs text-red-400 mt-0.5">↓ Below par</p>
          ) : parOnUnit > 0 ? (
            <p className="text-xs text-gray-600 mt-0.5">across all lots on this unit</p>
          ) : null}
        </div>
      </div>

      {/* Lot / Expiry */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Lot #</p>
          <p className="text-sm text-white font-mono">{lot || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Expiration</p>
          <p className={`text-sm font-mono ${expired ? 'text-red-400' : expiring ? 'text-yellow-400' : 'text-white'}`}>
            {exp || '—'}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <Link
          to={`/cs/count?unit=${encodeURIComponent(item.unit?.name || '')}`}
          className="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded-lg font-medium transition-colors"
        >
          📋 Count
        </Link>
        <Link
          to={`/cs/transfer?from=${encodeURIComponent(item.unit?.name || '')}`}
          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg font-medium transition-colors"
        >
          ⇄ Transfer
        </Link>
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Transaction History {lot && <span className="normal-case text-gray-600">· Lot {lot}</span>}
        </h3>
        {transactions.length === 0 ? (
          <p className="text-xs text-gray-600">No transactions found for this lot.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="theme-card rounded-lg border px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-gray-400">{tx.date} {tx.time}</span>
                  <div className="flex gap-1">
                    {tx.qty_used != null && tx.qty_used > 0 && (
                      <span className="text-orange-300 font-bold">−{tx.qty_used} used</span>
                    )}
                    {tx.qty_wasted != null && tx.qty_wasted > 0 && (
                      <span className="text-red-400 font-bold ml-1">−{tx.qty_wasted} wasted</span>
                    )}
                  </div>
                </div>
                <div className="text-gray-300">{tx.patient_name || 'No patient'}</div>
                {tx.indication && <div className="text-gray-500 truncate">{tx.indication}</div>}
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>By: {tx.dispensed_by || '—'}</span>
                  {tx.witness_name && <span>Witness: {tx.witness_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // If linked to catalog, use CatalogItemPanel (header + badges come from panel)
  if (item.catalog_item_id) {
    return (
      <CatalogItemPanel
        catalogItemId={item.catalog_item_id}
        contextCard={csContextCard}
      />
    )
  }

  // Fallback: no catalog link — render original layout
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800 shrink-0 pr-12">
        <h2 className="text-base font-bold text-white">{item.item_name}</h2>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300">CS</span>
          {item.unit && <span className="text-xs text-gray-400">{item.unit.name}</span>}
          {expired && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">EXPIRED</span>}
          {expiring && !expired && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900 text-yellow-300">⚠ Expiring Soon</span>}
        </div>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Quantity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="theme-card rounded-xl p-4 border">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">On Hand (this lot)</p>
            <p className="text-3xl font-bold text-white">{item.quantity}</p>
            {item.unit_of_measure && <p className="text-xs text-gray-600 mt-0.5">{item.unit_of_measure}</p>}
          </div>
          <div className="theme-card rounded-xl p-4 border">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Unit Total / Par</p>
            <p className={`text-3xl font-bold ${low ? 'text-red-400' : 'text-white'}`}>
              {totalOnUnit}<span className="text-gray-500 text-xl">/{parOnUnit}</span>
            </p>
            {low ? (
              <p className="text-xs text-red-400 mt-0.5">↓ Below par</p>
            ) : parOnUnit > 0 ? (
              <p className="text-xs text-gray-600 mt-0.5">across all lots on this unit</p>
            ) : null}
          </div>
        </div>

        {/* Lot / Expiry */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Lot #</p>
            <p className="text-sm text-white font-mono">{lot || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Expiration</p>
            <p className={`text-sm font-mono ${expired ? 'text-red-400' : expiring ? 'text-yellow-400' : 'text-white'}`}>
              {exp || '—'}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Link
            to={`/cs/count?unit=${encodeURIComponent(item.unit?.name || '')}`}
            className="px-3 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded-lg font-medium transition-colors"
          >
            📋 Count
          </Link>
          <Link
            to={`/cs/transfer?from=${encodeURIComponent(item.unit?.name || '')}`}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg font-medium transition-colors"
          >
            ⇄ Transfer
          </Link>
        </div>

        {/* Transaction history */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Transaction History {lot && <span className="normal-case text-gray-600">· Lot {lot}</span>}
          </h3>
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-600">No transactions found for this lot.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="theme-card rounded-lg border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-gray-400">{tx.date} {tx.time}</span>
                    <div className="flex gap-1">
                      {tx.qty_used != null && tx.qty_used > 0 && (
                        <span className="text-orange-300 font-bold">−{tx.qty_used} used</span>
                      )}
                      {tx.qty_wasted != null && tx.qty_wasted > 0 && (
                        <span className="text-red-400 font-bold ml-1">−{tx.qty_wasted} wasted</span>
                      )}
                    </div>
                  </div>
                  <div className="text-gray-300">{tx.patient_name || 'No patient'}</div>
                  {tx.indication && <div className="text-gray-500 truncate">{tx.indication}</div>}
                  <div className="flex justify-between text-gray-600 mt-1">
                    <span>By: {tx.dispensed_by || '—'}</span>
                    {tx.witness_name && <span>Witness: {tx.witness_name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
