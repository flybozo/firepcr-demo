
import { FieldGuard } from '@/components/FieldGuard'

import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatCard, PageHeader, LoadingSkeleton } from '@/components/ui'

type Stat = { label: string; value: number; href: string; color: string }

function AdminDashboardPageInner() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [])

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
    { icon: '🔥', label: 'Incidents', desc: 'Manage active deployments', href: '/incidents' },
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
