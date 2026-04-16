

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { getIsOnline } from '@/lib/syncManager'
import { useNavigate } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import PinSignature, { type SignatureRecord } from '@/components/PinSignature'

type Employee = {
  id: string
  name: string
  role: string
}

const CS_DRUGS = ['Morphine Sulfate', 'Fentanyl', 'Midazolam (Versed)', 'Ketamine', 'Other']
const CLINICAL_ROLES = ['MD/DO', 'NP', 'PA', 'Paramedic', 'RN']

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

export default function ReceiveCSPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const assignment = useUserAssignment()
  const [showReceiverSig, setShowReceiverSig] = useState(false)
  const [showWitnessSig, setShowWitnessSig] = useState(false)
  const [receiverSigRecord, setReceiverSigRecord] = useState<SignatureRecord | null>(null)
  const [witnessSigRecord, setWitnessSigRecord] = useState<SignatureRecord | null>(null)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isOffline, setIsOffline] = useState(false)

  const [form, setForm] = useState({
    drug_name: '',
    drug_name_other: '',
    lot_number: '',
    expiration_date: '',
    quantity_received: '',
    ndc: '',
    manufacturer: '',
    supplier: '',
    invoice_number: '',
    received_by: '',
    witness: '',
    notes: '',
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  async function loadEmployees() {
    // Preload dropdown data from cache
    try {
      const { getCachedData } = await import('@/lib/offlineStore')
      const cachedEmps = await getCachedData('employees') as any[]
      if (cachedEmps.length > 0) setEmployees(cachedEmps.filter((e: any) => CLINICAL_ROLES.includes(e.role)) as Employee[])
    } catch {}
    const { data, offline } = await loadList<Employee>(
      () => supabase
        .from('employees')
        .select('id, name, role')
        .eq('status', 'Active')
        .in('role', CLINICAL_ROLES)
        .order('name'),
      'employees',
      (all) => all.filter(e => CLINICAL_ROLES.includes(e.role))
    )
    setEmployees(data)
    if (offline) setIsOffline(true)
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!getIsOnline()) {
      setError('Receiving CS requires an internet connection. Please reconnect and try again.')
      return
    }

    const drugName = form.drug_name === 'Other' ? form.drug_name_other : form.drug_name
    if (!drugName) { setError('Drug name is required'); return }
    if (!form.lot_number) { setError('Lot number is required'); return }
    if (!form.expiration_date) { setError('Expiration date is required'); return }
    if (!form.quantity_received || Number(form.quantity_received) <= 0) { setError('Valid quantity is required'); return }
    if (!form.received_by) { setError('Received By is required'); return }
    if (!form.witness) { setError('Witness is required'); return }
    if (form.received_by === form.witness) { setError('Received By and Witness must be different people'); return }
    if (!receiverSigRecord) { setError('Receiver signature is required — tap Sign below'); return }
    if (!witnessSigRecord) { setError('Witness signature is required'); return }

    setSubmitting(true)
    try {
      const receiverUrl = receiverSigRecord.signatureHash
      const witnessUrl = witnessSigRecord.signatureHash

      // Find warehouse unit ID
      const { data: warehouseUnit } = await supabase
        .from('incident_units')
        .select('id')
        .eq('name', 'Warehouse')
        .maybeSingle()

      const warehouseId = warehouseUnit?.id || null

      // Insert cs_receipt
      const { error: receiptErr } = await supabase.from('cs_receipts').insert({
        received_at: new Date().toISOString(),
        received_by: form.received_by,
        drug_name: drugName,
        manufacturer: form.manufacturer || null,
        lot_number: form.lot_number,
        expiration_date: form.expiration_date,
        quantity_received: Number(form.quantity_received),
        ndc: form.ndc || null,
        supplier: form.supplier || null,
        invoice_number: form.invoice_number || null,
        witness: form.witness,
        witness_signature_url: witnessUrl || null,
        receiver_signature_url: receiverUrl || null,
        incident_unit_id: warehouseId,
        notes: form.notes || null,
      })
      if (receiptErr) throw new Error('Failed to save receipt: ' + receiptErr.message)

      // Update/insert warehouse_inventory for warehouse stock
      const { data: existingWh } = await supabase
        .from('warehouse_inventory')
        .select('id, quantity')
        .eq('item_name', drugName)
        .eq('category', 'CS')
        .eq('cs_lot_number', form.lot_number)
        .maybeSingle()

      if (existingWh) {
        await supabase
          .from('warehouse_inventory')
          .update({
            quantity: existingWh.quantity + Number(form.quantity_received),
            cs_expiration_date: form.expiration_date,
          })
          .eq('id', existingWh.id)
      } else {
        await supabase.from('warehouse_inventory').insert({
          item_name: drugName,
          category: 'CS',
          quantity: Number(form.quantity_received),
          cs_lot_number: form.lot_number,
          cs_expiration_date: form.expiration_date,
        })
      }

      // Insert cs_transaction
      await supabase.from('cs_transactions').insert({
        transfer_type: 'Receive',
        drug_name: drugName,
        lot_number: form.lot_number,
        to_unit: 'Warehouse',
        quantity: Number(form.quantity_received),
        performed_by: form.received_by,
        witness: form.witness,
        expiration_date: form.expiration_date,
        receiver_signature_url: receiverUrl || null,
        notes: form.notes || null,
      })

      navigate('/cs')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const receiverName = employees.find(e => e.id === form.received_by)?.name || ''
  const witnessName = employees.find(e => e.id === form.witness)?.name || ''

  return (
    <div className="p-4 md:p-8 max-w-lg mt-8 md:mt-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Receive Controlled Substance</h1>
        <p className="text-gray-400 text-sm mt-1">Record a new CS delivery to Warehouse</p>
      </div>

      {isOffline && (
        <div className="mb-4 bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm">
          📶 You are offline. CS receiving requires an internet connection to save signatures and update inventory.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drug Name */}
        <div>
          <label className={labelCls}>Drug Name *</label>
          <select className={inputCls} value={form.drug_name} onChange={e => set('drug_name', e.target.value)} required>
            <option value="">Select drug...</option>
            {CS_DRUGS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {form.drug_name === 'Other' && (
          <div>
            <label className={labelCls}>Drug Name (Other) *</label>
            <input className={inputCls} type="text" value={form.drug_name_other} onChange={e => set('drug_name_other', e.target.value)} placeholder="Enter drug name" required />
          </div>
        )}

        {/* Lot + Expiration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className={labelCls}>Lot Number *</label>
            <input className={inputCls + ' min-w-0'} type="text" value={form.lot_number} onChange={e => set('lot_number', e.target.value)} required />
          </div>
          <div className="min-w-0">
            <label className={labelCls}>Expiration Date *</label>
            <input className={inputCls + ' min-w-0'} type="date" value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} required />
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className={labelCls}>Quantity Received *</label>
          <input className={inputCls} type="number" min="1" value={form.quantity_received} onChange={e => set('quantity_received', e.target.value)} required />
        </div>

        {/* NDC + Manufacturer */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>NDC</label>
            <input className={inputCls} type="text" value={form.ndc} onChange={e => set('ndc', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={labelCls}>Manufacturer</label>
            <input className={inputCls} type="text" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {/* Supplier + Invoice */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Supplier</label>
            <input className={inputCls} type="text" value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={labelCls}>Invoice Number</label>
            <input className={inputCls} type="text" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {/* Received By */}
        <div>
          <label className={labelCls}>Received By *</label>
          <select className={inputCls} value={form.received_by} onChange={e => set('received_by', e.target.value)} required>
            <option value="">Select person...</option>
            {employees.filter(e => e.id !== form.witness).map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>

        {/* Witness */}
        <div>
          <label className={labelCls}>Witness *</label>
          <select className={inputCls} value={form.witness} onChange={e => set('witness', e.target.value)} required>
            <option value="">Select witness...</option>
            {employees.filter(e => e.id !== form.received_by).map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>

        {/* Receiver Signature */}
        <div>
          <label className={labelCls}>Receiver Signature{receiverName ? ` — ${receiverName}` : ''} *</label>
          {receiverSigRecord ? (
            <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-green-400 text-sm font-medium">✓ Signed</p>
                <p className="text-gray-400 text-xs">{receiverSigRecord.displayText}</p>
              </div>
              <button type="button" onClick={() => setReceiverSigRecord(null)} className="text-gray-500 hover:text-white text-xs">Clear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowReceiverSig(true)}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl text-sm text-gray-400 transition-colors">
              Tap to Sign
            </button>
          )}
        </div>

        {/* Witness Signature */}
        <div>
          <label className={labelCls}>Witness Signature{witnessName ? ` — ${witnessName}` : ''} *</label>
          {witnessSigRecord ? (
            <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-green-400 text-sm font-medium">✓ Witnessed</p>
                <p className="text-gray-400 text-xs">{witnessSigRecord.displayText}</p>
              </div>
              <button type="button" onClick={() => setWitnessSigRecord(null)} className="text-gray-500 hover:text-white text-xs">Clear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowWitnessSig(true)}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl text-sm text-gray-400 transition-colors">
              Witness — Tap to Sign
            </button>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={inputCls} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/cs')}
            className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold"
          >
            {submitting ? 'Saving...' : 'Receive CS'}
          </button>
        </div>
      </form>

      {showReceiverSig && (
        <PinSignature label="Receiver Signature" mode="self"
          employeeId={assignment.employee?.id} employeeName={assignment.employee?.name}
          documentContext="cs-receive"
          onSign={(rec) => { setReceiverSigRecord(rec); setShowReceiverSig(false) }}
          onCancel={() => setShowReceiverSig(false)} />
      )}
      {showWitnessSig && (
        <PinSignature label="Witness Signature" mode="witness"
          documentContext="cs-receive"
          onSign={(rec) => { setWitnessSigRecord(rec); setShowWitnessSig(false) }}
          onCancel={() => setShowWitnessSig(false)} />
      )}
    </div>
  )
}
