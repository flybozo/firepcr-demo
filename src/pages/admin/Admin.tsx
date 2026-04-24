
import { FieldGuard } from '@/components/FieldGuard'

import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { StatCard, PageHeader, LoadingSkeleton } from '@/components/ui'
import { calcDays } from '@/utils/incidentFormatters'

type Stat = { label: string; value: number; href: string; color: string }

type IncidentFinancials = {
  revenue: number
  payroll: number
  expenses: number
  net: number
}

type IncidentOverview = {
  id: string
  name: string
  status: string
  location: string | null
  start_date: string | null
  daysDeployed: number
  financials: IncidentFinancials | null
  units: { id: string; name: string; type: string | null; crewCount: number }[]
}

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}


function AdminDashboardPageInner() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState<IncidentOverview[]>([])
  const [opsLoading, setOpsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')  // YYYY-MM-DD in local tz
        const [
          { count: employees },
          { count: activeIncidents },
          { count: encToday },
          { count: unsignedOrders },
          { count: lowStock },
          { count: totalDocs },
        ] = await Promise.all([
          supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
          supabase.from('patient_encounters').select('id', { count: 'exact', head: true }).eq('date', today).is('deleted_at', null),
          supabase.from('dispense_admin_log').select('id', { count: 'exact', head: true }).eq('requires_cosign', true).is('provider_signature_url', null),
          supabase.from('unit_inventory').select('id', { count: 'exact', head: true }).lte('quantity', 1),
          supabase.from('documents').select('id', { count: 'exact', head: true }).eq('active', true),
        ])
        setStats([
          { label: 'Active Employees', value: employees || 0, href: '/roster', color: 'text-blue-400' },
          { label: 'Active Incidents', value: activeIncidents || 0, href: '/incidents', color: 'text-red-400' },
          { label: 'Encounters Today', value: encToday || 0, href: '/encounters', color: 'text-green-400' },
          { label: 'Unsigned Orders', value: unsignedOrders || 0, href: '/unsigned-orders', color: unsignedOrders ? 'text-orange-400' : 'text-gray-500' },
          { label: 'Low Stock Items', value: lowStock || 0, href: '/inventory/reorder', color: lowStock ? 'text-yellow-400' : 'text-gray-500' },
          { label: 'P&P Documents', value: totalDocs || 0, href: '/documents', color: 'text-purple-400' },
        ])
      } catch {
        // Offline — show zeros so page doesn't crash
        setStats([
          { label: 'Active Employees', value: 0, href: '/roster', color: 'text-blue-400' },
          { label: 'Active Incidents', value: 0, href: '/incidents', color: 'text-red-400' },
          { label: 'Encounters Today', value: 0, href: '/encounters', color: 'text-green-400' },
          { label: 'Unsigned Orders', value: 0, href: '/unsigned-orders', color: 'text-gray-500' },
          { label: 'Low Stock Items', value: 0, href: '/inventory/reorder', color: 'text-gray-500' },
          { label: 'P&P Documents', value: 0, href: '/documents', color: 'text-purple-400' },
        ])
      }
      setLoading(false)
    }
    load()

    // Load active incidents with units, crew counts, and financials
    const loadOps = async () => {
      try {
        const { data: incData } = await supabase
          .from('incidents')
          .select('id, name, status, location, start_date')
          .eq('status', 'Active')
          .order('name')
        if (!incData?.length) { setOpsLoading(false); return }

        const incidentIds = incData.map(i => i.id)
        const incByIdMap = Object.fromEntries(incData.map(i => [i.id, i]))

        // For unit pills — active (unreleased) units only
        const { data: iuData } = await supabase
          .from('incident_units')
          .select('id, incident_id, assigned_at, released_at, daily_contract_rate, unit:units(id, name, unit_type:unit_types(name, default_contract_rate))')
          .in('incident_id', incidentIds)
          .is('released_at', null)

        // For financial calc — all units including released
        const { data: iuDataAll } = await supabase
          .from('incident_units')
          .select('id, incident_id, assigned_at, released_at, daily_contract_rate, unit:units(id, name, unit_type:unit_types(name, default_contract_rate))')
          .in('incident_id', incidentIds)

        const iuIdsAll = (iuDataAll || []).map(iu => iu.id)
        const iuToIncident: Record<string, string> = {}
        for (const iu of (iuDataAll || []) as any[]) {
          iuToIncident[iu.id] = iu.incident_id
        }

        let crewCounts: Record<string, number> = {}
        const payrollByIncident: Record<string, number> = {}

        if (iuIdsAll.length > 0) {
          const { data: assignments } = await supabase
            .from('unit_assignments')
            .select('incident_unit_id, employee_id, daily_rate_override, travel_date, assigned_at, released_at, employees(daily_rate)')
            .in('incident_unit_id', iuIdsAll)

          // Deployment records for rate fallback
          const empIds = [...new Set((assignments || []).map((a: any) => a.employee_id).filter(Boolean))]
          let depByEmpId: Record<string, any> = {}
          if (empIds.length > 0) {
            const { data: depData } = await supabase
              .from('deployment_records')
              .select('employee_id, daily_rate')
              .in('employee_id', empIds)
            for (const d of (depData || []) as any[]) {
              if (!depByEmpId[d.employee_id]) depByEmpId[d.employee_id] = d
            }
          }

          for (const a of (assignments || []) as any[]) {
            if (!a.released_at) crewCounts[a.incident_unit_id] = (crewCounts[a.incident_unit_id] || 0) + 1
            const incId = iuToIncident[a.incident_unit_id]
            if (!incId) continue
            const dep = depByEmpId[a.employee_id]
            const rate = a.daily_rate_override ?? dep?.daily_rate ?? a.employees?.daily_rate ?? 0
            const inc = incByIdMap[incId]
            const start = a.travel_date || a.assigned_at?.split('T')[0] || inc?.start_date
            const end = a.released_at?.split('T')[0] || null
            const days = calcDays(start, end)
            payrollByIncident[incId] = (payrollByIncident[incId] || 0) + (rate * days)
          }
        }

        // Revenue: all incident units including released
        const revenueByIncident: Record<string, number> = {}
        for (const iu of (iuDataAll || []) as any[]) {
          const inc = incByIdMap[iu.incident_id]
          const unitType = iu.unit?.unit_type
          const rate = iu.daily_contract_rate ?? unitType?.default_contract_rate ?? 0
          const start = iu.assigned_at?.split('T')[0] || inc?.start_date
          const end = iu.released_at?.split('T')[0] || null
          const days = calcDays(start, end)
          revenueByIncident[iu.incident_id] = (revenueByIncident[iu.incident_id] || 0) + (rate * days)
        }

        // Fetch expenses per incident
        const { data: expData } = await supabase
          .from('incident_expenses')
          .select('incident_id, amount')
          .in('incident_id', incidentIds)
        const expensesByIncident: Record<string, number> = {}
        for (const e of (expData || []) as any[]) {
          expensesByIncident[e.incident_id] = (expensesByIncident[e.incident_id] || 0) + (Number(e.amount) || 0)
        }

        const overview: IncidentOverview[] = incData.map(inc => {
          const rev = revenueByIncident[inc.id] || 0
          const pay = payrollByIncident[inc.id] || 0
          const exp = expensesByIncident[inc.id] || 0
          return {
            id: inc.id,
            name: inc.name,
            status: inc.status,
            location: inc.location,
            start_date: inc.start_date,
            daysDeployed: inc.start_date ? calcDays(inc.start_date, null) : 0,
            financials: (rev > 0 || pay > 0 || exp > 0) ? {
              revenue: rev,
              payroll: pay,
              expenses: exp,
              net: rev - pay - exp,
            } : null,
            units: (iuData || [])
              .filter(iu => iu.incident_id === inc.id)
              .map(iu => ({
                id: (iu.unit as any)?.id || iu.id,
                name: (iu.unit as any)?.name || 'Unknown',
                type: (iu.unit as any)?.unit_type?.name || null,
                crewCount: crewCounts[iu.id] || 0,
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          }
        })
        setIncidents(overview)
      } catch {
        // Offline — skip ops overview
      }
      setOpsLoading(false)
    }
    loadOps()
  }, [])

  const myUnit = assignment.unit?.name
  const myIncident = assignment.incident?.name

  const adminTools = [
    { icon: '📢', label: 'Announcements', desc: 'Manage ticker announcements', href: '/admin/announcements' },
    { icon: '👥', label: 'Employee Roster', desc: 'View & manage all employees', href: '/roster' },
    { icon: '📋', label: 'HR Credentials', desc: 'Credential compliance tracker', href: '/roster/hr' },
    { icon: '💰', label: 'Pay Rates', desc: 'Set default daily rates by employee', href: '/roster/pay-rates' },
    { icon: '✍️', label: 'Unsigned Orders', desc: 'Review & sign pending orders', href: '/unsigned-orders' },
    { icon: '📦', label: 'Reorder Report', desc: 'Items below par across all units', href: '/inventory/reorder' },
    { icon: '📄', label: 'Policies & Procedures', desc: 'Upload & manage documents', href: '/documents' },
    { icon: '💰', label: 'Billing Report', desc: 'Incident cost reports', href: '/billing' },
    { icon: '📊', label: 'CS Audit Log', desc: 'Full controlled substance history', href: '/cs/audit' },
    { icon: '🔥', label: 'Active Incidents', desc: 'Manage active deployments', href: '/incidents' },
    { icon: '📁', label: 'Closed Incidents', desc: 'View past/closed fires', href: '/incidents?status=Closed' },
    { icon: '🔬', label: 'Formulary Templates', desc: 'Manage unit drug formularies', href: '/formulary' },
    { icon: '🛡️', label: 'Roles & Permissions', desc: 'Manage RBAC roles and access control', href: '/admin/roles' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-4xl mt-8 md:mt-0">
      <PageHeader title="Admin Dashboard" subtitle="System overview and administrative functions" className="mb-6" />

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="theme-card rounded-xl p-4 border animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {stats.map(s => (
            <StatCard key={s.href} value={s.value} label={s.label} color={s.color} href={s.href} />
          ))}
        </div>
      )}

      {/* My Assignment (if admin is assigned to a unit) */}
      {myUnit && (
        <Link to="/dashboard/my-unit" className="block bg-gradient-to-r from-red-950/40 to-gray-900 rounded-xl border border-red-800/40 p-4 mb-6 hover:from-red-950/60 hover:to-gray-800 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🚑</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Your Assignment: {myUnit}</p>
              {myIncident && <p className="text-xs text-gray-400 mt-0.5">Active Incident: <span className="text-orange-400 font-medium">{myIncident}</span></p>}
            </div>
            <span className="text-red-400 text-sm shrink-0">→</span>
          </div>
        </Link>
      )}

      {/* Active Operations Overview */}
      {opsLoading ? (
        <div className="mb-6 space-y-3">
          <div className="h-6 w-40 bg-gray-800 rounded animate-pulse" />
          <div className="h-32 bg-gray-800/50 rounded-xl animate-pulse" />
        </div>
      ) : incidents.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">🔥 Active Operations</h2>
          <div className="space-y-3">
            {incidents.map(inc => (
              <div key={inc.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <Link to={`/incidents/${inc.id}`} className="block px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-white">🔥 {inc.name}</p>
                        {inc.start_date && (
                          <span className="text-xs text-gray-600 font-mono">
                            {inc.start_date} · Day {inc.daysDeployed}
                          </span>
                        )}
                      </div>
                      {inc.location && <p className="text-xs text-gray-500 mt-0.5">{inc.location}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-xs text-gray-500">{inc.units.length} unit{inc.units.length !== 1 ? 's' : ''} · {inc.units.reduce((s, u) => s + u.crewCount, 0)} crew</p>
                      {inc.financials && (
                        <div className="flex items-center gap-1.5 justify-end text-xs font-mono">
                          <span className="text-green-400">{fmtCurrency(inc.financials.revenue)}</span>
                          <span className="text-gray-600">−</span>
                          <span className="text-yellow-400">{fmtCurrency(inc.financials.payroll + inc.financials.expenses)}</span>
                          <span className="text-gray-600">=</span>
                          <span className={inc.financials.net >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                            {fmtCurrency(inc.financials.net)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
                {inc.units.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-2">
                    {inc.units.map(u => (
                      <Link key={u.id} to={`/units/${u.id}`} className={`text-xs px-2 py-1 rounded-lg border hover:brightness-125 transition-all ${
                        u.type?.toLowerCase().includes('ambulance') ? 'bg-red-950/40 border-red-800/40 text-red-300' :
                        u.type?.toLowerCase().includes('med') ? 'bg-blue-950/40 border-blue-800/40 text-blue-300' :
                        u.type?.toLowerCase().includes('rescue') || u.type?.toLowerCase().includes('rems') ? 'bg-amber-950/40 border-amber-800/40 text-amber-300' :
                        u.type?.toLowerCase() === 'truck' ? 'bg-stone-800/60 border-stone-700/40 text-stone-300' :
                        'bg-gray-800 border-gray-700 text-gray-400'
                      }`}>
                        {u.name} <span className="text-gray-500 ml-1">({u.crewCount})</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Tools Grid */}
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Admin Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {adminTools.map(tool => (
          <Link key={tool.href} to={tool.href}
            className="flex items-center gap-4 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-xl transition-colors">
            <span className="text-2xl shrink-0">{tool.icon}</span>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{tool.label}</p>
              <p className="text-xs text-gray-500 truncate">{tool.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function AdminDashboardPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => '/'}>
      <AdminDashboardPageInner />
    </FieldGuard>
  )
}
