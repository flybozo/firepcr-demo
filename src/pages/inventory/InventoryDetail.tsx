import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { getCachedById } from '@/lib/offlineStore'
import { loadSingle } from '@/lib/offlineFirst'
import { FormularyDetailInner } from '@/pages/formulary/FormularyDetail'
import type { InventoryContext } from '@/pages/formulary/FormularyDetail'
import { LoadingSkeleton } from '@/components/ui'

/**
 * Inventory detail page — resolves the matching formulary template
 * and renders FormularyDetailInner with inventory context overlay.
 *
 * The formulary template is the master record (photo, cost, supplier, etc.).
 * This page adds the inventory-specific layer (quantity, lot, expiration, unit).
 */
export default function InventoryDetailPage() {
  const supabase = createClient()
  const { id } = useParams<{ id: string }>()
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [inventoryCtx, setInventoryCtx] = useState<InventoryContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      // Load inventory item
      let inv: any = null
      try {
        const cached = await getCachedById('inventory', id) as any
        if (cached) inv = cached
      } catch {}

      const { data } = await loadSingle(
        () => supabase
          .from('unit_inventory')
          .select('id, item_name, category, quantity, par_qty, lot_number, expiration_date, cs_lot_number, cs_expiration_date, unit_id, catalog_item_id, unit:units(id, name)')
          .eq('id', id)
          .single() as any,
        'inventory',
        id
      )
      if (data) inv = data

      if (!inv) { setNotFound(true); setLoading(false); return }

      const unitName = inv.unit?.name || 'Unknown'

      setInventoryCtx({
        inventoryId: inv.id,
        unitName,
        quantity: inv.quantity ?? 0,
        parQty: inv.par_qty ?? 0,
        lotNumber: inv.lot_number || null,
        expirationDate: inv.expiration_date || null,
        csLotNumber: inv.cs_lot_number || null,
        csExpirationDate: inv.cs_expiration_date || null,
      })

      // Find the matching formulary template — prefer catalog_item_id join, fall back to item_name
      const tmplQuery = inv.catalog_item_id
        ? supabase.from('formulary_templates').select('id').eq('catalog_item_id', inv.catalog_item_id).limit(1).maybeSingle()
        : supabase.from('formulary_templates').select('id').eq('item_name', inv.item_name).limit(1).maybeSingle()
      const { data: tmpl } = await tmplQuery

      if (tmpl?.id) {
        setTemplateId(tmpl.id)
      } else {
        // No template found — still show what we have
        setTemplateId(null)
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} /></div>

  if (notFound) return (
    <div className="p-6 text-center text-gray-500">
      <p>Inventory item not found.</p>
    </div>
  )

  if (!templateId) {
    // No template match — show basic inventory info via the component with just the context
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="mb-2">No formulary template found for this item.</p>
        {inventoryCtx && (
          <div className="text-left max-w-md mx-auto mt-4 bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-white font-semibold">{inventoryCtx.unitName}</p>
            <p className="text-sm text-gray-400">Qty: {inventoryCtx.quantity} / Par: {inventoryCtx.parQty}</p>
            {inventoryCtx.lotNumber && <p className="text-xs text-gray-500">Lot: {inventoryCtx.lotNumber}</p>}
            {inventoryCtx.expirationDate && <p className="text-xs text-gray-500">Exp: {inventoryCtx.expirationDate}</p>}
          </div>
        )}
      </div>
    )
  }

  // Render the formulary template detail with inventory overlay
  return <FormularyDetailInner key={templateId} templateId={templateId} inventoryCtx={inventoryCtx || undefined} backPath="/inventory" />
}
