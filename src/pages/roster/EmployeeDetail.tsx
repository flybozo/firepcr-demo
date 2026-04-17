
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'


type Employee = {
  id: string
  name: string
  role: string
  email: string | null
  wf_email: string | null
  phone: string | null
  dob: string | null
  address: string | null
  emergency_contact: string | null
  status: string
  rems: boolean
  rems_capable: boolean | null
  dea_license: string | null
  red_card: string | null
  red_card_year: number | null
  ssv_lemsa: string | null
  drive_folder_url: string | null
  drive_folder_id: string | null
  qr_code_url: string | null
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

const ROLE_COLORS: Record<string, string> = {
  'MD/DO': 'bg-purple-900 text-purple-300',
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
  const { isAdmin } = useRole()
  const myAssignment = useUserAssignment()
  const id = params.id as string

  const [emp, setEmp] = useState<Employee | null>(null)
  const [creds, setCreds] = useState<CredentialDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)

  const toggleStatus = async () => {
    if (!emp || !isAdmin) return
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active'
    const confirmed = confirm(
      newStatus === 'Inactive'
        ? `Inactivate ${emp.name}? This will ban their app login and release all unit assignments.`
        : `Reactivate ${emp.name}? This will restore their app login access.`
    )
    if (!confirmed) return
    setTogglingStatus(true)
    try {
      const res = await fetch('/api/employee-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ employeeId: emp.id, status: newStatus }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEmp(e => e ? { ...e, status: newStatus } : e)
    } catch (err: any) {
      alert('Failed to update status: ' + (err?.message || err))
    }
    setTogglingStatus(false)
  }

  useEffect(() => {
    const load = async () => {
      // Show cached data instantly
      try {
        const { getCachedById } = await import('@/lib/offlineStore')
        const cached = await getCachedById('employees', id) as any
        if (cached) {
          setEmp(cached as Employee)
          setLoading(false)
        }
      } catch {}
      const { data: empData, offline } = await loadSingle<Employee>(
        () => supabase.from('employees').select('id, name, role, app_role, status, wf_email, email, phone, personal_email, personal_phone, home_address, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, headshot_url, date_of_birth, ram_id, auth_user_id, qr_code_url, bls, acls, pals, itls, paramedic_license, ambulance_driver_cert, medical_license, s130, s190, l180, ics100, ics200, ics700, ics800, dea_license, ssv_lemsa, npi').eq('id', id).single() as any,
        'employees',
        id
      )
      setEmp(empData)
      setQrUrl((empData as any)?.qr_code_url || null)
      if (offline) setIsOfflineData(true)
      if (empData && !offline) {
        try {
          const { data: credData } = await supabase.from('employee_credentials').select('*').eq('employee_id', id).order('cert_type')
          setCreds(credData || [])
        } catch {}
      }
      setLoading(false)
    }
    load()
  }, [id])

  const generateQrCode = async () => {
    if (!emp?.drive_folder_id) return
    setGeneratingQr(true)
    const folderUrl = `https://drive.google.com/drive/folders/${emp.drive_folder_id}`
    const generated = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(folderUrl)}`
    await supabase.from('employees').update({ qr_code_url: generated }).eq('id', id)
    setQrUrl(generated)
    setEmp(prev => prev ? { ...prev, qr_code_url: generated } : prev)
    setGeneratingQr(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  // Can edit: admin OR viewing own employee record
  // Note: isAdmin derives from myAssignment; if still loading, default false then re-render
  const canEdit = isAdmin || (!myAssignment.loading && myAssignment.employee?.id === emp?.id)

  if (!emp) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Employee not found.</p>
        <Link to="/roster" className="text-red-400 underline">← Back</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8 mt-8 md:mt-0">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">

        <Link to="/roster" className="text-gray-500 hover:text-gray-300 text-sm">← Roster</Link>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs flex items-center gap-2">
            📶 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Header */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{emp.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[emp.role] || ROLE_COLORS.Tech}`}>
                  {emp.role}
                </span>
                {emp.rems && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">REMS</span>
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
            <div className="flex flex-col gap-2 items-end shrink-0">
              {emp.drive_folder_url && (
                <a href={emp.drive_folder_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                  📁 Drive
                </a>
              )}
              {emp.drive_folder_id && !emp.drive_folder_url && (
                <a href={`https://drive.google.com/drive/folders/${emp.drive_folder_id}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                  📁 Open Drive Folder
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Personal</h2>
          <dl className="grid grid-cols-1 gap-3">
            {/* Emails full-width — too long to share a row on mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Personal Email" value={emp.email} />
              <Field label="WF Email" value={emp.wf_email} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Phone" value={emp.phone} />
              <Field label="DOB" value={emp.dob} />
              <Field label="Address" value={emp.address} />
              <Field label="Emergency Contact" value={emp.emergency_contact} />
            </div>
          </dl>
        </div>

        {/* Medical Credentials */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Medical Credentials</h2>
          <CredRow label="BLS" value={emp.bls} />
          <CredRow label="ACLS" value={emp.acls} />
          <CredRow label="ITLS" value={emp.itls} />
          <CredRow label="PALS" value={emp.pals} />
          <CredRow label="Paramedic License" value={emp.paramedic_license} />
          <CredRow label="EMT License" value={emp.emt_license} />
          <CredRow label="RN License" value={emp.rn_license} />
          <CredRow label="NP License" value={emp.np_license} />
          <CredRow label="MD/DO License" value={emp.md_license} />
        </div>

        {/* Wildland Certs */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Wildland Certifications</h2>
          <CredRow label="S-130" value={emp.s130} />
          <CredRow label="S-190" value={emp.s190} />
          <CredRow label="L-180" value={emp.l180} />
          <CredRow label="ICS 100" value={emp.ics_100} />
          <CredRow label="ICS 200" value={emp.ics_200} />
          <CredRow label="ICS 700" value={emp.ics_700} />
          <CredRow label="ICS 800" value={emp.ics_800} />
          <CredRow label="SSV LEMSA" value={(emp as any).ssv_lemsa} />
        </div>

        {/* Red Card & Deployment Status */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Deployment Qualifications</h2>
          <div className="space-y-2">
            {/* REMS Capable toggle */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
              <div>
                <p className="text-sm font-medium text-white">REMS Capable</p>
                <p className="text-xs text-gray-500">Qualified for Technical Rope Rescue / REMS operations</p>
              </div>
              {canEdit ? (
                <button
                  onClick={async () => {
                    const newVal = !(emp as any).rems_capable
                    const supabase = (await import('@/lib/supabase/client')).createClient()
                    await supabase.from('employees').update({ rems_capable: newVal, rems: newVal }).eq('id', emp.id)
                    setEmp((prev: any) => prev ? { ...prev, rems_capable: newVal, rems: newVal } : prev)
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${(emp as any).rems_capable ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${(emp as any).rems_capable ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-xs px-2 py-0.5 rounded-full ${(emp as any).rems_capable ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-500'}`}>{(emp as any).rems_capable ? 'Yes' : 'No'}</span>
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
                  defaultValue={(emp as any).red_card_year || ''}
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-red-500"
                  onBlur={async e => {
                    const yr = e.target.value ? parseInt(e.target.value) : null
                    const supabase = (await import('@/lib/supabase/client')).createClient()
                    await supabase.from('employees').update({
                      red_card_year: yr,
                      red_card: yr ? `${yr} RAM Red Card` : null
                    }).eq('id', emp.id)
                    setEmp((prev: any) => prev ? { ...prev, red_card_year: yr, red_card: yr ? `${yr} RAM Red Card` : null } : prev)
                  }}
                />
                {(emp as any).red_card_year && (
                  <span className="text-xs px-2 py-0.5 rounded bg-red-900/70 text-red-300 font-bold">
                    🔴 {(emp as any).red_card_year}
                  </span>
                )}
              </div>
            </div>

            {/* DEA License */}
            <div className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium text-white">DEA License</p>
                <p className="text-xs text-gray-500">Drug Enforcement Administration registration number</p>
              </div>
              <input
                type="text"
                placeholder="DEA number or expiry"
                defaultValue={(emp as any).dea_license || ''}
                className="w-40 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                onBlur={async e => {
                  const val = e.target.value.trim() || null
                  const supabase = (await import('@/lib/supabase/client')).createClient()
                  await supabase.from('employees').update({ dea_license: val }).eq('id', emp.id)
                  setEmp((prev: any) => prev ? { ...prev, dea_license: val } : prev)
                }}
              />
            </div>
          </div>
        </div>

        {/* Credential Documents */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Credential Documents</h2>
            <div className="flex gap-2">
              {emp.drive_folder_id && (
                <a
                  href={`https://drive.google.com/drive/folders/${emp.drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  📁 Open Drive Folder
                </a>
              )}
              <button className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 cursor-default">
                Upload via Drive folder
              </button>
            </div>
          </div>

          {creds.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No credential documents on file.</p>
          ) : (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <div className="flex items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800/50">
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

        {/* QR Code Section */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">QR Code</h2>

          {qrUrl ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-2 rounded-lg inline-block">
                <img src={qrUrl} alt="Employee QR Code" width={200} height={200} />
              </div>
              <p className="text-xs text-gray-500">Scan to open Drive folder</p>
            </div>
          ) : emp.drive_folder_id ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-gray-400 text-sm">No QR code generated yet.</p>
              {canEdit && <button
                onClick={generateQrCode}
                disabled={generatingQr}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-semibold transition-colors"
              >
                {generatingQr ? 'Generating...' : '📷 Generate QR Code'}
              </button>}
            </div>
          ) : (
            <p className="text-gray-600 text-sm text-center py-4">
              No Drive folder linked — add a Drive folder ID to enable QR code generation.
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
