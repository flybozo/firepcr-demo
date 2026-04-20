import { Link } from 'react-router-dom'
import type { DeploymentRow } from './types'

type Props = {
  deployments: DeploymentRow[]
  defaultContractRate: number
  incidentFilter: string
  onFilterChange: (filter: string) => void
}

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function calcRow(dep: DeploymentRow, defaultRate: number) {
  const rate = dep.daily_contract_rate ?? defaultRate
  const start = new Date(dep.assigned_at).getTime()
  const end = dep.released_at ? new Date(dep.released_at).getTime() : Date.now()
  const days = Math.max(1, Math.ceil((end - start) / 86400000))
  return { rate, days, revenue: days * rate }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function DeploymentHistory({ deployments, defaultContractRate, incidentFilter, onFilterChange }: Props) {
  const uniqueIncidents = Array.from(
    new Set(deployments.map(d => d.incident?.name).filter(Boolean) as string[])
  )
  const filtered = incidentFilter === 'All'
    ? deployments
    : deployments.filter(d => d.incident?.name === incidentFilter)
  const totalRevenue = filtered.reduce((sum, dep) => sum + calcRow(dep, defaultContractRate).revenue, 0)

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">📊 Deployment History</h2>
        <span className="text-sm font-semibold text-green-400">{currencyFmt.format(totalRevenue)}</span>
      </div>
      {deployments.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-600 text-center">No deployment history yet.</p>
      ) : (
        <>
          {uniqueIncidents.length > 1 && (
            <div className="px-4 py-2 border-b border-gray-800">
              <select value={incidentFilter} onChange={e => onFilterChange(e.target.value)}
                className="bg-gray-800 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="All">All Incidents</option>
                {uniqueIncidents.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-4 py-2 font-medium">Incident</th>
                  <th className="text-left px-4 py-2 font-medium">Mobilized</th>
                  <th className="text-left px-4 py-2 font-medium">Demob</th>
                  <th className="text-right px-4 py-2 font-medium">Days</th>
                  <th className="text-right px-4 py-2 font-medium">Rate</th>
                  <th className="text-right px-4 py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(dep => {
                  const { rate, days, revenue } = calcRow(dep, defaultContractRate)
                  const isActive = dep.incident?.status === 'Active'
                  return (
                    <tr key={dep.id} className="hover:bg-gray-800/50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                          {dep.incident ? (
                            <Link to={`/incidents/${dep.incident.id}`} className="text-white hover:text-blue-300 underline underline-offset-2 truncate max-w-[140px]">
                              {dep.incident.name}
                            </Link>
                          ) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{fmtDate(dep.assigned_at)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {dep.released_at
                          ? <span className="text-gray-300">{fmtDate(dep.released_at)}</span>
                          : <span className="text-green-400">Active</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{days}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{currencyFmt.format(rate)}</td>
                      <td className="px-4 py-2.5 text-right text-green-300 font-semibold">{currencyFmt.format(revenue)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700 bg-gray-800/50">
                  <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</td>
                  <td className="px-4 py-2.5 text-right text-green-400 font-bold">{currencyFmt.format(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
