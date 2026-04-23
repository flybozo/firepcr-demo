
import { FieldGuard } from '@/components/FieldGuard'

import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { StatCard, PageHeader, LoadingSkeleton } from '@/components/ui'

type Stat = { label: string; value: number; href: string; color: string }

type IncidentOverview = {
  id: string
  name: string
  status: string
  location: string | null
  units: { id: string; name: string; type: string | null; crewCount: number }[]
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

    // Load active incidents with units and crew counts
    const loadOps = async () => {
      try {
        const { data: incData } = await supabase
          .from('incidents')
          .select('id, name, status, location')
          .eq('status', 'Active')
          .order('name')
        if (!incData?.length) { setOpsLoading(false); return }

        const { data: iuData } = await supabase
          .from('incident_units')
          .select('id, incident_id, released_at, unit:units(id, name, unit_type:unit_types(name))')
          .in('incident_id', incData.map(i => i.id))
          .is('released_at', null)

        const iuIds = (iuData || []).map(iu => iu.id)
        let crewCounts: Record<string, number> = {}
        if (iuIds.length > 0) {
          const { data: assignments } = await supabase
            .from('unit_assignments')
            .select('incident_unit_id')
            .in('incident_unit_id', iuIds)
            .is('released_at', null)
          for (const a of assignments || []) {
            crewCounts[a.incident_unit_id] = (crewCounts[a.incident_unit_id] || 0) + 1
          }
        }

        const overview: IncidentOverview[] = incData.map(inc => ({
          id: inc.id,
          name: inc.name,
          status: inc.status,
          location: inc.location,
          units: (iuData || [])
            .filter(iu => iu.incident_id === inc.id)
            .map(iu => ({
              id: (iu.unit as any)?.id || iu.id,
              name: (iu.unit as any)?.name || 'Unknown',
              type: (iu.unit as any)?.unit_type?.name || null,
              crewCount: crewCounts[iu.id] || 0,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
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
        <div className="bg-gradient-to-r from-red-950/40 to-gray-900 rounded-xl border border-red-800/40 p-4 mb-6 flex items-center gap-4">
          <span className="text-3xl">🚑</span>
          <div>
            <p className="text-sm font-bold text-white">Your Assignment: {myUnit}</p>
            {myIncident && <p className="text-xs text-gray-400 mt-0.5">Active Incident: <span className="text-orange-400 font-medium">{myIncident}</span></p>}
          </div>
          <Link to="/dashboard/my-unit" className="ml-auto text-xs text-red-400 hover:text-red-300 font-medium shrink-0">My Unit →</Link>
        </div>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-white">🔥 {inc.name}</p>
                      {inc.location && <p className="text-xs text-gray-500 mt-0.5">{inc.location}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{inc.units.length} unit{inc.units.length !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-600">{inc.units.reduce((s, u) => s + u.crewCount, 0)} crew</p>
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
