import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { insertCSTransaction } from '@/lib/services/cs'
import { inputCls, labelCls } from '@/components/ui/FormField'
import PinSignature, { type SignatureRecord } from '@/components/PinSignature'
import { toast } from '@/lib/toast'
import { useUserAssignment } from '@/lib/useUserAssignment'

type Employee = { id: string; name: string; role: string }

export type DisposeItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  lot_number: string | null
  effective_expiry: string
  unit_id: string | null
  unit_name: string
  catalog_item_id: string | null
}

type Props = {
  item: DisposeItem
  onClose: () => void
  onSuccess: (itemId: string, disposedQty: number) => void
}

const REASONS = ['Expired', 'Damaged', 'Contaminated', 'Recalled', 'Other']

const isCS = (cat: string) => cat === 'CS' || cat === 'Controlled Substance'

export default function DisposeModal({ item, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({
    quantity: '1',
    reason: 'Expired',
    notes: '',
    performed_by: '',
    witness: '',
  })
  const [performerSigRecord, setPerformerSigRecord] = useState<SignatureRecord | null>(null)
  const [witnessSigRecord, setWitnessSigRecord] = useState<SignatureRecord | null>(null)
  const [showPerformerSig, setShowPerformerSig] = useState(false)
  const [showWitnessSig, setShowWitnessSig] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadEmployees()
  }, [])

  useEffect(() => {
    if (assignment.employee?.id && !form.performed_by) {
      setForm(prev => ({ ...prev, performed_by: assignment.employee!.id }))
    }
  }, [assignment.employee?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadEmployees() {
    const { data, error: err } = await supabase
      .from('employees')
      .select('id, name, role')
      .eq('status', 'Active')
      .order('name')
    if (!err) setEmployees(data || [])
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const qty = Number(form.quantity)
    if (!qty || qty <= 0 || qty > item.quantity) {
      setError(`Quantity must be between 1 and ${item.quantity}`)
      return
    }
    if (!form.reason) { setError('Reason is required'); return }
    if (form.reason === 'Other' && !form.notes.trim()) {
      setError('Notes are required when reason is Other')
      return
    }
    if (!form.performed_by) { setError('Performed By is required'); return }

    if (isCS(item.category)) {
      if (!form.witness) { setError('Witness is required for CS disposals'); return }
      if (form.performed_by === form.witness) {
        setError('Performer and Witness must be different people')
        return
      }
      if (!performerSigRecord) { setError('Performer signature is required — tap Sign below'); return }
      if (!witnessSigRecord) { setError('Witness signature is required'); return }
    }

    setSubmitting(true)
    try {
      const performerName = employees.find(e => e.id === form.performed_by)?.name || form.performed_by
      const witnessName = form.witness
        ? employees.find(e => e.id === form.witness)?.name || form.witness
        : null

      // 1. Insert disposal record
      const { error: disposeErr } = await supabase
        .from('inventory_disposals')
        .insert({
          unit_id: item.unit_id,
          inventory_item_id: item.id,
          item_name: item.item_name,
          catalog_item_id: item.catalog_item_id || null,
          category: item.category,
          lot_number: item.lot_number || null,
          expiration_date: item.effective_expiry || null,
          quantity_disposed: qty,
          reason: form.reason,
          reason_notes: form.notes || null,
          performed_by: performerName,
          witness: witnessName,
          performer_signature: performerSigRecord?.signatureHash || null,
          witness_signature: witnessSigRecord?.signatureHash || null,
        })
      if (disposeErr) throw new Error('Failed to record disposal: ' + disposeErr.message)

      // 2. Decrement unit_inventory quantity
      const { error: updateErr } = await supabase
        .from('unit_inventory')
        .update({ quantity: item.quantity - qty })
        .eq('id', item.id)
      if (updateErr) throw new Error('Failed to update inventory: ' + updateErr.message)

      // 3. CS: log a Waste transaction for DEA compliance
      if (isCS(item.category)) {
        await insertCSTransaction({
          transfer_type: 'Waste',
          drug_name: item.item_name,
          lot_number: item.lot_number || null,
          from_unit: item.unit_name,
          quantity: qty,
          performed_by: performerName,
          witness: witnessName,
          expiration_date: item.effective_expiry || null,
          receiver_signature_url: performerSigRecord?.signatureHash || null,
          notes: form.notes || null,
        })
      }

      toast.success(`Disposed ${qty} unit${qty !== 1 ? 's' : ''} of ${item.item_name}`)
      onSuccess(item.id, qty)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const performerEmployee = employees.find(e => e.id === form.performed_by)
  const witnessEmployee = employees.find(e => e.id === form.witness)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-0 md:flex md:items-center md:justify-center p-0 md:p-4">
        <div className="bg-gray-950 border border-red-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white">Dispose / Waste</h2>
                <p className="text-sm text-red-400 mt-0.5 truncate">{item.item_name}</p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none shrink-0 mt-0.5">✕</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Unit: <span className="text-gray-300">{item.unit_name}</span></span>
              <span>Category: <span className="text-gray-300">{item.category}</span></span>
              {item.lot_number && <span>Lot: <span className="text-gray-300">{item.lot_number}</span></span>}
              <span>Expiry: <span className="text-gray-300">{item.effective_expiry}</span></span>
              <span>Current Qty: <span className="text-orange-300 font-bold">{item.quantity}</span></span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Quantity */}
            <div>
              <label className={labelCls}>Quantity to Dispose *</label>
              <input
                className={inputCls}
                type="number"
                min="1"
                max={item.quantity}
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className={labelCls}>Reason *</label>
              <select className={inputCls} value={form.reason} onChange={e => set('reason', e.target.value)} required>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes{form.reason === 'Other' ? ' *' : ''}</label>
              <textarea
                className={inputCls}
                rows={2}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder={form.reason === 'Other' ? 'Required — describe reason...' : 'Optional...'}
              />
            </div>

            {/* Performed By */}
            <div>
              <label className={labelCls}>Performed By *</label>
              <select
                className={inputCls}
                value={form.performed_by}
                onChange={e => { set('performed_by', e.target.value); setPerformerSigRecord(null) }}
                required
              >
                <option value="">Select person...</option>
                {employees.filter(e => e.id !== form.witness).map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>

            {/* CS-only: Witness + dual signatures */}
            {isCS(item.category) && (
              <>
                <div>
                  <label className={labelCls}>
                    Witness *{' '}
                    <span className="text-orange-400 normal-case font-normal tracking-normal">(Required for CS)</span>
                  </label>
                  <select
                    className={inputCls}
                    value={form.witness}
                    onChange={e => { set('witness', e.target.value); setWitnessSigRecord(null) }}
                    required
                  >
                    <option value="">Select witness...</option>
                    {employees.filter(e => e.id !== form.performed_by).map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>

                {/* Performer Signature */}
                <div>
                  <label className={labelCls}>
                    Performer Signature{performerEmployee ? ` — ${performerEmployee.name}` : ''} *
                  </label>
                  {performerSigRecord ? (
                    <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-green-400 text-sm font-medium">✓ Signed</p>
                        <p className="text-gray-400 text-xs">{performerSigRecord.displayText}</p>
                      </div>
                      <button type="button" onClick={() => setPerformerSigRecord(null)} className="text-gray-500 hover:text-white text-xs">Clear</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!form.performed_by) { setError('Select Performed By first'); return }
                        setError('')
                        setShowPerformerSig(true)
                      }}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl text-sm text-gray-400 transition-colors"
                    >
                      Tap to Sign
                    </button>
                  )}
                </div>

                {/* Witness Signature */}
                <div>
                  <label className={labelCls}>
                    Witness Signature{witnessEmployee ? ` — ${witnessEmployee.name}` : ''} *
                  </label>
                  {witnessSigRecord ? (
                    <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-green-400 text-sm font-medium">✓ Witnessed</p>
                        <p className="text-gray-400 text-xs">{witnessSigRecord.displayText}</p>
                      </div>
                      <button type="button" onClick={() => setWitnessSigRecord(null)} className="text-gray-500 hover:text-white text-xs">Clear</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!form.witness) { setError('Select Witness first'); return }
                        setError('')
                        setShowWitnessSig(true)
                      }}
                      className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl text-sm text-gray-400 transition-colors"
                    >
                      Witness — Tap to Sign
                    </button>
                  )}
                </div>
              </>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold"
              >
                {submitting ? 'Disposing...' : 'Confirm Dispose'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showPerformerSig && (
        <PinSignature
          label="Performer Signature"
          mode="self"
          employeeId={assignment.employee?.id}
          employeeName={assignment.employee?.name}
          documentContext="cs-waste"
          onSign={(rec) => { setPerformerSigRecord(rec); setShowPerformerSig(false) }}
          onCancel={() => setShowPerformerSig(false)}
        />
      )}
      {showWitnessSig && (
        <PinSignature
          label="Witness Signature"
          mode="witness"
          documentContext="cs-waste"
          onSign={(rec) => { setWitnessSigRecord(rec); setShowWitnessSig(false) }}
          onCancel={() => setShowWitnessSig(false)}
        />
      )}
    </>
  )
}
