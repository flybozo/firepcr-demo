

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCachedData } from '@/lib/offlineStore'
import { getIsOnline } from '@/lib/syncManager'
import { useNavigate } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'

type Employee = {
  id: string
  name: string
  role: string
}

const CS_DRUGS = ['Morphine Sulfate', 'Fentanyl', 'Midazolam (Versed)', 'Ketamine', 'Other']
const CLINICAL_ROLES = ['MD/DO', 'NP', 'PA', 'Paramedic', 'RN']

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

async function sigPadToBlob(ref: React.RefObject<SignatureCanvas | null>): Promise<Blob | null> {
  if (!ref.current || ref.current.isEmpty()) return null
  return new Promise(resolve => {
    ref.current!.getCanvas().toBlob(blob => resolve(blob), 'image/png')
  })
}

export default function ReceiveCSPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const receiverSigRef = useRef<SignatureCanvas>(null)
  const witnessSigRef = useRef<SignatureCanvas>(null)

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
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .eq('status', 'Active')
        .in('role', CLINICAL_ROLES)
        .order('name')
      if (error) throw error
      setEmployees(data || [])
    } catch {
      const cached = await getCachedData('employees')
      const filtered = cached.filter((e: any) => CLINICAL_ROLES.includes(e.role))
      if (filtered.length > 0) setEmployees(filtered as Employee[])
      setIsOffline(true)
    }
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
    if (!receiverSigRef.current || receiverSigRef.current.isEmpty()) { setError('Receiver signature is required'); return }
    if (!witnessSigRef.current || witnessSigRef.current.isEmpty()) { setError('Witness signature is required'); return }

    setSubmitting(true)
    try {
      const ts = Date.now()

      // Upload signatures
      const receiverBlob = await sigPadToBlob(receiverSigRef)
      const witnessBlob = await sigPadToBlob(witnessSigRef)

      let receiverUrl = ''
      let witnessUrl = ''

      if (receiverBlob) {
        const { data: rData, error: rErr } = await supabase.storage
          .from('signatures')
          .upload(`cs-receive/${ts}-receiver.png`, receiverBlob, { contentType: 'image/png' })
        if (rErr) throw new Error('Failed to upload receiver signature')
        const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(rData.path)
        receiverUrl = urlData.publicUrl
      }

      if (witnessBlob) {
        const { data: wData, error: wErr } = await supabase.storage
          .from('signatures')
          .upload(`cs-receive/${ts}-witness.png`, witnessBlob, { contentType: 'image/png' })
        if (wErr) throw new Error('Failed to upload witness signature')
        const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(wData.path)
        witnessUrl = urlData.publicUrl
      }

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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Lot Number *</label>
            <input className={inputCls} type="text" value={form.lot_number} onChange={e => set('lot_number', e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Expiration Date *</label>
            <input className={inputCls} type="date" value={form.expiration_date} onChange={e => set('expiration_date', e.target.value)} required />
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
          <div className="rounded-lg overflow-hidden border border-gray-600" style={{ width: 220, height: 80 }}>
            <SignatureCanvas
              ref={receiverSigRef}
              penColor="black"
              canvasProps={{ width: 220, height: 80, style: { background: 'white' } }}
            />
          </div>
          <button type="button" onClick={() => receiverSigRef.current?.clear()} className="text-xs text-gray-500 hover:text-gray-300 mt-1">Clear</button>
        </div>

        {/* Witness Signature */}
        <div>
          <label className={labelCls}>Witness Signature{witnessName ? ` — ${witnessName}` : ''} *</label>
          <div className="rounded-lg overflow-hidden border border-gray-600" style={{ width: 220, height: 80 }}>
            <SignatureCanvas
              ref={witnessSigRef}
              penColor="black"
              canvasProps={{ width: 220, height: 80, style: { background: 'white' } }}
            />
          </div>
          <button type="button" onClick={() => witnessSigRef.current?.clear()} className="text-xs text-gray-500 hover:text-gray-300 mt-1">Clear</button>
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
    </div>
  )
}
