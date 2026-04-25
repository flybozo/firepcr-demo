import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { LoadingSkeleton } from '@/components/ui'

export type CatalogItem = {
  id: string
  sku: string
  item_name: string
  category: string
  is_als: boolean
  reimbursable: boolean
  ndc: string | null
  barcode: string | null
  upc: string | null
  manufacturer_sku: string | null
  concentration: string | null
  route: string | null
  unit_of_measure: string | null
  supplier: string | null
  units_per_case: number | null
  case_cost: number | null
  unit_cost: number | null
  image_url: string | null
  notes: string | null
}

export type UnitTypeEntry = {
  unit_type_name: string
  default_par_qty: number | null
}

export const CAT_COLORS: Record<string, string> = {
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

type Props = {
  catalogItemId: string
  contextCard?: (item: CatalogItem) => ReactNode
  onPhotoUpload?: (file: File) => Promise<void>
  onPhotoRemove?: () => Promise<void>
  showPhotoActions?: boolean
  uploading?: boolean
  showCatalogLink?: boolean
  refreshKey?: number
}

export function CatalogItemPanel({
  catalogItemId,
  contextCard,
  onPhotoUpload,
  onPhotoRemove,
  showPhotoActions,
  uploading: externalUploading,
  showCatalogLink = true,
  refreshKey,
}: Props) {
  const supabase = createClient()
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [unitTypes, setUnitTypes] = useState<UnitTypeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [internalUploading, setInternalUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const isUploading = internalUploading || !!externalUploading

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [itemResult, templatesResult] = await Promise.all([
        supabase.from('item_catalog').select('*').eq('id', catalogItemId).single(),
        supabase
          .from('formulary_templates')
          .select('default_par_qty, unit_type:unit_types(name)')
          .eq('catalog_item_id', catalogItemId),
      ])
      if (cancelled) return
      if (itemResult.error || !itemResult.data) {
        setItem(null)
        setLoading(false)
        return
      }
      setItem(itemResult.data as CatalogItem)
      const types = (templatesResult.data || []).map((t: any) => ({
        unit_type_name: Array.isArray(t.unit_type) ? t.unit_type[0]?.name : t.unit_type?.name || 'Unknown',
        default_par_qty: t.default_par_qty,
      }))
      setUnitTypes(types.sort((a: UnitTypeEntry, b: UnitTypeEntry) => a.unit_type_name.localeCompare(b.unit_type_name)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [catalogItemId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onPhotoUpload) return
    setInternalUploading(true)
    try {
      await onPhotoUpload(file)
      // Re-fetch image_url so the panel reflects the new photo
      const { data } = await supabase
        .from('item_catalog')
        .select('image_url')
        .eq('id', catalogItemId)
        .single()
      if (data) setItem(prev => prev ? { ...prev, image_url: data.image_url } : prev)
    } finally {
      setInternalUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!onPhotoRemove) return
    await onPhotoRemove()
    setItem(prev => prev ? { ...prev, image_url: null } : prev)
  }

  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} /></div>
  if (!item) return <div className="p-6 text-gray-500">Item not found in catalog.</div>

  const unitCost = item.unit_cost ?? (item.case_cost && item.units_per_case ? Number(item.case_cost) / Number(item.units_per_case) : null)

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 overflow-y-auto h-full">
      {/* Context card slot — rendered above catalog detail (e.g. edit/delete buttons, back nav) */}
      {contextCard && contextCard(item)}

      {/* Header with photo — matches FormularyDetailInner layout */}
      <div className="flex gap-6 mb-6">
        {/* Photo */}
        <div className="shrink-0">
          <div className="w-32 h-32 rounded-xl bg-gray-800 overflow-hidden relative group">
            {item.image_url ? (
              <img src={item.image_url} alt={item.item_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                <span className="text-3xl mb-1">📦</span>
                <span className="text-xs">No photo</span>
              </div>
            )}
            {showPhotoActions && (onPhotoUpload || onPhotoRemove) && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {onPhotoUpload && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs text-white"
                  >
                    {isUploading ? '...' : '📷 Upload'}
                  </button>
                )}
                {onPhotoRemove && item.image_url && (
                  <button
                    onClick={handleRemovePhoto}
                    className="px-2 py-1 bg-red-600/60 hover:bg-red-600 rounded text-xs text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
          {showPhotoActions && onPhotoUpload && (
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          )}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white mb-1">{item.item_name}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[item.category] || CAT_COLORS.OTC}`}>
              {item.category}
            </span>
            {item.is_als && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">ALS</span>
            )}
            {item.reimbursable && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">💲 Reimb</span>
            )}
            <span className="text-xs font-mono text-gray-500">{item.sku}</span>
          </div>
          {item.concentration && <p className="text-sm text-gray-400">{item.concentration}</p>}
          {item.route && <p className="text-sm text-gray-500">Route: {item.route}</p>}
          {showCatalogLink && (
            <Link
              to={`/catalog/${item.id}`}
              className="mt-2 inline-block text-xs text-gray-500 hover:text-white transition-colors"
            >
              Open in Catalog →
            </Link>
          )}
        </div>
      </div>

      {/* Supply & Cost card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Supply & Cost</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-800">
          {[
            { label: 'Supplier', value: item.supplier || '—' },
            { label: 'Units/Case', value: item.units_per_case ?? '—' },
            { label: 'Cost/Case', value: item.case_cost != null ? `$${Number(item.case_cost).toFixed(2)}` : '—' },
            { label: 'Unit Cost', value: unitCost != null ? `$${Number(unitCost).toFixed(2)}` : '—' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              <p className="text-sm text-white font-medium">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Identifiers & Details card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Identifiers & Details</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-800">
          {[
            { label: 'SKU', value: item.sku || '—' },
            { label: 'NDC', value: item.ndc || '—' },
            { label: 'Barcode', value: item.barcode || '—' },
            { label: 'UPC', value: item.upc || '—' },
            { label: 'Mfr SKU', value: item.manufacturer_sku || '—' },
            { label: 'Concentration', value: item.concentration || '—' },
            { label: 'Route', value: item.route || '—' },
            { label: 'Unit of Measure', value: item.unit_of_measure || '—' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              <p className="text-sm text-white font-mono">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Carried By card */}
      {unitTypes.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-4">
          <div className="px-4 py-2.5 bg-gray-800 border-b border-gray-700">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Carried By</h2>
          </div>
          <div className="px-4 py-3 flex flex-wrap gap-2">
            {unitTypes.map((ut, i) => (
              <div key={i} className="bg-gray-800 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-white font-medium">{ut.unit_type_name}</span>
                {ut.default_par_qty !== null && (
                  <span className="text-gray-500 ml-1">(par: {ut.default_par_qty})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes card */}
      {item.notes && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</h2>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}
    </div>
  )
}
