

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { LoadingSkeleton } from '@/components/ui'
import { queryClinicalEmployees, updateInventoryQty, insertCSTransaction, insertDailyCount } from '@/lib/services/cs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOfflineWrite } from '@/lib/useOfflineWrite'
import { useUserAssignment } from '@/lib/useUserAssignment'
import PinSignature, { type SignatureRecord } from '@/components/PinSignature'
import OfflineGate from '@/components/OfflineGate'
import { inputCls, labelCls } from '@/components/ui/FormField'

type Employee = {
  id: string
  name: string
  role: string
}

type CSItem = {
  id: string
  item_name: string
  quantity: number
  lot_number: string | null
  expiration_date: string | null
  unit_id: string
}

type CountEntry = {
  inv: CSItem
  actualCount: string
  discrepancyNote: string
}

const ALL_UNITS = ['Warehouse', 'RAMBO 1', 'RAMBO 2', 'RAMBO 3', 'RAMBO 4', 'MSU 1', 'MSU 2', 'The Beast', 'REMS 1', 'REMS 2']
const CLINICAL_ROLES = ['MD', 'DO', 'NP', 'PA', 'Paramedic', 'RN']

function DailyCountInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { write: offlineWrite, isOffline } = useOfflineWrite()
  const [searchParams] = useSearchParams()
  const assignment = useUserAssignment()
  const [showCounterSig, setShowCounterSig] = useState(false)
  const [showWitnessSig, setShowWitnessSig] = useState(false)
  const [counterSigRecord, setCounterSigRecord] = useState<SignatureRecord | null>(null)
  const [witnessSigRecord, setWitnessSigRecord] = useState<SignatureRecord | null>(null)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [csItems, setCSItems] = useState<CSItem[]>([])
  const [entries, setEntries] = useState<CountEntry[]>([])
  const [unitIdMap, setUnitIdMap] = useState<Record<string, string>>({})
  const [availableUnits, setAvailableUnits] = useState<string[]>([])
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
    // Preload dropdown data from cache
    try {
      const { getCachedData } = await import('@/lib/offlineStore')
      const cachedEmps = await getCachedData('employees') as any[]
      if (cachedEmps.length > 0) setEmployees(cachedEmps.filter((e: any) => CLINICAL_ROLES.includes(e.role)) as Employee[])
      const cachedInv = await getCachedData('inventory') as any[]
      if (cachedInv.length > 0) setCSItems(cachedInv.filter((i: any) => i.category === 'CS') as CSItem[])
    } catch {}
    const { data: emps } = await loadList<Employee>(
      () => queryClinicalEmployees(CLINICAL_ROLES),
      'employees',
      (all) => all.filter(e => CLINICAL_ROLES.includes(e.role))
    )
    setEmployees(emps)
    try {
      const { data: units } = await supabase.from('units').select('id, name').order('name')
      const map: Record<string, string> = {}
      if (units) for (const u of units) { map[u.name] = u.id }
      setUnitIdMap(map)
      setAvailableUnits(units?.map(u => u.name) || [])
    } catch {}
  }

  async function loadCSItems(unit: string) {
    setLoadingItems(true)
    const unitId = unitIdMap[unit]

    const { data: items } = await loadList<CSItem>(
      () => unitId
        ? supabase
            .from('unit_inventory')
            .select('id, item_name, quantity, lot_number, expiration_date, unit_id')
            .eq('unit_id', unitId)
            .eq('category', 'CS')
        : Promise.resolve({ data: [], error: null }),
      'inventory',
      unitId ? (all) => all.filter((i: any) => i.category === 'CS' && i.unit_id === unitId) : undefined
    )

    setCSItems(items || [])
    setEntries((items || []).map(inv => ({ inv, actualCount: String(inv.quantity), discrepancyNote: '' })))
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
    if (!counterSigRecord) { setError('Counter signature is required — tap Sign below'); return }
    if (!witnessSigRecord) { setError('Witness signature is required'); return }

    // Check all discrepancies have notes
    for (const entry of entries) {
      if (hasDiscrepancy(entry) && !entry.discrepancyNote.trim()) {
        setError(`Discrepancy note required for ${entry.inv.item_name} (Lot: ${entry.inv.lot_number || 'N/A'})`)
        return
      }
    }

    setSubmitting(true)
    try {
      const counterSigUrl = counterSigRecord?.signatureHash || ''
      const witnessSigUrl = witnessSigRecord?.signatureHash || ''

      const counterName = employees.find(e => e.id === form.performed_by)?.name || form.performed_by
      const witnessName = employees.find(e => e.id === form.witness)?.name || form.witness
      const discrepancySummary: string[] = []

      // Update inventory and log discrepancies
      for (const entry of entries) {
        const actual = Number(entry.actualCount)
        const expected = entry.inv.quantity

        // Update quantity to actual
        await updateInventoryQty(entry.inv.id, actual)

        // Log discrepancy if any
        if (actual !== expected) {
          const diff = actual - expected
          discrepancySummary.push(`${entry.inv.item_name} (Lot ${entry.inv.lot_number || 'N/A'}): expected ${expected}, found ${actual} (${diff > 0 ? '+' : ''}${diff}). ${entry.discrepancyNote}`)

          await insertCSTransaction({
            transfer_type: 'Audit',
            drug_name: entry.inv.item_name,
            lot_number: entry.inv.lot_number,
            from_unit: selectedUnit,
            to_unit: selectedUnit,
            quantity: Math.abs(diff),
            performed_by: counterName,
            witness: witnessName,
            notes: `DISCREPANCY: Expected ${expected}, Found ${actual}. ${entry.discrepancyNote}`,
            expiration_date: entry.inv.expiration_date,
          })
        }
      }

      // Insert daily count record
      await insertDailyCount({
        unit: selectedUnit,
        date: new Date().toISOString().split('T')[0],
        performed_by: counterName,
        witness: witnessName,
        discrepancies: discrepancySummary.length > 0 ? discrepancySummary.join('\n') : null,
        counter_signature_url: counterSigUrl || null,
        witness_signature_url: witnessSigUrl || null,
      })

      // Alert admins if discrepancies found
      if (discrepancySummary.length > 0) {
        try {
          const { authFetch } = await import('@/lib/authFetch')
          await authFetch('/api/push/cs-discrepancy-alert', {
            method: 'POST',
            body: JSON.stringify({
              unit: selectedUnit,
              counter: counterName,
              witness: witnessName,
              discrepancies: discrepancySummary,
            }),
          })
        } catch { /* alert is best-effort */ }
      }

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
    <OfflineGate page message="CS transfers and daily counts require a connection.">
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
            {(availableUnits.length > 0 ? availableUnits : ALL_UNITS).map(u => <option key={u} value={u}>{u}</option>)}
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
                          <p className="text-gray-400 text-xs">Lot: {entry.inv.lot_number || '—'} | Exp: {entry.inv.expiration_date || '—'}</p>
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
          {counterSigRecord ? (
            <div className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
              <div>
                <p className="text-green-400 text-sm font-medium">✓ Signed</p>
                <p className="text-gray-400 text-xs">{counterSigRecord.displayText}</p>
              </div>
              <button type="button" onClick={() => setCounterSigRecord(null)} className="text-gray-500 hover:text-white text-xs">Clear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCounterSig(true)}
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

      {showCounterSig && (
        <PinSignature label="Counter Signature" mode="self"
          employeeId={assignment.employee?.id} employeeName={assignment.employee?.name}
          documentContext="cs-count"
          onSign={(rec) => { setCounterSigRecord(rec); setShowCounterSig(false) }}
          onCancel={() => setShowCounterSig(false)} />
      )}
      {showWitnessSig && (
        <PinSignature label="Witness Signature" mode="witness"
          documentContext="cs-count"
          onSign={(rec) => { setWitnessSigRecord(rec); setShowWitnessSig(false) }}
          onCancel={() => setShowWitnessSig(false)} />
      )}
    </div>
    </OfflineGate>
  )
}

export default function DailyCountPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <DailyCountInner />
    </Suspense>
  )
}
