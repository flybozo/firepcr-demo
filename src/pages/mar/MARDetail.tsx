

import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import PinSignature, { type SignatureRecord } from '@/components/PinSignature'
import { LoadingSkeleton, EmptyState } from '@/components/ui'
import { useUserAssignment } from '@/lib/useUserAssignment'

type MAREntry = {
  id: string
  date: string
  patient_name: string | null
  item_name: string | null
  qty_used: number | null
  qty_wasted: number | null
  med_unit: string | null
  dispensed_by: string | null
  category: string | null
  route: string | null
  medication_route: string | null
  indication: string | null
  dose_mg: number | null
  concentration: string | null
  lot_number: string | null
  expiration_date: string | null
  exp_date: string | null
  witness_name: string | null
  witness_signature: string | null
  witness_signature_url: string | null
  encounter_id: string | null
  unit: string | null
  notes: string | null
  prescribing_provider: string | null
  entry_type: string | null
  provider_signature_url: string | null
  provider_signed_at: string | null
  provider_signed_by: string | null
  requires_cosign: boolean | null
  cosigned_at: string | null
  cosigned_by: string | null
  cosign_signature_url: string | null
  is_void: boolean | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  item_type: string | null
  incident_id: string | null
  [key: string]: unknown
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

export default function MARDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const id = params.id as string
  const assignment = useUserAssignment()

  const [entry, setEntry] = useState<MAREntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [encounterUUID, setEncounterUUID] = useState<string | null>(null)
  const [editingQty, setEditingQty] = useState(false)
  const [newQty, setNewQty] = useState('')
  const [savingQty, setSavingQty] = useState(false)
  const [showSignPad, setShowSignPad] = useState(false)
  const [signing, setSigning] = useState(false)
  const [showVoidForm, setShowVoidForm] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [showVoidPin, setShowVoidPin] = useState(false)

  const isVoided = !!entry?.is_void || !!entry?.voided_at

  const handleVoid = async (sigRecord: SignatureRecord) => {
    setVoiding(true)
    try {
      // 1. Mark the MAR entry as voided
      await supabase.from('dispense_admin_log').update({
        is_void: true,
        voided_at: new Date().toISOString(),
        voided_by: sigRecord.employeeName,
        void_reason: voidReason.trim(),
      }).eq('id', id)

      // 2. Reverse inventory — return qty to the unit it came from
      const qtyToReturn = Number(entry?.qty_used) || 0
      const unitName = entry?.med_unit || entry?.unit || null
      const itemName = entry?.item_name || null
      const lotNumber = entry?.lot_number || null
      const itemType = entry?.item_type || null

      if (qtyToReturn > 0 && unitName && itemName) {
        // Return to general unit_inventory (by unit_id — inventory belongs to the truck)
        try {
          const { data: unitRow } = await supabase.from('units').select('id').eq('name', unitName).single()
          if (unitRow) {
            let invQuery = supabase.from('unit_inventory')
              .select('id, quantity')
              .eq('unit_id', unitRow.id)
              .eq('item_name', itemName)
              .limit(1)
            if (lotNumber) invQuery = invQuery.eq('lot_number', lotNumber)
            const { data: invRows } = await invQuery
            if (invRows?.length) {
              await supabase.from('unit_inventory')
                .update({ quantity: (invRows[0].quantity || 0) + qtyToReturn })
                .eq('id', invRows[0].id)
            }
          }
        } catch { /* inventory reversal is best-effort */ }

        // For controlled substances, log void/reversal in CS transaction log
        // (inventory already returned to unit_inventory above — single source of truth)
        if (itemType === 'CS') {
          // Log void/reversal in CS transaction log
          try {
            await supabase.from('cs_transactions').insert({
              transfer_type: 'Void/Reversal',
              transaction_type: 'Void/Reversal',
              drug_name: itemName,
              lot_number: lotNumber,
              to_unit: unitName,
              quantity: qtyToReturn,
              date: new Date().toISOString(),
              performed_by: sigRecord.employeeName,
              notes: `VOID: ${voidReason.trim()} — Reversed administration of ${qtyToReturn} ${itemName}${lotNumber ? ` (Lot ${lotNumber})` : ''} back to ${unitName}`,
            })
          } catch { /* CS transaction log is best-effort */ }
        }
      }

      // 3. Write audit log entry
      try {
        await supabase.from('clinical_audit_log').insert({
          table_name: 'dispense_admin_log',
          record_id: id,
          action: 'void',
          field_name: 'is_void',
          old_value: 'false',
          new_value: 'true',
          performed_by: sigRecord.employeeName,
          metadata: { void_reason: voidReason.trim(), qty_returned: qtyToReturn, unit: unitName, item: itemName, lot: lotNumber, item_type: itemType },
        })
      } catch { /* audit is best-effort */ }

      setEntry(prev => prev ? { ...prev, is_void: true, voided_at: new Date().toISOString(), voided_by: sigRecord.employeeName, void_reason: voidReason } : prev)
      setShowVoidPin(false)
      setShowVoidForm(false)
    } catch (err) {
      toast.error('Failed to void entry')
    }
    setVoiding(false)
  }

  const loadEntry = async () => {
    // Show cached data instantly
    try {
      const { getCachedById } = await import('@/lib/offlineStore')
      const cached = await getCachedById('mar_entries', id)
      if (cached) {
        setEntry(cached)
        setLoading(false)
      }
    } catch {}
    const { data, offline } = await loadSingle<MAREntry>(
      () => supabase.from('dispense_admin_log').select('*').eq('id', id).single(),
      'mar_entries',
      id
    )
    setIsOfflineData(offline)
    setEntry(data)
    setLoading(false)
    // Resolve encounter text ID → UUID for navigation (online only)
    if (data?.encounter_id) {
      try {
        const { data: encRow } = await supabase
          .from('patient_encounters')
          .select('id')
          .eq('encounter_id', data.encounter_id)
          .single()
        if (encRow) setEncounterUUID(encRow.id)
      } catch { /* offline — skip */ }
    }
  }

  useEffect(() => {
    loadEntry()
  }, [id])


  const handleSaveQty = async () => {
    if (!entry || !newQty) return
    const parsed = parseFloat(newQty)
    if (isNaN(parsed) || parsed < 0) return
    setSavingQty(true)
    const oldQty = entry.qty_used || 0
    const delta = parsed - oldQty

    // Update log
    await supabase.from('dispense_admin_log').update({ qty_used: parsed }).eq('id', id)

    // Adjust inventory if unit is known (by unit_id — inventory belongs to the truck)
    if (entry.med_unit && delta !== 0) {
      const { data: unitData } = await supabase.from('units').select('id').eq('name', entry.med_unit).single()
      const unitId = unitData?.id
      if (!unitId) { console.error('Unit not found for inventory adjustment:', entry.med_unit); return }
      const { data: invRows } = await supabase.from('unit_inventory')
        .select('id, quantity')
        .eq('unit_id', unitId)
        .eq('item_name', entry.item_name)
        .order('quantity', { ascending: false })
        .limit(1)
      if (invRows?.length) {
        const newInvQty = Math.max(0, (invRows[0].quantity || 0) - delta)
        await supabase.from('unit_inventory').update({ quantity: newInvQty }).eq('id', invRows[0].id)
      }
    }

    setEntry(prev => prev ? { ...prev, qty_used: parsed } : prev)
    setEditingQty(false)
    setSavingQty(false)
  }

  const handleSign = async (rec: SignatureRecord) => {
    setSigning(true)
    try {
      const { error: updateErr } = await supabase
        .from('dispense_admin_log')
        .update({
          provider_signature_url: rec.signatureHash,
          provider_signed_at: rec.signedAt,
          provider_signed_by: rec.displayText,
          requires_cosign: false,
        })
        .eq('id', id)

      if (updateErr) throw new Error(updateErr.message)

      setShowSignPad(false)
      await loadEntry()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Signature failed: ${msg}`)
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <LoadingSkeleton fullPage />

  if (!entry) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <EmptyState icon="💊" message="Entry not found." actionHref="/mar" actionLabel="← Back to MAR" />
    </div>
  )

  const isCS = entry.category === 'CS'
  const isDispensed = entry.entry_type === 'Dispensed'
  const awaitingSignature = entry.requires_cosign && !entry.provider_signature_url

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">

        <Link to="/mar" className="text-gray-500 hover:text-gray-300 text-sm">← MAR</Link>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* CS Banner */}
        {isCS && (
          <div className="bg-orange-950 border border-orange-700 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-orange-400 text-lg">⚠️</span>
            <div>
              <p className="text-orange-300 font-semibold text-sm">Controlled Substance</p>
              <p className="text-orange-400 text-xs mt-0.5">
                Witness: {entry.witness_name || '—'}
                {entry.witness_signature_url ? ' · Signature on file' : ' · No signature recorded'}
              </p>
            </div>
          </div>
        )}

        {/* Dispensed Badge */}
        {isDispensed && (
          <div className="bg-blue-950 border border-blue-700 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-blue-400">📦</span>
            <p className="text-blue-300 text-sm font-semibold">Dispensed Medication</p>
          </div>
        )}

        {/* Header */}
        <div className="theme-card rounded-xl p-4 border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{entry.item_name || 'Unknown Medication'}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{entry.patient_name || 'Unknown Patient'}</p>
              <p className="text-gray-500 text-xs mt-1">{entry.date}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {entry.entry_type && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${isDispensed ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                  {entry.entry_type}
                </span>
              )}
              {entry.category && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isCS ? 'bg-orange-900 text-orange-300' :
                  entry.category === 'Rx' ? 'bg-blue-900 text-blue-300' :
                  'bg-gray-700 text-gray-300'
                }`}>{entry.category}</span>
              )}
              <div className="flex items-center gap-2">
                {editingQty ? (
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" step="0.5" autoFocus
                      className="w-24 bg-gray-700 border border-red-600 rounded px-2 py-1 text-xl font-mono font-bold text-white focus:outline-none"
                      value={newQty} onChange={e => setNewQty(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveQty(); if (e.key === 'Escape') setEditingQty(false) }}
                    />
                    <button onClick={handleSaveQty} disabled={savingQty} className="text-green-400 hover:text-green-300 text-lg font-bold">✓</button>
                    <button onClick={() => setEditingQty(false)} className="text-gray-500 hover:text-gray-300">✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setNewQty(String(entry.qty_used || 0)); setEditingQty(true) }}
                    className="group flex items-center gap-2">
                    <span className="text-2xl font-mono font-bold text-white">×{entry.qty_used ?? '—'}</span>
                    <span className="text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✏️ edit</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Administration Details */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Administration</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Route" value={entry.medication_route || entry.route} />
            <Field label="Dose (mg)" value={entry.dose_mg} />
            <Field label="Concentration" value={entry.concentration} />
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">Quantity Used</dt>
              <dd className="mt-0.5 flex items-center gap-2">
                <span className="text-sm text-white">{entry.qty_used ?? '—'}</span>
                <button onClick={() => { setNewQty(String(entry.qty_used || 0)); setEditingQty(true) }}
                  className="text-xs text-gray-600 hover:text-gray-400">✏️</button>
              </dd>
            </div>
            <Field label="Quantity Wasted" value={entry.qty_wasted} />
            <Field label="Unit" value={entry.med_unit} />
            <Field label="Indication" value={entry.indication} />
            <Field label="Dispensed By" value={entry.dispensed_by} />
            <Field label="Prescribing Provider" value={entry.prescribing_provider} />
          </dl>
        </div>

        {/* Drug Info */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Drug Info</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Lot Number" value={entry.lot_number} />
            <Field label="Expiration" value={entry.exp_date || entry.expiration_date} />
          </dl>
        </div>

        {/* CS Witness */}
        {isCS && (
          <div className="bg-gray-900 rounded-xl p-4 border border-orange-800/50 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-orange-400">CS Witness</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Witness Name" value={entry.witness_name} />
              <Field label="Signature" value={entry.witness_signature_url ? 'On file' : null} />
            </dl>
          </div>
        )}

        {/* ─── Physician Signature Section ─── */}
        <div className={`rounded-xl p-4 border space-y-3 ${
          awaitingSignature
            ? 'bg-orange-950 border-orange-700'
            : 'bg-gray-900 border-gray-800'
        }`}>
          <h2 className={`text-xs font-semibold uppercase tracking-wider ${awaitingSignature ? 'text-orange-400' : 'text-gray-400'}`}>
            Physician Signature
          </h2>

          {entry.provider_signature_url ? (
            <div className="space-y-2">
              <img
                src={entry.provider_signature_url}
                alt="Provider signature"
                className="bg-white rounded-lg p-2 max-w-xs"
                style={{ maxHeight: 100 }}
              />
              <p className="text-xs text-gray-400">
                Signed by <strong className="text-white">{entry.provider_signed_by || '—'}</strong>
                {entry.provider_signed_at
                  ? ` on ${new Date(entry.provider_signed_at).toLocaleString()}`
                  : ''}
              </p>
            </div>
          ) : awaitingSignature ? (
            <div className="space-y-3">
              <p className="text-orange-300 font-bold text-sm">⚠️ AWAITING PHYSICIAN CO-SIGNATURE</p>
              <p className="text-orange-400 text-xs">
                Prescribing provider: <strong>{entry.prescribing_provider || '—'}</strong>
              </p>
              <button
                type="button"
                onClick={() => setShowSignPad(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Sign Now
              </button>
              {showSignPad && (
                <PinSignature
                  label="Provider Co-Signature"
                  mode="self"
                  employeeId={assignment.employee?.id}
                  employeeName={assignment.employee?.name}
                  documentContext={`mar-cosign-${id}`}
                  onSign={(rec) => { setShowSignPad(false); handleSign(rec) }}
                  onCancel={() => setShowSignPad(false)}
                />
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No physician signature required for this entry.</p>
          )}
        </div>

        {/* Linked Encounter */}
        {(encounterUUID || entry.encounter_id) && (
          <div className="theme-card rounded-xl p-4 border">
            <Link to={`/encounters/${encounterUUID || entry.encounter_id}`}
              className="text-blue-400 hover:text-blue-300 text-sm underline flex items-center gap-1">
              → View linked patient encounter
              {!encounterUUID && <span className="text-xs text-gray-600">(loading...)</span>}
            </Link>
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div className="theme-card rounded-xl p-4 border space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
            <p className="text-sm text-white whitespace-pre-wrap">{entry.notes}</p>
          </div>
        )}

        {/* Void banner (if already voided) */}
        {isVoided && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 space-y-1">
            <p className="text-sm font-bold text-red-300">⛔ VOIDED</p>
            <p className="text-xs text-red-400">Voided by {entry.voided_by} on {new Date(entry.voided_at!).toLocaleString()}</p>
            {entry.void_reason && <p className="text-xs text-red-400/80">Reason: {entry.void_reason}</p>}
          </div>
        )}

        {/* Void Entry button (not shown if already voided) */}
        {!isVoided && (
          <div className="pt-2">
            {!showVoidForm ? (
              <button
                onClick={() => setShowVoidForm(true)}
                className="w-full py-2.5 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-300 font-semibold rounded-xl text-sm transition-colors"
              >
                ⛔ Void This Entry
              </button>
            ) : showVoidPin ? (
              <div className="theme-card rounded-xl border p-4">
                <PinSignature
                  label={`Void ${isCS ? 'Controlled Substance' : 'MAR'} Entry`}
                  mode="self"
                  employeeId={assignment.employee?.id}
                  employeeName={assignment.employee?.name}
                  documentContext={`void-mar:${id}`}
                  onSign={handleVoid}
                  onCancel={() => { setShowVoidPin(false); setShowVoidForm(false) }}
                />
              </div>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-red-800 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-300">⛔ Void MAR Entry</p>
                <p className="text-xs text-gray-400">
                  This will mark the entry as voided. It will remain in the record for audit purposes{isCS ? ' (required for controlled substances)' : ''} but will not count toward clinical totals.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Reason for voiding *</label>
                  <textarea
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    placeholder="e.g. Duplicate entry, incorrect dosage recorded, wrong patient..."
                    rows={2}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowVoidForm(false); setVoidReason('') }}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors"
                  >Cancel</button>
                  <button
                    disabled={!voidReason.trim() || voiding}
                    onClick={() => setShowVoidPin(true)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-bold text-white transition-colors"
                  >Continue — PIN Required</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
