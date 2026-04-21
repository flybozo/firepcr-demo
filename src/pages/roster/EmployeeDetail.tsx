
import { usePermission } from '@/hooks/usePermission'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import QRCodeCard from '@/components/QRCodeCard'
import { brand } from '@/lib/branding.config'
import { queryEmployee, queryCredentials, updateEmployee } from '@/lib/services/employees'
import { LoadingSkeleton, EmptyState, ConfirmDialog } from '@/components/ui'


type Employee = {
  id: string
  name: string
  role: string
  email: string | null
  wf_email: string | null
  phone: string | null
  date_of_birth: string | null
  personal_email: string | null
  personal_phone: string | null
  home_address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  headshot_url: string | null
  daily_rate: number | null
  default_hours_per_day: number | null
  status: string
  rems: boolean
  rescue_capable: boolean | null
  dea_license: string | null
  npi_number: string | null
  red_card: string | null
  red_card_year: number | null
  ssv_lemsa: string | null
  app_role: string | null
  roles: string[] | null
  is_medical_director: boolean | null
  // Medical certs
  bls: string | null
  acls: string | null
  itls: string | null
  pals: string | null
  paramedic_license: string | null
  emt_license: string | null
  rn_license: string | null
  np_license: string | null
  md_license: string | null
  // Wildland certs
  s130: string | null
  s190: string | null
  l180: string | null
  ics_100: string | null
  ics_200: string | null
  ics_700: string | null
  ics_800: string | null
  [key: string]: unknown
}

type CredentialDoc = {
  id: string
  cert_type: string
  issued_date: string | null
  expiration_date: string | null
  file_url: string | null
}

type RBACRole = {
  id: string
  name: string
  display_name: string
  description: string | null
  permissions: string[]
  is_system: boolean
}

const ROLE_COLORS: Record<string, string> = {
  'DO': 'bg-purple-900 text-purple-300',
  'NP': 'bg-blue-900 text-blue-300',
  'PA': 'bg-blue-900 text-blue-300',
  'RN': 'bg-teal-900 text-teal-300',
  'Paramedic': 'bg-red-900 text-red-300',
  'EMT': 'bg-orange-900 text-orange-300',
  'Tech': 'bg-gray-700 text-gray-300',
}

function CredRow({ label, value }: { label: string; value: string | null | undefined }) {
  const isOk = value && value.includes('✅')
  const isWarn = value && value.includes('⚠')
  const isEmpty = !value

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <span className={`text-xs ${isOk ? 'text-green-400' : isWarn ? 'text-yellow-400' : 'text-gray-600'}`}>
        {isEmpty ? '—' : isOk ? '✅ Current' : isWarn ? '⚠️ Expiring' : value}
      </span>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const isEmail = value && value.includes('@')
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className={`mt-0.5 text-sm text-white ${isEmail ? 'break-all' : 'break-words'}`}>
        {value ? value : <span className="text-gray-600">—</span>}
      </dd>
    </div>
  )
}

export default function RosterDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const isAdmin = usePermission('roster.manage')
  const myAssignment = useUserAssignment()
  const id = params.id as string

  const [emp, setEmp] = useState<Employee | null>(null)
  const [creds, setCreds] = useState<CredentialDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)
  const [empExpenses, setEmpExpenses] = useState<{ id: string; expense_type: string; amount: number; description: string | null; expense_date: string; receipt_url: string | null; no_receipt_reason: string | null; incidents?: { name: string } | { name: string }[] | null }[]>([])
  const [deployments, setDeployments] = useState<{ id: string; incident_name: string | null; start_date: string | null; end_date: string | null; hours_worked: number | null; daily_rate: number | null }[]>([])
  const [empRoles, setEmpRoles] = useState<RBACRole[]>([])
  const [allRoles, setAllRoles] = useState<RBACRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [assigningRole, setAssigningRole] = useState(false)

  const toggleStatus = () => {
    if (!emp || !isAdmin) return
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active'
    const message = newStatus === 'Inactive'
      ? `Inactivate ${emp.name}? This will ban their app login and release all unit assignments.`
      : `Reactivate ${emp.name}? This will restore their app login access.`
    setConfirmAction({
      action: async () => {
        setTogglingStatus(true)
        try {
          const res = await fetch('/api/employee-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data?.session?.access_token ?? ''}` },
            body: JSON.stringify({ employeeId: emp.id, status: newStatus }),
          })
          if (!res.ok) throw new Error(await res.text())
          setEmp(e => e ? { ...e, status: newStatus } : e)
        } catch (err: any) {
          toast.error('Failed to update status: ' + (err?.message || err))
        }
        setTogglingStatus(false)
      },
      title: newStatus === 'Inactive' ? 'Inactivate Employee' : 'Reactivate Employee',
      message,
      icon: '⚠️',
    })
  }

  useEffect(() => {
    const load = async () => {
      // Show cached data instantly
      try {
        const { getCachedById } = await import('@/lib/offlineStore')
        const cached = await getCachedById('employees', id)
        if (cached) {
          setEmp(cached as Employee)
          setLoading(false)
        }
      } catch {}
      const { data: empData, offline } = await loadSingle<Employee>(
        () => queryEmployee(id),
        'employees',
        id
      )
      setEmp(empData)
      setIsOfflineData(offline)
      if (empData && !offline) {
        try {
          const { data: credData } = await queryCredentials(id)
          setCreds(credData || [])
        } catch {}
        // Load expenses for this employee (admin only)
        try {
          const { data: expData } = await supabase
            .from('incident_expenses')
            .select('id, expense_type, amount, description, expense_date, receipt_url, no_receipt_reason, incidents:incidents(name)')
            .eq('employee_id', id)
            .order('expense_date', { ascending: false })
            .limit(100)
          setEmpExpenses(expData || [])

          // Deployments for payroll card
          const { data: depData } = await supabase
            .from('deployments')
            .select('id, start_date, end_date, hours_worked, daily_rate, incident:incidents(name)')
            .eq('employee_id', id)
            .order('start_date', { ascending: false })
            .limit(50)
          setDeployments((depData || []).map((d: any) => ({
            ...d,
            incident_name: d.incident?.name || null,
          })))
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [id])



  // Load RBAC roles for this employee (admin only)
  useEffect(() => {
    if (!isAdmin || !id) return
    const load = async () => {
      setRolesLoading(true)
      try {
        const [{ data: erData }, { data: allRoleData }] = await Promise.all([
          supabase.from('employee_roles').select('role_id, roles(id, name, display_name, description, permissions, is_system)').eq('employee_id', id),
          supabase.from('roles').select('id, name, display_name, description, permissions, is_system').order('is_system', { ascending: false }).order('display_name'),
        ])
        setEmpRoles(((erData || []) as any[]).map(er => er.roles as RBACRole).filter(Boolean))
        setAllRoles((allRoleData || []) as RBACRole[])
      } catch {}
      setRolesLoading(false)
    }
    load()
  }, [isAdmin, id])

  if (loading) return <LoadingSkeleton fullPage />

  // Can edit: admin OR viewing own employee record
  // Note: isAdmin derives from myAssignment; if still loading, default false then re-render
  const canEdit = isAdmin || (!myAssignment.loading && myAssignment.employee?.id === emp?.id)

  if (!emp) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <EmptyState icon="👤" message="Employee not found." actionHref="/roster" actionLabel="← Back to Roster" />
    </div>
  )

  return (
    <div className="bg-gray-950 text-white pb-8 mt-8 md:mt-0">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">

        <Link to="/roster" className="text-gray-500 hover:text-gray-300 text-sm">← Roster</Link>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs flex items-center gap-2">
            📶 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Header */}
        <div className="theme-card rounded-xl p-4 border">
          <div className="flex items-start justify-between gap-3">
            {/* Headshot */}
            <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
              {emp.headshot_url ? (
                <img src={emp.headshot_url} alt={emp.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-2xl font-bold">{emp.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{emp.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {((emp.roles as string[] | null)?.length ? (emp.roles as string[]) : [emp.role]).map(r => (
                  <span key={r} className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[r] || ROLE_COLORS.Tech}`}>
                    {r}
                  </span>
                ))}
                {emp.rems && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">REMS</span>
                )}
                {emp.is_medical_director && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300">Medical Director</span>
                )}
                {emp.status === 'Inactive' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">Inactive</span>
                )}
                {isAdmin && (
                  <button
                    onClick={toggleStatus}
                    disabled={togglingStatus}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 ${
                      emp.status === 'Active'
                        ? 'bg-red-900/40 text-red-400 hover:bg-red-900/70'
                        : 'bg-green-900/40 text-green-400 hover:bg-green-900/70'
                    }`}
                  >
                    {togglingStatus ? '…' : emp.status === 'Active' ? 'Inactivate' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Personal info */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Personal</h2>
          <dl className="grid grid-cols-1 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Personal Email" value={emp.personal_email || emp.email} />
              <Field label="WF Email" value={emp.wf_email} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Phone" value={emp.phone} />
              <Field label="Personal Phone" value={emp.personal_phone} />
              <Field label="DOB" value={emp.date_of_birth} />
            </div>
            <Field label="Home Address" value={emp.home_address} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Emergency Contact" value={emp.emergency_contact_name} />
              <Field label="Emergency Phone" value={emp.emergency_contact_phone} />
              <Field label="Relationship" value={emp.emergency_contact_relationship} />
            </div>
            {isAdmin && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                <Field label="Daily Rate" value={emp.daily_rate ? `$${emp.daily_rate.toLocaleString()}` : null} />
                <Field label="Hours/Day" value={emp.default_hours_per_day ? String(emp.default_hours_per_day) : '16'} />
              </div>
            )}
          </dl>
        </div>

        {/* Medical Credentials */}
        <div className="theme-card rounded-xl p-4 border space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Medical Credentials</h2>
          <CredRow label="BLS" value={emp.bls} />
          <CredRow label="ACLS" value={emp.acls} />
          <CredRow label="ITLS" value={emp.itls} />
          <CredRow label="PALS" value={emp.pals} />
          <CredRow label="Paramedic License" value={emp.paramedic_license} />
          <CredRow label="EMT License" value={emp.emt_license} />
          <CredRow label="RN License" value={emp.rn_license} />
          <CredRow label="NP License" value={emp.np_license} />
          <CredRow label="Medical License" value={emp.md_license} />
        </div>

        {/* Wildland Certs */}
        <div className="theme-card rounded-xl p-4 border space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Wildland Certifications</h2>
          <CredRow label="S-130" value={emp.s130} />
          <CredRow label="S-190" value={emp.s190} />
          <CredRow label="L-180" value={emp.l180} />
          <CredRow label="ICS 100" value={emp.ics_100} />
          <CredRow label="ICS 200" value={emp.ics_200} />
          <CredRow label="ICS 700" value={emp.ics_700} />
          <CredRow label="ICS 800" value={emp.ics_800} />
          <CredRow label="SSV LEMSA" value={emp.ssv_lemsa} />
        </div>

        {/* Red Card & Deployment Status */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Deployment Qualifications</h2>
          <div className="space-y-2">
            {/* Rescue Capable toggle */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
              <div>
                <p className="text-sm font-medium text-white">Rescue Capable</p>
                <p className="text-xs text-gray-500">Qualified for Technical Rope Rescue / Rescue operations</p>
              </div>
              {canEdit ? (
                <button
                  onClick={async () => {
                    const newVal = !emp.rescue_capable
                    const supabase = (await import('@/lib/supabase/client')).createClient()
                    await updateEmployee(emp.id, { rescue_capable: newVal, rems: newVal })
                    setEmp((prev: any) => prev ? { ...prev, rescue_capable: newVal, rems: newVal } : prev)
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${emp.rescue_capable ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emp.rescue_capable ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full ${emp.rescue_capable ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-500'}`}>{emp.rescue_capable ? 'Yes' : 'No'}</span>
              )}
            </div>

            {/* Red Card */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
              <div>
                <p className="text-sm font-medium text-white">🔴 Red Card</p>
                <p className="text-xs text-gray-500">Annual RAM wildfire qualification (S-130/190/L-180 + 4hr class + fire shelter)</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  placeholder="Year"
                  defaultValue={emp.red_card_year || ''}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-red-500"
                  onBlur={async e => {
                    const yr = e.target.value ? parseInt(e.target.value) : null
                    await updateEmployee(emp.id, {
                      red_card_year: yr,
                      red_card: yr ? `${yr} RAM Red Card` : null
                    })
                    setEmp((prev: any) => prev ? { ...prev, red_card_year: yr, red_card: yr ? `${yr} RAM Red Card` : null } : prev)
                  }}
                />
                {emp.red_card_year && (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-900/70 text-red-300 font-bold">
                    🔴 {emp.red_card_year}
                  </span>
                )}
              </div>
            </div>

            {/* DEA License — providers only */}
            {['MD', 'DO', 'PA', 'NP'].includes(emp.role) && (
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium text-white">DEA License</p>
                  <p className="text-xs text-gray-500">Drug Enforcement Administration registration number</p>
                </div>
                <input
                  type="text"
                  placeholder="DEA number or expiry"
                  defaultValue={emp.dea_license || ''}
                  className="w-40 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onBlur={async e => {
                    const val = e.target.value.trim() || null
                    await updateEmployee(emp.id, { dea_license: val })
                    setEmp((prev: any) => prev ? { ...prev, dea_license: val } : prev)
                  }}
                />
              </div>
            )}

            {/* NPI Number — providers only */}
            {['MD', 'DO', 'PA', 'NP'].includes(emp.role) && (
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium text-white">NPI Number</p>
                  <p className="text-xs text-gray-500">National Provider Identifier</p>
                </div>
                <input
                  type="text"
                  placeholder="NPI number"
                  defaultValue={emp.npi_number || ''}
                  className="w-40 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onBlur={async e => {
                    const val = e.target.value.trim() || null
                    await updateEmployee(emp.id, { npi_number: val })
                    setEmp((prev: any) => prev ? { ...prev, npi_number: val } : prev)
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Credential Documents */}
        <div className="theme-card rounded-xl p-4 border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Credential Documents</h2>

          </div>

          {creds.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No credential documents on file.</p>
          ) : (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header">
                <span className="flex-1">Cert Type</span>
                <span className="w-28 shrink-0 hidden sm:block">Issued</span>
                <span className="w-28 shrink-0 hidden sm:block">Expires</span>
                <span className="w-16 shrink-0 text-right">File</span>
              </div>
              {creds.map(doc => (
                <div key={doc.id} className="flex items-center px-3 py-2.5 border-b border-gray-800/50 last:border-0 text-sm">
                  <span className="flex-1 font-medium text-white">{doc.cert_type}</span>
                  <span className="w-28 shrink-0 text-gray-400 text-xs hidden sm:block">
                    {doc.issued_date || '—'}
                  </span>
                  <span className="w-28 shrink-0 text-gray-400 text-xs hidden sm:block">
                    {doc.expiration_date || '—'}
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs underline">
                        View
                      </a>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>



        {/* Employee Badge QR Code */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-card-bg, #111827)', borderColor: 'var(--color-border, #1f2937)' }}>
          <div className="px-4 py-3 border-b" style={{ backgroundColor: 'var(--color-header-bg, #030712)', borderColor: 'var(--color-border, #1f2937)' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Badge QR Code</h3>
            <p className="text-xs text-gray-500 mt-0.5">Print for employee badge — links to credential verification.</p>
          </div>
          <QRCodeCard
            url={`${brand.appUrl}/roster/${emp.id}`}
            label={emp.name}
            sublabel={emp.role}
            downloadName={`${emp.name.replace(/\s+/g, '-')}-badge-QR`}
            size={180}
          />
        </div>

        {/* Payroll / Deployment History — admin only */}
        {isAdmin && deployments.length > 0 && (
          <div className="theme-card rounded-xl border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">💰 Payroll Summary</h3>
              <span className="text-sm font-bold text-green-400">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                  deployments.reduce((s, d) => {
                    const h = d.hours_worked || 0
                    const rate = d.daily_rate || 0
                    return s + (rate > 0 ? (h / 24) * rate : 0)
                  }, 0)
                )}
              </span>
            </div>
            <div className="divide-y divide-gray-800/50">
              <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                <span className="w-32 shrink-0">Incident</span>
                <span className="flex-1 min-w-0">Dates</span>
                <span className="w-16 shrink-0 text-right">Hours</span>
                <span className="w-20 shrink-0 text-right">Est. Pay</span>
              </div>
              {deployments.map(d => {
                const h = d.hours_worked || 0
                const rate = d.daily_rate || 0
                const pay = rate > 0 ? (h / 24) * rate : 0
                return (
                  <div key={d.id} className="flex items-center px-4 py-2 text-sm">
                    <span className="w-32 shrink-0 text-white text-xs truncate pr-2">{d.incident_name || '—'}</span>
                    <span className="flex-1 min-w-0 text-gray-400 text-xs truncate">
                      {d.start_date || '?'} → {d.end_date || 'active'}
                    </span>
                    <span className="w-16 shrink-0 text-right text-gray-400 text-xs">{h > 0 ? `${h.toFixed(0)}h` : '—'}</span>
                    <span className="w-20 shrink-0 text-right text-green-400 text-xs font-medium">
                      {pay > 0 ? `$${pay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="px-4 py-2 border-t border-gray-800/50 flex justify-between text-xs">
              <span className="text-gray-500">{deployments.length} deployment{deployments.length !== 1 ? 's' : ''}</span>
              <span className="text-gray-500">
                {deployments.reduce((s, d) => s + (d.hours_worked || 0), 0).toFixed(0)} total hours
              </span>
            </div>
          </div>
        )}

        {/* Employee Expenses — admin only */}
        {isAdmin && (
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-card-bg, #111827)', borderColor: 'var(--color-border, #1f2937)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ backgroundColor: 'var(--color-header-bg, #030712)', borderColor: 'var(--color-border, #1f2937)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🧂 Expense History</h3>
              <span className="text-sm font-bold text-red-400">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                  empExpenses.reduce((s, e) => s + (e.amount || 0), 0)
                )}
              </span>
            </div>
            {empExpenses.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No expenses logged for this employee.</p>
            )}
            {empExpenses.length > 0 && <div className="overflow-x-auto" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border, #1f2937)' }}>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Date</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Incident</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Type</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Description</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Amount</th>
                    <th className="px-2 py-2 text-center text-gray-500 font-semibold uppercase">🧃</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border, #1f2937)' }}>
                  {empExpenses.map(exp => {
                    const inc = exp.incidents as { name: string } | { name: string }[] | null
                    const incName = (Array.isArray(inc) ? inc[0]?.name : inc?.name) || '—'
                    return (
                      <tr key={exp.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-3 py-2 text-gray-400">{exp.expense_date}</td>
                        <td className="px-3 py-2 text-white truncate max-w-[120px]">{incName}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            exp.expense_type === 'Gas' ? 'bg-yellow-900/60 text-yellow-300' :
                            exp.expense_type === 'Hotel' ? 'bg-purple-900/60 text-purple-300' :
                            exp.expense_type === 'Repairs' ? 'bg-red-900/60 text-red-300' :
                            exp.expense_type === 'Food' ? 'bg-orange-900/60 text-orange-300' :
                            exp.expense_type === 'Supplies' ? 'bg-blue-900/60 text-blue-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>{exp.expense_type}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-300 truncate max-w-[150px]">{exp.description || '—'}</td>
                        <td className="px-3 py-2 text-right font-medium text-red-400">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(exp.amount)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {exp.receipt_url ? (
                            <button onClick={async () => {
                              const { data } = await supabase.storage.from('documents').createSignedUrl(exp.receipt_url!, 3600)
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                            }} className="text-xs text-blue-400 hover:text-blue-300" title="View receipt">🧃</button>
                          ) : (
                            <span className="text-gray-600 text-xs italic" title={exp.no_receipt_reason || 'No receipt'}>
                              {exp.no_receipt_reason === "I'm a knucklehead" ? '🤦' : '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        )}

        {/* Roles & Permissions — admin only */}
        {isAdmin && (
          <div className="theme-card rounded-xl border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🛡️ Roles & Permissions</h3>
            </div>
            <div className="p-4 space-y-4">
              {rolesLoading ? (
                <p className="text-xs text-gray-500">Loading roles…</p>
              ) : (
                <>
                  {/* Current role assignments */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Assigned Roles</p>
                    {empRoles.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">No roles assigned.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {empRoles.map(role => (
                          <div key={role.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-900/50 text-indigo-300 text-xs">
                            <span>{role.display_name}</span>
                            {role.is_system && <span className="text-indigo-600" title="System role">🔒</span>}
                            <button
                              onClick={async () => {
                                try {
                                  const { error } = await supabase.from('employee_roles').delete().match({ employee_id: id, role_id: role.id })
                                  if (error) throw error
                                  setEmpRoles(rs => rs.filter(r => r.id !== role.id))
                                  toast.success(`Removed role "${role.display_name}"`)
                                } catch (err: any) {
                                  toast.error('Failed to remove role: ' + (err?.message || err))
                                }
                              }}
                              className="text-indigo-500 hover:text-red-400 ml-0.5 transition-colors"
                              title="Remove role"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add role */}
                  {allRoles.filter(r => !empRoles.some(er => er.id === r.id)).length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRoleId}
                        onChange={e => setSelectedRoleId(e.target.value)}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <option value="">— Add a role —</option>
                        {allRoles.filter(r => !empRoles.some(er => er.id === r.id)).map(r => (
                          <option key={r.id} value={r.id}>{r.display_name}</option>
                        ))}
                      </select>
                      <button
                        disabled={!selectedRoleId || assigningRole}
                        onClick={async () => {
                          if (!selectedRoleId) return
                          setAssigningRole(true)
                          try {
                            const { error } = await supabase.from('employee_roles').insert({ employee_id: id, role_id: selectedRoleId })
                            if (error) throw error
                            const added = allRoles.find(r => r.id === selectedRoleId)
                            if (added) setEmpRoles(rs => [...rs, added])
                            setSelectedRoleId('')
                            toast.success(`Added role "${added?.display_name}"`)
                          } catch (err: any) {
                            toast.error('Failed to assign role: ' + (err?.message || err))
                          }
                          setAssigningRole(false)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-sm font-semibold transition-colors"
                      >
                        {assigningRole ? '…' : 'Add'}
                      </button>
                    </div>
                  )}

                  {/* Resolved permissions */}
                  {empRoles.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">Resolved Permissions</p>
                      {(() => {
                        const perms = Array.from(new Set(empRoles.flatMap(r => r.permissions))).sort()
                        return (
                          <div className="flex flex-wrap gap-1.5">
                            {perms.map(p => (
                              <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 font-mono">{p}</span>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
