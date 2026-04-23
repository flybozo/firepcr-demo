
import { usePermission } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { useNavigate, useMatch } from 'react-router-dom'
import { PageHeader, EmptyState, LoadingSkeleton } from '@/components/ui'
import { ContactIcons } from '@/components/ContactCards'

type Employee = {
  id: string
  name: string
  role: string
  roles: string[] | null
  email: string
  wf_email: string | null
  phone: string | null
  status: string
  rems: boolean
  // Medical certs
  bls: string | null
  acls: string | null
  paramedic_license: string | null
  medical_license: string | null
  ambulance_driver_cert: string | null
  s190: string | null
  l180: string | null
  s130: string | null
  ics100: string | null
  ics200: string | null
  headshot_url: string | null
}

const ROLE_COLORS: Record<string, string> = {
  'MD': 'bg-purple-900 text-purple-300',
  'DO': 'bg-purple-900 text-purple-300',
  'NP': 'bg-blue-900 text-blue-300',
  'PA': 'bg-blue-900 text-blue-300',
  'RN': 'bg-teal-900 text-teal-300',
  'Paramedic': 'bg-red-900 text-red-300',
  'EMT': 'bg-orange-900 text-orange-300',
  'Tech': 'bg-gray-700 text-gray-300',
}

function RolePills({ roles, role }: { roles: string[] | null; role: string }) {
  const displayRoles = roles && roles.length > 0 ? roles : [role]
  return (
    <span className="flex items-center gap-1 flex-wrap">
      {displayRoles.map(r => (
        <span key={r} className={`text-[11px] px-1.5 py-0.5 rounded-full whitespace-nowrap leading-tight ${ROLE_COLORS[r] || ROLE_COLORS.Tech}`}>
          {r === 'Paramedic' ? 'Medic' : r}
        </span>
      ))}
    </span>
  )
}

// Cert helpers removed — inline cert badges used directly in roster rows

export default function RosterPage() {
  const supabase = createClient()
  const isAdmin = usePermission('roster.manage')
  const assignment = useUserAssignment()
  const navigate = useNavigate()
  const detailMatch = useMatch('/roster/:id')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      // Show cached data only when offline
      if (!navigator.onLine) {
        try {
          const { getCachedData } = await import('@/lib/offlineStore')
          const cached = await getCachedData('employees')
          if (cached.length > 0) {
            setEmployees(cached as Employee[])
            setIsOfflineData(true)
            setLoading(false)
            return
          }
        } catch {}
      }
      const { data, offline } = await loadList<Employee>(
        () => supabase
          .from('employees')
          .select('id, name, role, roles, email, wf_email, phone, status, rems, bls, acls, paramedic_license, medical_license, ambulance_driver_cert, s130, s190, l180, ics100, ics200, ics700, ics800, headshot_url, rems_capable, red_card, red_card_year, dea_license, ssv_lemsa')
          .order('name'),
        'employees'
      )
      setEmployees(data)
      setIsOfflineData(offline)
      setLoading(false)
    }
    load()
  }, [])

  const roles = ['All', 'MD', 'NP', 'PA', 'RN', 'Paramedic', 'EMT', 'Tech']

  const applyFilters = (e: Employee) => {
    if (roleFilter !== 'All') {
      const allRoles = e.roles && e.roles.length > 0 ? e.roles : [e.role]
      const match = roleFilter === 'MD'
        ? allRoles.some(r => ['MD', 'DO'].includes(r))
        : allRoles.includes(roleFilter)
      if (!match) return false
    }
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }
  const activeEmployees = employees.filter(e => e.status === 'Active' && applyFilters(e))
  const inactiveEmployees = employees.filter(e => e.status !== 'Active' && applyFilters(e))
  const filtered = [...activeEmployees, ...inactiveEmployees]

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="p-4 md:p-6 space-y-4 overflow-x-auto">
        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}
        <PageHeader
          title="Employee Roster"
          subtitle={`${activeEmployees.length} active · ${inactiveEmployees.length} inactive`}
        />

        <div className="space-y-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600" />
          <div className="flex gap-1.5 flex-wrap">
            {roles.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${roleFilter === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton rows={8} header />
        ) : (
          <>
          {/* ── Active employees ── */}
          {activeEmployees.length === 0 ? (
            <EmptyState icon="👥" message="No active employees found." className="py-8" />
          ) : (
          <div className="theme-card rounded-xl border overflow-x-auto">
            {/* Header row — use CSS grid matching the data rows */}
            <div className="hidden md:grid grid-cols-[2.5rem_1fr_7rem] items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 gap-x-4 min-w-[400px]">
              <span />{/* avatar */}
              <span>Name</span>
              <span className="text-right">Contact</span>
            </div>
            {activeEmployees.map(emp => {
              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/roster/${emp.id}`)}
                  className={`cursor-pointer border-b border-gray-800/50 text-sm transition-colors ${
                    detailMatch?.params?.id === emp.id ? 'bg-gray-700' : 'hover:bg-gray-800'
                  }`}
                >
                  {/* Desktop row (md+) */}
                  <div className="hidden md:grid grid-cols-[2.5rem_1fr_7rem] items-center px-4 py-2.5 gap-x-4 min-w-[400px]">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                      {emp.headshot_url ? (
                        <img src={emp.headshot_url} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-sm font-bold">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    {/* Name + Role pills */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium truncate">
                        {emp.name}
                        {emp.status === 'Inactive' && <span className="ml-2 text-xs text-gray-600">(Inactive)</span>}
                      </span>
                      <RolePills roles={emp.roles} role={emp.role} />
                    </div>
                    {/* Contact icons */}
                    <span className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
                      <ContactIcons phone={emp.phone} email={emp.wf_email || emp.email || null} />
                    </span>
                  </div>

                  {/* Mobile row (below md) */}
                  <div className="flex md:hidden items-center px-4 py-2.5 gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                      {emp.headshot_url ? (
                        <img src={emp.headshot_url} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-sm font-bold">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate text-sm">{emp.name}</span>
                        <RolePills roles={emp.roles} role={emp.role} />
                      </div>
                    </div>
                    <span className="shrink-0" onClick={e => e.stopPropagation()}>
                      <ContactIcons phone={emp.phone} email={emp.wf_email || emp.email || null} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          )}

          {/* ── Inactive employees ── */}
          {inactiveEmployees.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Inactive</span>
                <span className="text-xs text-gray-700">({inactiveEmployees.length})</span>
              </div>
              <div className="bg-gray-900/50 rounded-xl overflow-hidden border border-gray-800/50">
                {inactiveEmployees.map(emp => {
                  return (
                    <div
                      key={emp.id}
                      onClick={() => navigate(`/roster/${emp.id}`)}
                      className={`flex items-center px-4 py-2.5 cursor-pointer border-b border-gray-800/30 text-sm gap-3 opacity-50 hover:opacity-75 ${detailMatch?.params?.id === emp.id ? 'bg-gray-700 opacity-100' : 'hover:bg-gray-800/50'}`}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                        {emp.headshot_url ? (
                          <img src={emp.headshot_url} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-500 text-sm font-bold">{emp.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="flex-1 min-w-0 font-medium truncate pr-2 text-gray-400">
                        {emp.name}
                        <span className="ml-2 text-xs text-gray-600">(Inactive)</span>
                      </span>
                      <span className="shrink-0">
                        <RolePills roles={emp.roles} role={emp.role} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}
