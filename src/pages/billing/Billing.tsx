
import { FieldGuard } from '@/components/FieldGuard'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { fmtCurrencyFull as fmt } from '@/utils/incidentFormatters'

type Incident = {
  id: string
  name: string
  status: string
}

type SupplyLineItem = {
  item_name: string
  quantity: number
  unit_cost: number | null
  total_cost: number | null
  date: string
  unit_name: string
}

type MARLineItem = {
  item_name: string
  qty_used: number
  med_unit: string | null
  date: string
  case_cost: number | null
  units_per_case: number | null
  category: string | null
}

function BillingPageInner() {
  const [searchParams] = useSearchParams()
  const preselectedId = searchParams.get('incidentId') ?? ''

  const supabase = createClient()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentId, setIncidentId] = useState(preselectedId)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [generatedAt, setGeneratedAt] = useState('')

  const [supplyItems, setSupplyItems] = useState<SupplyLineItem[]>([])
  const [marItems, setMarItems] = useState<MARLineItem[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('incidents')
        .select('id, name, status')
        .in('status', ['Active', 'Closed'])
        .order('name')
      setIncidents(data || [])
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIncident = incidents.find(i => i.id === incidentId)

  const generate = async () => {
    if (!incidentId) return
    setLoading(true)
    setGenerated(false)

    // Supply run items
    const { data: srData } = await supabase
      .from('supply_run_items')
      .select(`
        item_name,
        quantity,
        unit_cost,
        total_cost,
        supply_run:supply_runs!inner(
          date,
          incident_id,
          incident_unit:incident_units!inner(
            unit:units(name)
          )
        )
      `)
      .eq('supply_run.incident_id', incidentId)
      .gte('supply_run.date', startDate || '1900-01-01')
      .lte('supply_run.date', endDate || '9999-12-31')

    const mappedSupply: SupplyLineItem[] = ((srData as any[]) || []).map((row: any) => ({
      item_name: row.item_name,
      quantity: row.quantity,
      unit_cost: row.unit_cost,
      total_cost: row.total_cost,
      date: row.supply_run?.date ?? '',
      unit_name: row.supply_run?.incident_unit?.unit?.name ?? '—',
    }))

    // MAR items — join via patient_encounters
    const { data: encData } = await supabase
      .from('patient_encounters')
      .select('encounter_id')
      .eq('incident_id', incidentId)
      .is('deleted_at', null)

    const encIds = ((encData as any[]) || []).map((e: any) => e.encounter_id)

    let mappedMAR: MARLineItem[] = []
    if (encIds.length > 0) {
      const { data: marData } = await supabase
        .from('dispense_admin_log')
        .select(`
          item_name,
          qty_used,
          med_unit,
          date,
          category,
          formulary:formulary_templates(case_cost, units_per_case)
        `)
        .in('encounter_id', encIds)
        .gte('date', startDate || '1900-01-01')
        .lte('date', endDate || '9999-12-31')

      mappedMAR = ((marData as any[]) || []).map((row: any) => ({
        item_name: row.item_name,
        qty_used: row.qty_used ?? 1,
        med_unit: row.med_unit,
        date: row.date ?? '',
        case_cost: row.formulary?.case_cost ?? null,
        units_per_case: row.formulary?.units_per_case ?? null,
        category: row.category ?? null,
      }))
    }

    setSupplyItems(mappedSupply.sort((a, b) => a.date.localeCompare(b.date)))
    setMarItems(mappedMAR.sort((a, b) => a.date.localeCompare(b.date)))
    setGeneratedAt(new Date().toLocaleString())
    setGenerated(true)
    setLoading(false)
  }

  const supplySubtotal = supplyItems.reduce((sum, item) => {
    const lineTotal = item.total_cost ?? ((item.unit_cost ?? 0) * item.quantity)
    return sum + lineTotal
  }, 0)

  const marSubtotal = marItems.reduce((sum, item) => {
    const unitCost = item.case_cost != null && item.units_per_case != null && item.units_per_case > 0
      ? item.case_cost / item.units_per_case
      : 0
    return sum + unitCost * item.qty_used
  }, 0)

  const grandTotal = supplySubtotal + marSubtotal

  const exportCSV = () => {
    if (!selectedIncident) return
    const rows: string[] = []
    rows.push('Section,Date,Unit,Item,Category,Qty,Unit Cost,Line Total')

    supplyItems.forEach(item => {
      const unitCost = item.unit_cost ?? 0
      const lineTotal = item.total_cost ?? (unitCost * item.quantity)
      rows.push([
        'Supply Run',
        item.date,
        item.unit_name,
        item.item_name,
        '',
        item.quantity,
        unitCost.toFixed(2),
        lineTotal.toFixed(2),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })

    marItems.forEach(item => {
      const unitCost = item.case_cost != null && item.units_per_case != null && item.units_per_case > 0
        ? item.case_cost / item.units_per_case
        : 0
      const lineTotal = unitCost * item.qty_used
      rows.push([
        'MAR',
        item.date,
        item.med_unit ?? '',
        item.item_name,
        item.category ?? '',
        item.qty_used,
        unitCost.toFixed(2),
        lineTotal.toFixed(2),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    })

    rows.push(`"Grand Total",,,,,,,${grandTotal.toFixed(2)}`)

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateRange = `${startDate || 'all'}_to_${endDate || 'all'}`
    a.href = url
    a.download = `Billing-${selectedIncident.name.replace(/[^a-z0-9]/gi, '-')}-${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <Link to="/" className="text-gray-500 hover:text-white text-sm">← Home</Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-xl font-bold">Billing Report</h1>
        </div>

        {/* Controls */}
        <div className="theme-card rounded-xl border p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Incident</label>
              <select
                value={incidentId}
                onChange={e => setIncidentId(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select incident...</option>
                {incidents.map(i => (
                  <option key={i.id} value={i.id}>{i.name} ({i.status})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <button
            onClick={generate}
            disabled={!incidentId || loading}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {/* Report */}
        {generated && selectedIncident && (
          <div className="space-y-4">

            {/* Report header */}
            <div className="theme-card rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h2 className="text-lg font-bold">{selectedIncident.name}</h2>
                <p className="text-sm text-gray-400">
                  {startDate || 'All dates'} {endDate ? `→ ${endDate}` : ''}
                </p>
                <p className="text-xs text-gray-600">Generated: {generatedAt}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportCSV}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition-colors"
                >
                  Print
                </button>
              </div>
            </div>

            {/* Supply Runs */}
            <div className="theme-card rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Supply Runs</h3>
                <span className="text-sm font-semibold text-white">{fmt(supplySubtotal)}</span>
              </div>
              {supplyItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-600 text-center">No supply run items found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-gray-600 theme-card-footer">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Unit</th>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Unit Cost</th>
                        <th className="px-4 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {supplyItems.map((item, idx) => {
                        const unitCost = item.unit_cost ?? 0
                        const lineTotal = item.total_cost ?? (unitCost * item.quantity)
                        return (
                          <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{item.date}</td>
                            <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{item.unit_name}</td>
                            <td className="px-4 py-2">{item.item_name}</td>
                            <td className="px-4 py-2 text-right text-gray-300">{item.quantity}</td>
                            <td className="px-4 py-2 text-right text-gray-300">{fmt(unitCost)}</td>
                            <td className="px-4 py-2 text-right font-medium">{fmt(lineTotal)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* MAR */}
            <div className="theme-card rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Medication Administrations (MAR)</h3>
                <span className="text-sm font-semibold text-white">{fmt(marSubtotal)}</span>
              </div>
              {marItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-600 text-center">No MAR entries found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-gray-600 theme-card-footer">
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Unit</th>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-left">Category</th>
                        <th className="px-4 py-2 text-right">Qty</th>
                        <th className="px-4 py-2 text-right">Unit Cost</th>
                        <th className="px-4 py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {marItems.map((item, idx) => {
                        const unitCost = item.case_cost != null && item.units_per_case != null && item.units_per_case > 0
                          ? item.case_cost / item.units_per_case
                          : 0
                        const lineTotal = unitCost * item.qty_used
                        return (
                          <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-2 text-gray-400 whitespace-nowrap">{item.date}</td>
                            <td className="px-4 py-2 text-gray-300 whitespace-nowrap">{item.med_unit ?? '—'}</td>
                            <td className="px-4 py-2">{item.item_name}</td>
                            <td className="px-4 py-2 text-gray-400 text-xs">{item.category ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-gray-300">{item.qty_used}</td>
                            <td className="px-4 py-2 text-right text-gray-300">{unitCost > 0 ? fmt(unitCost) : '—'}</td>
                            <td className="px-4 py-2 text-right font-medium">{unitCost > 0 ? fmt(lineTotal) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Summary footer */}
            <div className="theme-card rounded-xl border p-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-end justify-end text-right">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Supply Runs Subtotal</p>
                  <p className="text-lg font-semibold text-white">{fmt(supplySubtotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">MAR Subtotal</p>
                  <p className="text-lg font-semibold text-white">{fmt(marSubtotal)}</p>
                </div>
                <div className="border-l border-gray-700 pl-6">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Grand Total</p>
                  <p className="text-2xl font-bold text-red-400">{fmt(grandTotal)}</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}


export default function BillingPageWrapped() {
  return (
    <FieldGuard redirectFn={() => '/'}>
      <BillingPageInner />
    </FieldGuard>
  )
}
