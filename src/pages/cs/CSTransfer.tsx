

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { getIsOnline } from '@/lib/syncManager'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'

const CS_DRUGS = ['Morphine Sulfate', 'Fentanyl', 'Midazolam (Versed)', 'Ketamine']

type LotOption = {
  lot_number: string | null
  expiration_date: string | null
  quantity: number
  inventory_id: string
  from_warehouse: boolean
}

type UnitOption = {
  id: string
  name: string
}

export default function CSTransferPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const transferSigRef = useRef<SignatureCanvas>(null)
  const witnessSigRef = useRef<SignatureCanvas>(null)

  const [units, setUnits] = useState<UnitOption[]>([])
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const [form, setForm] = useState({
    drug_name: '',
    from_unit_id: '',
    from_unit_name: '',
    to_unit_id: '',
    to_unit_name: '',
    lot_number: '',
    quantity: '',
    transferred_by: '',
    witness: '',
    notes: '',
  })

  const [lots, setLots] = useState<LotOption[]>([])
  const [selectedLot, setSelectedLot] = useState<LotOption | null>(null)
  const [loadingLots, setLoadingLots] = useState(false)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    const load = async () => {
      // Preload dropdown data from cache
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedUnits = await getCachedData('units') as any[]
        if (cachedUnits.length > 0) setUnits(cachedUnits as UnitOption[])
        const cachedEmps = await getCachedData('employees') as any[]
        if (cachedEmps.length > 0) setEmployees(cachedEmps.filter((e: any) => ['MD','MD/DO','NP','PA','RN','Paramedic'].includes(e.role)))
      } catch {}
      const [unitResult, empResult] = await Promise.all([
        loadList<UnitOption>(
          () => supabase.from('units').select('id, name').eq('active', true).order('name'),
          'units'
        ),
        loadList<{ id: string; name: string }>(
          () => supabase.from('employees').select('id, name').eq('status', 'Active')
            .in('role', ['MD', 'MD/DO', 'NP', 'PA', 'RN', 'Paramedic']).order('name'),
          'employees',
          (all) => all.filter((e: any) => ['MD', 'MD/DO', 'NP', 'PA', 'RN', 'Paramedic'].includes((e as any).role))
        ),
      ])
      setUnits(unitResult.data)
      setEmployees(empResult.data)
      if (unitResult.offline || empResult.offline) setIsOffline(true)
    }
    load()
  }, [])

  // When drug + from_unit changes, load available lots
  useEffect(() => {
    const loadLots = async () => {
      if (!form.drug_name || !form.from_unit_id) { setLots([]); return }
      setLoadingLots(true)

      const fromUnit = units.find(u => u.id === form.from_unit_id)
      const isWarehouse = fromUnit?.name === 'Warehouse'

      if (isWarehouse) {
        // Query warehouse_inventory
        const { data } = await supabase
          .from('warehouse_inventory')
          .select('id, lot_number, expiration_date, quantity')
          .eq('item_name', form.drug_name)
          .gt('quantity', 0)
          .order('expiration_date')
        const lotOpts: LotOption[] = (data || []).map((r: any) => ({
          lot_number: r.lot_number,
          expiration_date: r.expiration_date,
          quantity: r.quantity,
          inventory_id: r.id,
          from_warehouse: true,
        }))
        setLots(lotOpts)
      } else {
        // Find incident_unit for this unit
        const { data: iuData } = await supabase
          .from('incident_units')
          .select('id')
          .eq('unit_id', form.from_unit_id)
          .limit(1)
          .single()
        if (!iuData) { setLots([]); setLoadingLots(false); return }

        const { data } = await supabase
          .from('unit_inventory')
          .select('id, cs_lot_number, cs_expiration_date, quantity')
          .eq('incident_unit_id', iuData.id)
          .eq('item_name', form.drug_name)
          .eq('category', 'CS')
          .gt('quantity', 0)
          .order('cs_expiration_date')
        const lotOpts: LotOption[] = (data || []).map((r: any) => ({
          lot_number: r.cs_lot_number,
          expiration_date: r.cs_expiration_date,
          quantity: r.quantity,
          inventory_id: r.id,
          from_warehouse: false,
        }))
        setLots(lotOpts)
      }
      setLoadingLots(false)
    }
    loadLots()
  }, [form.drug_name, form.from_unit_id])

  // When lot selected, auto-fill lot number
  const handleLotSelect = (lotNum: string) => {
    const lot = lots.find(l => l.lot_number === lotNum)
    setSelectedLot(lot || null)
    set('lot_number', lotNum)
  }

  const uploadSig = async (ref: React.RefObject<SignatureCanvas | null>, path: string) => {
    if (!ref.current || ref.current.isEmpty()) return null
    const blob = await (await fetch(ref.current.getTrimmedCanvas().toDataURL('image/png'))).blob()
    const { data, error } = await supabase.storage.from('signatures').upload(path, blob, { contentType: 'image/png' })
    if (error) return null
    return supabase.storage.from('signatures').getPublicUrl(data.path).data.publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!getIsOnline()) {
      setError('CS transfers require an internet connection. Please reconnect and try again.')
      return
    }
    if (!form.drug_name || !form.from_unit_id || !form.to_unit_id) { setError('Select drug, from unit, and to unit'); return }
    if (form.from_unit_id === form.to_unit_id) { setError('From and To units must be different'); return }
    if (!form.lot_number) { setError('Select a lot number'); return }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { setError('Enter quantity'); return }
    if (!form.transferred_by || !form.witness) { setError('Transferred By and Witness are required'); return }
    if (form.transferred_by === form.witness) { setError('Transferred By and Witness must be different people'); return }
    if (!selectedLot) { setError('Invalid lot selection'); return }

    const qty = parseFloat(form.quantity)
    if (qty > selectedLot.quantity) {
      setError(`Insufficient stock: only ${selectedLot.quantity} available for this lot`)
      return
    }

    setSubmitting(true); setError('')
    try {
      const ts = Date.now()
      const [transferSigUrl, witnessSigUrl] = await Promise.all([
        uploadSig(transferSigRef, `cs-transfer/${ts}-transfer.png`),
        uploadSig(witnessSigRef, `cs-transfer/${ts}-witness.png`),
      ])

      const fromUnit = units.find(u => u.id === form.from_unit_id)
      const toUnit = units.find(u => u.id === form.to_unit_id)

      // 1. Subtract from source
      if (selectedLot.from_warehouse) {
        const newQty = selectedLot.quantity - qty
        await supabase.from('warehouse_inventory').update({ quantity: newQty })
          .eq('id', selectedLot.inventory_id)
      } else {
        const newQty = selectedLot.quantity - qty
        await supabase.from('unit_inventory').update({ quantity: newQty })
          .eq('id', selectedLot.inventory_id)
      }

      // 2. Add to destination
      const toIsWarehouse = toUnit?.name === 'Warehouse'
      if (toIsWarehouse) {
        const { data: existing } = await supabase.from('warehouse_inventory')
          .select('id, quantity').eq('item_name', form.drug_name).eq('lot_number', form.lot_number).single()
        if (existing) {
          await supabase.from('warehouse_inventory').update({ quantity: existing.quantity + qty }).eq('id', existing.id)
        } else {
          await supabase.from('warehouse_inventory').insert({
            item_name: form.drug_name, category: 'CS', lot_number: form.lot_number,
            expiration_date: selectedLot.expiration_date, quantity: qty,
          })
        }
      } else {
        // Find or create unit_inventory row for destination
        const { data: destIU } = await supabase.from('incident_units').select('id')
          .eq('unit_id', form.to_unit_id).limit(1).single()
        if (!destIU) throw new Error('Destination unit not assigned to an incident')

        const { data: existing } = await supabase.from('unit_inventory')
          .select('id, quantity')
          .eq('incident_unit_id', destIU.id)
          .eq('item_name', form.drug_name)
          .eq('category', 'CS')
          .single()
        if (existing) {
          await supabase.from('unit_inventory').update({
            quantity: existing.quantity + qty,
            cs_lot_number: form.lot_number,
            cs_expiration_date: selectedLot.expiration_date,
          }).eq('id', existing.id)
        } else {
          await supabase.from('unit_inventory').insert({
            incident_unit_id: destIU.id, item_name: form.drug_name, category: 'CS',
            quantity: qty, par_qty: 0, cs_lot_number: form.lot_number,
            cs_expiration_date: selectedLot.expiration_date,
          })
        }
      }

      // 3. Log transaction
      await supabase.from('cs_transactions').insert({
        transfer_type: toUnit?.name === 'Warehouse' ? 'Return' : 'Transfer',
        drug_name: form.drug_name,
        lot_number: form.lot_number,
        from_unit: fromUnit?.name,
        to_unit: toUnit?.name,
        quantity: qty,
        date: new Date().toISOString(),
        performed_by: form.transferred_by,
        witness: form.witness,
        expiration_date: selectedLot.expiration_date,
        transfer_signature_url: transferSigUrl,
        receiver_signature_url: witnessSigUrl,
        notes: form.notes || null,
      })

      setSuccess(true)
      setTimeout(() => navigate('/cs'), 1500)
    } catch (err: any) {
      setError(err.message || 'Transfer failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

  if (success) return (
    <div className="p-8 text-center mt-16">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-xl font-bold text-white">Transfer Complete</h2>
      <p className="text-gray-400 text-sm mt-2">Redirecting to CS overview...</p>
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-lg mt-8 md:mt-0 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/cs" className="text-gray-500 hover:text-white text-sm">← CS</Link>
        <h1 className="text-2xl font-bold">Transfer Controlled Substance</h1>
      </div>

      {isOffline && (
        <div className="mb-4 bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm">
          📶 You are offline. CS transfers require an internet connection. You can prepare the form, but submission requires connectivity.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Drug */}
        <div className="bg-gray-900 rounded-xl p-4 border border-orange-900/50 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-lg">⚠️</span>
            <h2 className="text-xs font-bold uppercase tracking-wide text-orange-400">Controlled Substance Transfer</h2>
          </div>

          <div>
            <label className={labelCls}>Drug Name *</label>
            <select value={form.drug_name} onChange={e => { set('drug_name', e.target.value); set('lot_number', ''); setLots([]) }} className={inputCls}>
              <option value="">Select drug...</option>
              {CS_DRUGS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          {/* From Unit */}
          <div>
            <label className={labelCls}>From Unit *</label>
            <select value={form.from_unit_id} onChange={e => {
              const u = units.find(u => u.id === e.target.value)
              set('from_unit_id', e.target.value)
              set('from_unit_name', u?.name || '')
              set('lot_number', '')
              setLots([])
            }} className={inputCls}>
              <option value="">Select source unit...</option>
              {units.filter(u => u.id !== form.to_unit_id).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Lot Number — populated from From Unit */}
          {form.from_unit_id && form.drug_name && (
            <div>
              <label className={labelCls}>Lot Number *</label>
              {loadingLots ? (
                <div className={inputCls + ' text-gray-500'}>Loading lots...</div>
              ) : lots.length === 0 ? (
                <div className="px-3 py-2 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                  No {form.drug_name} in stock on {form.from_unit_name}
                </div>
              ) : (
                <select value={form.lot_number} onChange={e => handleLotSelect(e.target.value)} className={inputCls}>
                  <option value="">Select lot...</option>
                  {lots.map(l => (
                    <option key={l.lot_number || 'no-lot'} value={l.lot_number || ''}>
                      {l.lot_number || 'No lot'} — Exp: {l.expiration_date || 'N/A'} — Qty: {l.quantity}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Qty */}
          {selectedLot && (
            <div>
              <label className={labelCls}>Quantity to Transfer * (max: {selectedLot.quantity})</label>
              <input type="number" min="1" max={selectedLot.quantity}
                value={form.quantity} onChange={e => set('quantity', e.target.value)} className={inputCls} />
            </div>
          )}

          {/* To Unit */}
          <div>
            <label className={labelCls}>To Unit *</label>
            <select value={form.to_unit_id} onChange={e => {
              const u = units.find(u => u.id === e.target.value)
              set('to_unit_id', e.target.value)
              set('to_unit_name', u?.name || '')
            }} className={inputCls}>
              <option value="">Select destination unit...</option>
              {/* Selecting Warehouse = Return transfer */}
              {units.filter(u => u.id !== form.from_unit_id).map(u => (
                <option key={u.id} value={u.id}>{u.name === 'Warehouse' ? '🏭 Warehouse (Return)' : u.name}</option>
              ))}
            </select>
            {form.to_unit_name === 'Warehouse' && (
              <p className="mt-1.5 text-xs text-purple-400 flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-purple-900/40 border border-purple-700 rounded text-purple-300 font-medium">RETURN</span>
                This will be logged as a return to warehouse and deduct from unit inventory.
              </p>
            )}
          </div>
        </div>

        {/* Personnel */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Personnel</h2>
          <div>
            <label className={labelCls}>Transferred By *</label>
            <select value={form.transferred_by} onChange={e => set('transferred_by', e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Witness * (must be different person)</label>
            <select value={form.witness} onChange={e => set('witness', e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              {employees.filter(e => e.name !== form.transferred_by).map(e => (
                <option key={e.id} value={e.name}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className={inputCls + ' resize-none'} />
          </div>
        </div>

        {/* Signatures */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Signatures</h2>
          <div>
            <label className={labelCls}>Transferred By Signature</label>
            <div className="bg-white rounded-lg overflow-hidden">
              <SignatureCanvas ref={transferSigRef} canvasProps={{ className: 'w-full', height: 80 }}
                backgroundColor="white" penColor="black" />
            </div>
            <button type="button" onClick={() => transferSigRef.current?.clear()}
              className="text-xs text-gray-500 underline mt-1">Clear</button>
          </div>
          <div>
            <label className={labelCls}>Witness Signature</label>
            <div className="bg-white rounded-lg overflow-hidden">
              <SignatureCanvas ref={witnessSigRef} canvasProps={{ className: 'w-full', height: 80 }}
                backgroundColor="white" penColor="black" />
            </div>
            <button type="button" onClick={() => witnessSigRef.current?.clear()}
              className="text-xs text-gray-500 underline mt-1">Clear</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors">
          {submitting ? 'Processing Transfer...' : 'Complete Transfer'}
        </button>
      </form>
    </div>
  )
}
