import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { getIsOnline } from '@/lib/syncManager'
import { queueOfflineWrite } from '@/lib/offlineStore'
import * as encounterService from '@/lib/services/encounters'
import type { Encounter } from '@/types/encounters'

export function MARSection({
  enc,
  marEntries,
  setMarEntries,
  canMedicate,
}: {
  enc: Encounter
  marEntries: any[]
  setMarEntries: (updater: (prev: any[]) => any[]) => void
  canMedicate: boolean
}) {
  const supabase = createClient()
  const [editingMarQtyId, setEditingMarQtyId] = useState<string | null>(null)
  const [editingMarQtyValue, setEditingMarQtyValue] = useState<string>('')

  const saveQty = async (m: any, newQty: number) => {
    const delta = newQty - m.qty_used
    if (getIsOnline()) {
      await encounterService.updateMARQuantity(m.id, newQty)
      if (delta !== 0 && m.med_unit) {
        const { data: invSearch } = await supabase
          .from('unit_inventory')
          .select('id, quantity, incident_unit:incident_units(unit:units(name))')
          .eq('item_name', m.item_name)
          .limit(20)
        const matched = (invSearch || []).find((r: any) => r.incident_unit?.unit?.name === m.med_unit)
        if (matched) {
          const newInvQty = Math.max(0, (matched.quantity || 0) - delta)
          await encounterService.updateInventoryQuantity(matched.id, newInvQty)
        }
      }
    } else {
      await queueOfflineWrite('dispense_admin_log', 'update', { id: m.id, qty_used: newQty })
      if (delta !== 0 && m.med_unit) {
        const { getCachedData } = await import('@/lib/offlineStore')
        const [inv, units] = await Promise.all([
          getCachedData('inventory') as Promise<any[]>,
          getCachedData('units') as Promise<any[]>,
        ])
        const unit = (units as any[]).find((u: any) => u.name === m.med_unit)
        const matched = (inv as any[]).find((i: any) => i.item_name === m.item_name && i.unit_id === unit?.id)
        if (matched) {
          const newInvQty = Math.max(0, (matched.quantity || 0) - delta)
          await queueOfflineWrite('unit_inventory', 'update', { id: matched.id, quantity: newInvQty })
        }
      }
    }
    setMarEntries(prev => prev.map(x => x.id === m.id ? { ...x, qty_used: newQty } : x))
    setEditingMarQtyId(null)
  }

  return (
    <div className="theme-card rounded-xl border overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 pr-10 py-3 theme-card-header border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Medications Administered
          {marEntries.length > 0 && <span className="ml-2 text-gray-600 font-normal normal-case">({marEntries.length})</span>}
        </h2>
        {canMedicate && (
          <Link to={`/mar/new?encounterId=${enc.encounter_id}&unit=${encodeURIComponent(enc.unit||'')}&patientName=${encodeURIComponent(((enc.patient_first_name||'')+' '+(enc.patient_last_name||'')).trim())}&dob=${encodeURIComponent(enc.patient_dob||'')}`}
            className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors flex items-center gap-1">
            <span>+</span> Med
          </Link>
        )}
      </div>
      {marEntries.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-600">No medications recorded. Use Chart Actions above.</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {marEntries.map((m: any) => (
            <div key={m.id} className="flex items-center px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-sm gap-3">
              <Link to={`/mar/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xs text-gray-500 shrink-0 w-28">{m.date ? m.date + ' ' : ''}{m.time?.slice(0,5) || ''}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-white font-medium truncate block">{m.item_name}</span>
                  <span className="text-xs text-gray-500">
                    {editingMarQtyId === m.id ? '...' : `${m.qty_used}${m.dosage_units ? ' ' + m.dosage_units : ''}`}
                    {' '}&middot; {m.medication_route} &middot; {m.dispensed_by?.split(',')[0]}
                  </span>
                </span>
              </Link>
              {m.item_type === 'CS' && <span className="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded shrink-0">CS</span>}
              {m.requires_cosign && !m.provider_signature_url && <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded shrink-0">⚠ Unsigned</span>}
              {editingMarQtyId === m.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number" min="0" step="0.5" autoFocus
                    className="w-16 bg-gray-700 rounded px-2 py-1 text-sm text-white"
                    value={editingMarQtyValue}
                    onChange={e => setEditingMarQtyValue(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Escape') { setEditingMarQtyId(null); return }
                      if (e.key === 'Enter') {
                        const newQty = parseFloat(editingMarQtyValue)
                        if (isNaN(newQty) || newQty < 0) { setEditingMarQtyId(null); return }
                        await saveQty(m, newQty)
                      }
                    }}
                  />
                  <button
                    onClick={async () => {
                      const newQty = parseFloat(editingMarQtyValue)
                      if (isNaN(newQty) || newQty < 0) { setEditingMarQtyId(null); return }
                      await saveQty(m, newQty)
                    }}
                    className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-white"
                  >✓</button>
                  <button onClick={() => setEditingMarQtyId(null)}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingMarQtyId(m.id); setEditingMarQtyValue(String(m.qty_used)) }}
                  className="text-xs text-blue-400 hover:text-blue-300 shrink-0 transition-colors"
                  title="Edit quantity"
                >
                  Edit Qty
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
