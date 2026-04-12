

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
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
  const sigRef = useRef<SignatureCanvas>(null)

  const loadEntry = async () => {
    // Show cached data instantly
    try {
      const { getCachedById } = await import('@/lib/offlineStore')
      const cached = await getCachedById('mar_entries', id) as any
      if (cached) {
        setEntry(cached)
        setLoading(false)
      }
    } catch {}
    const { data, offline } = await loadSingle<MAREntry>(
      () => supabase.from('dispense_admin_log').select('*').eq('id', id).single() as any,
      'mar_entries',
      id
    )
    if (offline) setIsOfflineData(true)
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

    // Adjust inventory if unit is known
    if (entry.med_unit && delta !== 0) {
      const { data: iuRows } = await supabase.from('incident_units')
        .select('id')
        .eq('unit_id', (await supabase.from('units').select('id').eq('name', entry.med_unit).single()).data?.id)
      if (iuRows?.length) {
        const iuIds = iuRows.map((r: any) => r.id)
        const { data: invRows } = await supabase.from('unit_inventory')
          .select('id, quantity')
          .in('incident_unit_id', iuIds)
          .eq('item_name', entry.item_name)
          .order('quantity', { ascending: false })
          .limit(1)
        if (invRows?.length) {
          const newInvQty = Math.max(0, (invRows[0].quantity || 0) - delta)
          await supabase.from('unit_inventory').update({ quantity: newInvQty }).eq('id', invRows[0].id)
        }
      }
    }

    setEntry(prev => prev ? { ...prev, qty_used: parsed } : prev)
    setEditingQty(false)
    setSavingQty(false)
  }

  const handleSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Please draw your signature.')
      return
    }
    setSigning(true)
    try {
      const dataUrl = sigRef.current.toDataURL('image/png')
      const base64 = dataUrl.split(',')[1]
      const byteChars = atob(base64)
      const byteArr = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
      const blob = new Blob([byteArr], { type: 'image/png' })
      const path = `mar-orders/${Date.now()}-provider.png`

      const { error: uploadErr } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
      if (uploadErr) throw new Error(uploadErr.message)

      const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(path)
      const signatureUrl = urlData.publicUrl

      const { error: updateErr } = await supabase
        .from('dispense_admin_log')
        .update({
          provider_signature_url: signatureUrl,
          provider_signed_at: new Date().toISOString(),
          provider_signed_by: assignment.user?.email || 'unknown',
          requires_cosign: false,
        })
        .eq('id', id)

      if (updateErr) throw new Error(updateErr.message)

      setShowSignPad(false)
      await loadEntry()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      alert(`Signature failed: ${msg}`)
    } finally {
      setSigning(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!entry) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Entry not found.</p>
        <Link to="/mar" className="text-red-400 underline">← Back</Link>
      </div>
    </div>
  )

  const isCS = entry.category === 'CS'
  const isDispensed = entry.entry_type === 'Dispensed'
  const awaitingSignature = entry.requires_cosign && !entry.provider_signature_url

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
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
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
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
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
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
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
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
              {!showSignPad ? (
                <button
                  type="button"
                  onClick={() => setShowSignPad(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  ✍️ Sign Now
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Draw your signature:</p>
                  <div className="bg-white rounded-lg overflow-hidden" style={{ width: 300, height: 80 }}>
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="black"
                      canvasProps={{
                        width: 300,
                        height: 80,
                        style: { touchAction: 'none', display: 'block' }
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSign}
                      disabled={signing}
                      className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      {signing ? 'Saving...' : 'Submit Signature'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { sigRef.current?.clear() }}
                      className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-2 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSignPad(false)}
                      className="text-gray-500 hover:text-gray-300 text-sm px-3 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No physician signature required for this entry.</p>
          )}
        </div>

        {/* Linked Encounter */}
        {(encounterUUID || entry.encounter_id) && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <Link to={`/encounters/${encounterUUID || entry.encounter_id}`}
              className="text-blue-400 hover:text-blue-300 text-sm underline flex items-center gap-1">
              → View linked patient encounter
              {!encounterUUID && <span className="text-xs text-gray-600">(loading...)</span>}
            </Link>
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
            <p className="text-sm text-white whitespace-pre-wrap">{entry.notes}</p>
          </div>
        )}

      </div>
    </div>
  )
}
