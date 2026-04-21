import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LoadingSkeleton, EmptyState } from '@/components/ui'
import { authFetch } from '@/lib/authFetch'
import { loadSingle } from '@/lib/offlineFirst'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { queryEmployee } from '@/lib/services/employees'
import { usePermission } from '@/hooks/usePermission'
import { HeadshotSection } from './components/HeadshotSection'
import { PersonalInfoForm } from './components/PersonalInfoForm'
import { PushNotificationsSection } from './components/PushNotificationsSection'
import { CredentialWallet } from './components/CredentialWallet'
import { CredentialUpload } from './components/CredentialUpload'
import { DocumentPreviewPanel } from './components/DocumentPreviewPanel'
import { PinSetupSection } from './components/PinSetupSection'
import { AppearanceSection } from './components/AppearanceSection'

export default function ProfilePage() {
  const assignment = useUserAssignment()
  const location = useLocation()
  const canCredentials = usePermission('roster.credentials')
  const isUnassigned = !assignment.loading && assignment.employee && !assignment.unit
  const showUnassignedBanner = !canCredentials && isUnassigned

  const [employee, setEmployee] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [creds, setCreds] = useState<any[]>([])
  const [credSignedUrls, setCredSignedUrls] = useState<Record<string, string>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    date_of_birth: '',
    phone: '',
    personal_email: '',
    personal_phone: '',
    home_address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
  })

  useEffect(() => {
    if (!assignment.loading && assignment.employee?.id) {
      const load = async () => {
        try {
          const { getCachedById } = await import('@/lib/offlineStore')
          const cached = await getCachedById('employees', assignment.employee!.id) as any
          if (cached) setEmployee(cached)
        } catch {}
        const { data } = await loadSingle(
          () => queryEmployee(assignment.employee!.id) as any,
          'employees',
          assignment.employee!.id
        )
        if (data) {
          setEmployee(data)
          setForm({
            name: data.name || '',
            date_of_birth: data.date_of_birth || '',
            phone: data.phone || '',
            personal_email: data.personal_email || '',
            personal_phone: data.personal_phone || '',
            home_address: data.home_address || '',
            emergency_contact_name: data.emergency_contact_name || '',
            emergency_contact_phone: data.emergency_contact_phone || '',
            emergency_contact_relationship: data.emergency_contact_relationship || '',
          })
          try { await loadCreds(assignment.employee!.id) } catch {}
        }
      }
      load()
    }
  }, [assignment.loading, assignment.employee])

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const loadCreds = async (_empId: string) => {
    try {
      const res = await authFetch('/api/credentials/signed-urls')
      if (!res.ok) throw new Error('Failed to load credentials')
      const { credentials } = await res.json()
      setCreds(credentials || [])
      const urlMap: Record<string, string> = {}
      for (const c of (credentials || [])) {
        if (c.signed_url) urlMap[c.id] = c.signed_url
      }
      setCredSignedUrls(urlMap)
    } catch (e) {
      console.error('[Profile] loadCreds error:', e)
    }
  }

  const handleSave = async () => {
    if (!employee?.id) return
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await authFetch('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setEmployee((prev: any) => ({ ...prev, ...data.employee }))
      try {
        const { cacheData } = await import('@/lib/offlineStore')
        await cacheData('employees', [data.employee])
      } catch {}
      setSuccess('Profile updated successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save profile')
    }
    setSaving(false)
  }

  if (assignment.loading) return <LoadingSkeleton fullPage />
  if (!employee) return <EmptyState icon="👤" message="No employee record found for your account." />

  return (
    <div className="flex gap-6">
      <div className={`p-6 md:p-8 mt-8 md:mt-0 pb-20 transition-all ${previewUrl ? 'max-w-md' : 'max-w-lg'}`}>

        {showUnassignedBanner && (
          <div className="mb-5 bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3">
            <p className="text-amber-300 text-sm font-semibold mb-1">📢 Not yet assigned to a unit</p>
            <p className="text-amber-200/70 text-xs">
              You'll have full access to incidents, encounters, CS, and inventory once you're assigned to an active unit.
              In the meantime you can update your profile, view the roster, and submit schedule requests below.
            </p>
          </div>
        )}

        {!canCredentials && (
          <div className="mb-5">
            <Link
              to="/schedule/request"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              📅 Schedule Request
            </Link>
          </div>
        )}

        <h1 className="text-2xl font-bold mb-1">My Profile</h1>
        <p className="text-gray-400 text-sm mb-6">{form.name || employee.name} · {employee.role} · {employee.wf_email || employee.email}</p>

        <HeadshotSection
          employee={employee}
          onEmployeeUpdate={updates => setEmployee((p: any) => ({ ...p, ...updates }))}
          onSuccess={setSuccess}
          onError={setError}
        />

        <PersonalInfoForm form={form} set={set} />

        <PushNotificationsSection employeeId={assignment.employee?.id} onError={setError} />

        <CredentialWallet
          creds={creds}
          credSignedUrls={credSignedUrls}
          previewUrl={previewUrl}
          setPreviewUrl={setPreviewUrl}
          previewName={previewName}
          setPreviewName={setPreviewName}
        />

        <CredentialUpload
          employee={employee}
          onSuccess={setSuccess}
          onError={setError}
          onReload={() => loadCreds(employee.id)}
        />

        {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">{error}</div>}
        {success && <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm mb-4">✅ {success}</div>}

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>

        <PinSetupSection employeeId={assignment.employee?.id} />
        <AppearanceSection />
      </div>

      {previewUrl && (
        <DocumentPreviewPanel
          previewUrl={previewUrl}
          previewName={previewName}
          onClose={() => { setPreviewUrl(null); setPreviewName('') }}
        />
      )}
    </div>
  )
}
