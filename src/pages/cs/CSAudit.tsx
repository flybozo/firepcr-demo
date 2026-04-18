
import { FieldGuard } from '@/components/FieldGuard'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams, useNavigate } from 'react-router-dom'

type CSTransaction = {
  id: string
  transfer_type: string | null
  transaction_type?: string | null
  drug_name: string
  lot_number: string | null
  from_unit: string | null
  to_unit: string | null
  quantity: number
  performed_by: string | null
  witness: string | null
  notes: string | null
  created_at: string
}

const CS_DRUGS = ['Morphine Sulfate', 'Fentanyl', 'Midazolam (Versed)', 'Ketamine']
const TRANSFER_TYPES = ['Receive', 'Transfer', 'Administer', 'Waste', 'Return', 'Audit']
const ALL_UNITS = ['Warehouse', 'Medic 1', 'Medic 2', 'Medic 3', 'Medic 4', 'Aid 1', 'Aid 2', 'Command 1', 'Rescue 1', 'Rescue 2']

const TYPE_COLORS: Record<string, string> = {
  Receive: 'bg-green-900/40 text-green-300 border border-green-700',
  Transfer: 'bg-blue-900/40 text-blue-300 border border-blue-700',
  Administer: 'bg-orange-900/40 text-orange-300 border border-orange-700',
  Administration: 'bg-orange-900/40 text-orange-300 border border-orange-700',
  Waste: 'bg-red-900/40 text-red-300 border border-red-700',
  Audit: 'bg-gray-700/60 text-gray-300 border border-gray-600',
  Return: 'bg-purple-900/40 text-purple-300 border border-purple-700',
}

const inputCls = 'bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

function formatDate(str: string) {
  return new Date(str).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function AuditLogInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [transactions, setTransactions] = useState<CSTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const [dateRange, setDateRange] = useState('7d')
  const [filters, setFilters] = useState({
    unit: searchParams.get('unit') || '',
    drug: searchParams.get('drug') || '',
    type: searchParams.get('type') || '',
    dateFrom: searchParams.get('from') || '',
    dateTo: searchParams.get('to') || '',
  })

  const now = useMemo(() => Date.now(), [dateRange])
  const quickDateFilter = dateRange === 'All' ? null :
    new Date(now - (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90) * 86400000).toISOString()

  async function loadTransactions() {
    setLoading(true)
    let query = supabase
      .from('cs_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(200)

    if (filters.drug) query = query.eq('drug_name', filters.drug)
    if (filters.type) query = query.eq('transfer_type', filters.type)
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
    else if (quickDateFilter) query = query.gte('created_at', quickDateFilter)
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59')
    if (filters.unit) {
      query = query.or(`from_unit.eq.${filters.unit},to_unit.eq.${filters.unit}`)
    }

    const { data, count } = await query
    setTransactions(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTransactions() }, [filters, dateRange])

  function setFilter(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function exportCSV() {
    const headers = ['Date/Time', 'Type', 'Drug', 'Lot#', 'From', 'To', 'Qty', 'By', 'Witness', 'Notes']
    const rows = transactions.map(t => [
      formatDate(t.created_at),
      t.transfer_type,
      t.drug_name,
      t.lot_number || '',
      t.from_unit || '',
      t.to_unit || '',
      t.quantity,
      t.performed_by || '',
      t.witness || '',
      (t.notes || '').replace(/,/g, ';'),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cs-audit-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function clearFilters() {
    setFilters({ unit: '', drug: '', type: '', dateFrom: '', dateTo: '' })
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mt-8 md:mt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🔐 CS Audit Log</h1>
          <p className="text-gray-400 text-sm mt-1">Full controlled substance transaction history</p>
        </div>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg font-medium"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Date range filter pills */}
      <div className="hidden md:flex gap-1.5 mb-3">
        {(['7d', '30d', '90d', 'All'] as const).map(range => (
          <button key={range} onClick={() => setDateRange(range)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              dateRange === range ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
          </button>
        ))}
      </div>
      {/* Mobile: date range dropdown */}
      <select
        value={dateRange}
        onChange={e => setDateRange(e.target.value)}
        className="md:hidden w-full mb-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
      >
        <option value="7d">7 Days</option>
        <option value="30d">30 Days</option>
        <option value="90d">90 Days</option>
        <option value="All">All Time</option>
      </select>

      {/* Filters */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unit</label>
            <select className={inputCls + ' w-full'} value={filters.unit} onChange={e => setFilter('unit', e.target.value)}>
              <option value="">All Units</option>
              {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Drug</label>
            <select className={inputCls + ' w-full'} value={filters.drug} onChange={e => setFilter('drug', e.target.value)}>
              <option value="">All Drugs</option>
              {CS_DRUGS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select className={inputCls + ' w-full'} value={filters.type} onChange={e => setFilter('type', e.target.value)}>
              <option value="">All Types</option>
              {TRANSFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Date</label>
            <input className={inputCls + ' w-full'} type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To Date</label>
            <input className={inputCls + ' w-full'} type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">{loading ? 'Loading...' : `${total} transactions${transactions.length < total ? ` (showing ${transactions.length})` : ''}`}</p>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm py-4 text-center">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No transactions found</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="text-left py-2 pr-3 font-medium">Date/Time</th>
                    <th className="text-left py-2 pr-3 font-medium">Type</th>
                    <th className="text-left py-2 pr-3 font-medium">Drug</th>
                    <th className="text-left py-2 pr-3 font-medium">Lot#</th>
                    <th className="text-left py-2 pr-3 font-medium">From → To</th>
                    <th className="text-left py-2 pr-3 font-medium">Qty</th>
                    <th className="text-left py-2 pr-3 font-medium">By</th>
                    <th className="text-left py-2 font-medium">Witness</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b border-gray-800/50 hover:theme-card-footer" title={t.notes || undefined}>
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{formatDate(t.created_at)}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[(t.transfer_type || t.transaction_type) ?? ""] || 'text-gray-400'}`}>
                          {t.transfer_type || t.transaction_type || "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-white">{t.drug_name}</td>
                      <td className="py-2 pr-3 text-gray-400">{t.lot_number || '—'}</td>
                      <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">{t.from_unit || '—'} → {t.to_unit || '—'}</td>
                      <td className="py-2 pr-3 text-orange-300 font-bold">{t.quantity}</td>
                      <td className="py-2 pr-3 text-gray-400">{t.performed_by || '—'}</td>
                      <td className="py-2 text-gray-400">{t.witness || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {transactions.map(t => (
                <div key={t.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[(t.transfer_type || t.transaction_type) ?? ""] || 'text-gray-400'}`}>
                      {t.transfer_type || t.transaction_type || "—"}
                    </span>
                    <span className="text-gray-500 text-xs">{formatDate(t.created_at)}</span>
                  </div>
                  <p className="text-white text-sm font-medium">{t.drug_name}</p>
                  <p className="text-gray-400 text-xs">Lot: {t.lot_number || '—'} | {t.from_unit || '—'} → {t.to_unit || '—'}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-400 text-xs">By: {t.performed_by || '—'}</span>
                    <span className="text-orange-300 font-bold text-sm">×{t.quantity}</span>
                  </div>
                  {t.notes && <p className="text-gray-500 text-xs mt-1 italic">{t.notes}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AuditLogPageInner() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <AuditLogInner />
    </Suspense>
  )
}

export default function AuditLogPageWrapped() {
  return (
    <FieldGuard redirectFn={() => '/cs'}>
      <AuditLogPageInner />
    </FieldGuard>
  )
}
