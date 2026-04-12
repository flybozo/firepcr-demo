
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

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

function certIcon(val: string | null | undefined) {
  if (!val) return '—'
  if (val.includes('✅')) return '✅'
  if (val.includes('⚠') || val.toLowerCase().includes('needs')) return '⚠️'
  return '—'
}

function CertBadge({ label, val }: { label: string; val: string | null | undefined }) {
  const icon = certIcon(val)
  const color = icon === '✅' ? 'text-green-400' : icon === '⚠️' ? 'text-yellow-400' : 'text-gray-700'
  return (
    <span className={`text-xs ${color}`} title={label}>{icon} {label}</span>
  )
}

function getRoleCerts(emp: Employee): Array<{ label: string; val: string | null | undefined }> {
  const role = emp.role
  if (['MD', 'MD/DO', 'PA', 'NP'].includes(role)) {
    return [
      { label: 'BLS', val: emp.bls },
      { label: 'ACLS', val: emp.acls },
      { label: 'Med License', val: emp.medical_license },
    ]
  }
  if (role === 'RN') {
    return [
      { label: 'BLS', val: emp.bls },
      { label: 'ACLS', val: emp.acls },

    ]
  }
  if (role === 'Paramedic') {
    return [
      { label: 'BLS', val: emp.bls },
      { label: 'ACLS', val: emp.acls },
      { label: 'Medic License', val: emp.paramedic_license },
      { label: 'ADC', val: emp.ambulance_driver_cert },
    ]
  }
  if (role === 'EMT') {
    return [
      { label: 'BLS', val: emp.bls },
      { label: 'Amb Driver Cert', val: emp.ambulance_driver_cert },
      { label: 'ADC', val: emp.ambulance_driver_cert },
    ]
  }
  return []
}

export default function RosterPage() {
  const supabase = createClient()
  const { isAdmin } = useRole()
  const assignment = useUserAssignment()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Inactive'>('Active')

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
      if (offline) setIsOfflineData(true)
      setLoading(false)
    }
    load()
  }, [])

  const roles = ['All', 'MD', 'NP', 'PA', 'RN', 'Paramedic', 'EMT', 'Tech']

  const filtered = employees.filter(e => {
    if (e.status !== statusFilter) return false
    if (roleFilter !== 'All') {
      const match = roleFilter === 'MD' ? ['MD', 'MD/DO'].includes(e.role) : e.role === roleFilter
      if (!match) return false
    }
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16 mt-8 md:mt-0">
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">Employee Roster</h1>
            <p className="text-gray-500 text-xs">{filtered.length} of {employees.length} employees</p>
          </div>
          {isAdmin && (
            <Link to="/roster/new"
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
              + New
            </Link>
          )}
        </div>

        <div className="space-y-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600" />
          {/* Active / Inactive toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('Active')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === 'Active' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              ✅ Active
            </button>
            <button
              onClick={() => setStatusFilter('Inactive')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === 'Inactive' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              Inactive
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {roles.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${roleFilter === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 py-8">No employees found.</p>
        ) : (
          <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
            {/* Header */}
            <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700">
              <span className="flex-1 min-w-0">Name</span>
              <span className="w-24 shrink-0">Role</span>
              <span className="w-36 shrink-0 hidden lg:block">Phone</span>
              <span className="flex-1 min-w-0 hidden md:block">WF Email</span>
              <span className="flex-none w-56 shrink-0 text-right hidden sm:block">Certs</span>
            </div>
            {filtered.map(emp => {
              const certs = getRoleCerts(emp)
              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/roster/${emp.id}`)}
                  className="flex items-center px-4 py-2.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 text-sm gap-3"
                >
                  {/* Headshot */}
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                    {emp.headshot_url ? (
                      <img src={emp.headshot_url} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-sm font-bold">{emp.name.charAt(0)}</span>
                    )}
                  </div>
                  <span className="flex-1 min-w-0 font-medium truncate pr-2">
                    {emp.name}
                    {emp.status === 'Inactive' && (
                      <span className="ml-2 text-xs text-gray-600">(Inactive)</span>
                    )}
                  </span>
                  <span className="w-24 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[emp.role] || ROLE_COLORS.Tech}`}>
                      {emp.role}
                    </span>
                  </span>
                  {/* Phone column */}
                  <span className="w-36 shrink-0 hidden lg:flex items-center gap-1.5">
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
                  <span className="flex-1 min-w-0 text-gray-400 text-xs truncate pr-2 hidden md:flex items-center gap-2">
                    <span className="truncate">{emp.wf_email || emp.email || '—'}</span>
                    {(emp.phone || emp.wf_email || emp.email) && (
                      <span className="flex gap-1 shrink-0">
                        {emp.phone && <a href={`tel:${emp.phone}`} onClick={e => e.stopPropagation()} className="text-green-400 hover:text-green-300" title="Call">📞</a>}
                        {emp.phone && <a href={`sms:${emp.phone}`} onClick={e => e.stopPropagation()} className="text-blue-400 hover:text-blue-300" title="Text">💬</a>}
                        {(emp.wf_email || emp.email) && <a href={`mailto:${emp.wf_email || emp.email}`} onClick={e => e.stopPropagation()} className="text-yellow-400 hover:text-yellow-300" title="Email">✉️</a>}
                      </span>
                    )}
                  </span>
                  <span className="flex-none w-56 shrink-0 hidden sm:flex gap-0.5 justify-end flex-wrap items-center">
                    {/* Fire certs */}
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
                    {/* Red Card — always for field roles, green if on file */}
                    <span title={(emp as any).red_card ? `Red Card ${(emp as any).red_card_year || ''}` : 'Red Card — not on file'}
                      className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp as any).red_card ? 'bg-red-900/70 text-red-300' : 'bg-gray-800 text-gray-600'}`}>
                      🔴{(emp as any).red_card_year ? String((emp as any).red_card_year).slice(2) : ''}
                    </span>
                    {/* REMS — always shown */}
                    <span title={(emp as any).rems_capable ? 'REMS Capable' : 'Not REMS Capable'}
                      className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp as any).rems_capable ? 'bg-purple-900/60 text-purple-300' : 'bg-gray-800 text-gray-600'}`}>
                      REMS
                    </span>
                    {/* DEA — always for prescribers */}
                    {['MD','MD/DO','NP','PA'].includes(emp.role) && (
                      <span title={(emp as any).dea_license ? `DEA: ${(emp as any).dea_license}` : 'DEA — not on file'}
                        className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp as any).dea_license ? 'bg-blue-900/60 text-blue-300' : 'bg-gray-800 text-gray-600'}`}>
                        DEA
                      </span>
                    )}
                    {/* Lic — always shown */}
                    <span title={(emp.medical_license || emp.paramedic_license || (emp as any).ssv_lemsa) || 'License — not on file'}
                      className={`text-[10px] px-1 py-0.5 rounded font-bold ${(emp.medical_license || emp.paramedic_license || (emp as any).ssv_lemsa) ? 'bg-teal-900/60 text-teal-300' : 'bg-gray-800 text-gray-600'}`}>
                      Lic
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
