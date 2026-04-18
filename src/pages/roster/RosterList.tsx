
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { useNavigate, useMatch } from 'react-router-dom'

type Employee = {
  id: string
  name: string
  role: string
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
  'MD/DO': 'bg-purple-900 text-purple-300',
  'NP': 'bg-blue-900 text-blue-300',
  'PA': 'bg-blue-900 text-blue-300',
  'RN': 'bg-teal-900 text-teal-300',
  'Paramedic': 'bg-red-900 text-red-300',
  'EMT': 'bg-orange-900 text-orange-300',
  'Tech': 'bg-gray-700 text-gray-300',
}

// Cert helpers removed — inline cert badges used directly in roster rows

export default function RosterPage() {
  const supabase = createClient()
  const { isAdmin } = useRole()
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
      // Show cached data instantly
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('employees') as any[]
        if (cached.length > 0) {
          setEmployees(cached as Employee[])
          setLoading(false)
        }
      } catch {}
      const { data, offline } = await loadList<Employee>(
        () => supabase
          .from('employees')
          .select('id, name, role, email, wf_email, phone, status, rems, bls, acls, paramedic_license, medical_license, ambulance_driver_cert, s130, s190, l180, ics100, ics200, ics700, ics800, headshot_url, rems_capable, red_card, red_card_year, dea_license, ssv_lemsa')
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
      const match = roleFilter === 'MD' ? ['MD', 'MD/DO'].includes(e.role) : e.role === roleFilter
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
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">Employee Roster</h1>
            <p className="text-gray-500 text-xs">{activeEmployees.length} active · {inactiveEmployees.length} inactive</p>
          </div>

        </div>

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
          <p className="text-gray-500">Loading...</p>
        ) : (
          <>
          {/* ── Active employees ── */}
          {activeEmployees.length === 0 ? (
            <p className="text-center text-gray-600 py-8">No active employees found.</p>
          ) : (
          <div className="theme-card rounded-xl border overflow-x-auto">
            {/* Header row — use CSS grid matching the data rows */}
            <div className="hidden md:grid grid-cols-[2.5rem_12rem_3.5rem_9rem_14rem_auto] xl:grid-cols-[2.5rem_12rem_3.5rem_9rem_14rem_14rem_auto] items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 gap-x-3 min-w-[640px]">
              <span />{/* avatar */}
              <span>Name</span>
              <span>Role</span>
              <span>Phone</span>
              <span>Email</span>
              <span className="hidden xl:block text-right">Certs</span>
              <span />{/* actions */}
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
                  <div className="hidden md:grid grid-cols-[2.5rem_12rem_3.5rem_9rem_14rem_auto] xl:grid-cols-[2.5rem_12rem_3.5rem_9rem_14rem_14rem_auto] items-center px-4 py-2.5 gap-x-3 min-w-[640px]">
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center">
                      {emp.headshot_url ? (
                        <img src={emp.headshot_url} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-sm font-bold">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    {/* Name */}
                    <span className="font-medium truncate">
                      {emp.name}
                      {emp.status === 'Inactive' && <span className="ml-2 text-xs text-gray-600">(Inactive)</span>}
                    </span>
                    {/* Role */}
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full text-center whitespace-nowrap leading-tight ${ROLE_COLORS[emp.role] || ROLE_COLORS.Tech}`}>
                      {emp.role === 'Paramedic' ? 'Medic' : emp.role}
                    </span>
                    {/* Phone */}
                    <span className="flex items-center gap-1.5 min-w-0">
                      {emp.phone ? (
                        <>
                          <span className="text-xs text-gray-300 truncate">{emp.phone}</span>
                          <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="text-green-400 hover:text-green-300 shrink-0" title="Call">📞</a>
                          <a href={`sms:${emp.phone}`} onClick={e => e.stopPropagation()} className="text-blue-400 hover:text-blue-300 shrink-0" title="Text">💬</a>
                        </>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </span>
                    {/* Email */}
                    <span className="text-gray-400 text-xs truncate min-w-0">
                      {emp.wf_email || emp.email || '—'}
                    </span>
                    {/* Certs — hidden below xl */}
                    <span className="hidden xl:flex gap-0.5 justify-end flex-wrap items-center">
                      {[
                        { label: '130', val: emp.s130 },
                        { label: '190', val: emp.s190 },
                        { label: 'L180', val: emp.l180 },
                        { label: '100', val: emp.ics100 },
                        { label: '200', val: emp.ics200 },
                        { label: '700', val: (emp as any).ics700 },
                        { label: '800', val: (emp as any).ics800 },
                      ].map(c => (
                        <span key={c.label} title={`NWCG ${c.label}`} className={`text-[10px] px-1 py-0.5 rounded font-mono ${c.val ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-600'}`}>
                          {c.label}
                        </span>
                      ))}
                      <span title={(emp as any).red_card ? `Red Card ${(emp as any).red_card_year || ''}` : 'Red Card — not on file'}
                        className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp as any).red_card ? 'bg-red-900/70 text-red-300' : 'bg-gray-800 text-gray-600'}`}>
                        🔴{(emp as any).red_card_year ? String((emp as any).red_card_year).slice(2) : ''}
                      </span>
                      <span title={(emp as any).rems_capable ? 'REMS Capable' : 'Not REMS Capable'}
                        className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp as any).rems_capable ? 'bg-purple-900/60 text-purple-300' : 'bg-gray-800 text-gray-600'}`}>
                        REMS
                      </span>
                      {['MD','MD/DO','NP','PA'].includes(emp.role) && (
                        <span title={(emp as any).dea_license ? `DEA: ${(emp as any).dea_license}` : 'DEA — not on file'}
                          className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp as any).dea_license ? 'bg-blue-900/60 text-blue-300' : 'bg-gray-800 text-gray-600'}`}>
                          DEA
                        </span>
                      )}
                      <span title={(emp.medical_license || emp.paramedic_license || (emp as any).ssv_lemsa) || 'License — not on file'}
                        className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp.medical_license || emp.paramedic_license || (emp as any).ssv_lemsa) ? 'bg-teal-900/60 text-teal-300' : 'bg-gray-800 text-gray-600'}`}>
                        Lic
                      </span>
                    </span>
                    {/* Quick actions */}
                    <span className="flex gap-1 justify-end shrink-0">
                      {(emp.wf_email || emp.email) && <a href={`mailto:${emp.wf_email || emp.email}`} onClick={e => e.stopPropagation()} className="text-yellow-400 hover:text-yellow-300 text-xs" title="Email">✉️</a>}
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
                      <span className="font-medium truncate block">{emp.name}</span>
                      <span className="text-xs text-gray-400">{emp.role}{emp.phone ? ` · ${emp.phone}` : ''}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${ROLE_COLORS[emp.role] || ROLE_COLORS.Tech}`}>
                      {emp.role}
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
                      <span className="w-24 shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
                          {emp.role}
                        </span>
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
