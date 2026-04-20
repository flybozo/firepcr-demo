import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as incidentService from '@/lib/services/incidents'
import { calcDays, fmtCurrency } from '@/utils/incidentFormatters'
import type { CrewDeployment, ExpenseRow, Incident, IncidentUnit } from '@/types/incident'

export function RevenueCard({
  allIncidentUnits,
  crewDeployments,
  expenses,
  incident,
  isAdmin,
  reload,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  allIncidentUnits: IncidentUnit[]
  crewDeployments: CrewDeployment[]
  expenses: ExpenseRow[]
  incident: Incident | null
  isAdmin: boolean
  reload: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const navigate = useNavigate()
  const [editingRateIuId, setEditingRateIuId] = useState<string | null>(null)
  const [editRateVal, setEditRateVal] = useState('')

  if (!isAdmin) return null

  const revenueUnits = allIncidentUnits.map(iu => {
    const rate = iu.daily_contract_rate ?? 0
    const start = iu.assigned_at || incident?.start_date || null
    const end = iu.released_at || null
    const days = start ? calcDays(start.split('T')[0], end ? end.split('T')[0] : null) : 0
    const revenue = days * rate
    const typeName = (() => {
      const ut = (iu.unit as any)?.unit_type
      const t = Array.isArray(ut) ? ut[0] : ut
      return t?.name || ''
    })()
    return { ...iu, rate, days, revenue, typeName }
  })
  const totalRevenue = revenueUnits.reduce((s, u) => s + u.revenue, 0)
  const totalUnitDays = revenueUnits.reduce((s, u) => s + u.days, 0)
  const totalPayroll = crewDeployments.reduce((sum, dep) => {
    const start = dep.travel_date || (dep.assigned_at ? dep.assigned_at.split('T')[0] : null) || incident?.start_date || null
    const end = dep.released_at ? dep.released_at.split('T')[0] : null
    const d = start ? calcDays(start, end) : 0
    return sum + (d * dep.daily_rate)
  }, 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const netRevenue = totalRevenue - totalPayroll - totalExpenses

  return (
    <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
        {dragHandleProps && (
          <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
        )}
        {cycleSpan && (
          <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
            className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">💵 Incident Revenue</h3>
        <div className="text-right">
          <span className="text-xl font-bold text-green-400">{fmtCurrency(totalRevenue)}</span>
          <span className={`text-xs ml-2 font-semibold ${netRevenue >= 0 ? 'text-green-400/70' : 'text-red-400'}`}>
            (net {fmtCurrency(netRevenue)})
          </span>
        </div>
      </div>
      {revenueUnits.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-opacity-30 theme-border">
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Unit</th>
                <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Type</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Rate/Day</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Days</th>
                <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {revenueUnits.map(u => {
                const isActive = !u.released_at
                const isEditingRate = editingRateIuId === u.id
                return (
                  <tr key={u.id} className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${u.released_at ? 'opacity-50' : ''}`}
                    onClick={() => u.unit?.id && navigate(`/units/${u.unit.id}`)}>
                    <td className="px-3 py-2 text-white font-medium"><span className="hover:text-blue-400 transition-colors">{(u.unit as any)?.name || '?'}</span></td>
                    <td className="px-3 py-2 text-gray-400">{u.typeName}</td>
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      {isEditingRate ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-500">$</span>
                          <input type="number" step="100" value={editRateVal}
                            onChange={e => setEditRateVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = parseFloat(editRateVal) || 0
                                incidentService.updateIncidentUnitRate(u.id, val)
                                  .then(() => { setEditingRateIuId(null); reload() })
                              }
                              if (e.key === 'Escape') setEditingRateIuId(null)
                            }}
                            autoFocus
                            className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-white text-right text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                          <button onClick={() => {
                            const val = parseFloat(editRateVal) || 0
                            incidentService.updateIncidentUnitRate(u.id, val)
                              .then(() => { setEditingRateIuId(null); reload() })
                          }} className="text-green-400 hover:text-green-300 text-xs">✓</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingRateIuId(u.id); setEditRateVal(String(u.rate)) }}
                          className="text-green-400 hover:text-green-300 transition-colors" title="Click to edit rate">
                          {u.rate > 0 ? fmtCurrency(u.rate) : <span className="text-gray-600">—</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {u.days}{isActive && <span className="text-gray-500 ml-0.5">+</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-green-400">
                      {u.revenue > 0 ? fmtCurrency(u.revenue) : <span className="text-gray-600">—</span>}
                      {isActive && u.revenue > 0 && <span className="text-gray-500 ml-0.5">+</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t theme-card-header">
                <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-400">Gross Revenue</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-white">{totalUnitDays} days</td>
                <td className="px-3 py-2 text-right text-sm font-bold text-green-400">{fmtCurrency(totalRevenue)}</td>
              </tr>
              <tr style={{ backgroundColor: 'var(--color-header-bg, #030712)' }}>
                <td colSpan={3} className="px-3 py-1 text-right text-xs text-gray-500">− Payroll</td>
                <td colSpan={2} className="px-3 py-1 text-right text-xs text-red-400">{fmtCurrency(totalPayroll)}</td>
              </tr>
              <tr style={{ backgroundColor: 'var(--color-header-bg, #030712)' }}>
                <td colSpan={3} className="px-3 py-1 text-right text-xs text-gray-500">− Expenses</td>
                <td colSpan={2} className="px-3 py-1 text-right text-xs text-red-400">{fmtCurrency(totalExpenses)}</td>
              </tr>
              <tr className="border-t theme-card-header">
                <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-300">Net Revenue</td>
                <td colSpan={2} className={`px-3 py-2 text-right text-sm font-bold ${netRevenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtCurrency(netRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {revenueUnits.length === 0 && (
        <p className="px-4 py-6 text-sm text-gray-600 text-center">No units assigned</p>
      )}
    </div>
  )
}
