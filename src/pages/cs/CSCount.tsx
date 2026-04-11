

import { useEffect, useRef, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCachedData, cacheData } from '@/lib/offlineStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { useOfflineWrite } from '@/lib/useOfflineWrite'

type Employee = {
  id: string
  name: string
  role: string
}

type CSItem = {
  id: string
  item_name: string
  quantity: number
  cs_lot_number: string | null
  cs_expiration_date: string | null
  incident_unit_id: string
}

type CountEntry = {
  inv: CSItem
  actualCount: string
  discrepancyNote: string
}

const ALL_UNITS = ['Warehouse', 'RAMBO 1', 'RAMBO 2', 'RAMBO 3', 'RAMBO 4', 'MSU 1', 'MSU 2', 'The Beast', 'REMS 1', 'REMS 2']
const CLINICAL_ROLES = ['MD/DO', 'NP', 'PA', 'Paramedic', 'RN']

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

async function sigPadToBlob(ref: React.RefObject<SignatureCanvas | null>): Promise<Blob | null> {
  if (!ref.current || ref.current.isEmpty()) return null
  return new Promise(resolve => {
    ref.current!.getCanvas().toBlob(blob => resolve(blob), 'image/png')
  })
}

function DailyCountInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { write: offlineWrite, isOffline } = useOfflineWrite()
  const [searchParams] = useSearchParams()
  const counterSigRef = useRef<SignatureCanvas>(null)
  const witnessSigRef = useRef<SignatureCanvas>(null)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [csItems, setCSItems] = useState<CSItem[]>([])
  const [entries, setEntries] = useState<CountEntry[]>([])
  const [unitIdMap, setUnitIdMap] = useState<Record<string, string>>({})
  const [selectedUnit, setSelectedUnit] = useState(searchParams.get('unit') || '')
  const [loadingItems, setLoadingItems] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    performed_by: '',
    witness: '',
  })

  useEffect(() => {
    loadInit()
  }, [])

  useEffect(() => {
    if (selectedUnit && Object.keys(unitIdMap).length > 0) {
      loadCSItems(selectedUnit)
    }
  }, [selectedUnit, unitIdMap])

  async function loadInit() {
    try {
      const [{ data: emps, error: empErr }, { data: units }] = await Promise.all([
        supabase.from('employees').select('id, name, role').eq('status', 'Active').in('role', CLINICAL_ROLES).order('name'),
        supabase.from('incident_units').select('id, name'),
      ])
      if (empErr) throw empErr
      setEmployees(emps || [])
      const map: Record<string, string> = {}
      if (units) for (const u of units) map[u.name] = u.id
      setUnitIdMap(map)
    } catch {
      // Offline fallback — use cached employees
      const cached = await getCachedData('employees')
      const filtered = cached.filter((e: any) => CLINICAL_ROLES.includes(e.role))
      if (filtered.length > 0) setEmployees(filtered)
    }
  }

  async function loadCSItems(unit: string) {
    setLoadingItems(true)
    const unitId = unitIdMap[unit]

    let items: CSItem[] = []
    try {
      if (!unitId) throw new Error('No unit ID')
      const { data, error } = await supabase
        .from('unit_inventory')
        .select('id, item_name, quantity, cs_lot_number, cs_expiration_date, incident_unit_id')
        .eq('incident_unit_id', unitId)
        .eq('category', 'CS')
      if (error) throw error
      items = data || []
      if (items.length > 0) await cacheData('inventory', items)
    } catch {
      // Offline — filter CS items from cached inventory
      const cached = await getCachedData('inventory')
      items = cached.filter((i: any) => i.category === 'CS' && (!unitId || i.incident_unit_id === unitId)) as CSItem[]
    }

    setCSItems(items)
    setEntries(items.map(inv => ({ inv, actualCount: String(inv.quantity), discrepancyNote: '' })))
    setLoadingItems(false)
  }

  function updateEntry(index: number, field: 'actualCount' | 'discrepancyNote', value: string) {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e))
  }

  function hasDiscrepancy(entry: CountEntry) {
    return Number(entry.actualCount) !== entry.inv.quantity
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedUnit) { setError('Please select a unit'); return }
    if (!form.performed_by) { setError('Counter is required'); return }
    if (!form.witness) { setError('Witness is required'); return }
    if (form.performed_by === form.witness) { setError('Counter and Witness must be different people'); return }
    if (!counterSigRef.current || counterSigRef.current.isEmpty()) { setError('Counter signature is required'); return }
    if (!witnessSigRef.current || witnessSigRef.current.isEmpty()) { setError('Witness signature is required'); return }

    // Check all discrepancies have notes
    for (const entry of entries) {
      if (hasDiscrepancy(entry) && !entry.discrepancyNote.trim()) {
        setError(`Discrepancy note required for ${entry.inv.item_name} (Lot: ${entry.inv.cs_lot_number || 'N/A'})`)
        return
      }
    }

    setSubmitting(true)
    try {
      const ts = Date.now()

      const counterBlob = await sigPadToBlob(counterSigRef)
      const witnessBlob = await sigPadToBlob(witnessSigRef)
      let counterSigUrl = ''
      let witnessSigUrl = ''

      if (counterBlob) {
        const { data } = await supabase.storage.from('signatures').upload(`cs-count/${ts}-counter.png`, counterBlob, { contentType: 'image/png' })
        if (data) counterSigUrl = supabase.storage.from('signatures').getPublicUrl(data.path).data.publicUrl
      }
      if (witnessBlob) {
        const { data } = await supabase.storage.from('signatures').upload(`cs-count/${ts}-witness.png`, witnessBlob, { contentType: 'image/png' })
        if (data) witnessSigUrl = supabase.storage.from('signatures').getPublicUrl(data.path).data.publicUrl
      }

      const counterName = employees.find(e => e.id === form.performed_by)?.name || form.performed_by
      const witnessName = employees.find(e => e.id === form.witness)?.name || form.witness
      const discrepancySummary: string[] = []

      // Update inventory and log discrepancies
      for (const entry of entries) {
        const actual = Number(entry.actualCount)
        const expected = entry.inv.quantity

        // Update quantity to actual
        await supabase.from('unit_inventory').update({ quantity: actual }).eq('id', entry.inv.id)

        // Log discrepancy if any
        if (actual !== expected) {
          const diff = actual - expected
          discrepancySummary.push(`${entry.inv.item_name} (Lot ${entry.inv.cs_lot_number || 'N/A'}): expected ${expected}, found ${actual} (${diff > 0 ? '+' : ''}${diff}). ${entry.discrepancyNote}`)

          await supabase.from('cs_transactions').insert({
            transfer_type: 'Audit',
            drug_name: entry.inv.item_name,
            lot_number: entry.inv.cs_lot_number,
            from_unit: selectedUnit,
            to_unit: selectedUnit,
            quantity: Math.abs(diff),
            performed_by: counterName,
            witness: witnessName,
            notes: `DISCREPANCY: Expected ${expected}, Found ${actual}. ${entry.discrepancyNote}`,
            expiration_date: entry.inv.cs_expiration_date,
          })
        }
      }

      // Insert daily count record
      await supabase.from('cs_daily_counts').insert({
        unit: selectedUnit,
        date: new Date().toISOString().split('T')[0],
        performed_by: counterName,
        witness: witnessName,
        discrepancies: discrepancySummary.length > 0 ? discrepancySummary.join('\n') : null,
        counter_signature_url: counterSigUrl || null,
        witness_signature_url: witnessSigUrl || null,
      })

      setSuccess(true)
      setTimeout(() => navigate('/cs'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const counterName = employees.find(e => e.id === form.performed_by)?.name || ''
  const witnessName = employees.find(e => e.id === form.witness)?.name || ''
  const discrepancyCount = entries.filter(hasDiscrepancy).length

  if (success) {
    return (
      <div className="p-8 max-w-lg mt-8 md:mt-0">
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-green-400 font-bold text-lg">Daily Count Submitted</h2>
          {discrepancyCount > 0 && <p className="text-orange-400 text-sm mt-1">{discrepancyCount} discrepancy(ies) logged</p>}
          <p className="text-gray-400 text-sm mt-2">Redirecting to CS overview...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-lg mt-8 md:mt-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">📋 Daily CS Count</h1>
        <p className="text-gray-400 text-sm mt-1">Verify controlled substance quantities on unit</p>
      </div>

      {isOffline && (
        <div className="mb-4 bg-red-950/60 border border-red-800 rounded-xl px-4 py-4 text-red-300 text-sm">
          <p className="font-bold mb-1">📶 Offline — CS Count requires connectivity</p>
          <p className="text-xs text-red-400">Controlled substance counts require an internet connection for signature uploads and inventory updates. Please complete this count when you’re back online.</p>
        </div>
      )}

      <form onSubmit={isOffline ? (e) => { e.preventDefault(); setError('CS Count requires an internet connection. Please reconnect and try again.') } : handleSubmit} className="space-y-4">
        {/* Unit Select */}
        <div>
          <label className={labelCls}>Select Unit *</label>
          <select className={inputCls} value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} required>
            <option value="">Choose unit...</option>
            {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* CS Items */}
        {selectedUnit && (
          <div>
            {loadingItems ? (
              <p className="text-gray-400 text-sm">Loading CS inventory...</p>
            ) : csItems.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">No CS inventory found on {selectedUnit}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">CS Inventory Count</p>
                {entries.map((entry, index) => {
                  const disc = hasDiscrepancy(entry)
                  return (
                    <div key={entry.inv.id} className={`rounded-xl p-4 border ${disc ? 'bg-red-900/20 border-red-700' : 'bg-orange-900/10 border-orange-700/50'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-white font-medium text-sm">{entry.inv.item_name}</p>
                          <p className="text-gray-400 text-xs">Lot: {entry.inv.cs_lot_number || '—'} | Exp: {entry.inv.cs_expiration_date || '—'}</p>
                          <p className="text-gray-500 text-xs">Expected: <span className="text-white font-bold">{entry.inv.quantity}</span></p>
                        </div>
                        {disc && <span className="text-red-400 text-xs font-bold bg-red-900/40 px-2 py-1 rounded">DISCREPANCY</span>}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className={labelCls}>Actual Count</label>
                          <input
                            className={`${inputCls} ${disc ? 'border border-red-600' : ''}`}
                            type="number"
                            min="0"
                            value={entry.actualCount}
                            onChange={e => updateEntry(index, 'actualCount', e.target.value)}
                            required
                          />
                        </div>
                        {disc && (
                          <div className="flex-[2]">
                            <label className={labelCls}>Discrepancy Explanation *</label>
                            <input
                              className={inputCls}
                              type="text"
                              value={entry.discrepancyNote}
                              onChange={e => updateEntry(index, 'discrepancyNote', e.target.value)}
                              placeholder="Required — explain discrepancy"
                              required
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Counter */}
        <div>
          <label className={labelCls}>Counted By *</label>
          <select className={inputCls} value={form.performed_by} onChange={e => setForm(prev => ({ ...prev, performed_by: e.target.value }))} required>
            <option value="">Select person...</option>
            {employees.filter(e => e.id !== form.witness).map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>

        {/* Witness */}
        <div>
          <label className={labelCls}>Witness *</label>
          <select className={inputCls} value={form.witness} onChange={e => setForm(prev => ({ ...prev, witness: e.target.value }))} required>
            <option value="">Select witness...</option>
            {employees.filter(e => e.id !== form.performed_by).map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>

        {/* Counter Signature */}
        <div>
          <label className={labelCls}>Counter Signature{counterName ? ` — ${counterName}` : ''} *</label>
          <div className="rounded-lg overflow-hidden border border-gray-600" style={{ width: 220, height: 80 }}>
            <SignatureCanvas ref={counterSigRef} penColor="black" canvasProps={{ width: 220, height: 80, style: { background: 'white' } }} />
          </div>
          <button type="button" onClick={() => counterSigRef.current?.clear()} className="text-xs text-gray-500 hover:text-gray-300 mt-1">Clear</button>
        </div>

        {/* Witness Signature */}
        <div>
          <label className={labelCls}>Witness Signature{witnessName ? ` — ${witnessName}` : ''} *</label>
          <div className="rounded-lg overflow-hidden border border-gray-600" style={{ width: 220, height: 80 }}>
            <SignatureCanvas ref={witnessSigRef} penColor="black" canvasProps={{ width: 220, height: 80, style: { background: 'white' } }} />
          </div>
          <button type="button" onClick={() => witnessSigRef.current?.clear()} className="text-xs text-gray-500 hover:text-gray-300 mt-1">Clear</button>
        </div>

        {discrepancyCount > 0 && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <p className="text-red-400 text-sm font-bold">⚠ {discrepancyCount} discrepancy(ies) detected</p>
            <p className="text-red-300 text-xs mt-1">These will be logged as Audit transactions</p>
          </div>
        )}

        {error && <p className="text-red-400 text-sm bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/cs')} className="flex-1 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">Cancel</button>
          <button type="submit" disabled={submitting || !selectedUnit || csItems.length === 0} className="flex-1 py-3 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold">
            {submitting ? 'Submitting...' : 'Submit Count'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function DailyCountPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <DailyCountInner />
    </Suspense>
  )
}
