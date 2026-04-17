

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/authFetch'
import { loadSingle } from '@/lib/offlineFirst'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useTheme, THEME_PRESETS, THEME_FONTS } from '@/components/ThemeProvider'
import type { Theme } from '@/components/ThemeProvider'


const CERT_TYPE_OPTIONS = [
  'BLS/CPR', 'ACLS', 'PALS', 'ITLS / PHTLS / ATLS',
  'Paramedic License', 'Medical License (MD/DO)', 'NP License', 'PA License', 'RN License',
  'Ambulance Driver Cert', 'NREMT', 'EMT Certification',
  'S-130', 'S-190', 'L-180',
  'ICS-100', 'ICS-200', 'ICS-300', 'ICS-400', 'ICS-700', 'ICS-800',
  'IRATI Level 1', 'Rope Rescue Technician', 'Swiftwater Rescue',
  'Annual Refresher (RT-130)', 'REMS Certification',
  'Other (describe in filename)',
]

export default function ProfilePage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const headshotRef = useRef<HTMLInputElement>(null)
  const credRef = useRef<HTMLInputElement>(null)

  const [employee, setEmployee] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false)
  const [uploadingCred, setUploadingCred] = useState(false)
  const [selectedCredType, setSelectedCredType] = useState('')
  const [credExpiry, setCredExpiry] = useState('')
  const [showCredUpload, setShowCredUpload] = useState(false)
  const [creds, setCreds] = useState<any[]>([])
  const [credSignedUrls, setCredSignedUrls] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

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

  // Check push subscription status
  useEffect(() => {
    import('@/lib/pushNotifications').then(async ({ isPushSubscribed }) => {
      setPushEnabled(await isPushSubscribed())
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!assignment.loading && assignment.employee?.id) {
      const load = async () => {
        // Show cached data instantly
        try {
          const { getCachedById } = await import('@/lib/offlineStore')
          const cached = await getCachedById('employees', assignment.employee!.id) as any
          if (cached) setEmployee(cached)
        } catch {}
        const { data } = await loadSingle(
          () => supabase.from('employees').select('id, name, role, app_role, status, wf_email, email, phone, personal_email, personal_phone, home_address, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, headshot_url, date_of_birth, ram_id, auth_user_id').eq('id', assignment.employee!.id).single() as any,
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
          // Load credential files (online only)
          try { await loadCreds(assignment.employee!.id) } catch {}
        }
      }
      load()
    }
  }, [assignment.loading, assignment.employee])

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const loadCreds = async (empId: string) => {
    const { data } = await supabase
      .from('employee_credentials')
      .select('id, cert_type, file_name, file_url, expiration_date, issued_date')
      .eq('employee_id', empId)
      .order('cert_type')
    setCreds(data || [])
    // Generate signed URLs for storage-hosted files (not Drive links)
    const urlMap: Record<string, string> = {}

    // Get employee's Drive folder as fallback
    const { data: empRow } = await supabase.from('employees').select('drive_folder_id').eq('id', empId).single()
    const driveFolderUrl = (empRow as any)?.drive_folder_id
      ? `https://drive.google.com/drive/folders/${(empRow as any).drive_folder_id}`
      : null

    await Promise.all((data || []).map(async (c: any) => {
      if (!c.file_url) {
        // No file recorded — link to Drive folder if available
        if (driveFolderUrl) urlMap[c.id] = driveFolderUrl
        return
      }
      if (c.file_url.includes('drive.google.com') || c.file_url.startsWith('http')) {
        urlMap[c.id] = c.file_url  // Drive/external links work directly
      } else {
        // Supabase storage path — try signed URL, fall back to Drive folder
        const storagePath = c.file_url.replace(/.*\/credentials\//, '')
        const { data: signed } = await supabase.storage.from('credentials').createSignedUrl(storagePath, 3600)
        if (signed?.signedUrl) {
          urlMap[c.id] = signed.signedUrl
        } else if (driveFolderUrl) {
          urlMap[c.id] = driveFolderUrl  // Fall back to employee's Drive folder
        }
      }
    }))
    setCredSignedUrls(urlMap)
  }

  const handleSave = async () => {
    if (!employee?.id) return
    setSaving(true); setError(''); setSuccess('')
    const { error: err } = await supabase.from('employees').update(form).eq('id', employee.id)
    if (err) setError(err.message)
    else setSuccess('Profile updated successfully')
    setSaving(false)
  }

  const handleHeadshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !employee?.id) return
    setUploadingHeadshot(true); setError('')
    const ext = file.name.split('.').pop()
    const path = `${employee.id}/headshot.${ext}`
    const { data, error: upErr } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
    if (upErr) { setError('Upload failed: ' + upErr.message); setUploadingHeadshot(false); return }
    const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(data.path)
    await supabase.from('employees').update({ headshot_url: urlData.publicUrl }).eq('id', employee.id)
    setEmployee((p: any) => ({ ...p, headshot_url: urlData.publicUrl }))
    setSuccess('Headshot updated')
    setUploadingHeadshot(false)
  }

  // Canonical cert code map for naming
  const CERT_CODES: Record<string, string> = {
    'BLS/CPR': 'BLS', 'BLS': 'BLS', 'NREMT': 'NREMT', 'ACLS': 'ACLS',
    'PALS': 'PALS', 'ITLS': 'ITLS', 'ATLS': 'ATLS', 'PHTLS': 'PHTLS',
    'EMT Certification': 'EMT', 'Paramedic License': 'MEDIC',
    'Medical License': 'LICENSE', 'RN License': 'LICENSE', 'NP License': 'LICENSE',
    'Ambulance Driver Cert': 'ADC', 'DEA License': 'DEA',
    'S-130': 'S130', 'S-190': 'S190', 'L-180': 'L180',
    'ICS-100': 'ICS100', 'ICS-200': 'ICS200', 'ICS-700': 'ICS700', 'ICS-800': 'ICS800',
    'Red Card': 'REDCARD', 'SSV LEMSA': 'SSV-LEMSA',
  }

  const buildCanonicalName = (ramId: string, certType: string, empName: string, expiry: string | null, ext: string) => {
    const code = CERT_CODES[certType] || certType.toUpperCase().replace(/[^A-Z0-9-]/g, '-').slice(0, 20)
    const parts = empName.replace(/,/g, '').split(' ').filter(p => !['MD','DO','RN','NP','PA','FP-C'].includes(p))
    const nameShort = parts.length >= 2 ? `${parts[parts.length - 1]}-${parts[0][0]}` : parts[0] || 'Unknown'
    const dateStr = expiry ? `_exp${expiry.slice(0, 7)}` : ''
    return `${ramId}_${code}_${nameShort}${dateStr}${ext}`
  }

  const handleCredUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !employee?.id) return
    setUploadingCred(true); setError('')

    // Build canonical filename
    const origExt = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : '.pdf'
    const ramId = `RAM-${employee.id.slice(-3).toUpperCase()}`  // fallback ID from UUID
    const certType = selectedCredType || 'Document'
    const canonicalName = buildCanonicalName(ramId, certType, employee.name || 'Unknown', credExpiry || null, origExt)

    const path = `${employee.id}/${canonicalName}`
    const { data, error: upErr } = await supabase.storage.from('credentials').upload(path, file, { upsert: false })
    if (upErr) { setError('Upload failed: ' + upErr.message); setUploadingCred(false); return }

    const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/credentials/${path}`
    await supabase.from('employee_credentials').insert({
      employee_id: employee.id,
      cert_type: certType,
      file_name: canonicalName,
      file_url: fileUrl,
      expiration_date: credExpiry || null,
    })

    // Also update the employee cert field if we recognize the cert type
    const fieldMap: Record<string, string> = {
      'BLS/CPR': 'bls', 'BLS': 'bls', 'NREMT': 'bls', 'ACLS': 'acls', 'PALS': 'pals',
      'ITLS': 'itls', 'PHTLS': 'itls', 'ATLS': 'itls',
      'EMT Certification': 'ambulance_driver_cert', 'Ambulance Driver Cert': 'ambulance_driver_cert',
      'Paramedic License': 'paramedic_license', 'Medical License': 'medical_license',
      'S-130': 's130', 'S-190': 's190', 'L-180': 'l180',
      'ICS-100': 'ics100', 'ICS-200': 'ics200', 'ICS-700': 'ics700', 'ICS-800': 'ics800',
      'DEA License': 'dea_license', 'SSV LEMSA': 'ssv_lemsa',
    }
    const empField = fieldMap[certType]
    if (empField) {
      const val = credExpiry ? `✅ On file (exp ${credExpiry.slice(0,7)})` : '✅ On file'
      if (empField) await supabase.from('employees').update({ [empField]: val }).eq('id', employee.id)
    }

    setSuccess(`✅ ${certType} uploaded as ${canonicalName}`)
    await loadCreds(employee.id)
    setShowCredUpload(false)
    setSelectedCredType('')
    setCredExpiry('')
    setUploadingCred(false)
  }

  const inputCls = 'w-full max-w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 box-border'
  const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

  if (assignment.loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!employee) return <div className="p-8 text-gray-500">No employee record found for your account.</div>

  return (
    <div className="p-6 md:p-8 max-w-lg mt-8 md:mt-0 pb-20">
      <h1 className="text-2xl font-bold mb-1">My Profile</h1>
      <p className="text-gray-400 text-sm mb-6">{form.name || employee.name} · {employee.role} · {employee.wf_email || employee.email}</p>

      {/* Headshot */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Headshot</h2>
        <div className="flex items-center gap-4">
          {employee.headshot_url ? (
            <img src={employee.headshot_url} alt="Headshot" className="w-20 h-20 rounded-full object-cover border-2 border-gray-600" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl">👤</div>
          )}
          <div>
            <button onClick={() => headshotRef.current?.click()}
              disabled={uploadingHeadshot}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">
              {uploadingHeadshot ? 'Uploading...' : 'Upload Photo'}
            </button>
            <p className="text-xs text-gray-500 mt-1">JPG or PNG, max 10MB</p>
            <input ref={headshotRef} type="file" accept="image/*" className="hidden" onChange={handleHeadshotUpload} />
          </div>
        </div>
      </div>

      {/* Name & DOB */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Personal Information</h2>
        <div>
          <label className={labelCls}>Full Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="First Last" />
        </div>
        <div>
          <label className={labelCls}>Date of Birth</label>
          <input value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} type="date" className={inputCls} style={{ maxWidth: '200px' }} />
          <p className="text-xs text-gray-600 mt-1">Private — only visible to administrators.</p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Contact Information</h2>
        <p className="text-xs text-gray-500">This information is private — only visible to administrators.</p>
        <div>
          <label className={labelCls}>Work Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" className={inputCls} placeholder="Mobile number" />
        </div>
        <div>
          <label className={labelCls}>Personal Email</label>
          <input value={form.personal_email} onChange={e => set('personal_email', e.target.value)} type="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Personal Phone</label>
          <input value={form.personal_phone} onChange={e => set('personal_phone', e.target.value)} type="tel" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Home Address</label>
          <input value={form.home_address} onChange={e => set('home_address', e.target.value)} className={inputCls} placeholder="Street, City, State ZIP" />
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Emergency Contact</h2>
        <p className="text-xs text-gray-500">Private — only visible to administrators.</p>
        <div>
          <label className={labelCls}>Name</label>
          <input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} type="tel" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Relationship</label>
          <input value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)} className={inputCls} placeholder="Spouse, Parent, etc." />
        </div>
      </div>

      {/* Push Notifications */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Push Notifications</h2>
            <p className="text-xs text-gray-500 mt-0.5">Receive alerts for CS counts, admin announcements, and more</p>
          </div>
          <button
            onClick={async () => {
              setPushLoading(true)
              try {
                if (pushEnabled) {
                  const { unsubscribeFromPush } = await import('@/lib/pushNotifications')
                  await unsubscribeFromPush()
                  setPushEnabled(false)
                } else {
                  const { subscribeToPush } = await import('@/lib/pushNotifications')
                  const ok = await subscribeToPush(employee?.id)
                  setPushEnabled(ok)
                  if (!ok) setError('Push notifications blocked. Check browser permissions.')
                }
              } catch { setError('Failed to update push settings') }
              setPushLoading(false)
            }}
            disabled={pushLoading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pushEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {pushLoading ? '...' : pushEnabled ? '🔔 Enabled' : '🔕 Enable'}
          </button>
        </div>
      </div>

      {/* Credential Wallet */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">My Credential Wallet</h2>
          <span className="text-xs text-gray-600">{creds.length} file{creds.length !== 1 ? 's' : ''}</span>
        </div>
        {creds.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-600 text-center">No credentials uploaded yet.</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {creds.map(c => {
              const url = credSignedUrls[c.id]
              const isImage = c.file_name && /\.(jpg|jpeg|png|heic|webp)$/i.test(c.file_name)
              const expStr = c.expiration_date ? ` · exp ${String(c.expiration_date).slice(0,7)}` : ''
              const isExpired = c.expiration_date && new Date(c.expiration_date) < new Date()
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  {/* Thumbnail for images, icon for PDFs */}
                  {url && isImage ? (
                    <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-gray-800">
                      <img src={url} alt={c.cert_type} className="w-full h-full object-cover" style={{ imageOrientation: 'from-image' }} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center shrink-0">
                      <span className="text-lg">{isImage ? '🖼️' : '📄'}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isExpired ? 'text-red-400' : 'text-white'}`}>
                      {c.cert_type}
                      {isExpired && <span className="ml-1.5 text-xs bg-red-900/60 text-red-300 px-1.5 py-0.5 rounded">EXPIRED</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{c.file_name}{expStr}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {url ? (
                      <>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                          title="View">View</a>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(url)
                              const blob = await res.blob()
                              const a = document.createElement('a')
                              a.href = URL.createObjectURL(blob)
                              a.download = c.file_name || 'credential'
                              a.click()
                              URL.revokeObjectURL(a.href)
                            } catch {
                              window.open(url, '_blank')
                            }
                          }}
                          className="text-xs px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                          title="Download">⬇ Save</button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500 italic">File in Drive — contact admin</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Credential Upload */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Upload Credentials</h2>
        <p className="text-xs text-gray-500">Upload photos or PDFs of your certifications. You'll be asked what type of credential you're uploading.</p>
        
        {!showCredUpload ? (
          <button onClick={() => setShowCredUpload(true)}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors">
            📎 Upload Credential Document
          </button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Credential Type *</label>
              <select value={selectedCredType} onChange={e => setSelectedCredType(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select credential type...</option>
                {CERT_TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {selectedCredType && (
              <>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Expiration Date (optional)</label>
                  <input type="date" value={credExpiry} onChange={e => setCredExpiry(e.target.value)}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
                </div>
                <button onClick={() => credRef.current?.click()}
                  disabled={uploadingCred}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors">
                  {uploadingCred ? 'Uploading...' : `📎 Select file for: ${selectedCredType}`}
                </button>
                <p className="text-xs text-gray-600 text-center">Will be saved as: {selectedCredType.toUpperCase().replace(/[^A-Z0-9]/g,"-")}_[YourName]{credExpiry ? `_exp${credExpiry.slice(0,7)}` : ""}.pdf</p>
                <input ref={credRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" className="hidden" onChange={handleCredUpload} />
              </>
            )}
            <button onClick={() => { setShowCredUpload(false); setSelectedCredType('') }}
              className="w-full py-1.5 bg-gray-800 rounded-lg text-xs text-gray-400 hover:text-gray-200">
              Cancel
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500">PDF, JPG, or PNG · Max 50MB per file</p>
      </div>

      {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">{error}</div>}
      {success && <div className="bg-green-900/40 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm mb-4">✅ {success}</div>}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>

      {/* Signing PIN Section */}
      <PinSetupSection employeeId={assignment.employee?.id} />

      {/* Appearance / Theme Section */}
      <AppearanceSection />
    </div>
  )
}

// ── Personal Appearance / Theme Picker ───────────────────────────────
function AppearanceSection() {
  const { theme, applyTheme, savePersonalTheme, isPersonalTheme } = useTheme()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSelectPreset = (presetKey: string) => {
    const preset = THEME_PRESETS[presetKey]
    if (!preset) return
    const newTheme: any = {
      ...theme,
      preset: presetKey,
      colors: { ...preset.colors },
    }
    applyTheme(newTheme)
  }

  const handleSave = async () => {
    setSaving(true)
    await savePersonalTheme(theme)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async () => {
    setSaving(true)
    await savePersonalTheme(null)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mt-8 pt-6 border-t border-gray-800">
      <h2 className="text-lg font-bold mb-1">🎨 Appearance</h2>
      <p className="text-xs text-gray-500 mb-4">Choose a color scheme. Your selection is saved to your profile and won't affect other users.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {Object.entries(THEME_PRESETS).map(([key, preset]) => {
          const isActive = theme.preset === key
          return (
            <button
              key={key}
              onClick={() => handleSelectPreset(key)}
              className={`p-3 rounded-xl border-2 transition-all text-left ${
                isActive ? 'border-white/50 ring-1 ring-white/20' : 'border-gray-800 hover:border-gray-600'
              }`}
              style={{ backgroundColor: preset.colors.cardBg }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold" style={{ color: preset.colors.text }}>{preset.label}</span>
                {isActive && <span className="text-xs">✓</span>}
              </div>
              <div className="flex gap-1 mb-1.5">
                {[preset.colors.primary, preset.colors.secondary, preset.colors.accent, preset.colors.cardBg].map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                ))}
              </div>
              {/* Font sample */}
              {THEME_FONTS[key] && (
                <p className="text-xs mb-1" style={{ color: preset.colors.primary, fontFamily: THEME_FONTS[key].family, opacity: 0.9 }}>
                  Aa — {THEME_FONTS[key].name}
                </p>
              )}
              <p className="text-xs" style={{ color: preset.colors.textMuted }}>{preset.description}</p>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors">
          {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Appearance'}
        </button>
        {isPersonalTheme && (
          <button onClick={handleReset} disabled={saving}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors">
            Reset to Default
          </button>
        )}
      </div>
    </div>
  )
}

// ── Signing PIN Setup ─────────────────────────────────────────────────────────
function PinSetupSection({ employeeId }: { employeeId: string | undefined }) {
  const supabase = createClient()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [hasPin, setHasPin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!employeeId) return
    authFetch('/api/pin/status')
      .then(r => r.json())
      .then(data => setHasPin(!!data?.hasPin))
      .catch(() => setHasPin(null))
  }, [employeeId])

  const handleSave = async () => {
    setError(''); setSuccess('')
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    if (pin !== confirm) { setError('PINs do not match'); return }
    if (!/^\d+$/.test(pin)) { setError('PIN must contain digits only'); return }
    if (!employeeId) { setError('No employee record'); return }
    setSaving(true)
    try {
      // Server-side PIN hashing (bcrypt)
      const setRes = await authFetch('/api/pin/set', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      })
      const setData = await setRes.json()
      if (!setRes.ok) throw new Error(setData.error || 'Failed to set PIN')
      setSuccess('Signing PIN saved successfully.')
      setHasPin(true)
      setPin(''); setConfirm('')
    } catch (e: any) {
      setError(e.message || 'Failed to save PIN')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4 mt-2">
      <div>
        <h2 className="font-bold text-sm uppercase tracking-wide text-gray-400">Signing PIN</h2>
        <p className="text-xs text-gray-500 mt-1">
          {hasPin ? 'You have a signing PIN set. Enter a new one below to change it.' : 'Set a PIN to digitally sign CS transfers, daily counts, MAR co-signatures, and other actions.'}
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-400">New PIN (4–8 digits)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="● ● ● ●"
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-center text-xl tracking-widest focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={confirm}
            onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))}
            placeholder="● ● ● ●"
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-center text-xl tracking-widest focus:outline-none focus:border-red-500"
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {success && <p className="text-green-400 text-xs">{success}</p>}
        <button onClick={handleSave} disabled={saving || pin.length < 4}
          className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl text-sm transition-colors">
          {saving ? 'Saving...' : hasPin ? 'Update Signing PIN' : 'Set Signing PIN'}
        </button>
      </div>
    </div>
  )
}
