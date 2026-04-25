

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import OfflineGate from '@/components/OfflineGate'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

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

type Employee = {
  id: string
  name: string | null
  role: string | null
  status: string | null
  bls: string | null
  acls: string | null
  itls: string | null
  pals: string | null
  paramedic_license: string | null
  medical_license: string | null
  ambulance_driver_cert: string | null
  s130: string | null
  s190: string | null
  l180: string | null
  ics100: string | null
  ics200: string | null
  ics700: string | null
  ics800: string | null
  experience_level: number | null
}

const REQUIRED_CREDS: Record<string, string[]> = {
  'MD': ['Medical License', 'BLS', 'ACLS', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'DO': ['Medical License', 'BLS', 'ACLS', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'NP': ['Medical License', 'BLS', 'ACLS', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'PA': ['Medical License', 'BLS', 'ACLS', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'RN': ['Medical License', 'BLS', 'ACLS', 'Ambulance Driver Cert', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'Paramedic': ['Paramedic License', 'BLS', 'ACLS', 'ITLS', 'Ambulance Driver Cert', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'EMT': ['BLS', 'Ambulance Driver Cert', 'S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
  'Tech': ['S-130', 'S-190', 'L-180', 'ICS-100', 'ICS-200', 'ICS-700', 'ICS-800'],
}


// Aliases: required cert name -> acceptable cert_type values in employee_credentials
const CRED_ALIASES: Record<string, string[]> = {
  'BLS': ['BLS/CPR', 'BLS', 'CPR'],
  'ACLS': ['ACLS'],
  'ITLS': ['ITLS', 'PHTLS', 'ATLS'],
  'Medical License': ['LICENSE', 'MEDICAL LICENSE', 'NP LICENSE', 'RN LICENSE', 'MD LICENSE', 'PA LICENSE'],
  'Paramedic License': ['PARAMEDIC LICENSE', 'CA PARAMEDIC'],
  'Ambulance Driver Cert': ['AMBULANCE DRIVER CERT', 'DRIVER CERT'],
  'S-130': ['S-130'],
  'S-190': ['S-190'],
  'L-180': ['L-180'],
  'ICS-100': ['ICS-100', 'IS-100'],
  'ICS-200': ['ICS-200', 'IS-200'],
  'ICS-700': ['ICS-700', 'IS-700'],
  'ICS-800': ['ICS-800', 'IS-800'],
  'NREMT': ['NREMT', 'EMT CERTIFICATION', 'EMT CERT'],
}

const CRED_COLUMNS: Record<string, keyof Employee> = {
  'Medical License': 'medical_license',
  'BLS': 'bls',
  'ACLS': 'acls',
  'ITLS': 'itls',
  'PALS': 'pals',
  'Paramedic License': 'paramedic_license',
  'Ambulance Driver Cert': 'ambulance_driver_cert',
  'S-130': 's130',
  'S-190': 's190',
  'L-180': 'l180',
  'ICS-100': 'ics100',
  'ICS-200': 'ics200',
  'ICS-700': 'ics700',
  'ICS-800': 'ics800',
}

type CredStatus = 'on_file' | 'expired' | 'missing'

function getCredStatus(value: string | null | undefined): CredStatus {
  if (!value || value.trim() === '' || value === '[Pending]' || value.toLowerCase() === 'needs upload') {
    return 'missing'
  }
  if (value.includes('⚠️') || value.toLowerCase().includes('expired')) {
    return 'expired'
  }
  if (value.includes('✅') || value.toLowerCase().includes('on file')) {
    return 'on_file'
  }
  // Has some value but not clearly on file — treat as on file if non-empty
  return 'on_file'
}

type EmployeeCompliance = {
  employee: Employee
  required: string[]
  onFile: string[]
  missing: string[]
  expired: string[]
  pct: number
  isFullyCredentialed: boolean
}

function calcCompliance(emp: Employee, uploadedCerts: string[] = []): EmployeeCompliance {
  const role = emp.role || ''
  const required = REQUIRED_CREDS[role] || []
  const onFile: string[] = []
  const missing: string[] = []
  const expired: string[] = []

  for (const cred of required) {
    // First check the column value
    const col = CRED_COLUMNS[cred]
    const val = col ? emp[col] as string | null : null
    const colStatus = getCredStatus(val)

    // Then check employee_credentials table via uploadedCerts
    const aliases = CRED_ALIASES[cred] || [cred.toUpperCase()]
    const isUploaded = uploadedCerts.some(ct => aliases.some(a => ct.includes(a)))

    if (colStatus === 'on_file' || isUploaded) onFile.push(cred)
    else if (colStatus === 'expired') expired.push(cred)
    else missing.push(cred)
  }

  const pct = required.length > 0 ? Math.round((onFile.length / required.length) * 100) : 100
  return {
    employee: emp,
    required,
    onFile,
    missing,
    expired,
    pct,
    isFullyCredentialed: missing.length === 0 && expired.length === 0,
  }
}

type ComplianceFilter = 'All' | 'Complete' | 'Incomplete' | 'Expired'

export default function HRCredentialsPage() {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [credsByEmployee, setCredsByEmployee] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [savingExp, setSavingExp] = useState<string | null>(null)
  const [expDropdownId, setExpDropdownId] = useState<string | null>(null)

  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment.employee?.role || '')

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: credData }] = await Promise.all([
        supabase.from('employees')
          .select('id, name, role, status, bls, acls, itls, pals, paramedic_license, medical_license, ambulance_driver_cert, s130, s190, l180, ics100, ics200, ics700, ics800, experience_level')
          .eq('status', 'Active').order('name'),
        supabase.from('employee_credentials').select('employee_id, cert_type'),
      ])
      setEmployees(data || [])
      // Build lookup: employee_id -> [cert_types]
      const lookup: Record<string, string[]> = {}
      for (const c of (credData || [])) {
        if (!lookup[c.employee_id]) lookup[c.employee_id] = []
        lookup[c.employee_id].push(c.cert_type.toUpperCase())
      }
      setCredsByEmployee(lookup)
      setLoading(false)
    }
    load()
  }, [])

  if (!assignment.loading && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-gray-400 text-sm">HR Credentials view is restricted to admin users.</p>
          <Link to="/roster" className="mt-4 inline-block text-red-400 hover:text-red-300 text-sm">← Back to Roster</Link>
        </div>
      </div>
    )
  }

  const compliance = employees.map(emp => calcCompliance(emp, credsByEmployee[emp.id] || []))

  const roles = Array.from(new Set(employees.map(e => e.role).filter(Boolean) as string[])).sort()

  const fullyCredentialed = compliance.filter(c => c.isFullyCredentialed).length
  const total = compliance.length

  const filtered = compliance.filter(c => {
    if (roleFilter !== 'All' && c.employee.role !== roleFilter) return false
    if (complianceFilter === 'Complete') return c.isFullyCredentialed
    if (complianceFilter === 'Incomplete') return !c.isFullyCredentialed && c.expired.length === 0
    if (complianceFilter === 'Expired') return c.expired.length > 0
    return true
  })

  const filterBtnCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
    }`

  return (
    <OfflineGate page message="Employee credentials require a connection to load.">
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold">🗂️ HR Credentials</h1>
            <p className="text-gray-500 text-xs">
              {loading ? 'Loading...' : `${fullyCredentialed} of ${total} employees fully credentialed`}
            </p>
          </div>
          <Link to="/roster" className="text-gray-500 hover:text-white text-sm transition-colors">← Roster</Link>
        </div>

        {/* Compliance filter */}
        <div className="flex gap-2 flex-wrap">
          {(['All', 'Complete', 'Incomplete', 'Expired'] as ComplianceFilter[]).map(f => (
            <button key={f} onClick={() => setComplianceFilter(f)} className={filterBtnCls(complianceFilter === f)}>
              {f}
              {f === 'Complete' && !loading && (
                <span className="ml-1 text-green-400">({compliance.filter(c => c.isFullyCredentialed).length})</span>
              )}
              {f === 'Incomplete' && !loading && (
                <span className="ml-1 text-yellow-400">({compliance.filter(c => !c.isFullyCredentialed && c.expired.length === 0).length})</span>
              )}
              {f === 'Expired' && !loading && (
                <span className="ml-1 text-red-400">({compliance.filter(c => c.expired.length > 0).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Role filter */}
        {roles.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setRoleFilter('All')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${roleFilter === 'All' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              All Roles
            </button>
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${roleFilter === r ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading credentials...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No employees match this filter.</div>
        ) : (
          <div className={lc.container}>
            {/* Scrollable table wrapper for mobile */}
            <div className="overflow-x-auto">
            {/* Table header */}
            <div className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header" style={{ minWidth: '700px' }}>
              <span className="w-36 shrink-0">Name</span>
              <span className="w-20 shrink-0">Role</span>
              <span className="w-20 shrink-0 hidden md:block">Exp</span>
              <span className="w-44 shrink-0">Compliance</span>
              <span className="flex-1 min-w-0">Missing / Expired</span>
              <span className="w-20 shrink-0 text-right">Action</span>
            </div>

            {filtered.map(({ employee: emp, pct, missing, expired, required }) => {
              const barColor = pct === 100
                ? 'bg-green-500'
                : pct >= 75
                ? 'bg-yellow-500'
                : 'bg-red-500'

              const allIssues = [
                ...expired.map(c => ({ label: c, isExpired: true })),
                ...missing.map(c => ({ label: c, isExpired: false })),
              ]

              return (
                <div key={emp.id} className={`flex items-center px-3 py-2 ${lc.row}`} style={{ minWidth: '700px' }}>
                  {/* Name */}
                  <div className="w-36 shrink-0 pr-2">
                    <p className="text-sm font-medium text-white truncate">{emp.name || '—'}</p>
                  </div>

                  {/* Role */}
                  <div className="w-20 shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full inline-block w-fit ${ROLE_COLORS[emp.role || ''] || ROLE_COLORS.Tech}`}>
                      {emp.role === 'Paramedic' ? 'Medic' : (emp.role || '—')}
                    </span>
                  </div>

                  {/* Experience Level — click stars to change */}
                  <div className="w-20 shrink-0 hidden md:block" onClick={e => e.stopPropagation()}>
                    {isAdmin ? (
                      <div className="relative inline-block">
                        <button
                          onClick={() => setExpDropdownId(expDropdownId === emp.id ? null : emp.id)}
                          disabled={savingExp === emp.id}
                          className="text-sm hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
                          title="Click to set experience level"
                        >
                          {emp.experience_level === 1 ? '⭐' :
                           emp.experience_level === 2 ? '⭐⭐' :
                           emp.experience_level === 3 ? '⭐⭐⭐' :
                           <span className="text-gray-600 text-xs">☆☆☆</span>}
                        </button>
                        {expDropdownId === emp.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setExpDropdownId(null)} />
                            <div className="absolute left-0 top-full mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                              {[
                                { val: null, label: '— None', stars: '' },
                                { val: 1, label: '⭐ Junior', stars: '⭐' },
                                { val: 2, label: '⭐⭐ Mid', stars: '⭐⭐' },
                                { val: 3, label: '⭐⭐⭐ Senior', stars: '⭐⭐⭐' },
                              ].map(opt => (
                                <button
                                  key={opt.val ?? 'none'}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors ${
                                    emp.experience_level === opt.val ? 'text-white font-semibold' : 'text-gray-300'
                                  }`}
                                  onClick={async () => {
                                    setExpDropdownId(null)
                                    setSavingExp(emp.id)
                                    await supabase.from('employees').update({ experience_level: opt.val }).eq('id', emp.id)
                                    setEmployees(prev => prev.map(x => x.id === emp.id ? { ...x, experience_level: opt.val } : x))
                                    setSavingExp(null)
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm">
                        {emp.experience_level === 1 ? '⭐' :
                         emp.experience_level === 2 ? '⭐⭐' :
                         emp.experience_level === 3 ? '⭐⭐⭐' : '—'}
                      </span>
                    )}
                  </div>

                  {/* Compliance bar */}
                  <div className="w-44 shrink-0 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono font-bold ${
                        pct === 100 ? 'text-green-400' : pct >= 75 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {pct}%
                      </span>
                    </div>
                    {required.length === 0 && (
                      <p className="text-xs text-gray-600 mt-0.5">No role requirements</p>
                    )}
                  </div>

                  {/* Missing / Expired */}
                  <div className="flex-1 min-w-0 pr-2">
                    {allIssues.length === 0 ? (
                      <span className="text-xs text-green-400">✓ All credentials on file</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {allIssues.map(({ label, isExpired }) => (
                          <span
                            key={label}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              isExpired
                                ? 'bg-orange-900/60 text-orange-300'
                                : 'bg-red-900/60 text-red-400'
                            }`}
                          >
                            {isExpired ? '⚠️ ' : ''}{label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="w-24 shrink-0 text-right">
                    <Link
                      to={`/roster/${emp.id}`}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      View Profile →
                    </Link>
                  </div>
                </div>
              )
            })}
            </div> {/* end overflow-x-auto scroll wrapper */}
          </div>
        )}

        {/* Summary footer */}
        {!loading && total > 0 && (
          <div className="theme-card rounded-xl p-4 border grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-400">{fullyCredentialed}</p>
              <p className="text-xs text-gray-500">Fully Credentialed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{compliance.filter(c => !c.isFullyCredentialed && c.expired.length === 0).length}</p>
              <p className="text-xs text-gray-500">Missing Credentials</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{compliance.filter(c => c.expired.length > 0).length}</p>
              <p className="text-xs text-gray-500">Expired Credentials</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </OfflineGate>
  )
}
