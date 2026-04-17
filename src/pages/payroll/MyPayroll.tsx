

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'

type DeploymentRecord = {
  id: string
  incident_id: string
  travel_date: string
  check_in_date: string | null
  check_out_date: string | null
  daily_rate: number
  status: string
  incidents: { name: string } | null
}

function calcDays(travelDate: string, checkOutDate: string | null): number {
  const start = new Date(travelDate)
  const end = checkOutDate ? new Date(checkOutDate) : new Date()
  // Normalize to UTC midnight to avoid TZ issues
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endMs = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function MyPayrollPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (assignment.loading) return
    if (!assignment.employee) { setLoading(false); return }

    const load = async () => {
      const { data, error } = await supabase
        .from('deployment_records')
        .select('id, incident_id, travel_date, check_in_date, check_out_date, daily_rate, status, incidents(name)')
        .eq('employee_id', assignment.employee!.id)
        .order('travel_date', { ascending: false })

      if (!error) {
        setDeployments((data as unknown as DeploymentRecord[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [assignment.loading, assignment.employee?.id])

  if (assignment.loading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading payroll...</p>
        </div>
      </div>
    )
  }

  if (!assignment.employee) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-xl font-bold mb-2">Not Found</h1>
          <p className="text-gray-400 text-sm">No employee record linked to your account.</p>
        </div>
      </div>
    )
  }

  const activeDeployment = deployments.find(d => d.status === 'Traveling' || d.status === 'On Scene')
  const pastDeployments = deployments.filter(d => d.status !== 'Traveling' && d.status !== 'On Scene')

  const grandTotal = deployments.reduce((sum, d) => {
    return sum + calcDays(d.travel_date, d.check_out_date) * d.daily_rate
  }, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="mt-8 md:mt-0">
          <h1 className="text-2xl font-bold text-white">💰 My Payroll</h1>
          <p className="text-gray-400 text-sm mt-1">{assignment.employee.name} · {assignment.employee.role}</p>
        </div>

        {/* Active Deployment */}
        {activeDeployment && (() => {
          const days = calcDays(activeDeployment.travel_date, activeDeployment.check_out_date)
          const pay = days * activeDeployment.daily_rate
          return (
            <div className="bg-gray-900 rounded-xl border border-red-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 bg-red-950/30 flex items-center gap-2">
                <span className="text-red-400">🔴</span>
                <h2 className="text-sm font-bold text-red-300 uppercase tracking-wide">Active Deployment</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {activeDeployment.incidents?.name ?? 'Unknown Incident'}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Status: <span className={`font-medium ${activeDeployment.status === 'On Scene' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {activeDeployment.status}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(pay)}</p>
                    <p className="text-xs text-gray-500">estimated to date</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Travel Date</p>
                    <p className="text-sm font-medium">{formatDate(activeDeployment.travel_date)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Days So Far</p>
                    <p className="text-sm font-medium">{days} days</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Daily Rate</p>
                    <p className="text-sm font-medium">{formatCurrency(activeDeployment.daily_rate)}/day</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* No active deployment message */}
        {!activeDeployment && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
            <p className="text-gray-500 text-sm">No active deployment</p>
          </div>
        )}

        {/* Past Deployments */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 bg-gray-800 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">Deployment History</h2>
            <span className="text-xs text-gray-500">{deployments.length} total</span>
          </div>
          {deployments.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-600 text-center">No deployments recorded</p>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-800/30 border-b border-gray-800/60">
                <span className="flex-1 min-w-0">Incident</span>
                <span className="w-24 shrink-0">Travel Date</span>
                <span className="w-24 shrink-0">Check-Out</span>
                <span className="w-14 shrink-0 text-right">Days</span>
                <span className="w-24 shrink-0 text-right">Rate</span>
                <span className="w-24 shrink-0 text-right">Total Pay</span>
              </div>
              <div className="divide-y divide-gray-800/60">
                {deployments.map(dep => {
                  const days = calcDays(dep.travel_date, dep.check_out_date)
                  const pay = days * dep.daily_rate
                  const isActive = dep.status === 'Traveling' || dep.status === 'On Scene'
                  return (
                    <div key={dep.id} className="px-4 py-3 hover:bg-gray-800/30 transition-colors">
                      {/* Mobile layout */}
                      <div className="sm:hidden space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{dep.incidents?.name ?? '—'}</span>
                          {isActive && (
                            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">🔴 Active</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatDate(dep.travel_date)} → {dep.check_out_date ? formatDate(dep.check_out_date) : 'ongoing'}</span>
                          <span>{days} days</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{formatCurrency(dep.daily_rate)}/day</span>
                          <span className="text-sm font-semibold text-green-400">{formatCurrency(pay)}</span>
                        </div>
                      </div>
                      {/* Desktop layout */}
                      <div className="hidden sm:flex items-center">
                        <span className="flex-1 min-w-0 text-sm text-white truncate pr-2">
                          {dep.incidents?.name ?? '—'}
                          {isActive && (
                            <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">🔴 Active</span>
                          )}
                        </span>
                        <span className="w-24 shrink-0 text-xs text-gray-400">{formatDate(dep.travel_date)}</span>
                        <span className="w-24 shrink-0 text-xs text-gray-400">
                          {dep.check_out_date ? formatDate(dep.check_out_date) : <span className="text-yellow-500">ongoing</span>}
                        </span>
                        <span className="w-14 shrink-0 text-right text-sm font-medium">{days}</span>
                        <span className="w-24 shrink-0 text-right text-xs text-gray-400">{formatCurrency(dep.daily_rate)}</span>
                        <span className="w-24 shrink-0 text-right text-sm font-semibold text-green-400">{formatCurrency(pay)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Grand Total */}
        {deployments.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-bold">Grand Total</p>
              <p className="text-xs text-gray-600 mt-0.5">All deployments · {deployments.length} assignment{deployments.length !== 1 ? 's' : ''}</p>
            </div>
            <p className="text-3xl font-bold text-green-400">{formatCurrency(grandTotal)}</p>
          </div>
        )}

      </div>
    </div>
  )
}
