import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────

type Role = 'EMT' | 'Paramedic' | 'RN' | 'NP' | 'PA' | 'MD/DO' | 'Tech'

const ROLE_OPTIONS: Role[] = ['EMT', 'Paramedic', 'RN', 'NP', 'PA', 'MD/DO', 'Tech']

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

interface CredentialEntry {
  id: string
  certType: string
  expiry: string
  file: File | null
}

interface FormData {
  // Step 2
  name: string
  role: string
  personal_email: string
  phone: string
  date_of_birth: string
  home_address: string
  // Step 3
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
  // Step 4
  headshot: File | null
  headshotPreview: string | null
  // Step 5
  credentials: CredentialEntry[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7

const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'FirePCR'
const COMPANY = import.meta.env.VITE_COMPANY_DBA || 'Ridgeline EMS'
const LOGO_URL =
  import.meta.env.VITE_LOGO_URL ||
  '/firepcr-logo.png'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const MAX_FILE_MB = 10
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

// ── Shared input class ─────────────────────────────────────────────────────

const inputClass =
  'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors'

const labelClass = 'block text-sm text-gray-400 mb-1.5'

// ── Progress bar ───────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  // Steps 1 and 7 don't count in visual progress
  const displayStep = Math.max(0, Math.min(step - 1, total - 2))
  const displayTotal = total - 2
  const pct = displayTotal > 0 ? Math.round((displayStep / displayTotal) * 100) : 0

  const stepLabels = ['Personal Info', 'Emergency', 'Headshot', 'Credentials', 'Review']

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        {step > 1 && step < total ? (
          stepLabels.map((label, i) => (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 transition-colors ${
                  i + 2 < step
                    ? 'bg-red-600 text-white'
                    : i + 2 === step
                    ? 'bg-red-600 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-gray-950'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {i + 2 < step ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs hidden sm:block ${
                  i + 2 <= step ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {label}
              </span>
            </div>
          ))
        ) : null}
      </div>
      {step > 1 && step < total && (
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Step components ────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-8">
      <div>
        <img
          src={LOGO_URL}
          alt={COMPANY}
          className="w-24 h-24 mx-auto rounded-full object-contain bg-white p-1 shadow-xl"
        />
        <h1 className="mt-6 text-3xl font-bold text-white">{APP_TITLE}</h1>
        <p className="text-gray-400 mt-1">{COMPANY}</p>
      </div>
      <div className="bg-gray-900 rounded-2xl p-6 text-left space-y-3">
        <h2 className="text-white font-semibold text-lg">Employee Onboarding</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Welcome to {COMPANY}. Complete this form to get set up in our system. It takes
          about 5 minutes.
        </p>
        <ul className="text-gray-400 text-sm space-y-1.5">
          {[
            'Personal & contact information',
            'Emergency contact',
            'Headshot photo (optional)',
            'Certifications & credentials (optional)',
          ].map(item => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-red-500">✓</span> {item}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={onNext}
        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-lg"
      >
        Get Started →
      </button>
    </div>
  )
}

interface StepPersonalInfoProps {
  data: Pick<
    FormData,
    'name' | 'role' | 'personal_email' | 'phone' | 'date_of_birth' | 'home_address'
  >
  onChange: (field: string, value: string) => void
  onNext: () => void
  onBack: () => void
}

function StepPersonalInfo({ data, onChange, onNext, onBack }: StepPersonalInfoProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!data.name.trim()) e.name = 'Full name is required'
    if (!data.role) e.role = 'Role is required'
    if (!data.personal_email.trim()) e.personal_email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.personal_email))
      e.personal_email = 'Enter a valid email address'
    if (!data.phone.trim()) e.phone = 'Phone number is required'
    if (!data.date_of_birth) e.date_of_birth = 'Date of birth is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Personal Information</h2>
        <p className="text-gray-400 text-sm mt-1">Tell us about yourself.</p>
      </div>

      <div>
        <label className={labelClass}>Full Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={data.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Jane Smith"
          className={inputClass}
          autoComplete="name"
        />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className={labelClass}>Role <span className="text-red-500">*</span></label>
        <select
          value={data.role}
          onChange={e => onChange('role', e.target.value)}
          className={`${inputClass} appearance-none`}
        >
          <option value="">Select your role…</option>
          {ROLE_OPTIONS.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role}</p>}
      </div>

      <div>
        <label className={labelClass}>
          Personal Email <span className="text-red-500">*</span>
          <span className="text-gray-500 font-normal ml-1">— your login credentials will be sent here</span>
        </label>
        <input
          type="email"
          value={data.personal_email}
          onChange={e => onChange('personal_email', e.target.value)}
          placeholder="jane@example.com"
          className={inputClass}
          autoComplete="email"
        />
        {errors.personal_email && (
          <p className="text-red-400 text-xs mt-1">{errors.personal_email}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Phone <span className="text-red-500">*</span></label>
        <input
          type="tel"
          value={data.phone}
          onChange={e => onChange('phone', e.target.value)}
          placeholder="(555) 867-5309"
          className={inputClass}
          autoComplete="tel"
        />
        {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className={labelClass}>
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={data.date_of_birth}
          onChange={e => onChange('date_of_birth', e.target.value)}
          className={`${inputClass} [color-scheme:dark]`}
          max={new Date().toISOString().split('T')[0]}
        />
        {errors.date_of_birth && (
          <p className="text-red-400 text-xs mt-1">{errors.date_of_birth}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Home Address <span className="text-gray-500">(optional)</span></label>
        <input
          type="text"
          value={data.home_address}
          onChange={e => onChange('home_address', e.target.value)}
          placeholder="123 Main St, Anytown, CA 96000"
          className={inputClass}
          autoComplete="street-address"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

interface StepEmergencyContactProps {
  data: Pick<
    FormData,
    | 'emergency_contact_name'
    | 'emergency_contact_phone'
    | 'emergency_contact_relationship'
  >
  onChange: (field: string, value: string) => void
  onNext: () => void
  onBack: () => void
}

function StepEmergencyContact({ data, onChange, onNext, onBack }: StepEmergencyContactProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!data.emergency_contact_name.trim()) e.emergency_contact_name = 'Name is required'
    if (!data.emergency_contact_phone.trim()) e.emergency_contact_phone = 'Phone is required'
    if (!data.emergency_contact_relationship.trim())
      e.emergency_contact_relationship = 'Relationship is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (validate()) onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Emergency Contact</h2>
        <p className="text-gray-400 text-sm mt-1">
          Who should we contact in case of emergency?
        </p>
      </div>

      <div>
        <label className={labelClass}>Contact Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={data.emergency_contact_name}
          onChange={e => onChange('emergency_contact_name', e.target.value)}
          placeholder="John Smith"
          className={inputClass}
        />
        {errors.emergency_contact_name && (
          <p className="text-red-400 text-xs mt-1">{errors.emergency_contact_name}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Contact Phone <span className="text-red-500">*</span></label>
        <input
          type="tel"
          value={data.emergency_contact_phone}
          onChange={e => onChange('emergency_contact_phone', e.target.value)}
          placeholder="(555) 123-4567"
          className={inputClass}
        />
        {errors.emergency_contact_phone && (
          <p className="text-red-400 text-xs mt-1">{errors.emergency_contact_phone}</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Relationship <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={data.emergency_contact_relationship}
          onChange={e => onChange('emergency_contact_relationship', e.target.value)}
          placeholder="Spouse, Parent, Sibling…"
          className={inputClass}
        />
        {errors.emergency_contact_relationship && (
          <p className="text-red-400 text-xs mt-1">
            {errors.emergency_contact_relationship}
          </p>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

interface StepHeadshotProps {
  headshot: File | null
  headshotPreview: string | null
  onFile: (file: File | null, preview: string | null) => void
  onNext: () => void
  onBack: () => void
}

function StepHeadshot({ headshot, headshotPreview, onFile, onNext, onBack }: StepHeadshotProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback(
    async (file: File) => {
      setError('')
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPG, PNG, etc.)')
        return
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`Image must be under ${MAX_FILE_MB} MB`)
        return
      }
      const preview = URL.createObjectURL(file)
      onFile(file, preview)
    },
    [onFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Headshot Photo</h2>
        <p className="text-gray-400 text-sm mt-1">
          Upload a professional photo for your profile. This helps the team recognize you in the field.
        </p>
      </div>

      {headshotPreview ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-red-600 shadow-xl">
            <img
              src={headshotPreview}
              alt="Headshot preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center">
            <p className="text-white font-medium text-sm">{headshot?.name}</p>
            <button
              onClick={() => {
                onFile(null, null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="text-gray-400 hover:text-red-400 text-xs mt-1 transition-colors"
            >
              Remove & choose different photo
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-red-500 bg-red-900/10'
              : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900/50'
          }`}
        >
          <div className="text-4xl mb-3">📷</div>
          <p className="text-white font-medium">Drag & drop your photo here</p>
          <p className="text-gray-500 text-sm mt-1">or tap to browse</p>
          <p className="text-gray-600 text-xs mt-3">JPG, PNG, WEBP — max {MAX_FILE_MB} MB</p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          {headshot ? 'Continue →' : "Skip for now →"}
        </button>
      </div>
    </div>
  )
}

interface StepCredentialsProps {
  credentials: CredentialEntry[]
  onChange: (creds: CredentialEntry[]) => void
  onNext: () => void
  onBack: () => void
}

function StepCredentials({ credentials, onChange, onNext, onBack }: StepCredentialsProps) {
  const [error, setError] = useState('')

  const addCred = () => {
    onChange([
      ...credentials,
      { id: uid(), certType: '', expiry: '', file: null },
    ])
  }

  const updateCred = (id: string, field: keyof CredentialEntry, value: any) => {
    onChange(credentials.map(c => (c.id === id ? { ...c, [field]: value } : c)))
  }

  const removeCred = (id: string) => {
    onChange(credentials.filter(c => c.id !== id))
  }

  const handleFileChange = (id: string, file: File | null) => {
    setError('')
    if (file && file.size > MAX_FILE_BYTES) {
      setError(`${file.name} exceeds ${MAX_FILE_MB} MB limit`)
      return
    }
    updateCred(id, 'file', file)
  }

  const handleNext = () => {
    // Validate any started credentials
    for (const cred of credentials) {
      if (cred.certType && !cred.file) {
        setError('Please attach a file for each credential you added, or remove it.')
        return
      }
      if (cred.file && !cred.certType) {
        setError('Please select a credential type for each uploaded file.')
        return
      }
    }
    setError('')
    onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Certifications & Credentials</h2>
        <p className="text-gray-400 text-sm mt-1">
          Upload copies of your licenses and certs. You can skip this and add them later from your profile.
        </p>
      </div>

      {credentials.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">No credentials added yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map(cred => (
            <CredentialRow
              key={cred.id}
              cred={cred}
              onUpdate={(field, value) => updateCred(cred.id, field, value)}
              onFileChange={file => handleFileChange(cred.id, file)}
              onRemove={() => removeCred(cred.id)}
            />
          ))}
        </div>
      )}

      <button
        onClick={addCred}
        className="w-full py-3 border border-dashed border-gray-600 hover:border-red-500 text-gray-400 hover:text-red-400 rounded-xl transition-colors text-sm font-medium"
      >
        + Add a credential
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          {credentials.some(c => c.file) ? 'Continue →' : "Skip for now →"}
        </button>
      </div>
    </div>
  )
}

function CredentialRow({
  cred,
  onUpdate,
  onFileChange,
  onRemove,
}: {
  cred: CredentialEntry
  onUpdate: (field: keyof CredentialEntry, value: any) => void
  onFileChange: (file: File | null) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-3 relative">
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
        aria-label="Remove credential"
      >
        ×
      </button>

      <div>
        <label className={labelClass}>Credential Type <span className="text-red-500">*</span></label>
        <select
          value={cred.certType}
          onChange={e => onUpdate('certType', e.target.value)}
          className={`${inputClass} appearance-none`}
        >
          <option value="">Select type…</option>
          {CERT_TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Expiry Date <span className="text-gray-500">(optional)</span></label>
        <input
          type="date"
          value={cred.expiry}
          onChange={e => onUpdate('expiry', e.target.value)}
          className={`${inputClass} [color-scheme:dark]`}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div>
        <label className={labelClass}>File <span className="text-red-500">*</span></label>
        {cred.file ? (
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-3">
            <span className="text-green-400 text-sm flex-1 truncate">✓ {cred.file.name}</span>
            <button
              onClick={() => {
                onFileChange(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="text-gray-500 hover:text-red-400 transition-colors text-sm"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-xl px-4 py-3 text-gray-400 text-sm transition-colors text-left"
          >
            📎 Tap to attach file (PDF, image, max {MAX_FILE_MB} MB)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0] || null
            onFileChange(file)
          }}
        />
      </div>
    </div>
  )
}

interface StepReviewProps {
  data: FormData
  onEdit: (step: number) => void
  onSubmit: () => void
  onBack: () => void
  submitting: boolean
  submitError: string
}

function StepReview({ data, onEdit, onSubmit, onBack, submitting, submitError }: StepReviewProps) {
  const rows = [
    { label: 'Full Name', value: data.name, step: 2 },
    { label: 'Role', value: data.role, step: 2 },
    { label: 'Personal Email', value: data.personal_email, step: 2 },
    { label: 'Phone', value: data.phone, step: 2 },
    { label: 'Date of Birth', value: data.date_of_birth, step: 2 },
    { label: 'Home Address', value: data.home_address || '—', step: 2 },
    { label: 'Emergency Contact', value: data.emergency_contact_name, step: 3 },
    { label: 'Emergency Phone', value: data.emergency_contact_phone, step: 3 },
    { label: 'Relationship', value: data.emergency_contact_relationship, step: 3 },
  ]

  const validCreds = data.credentials.filter(c => c.certType && c.file)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Review & Submit</h2>
        <p className="text-gray-400 text-sm mt-1">
          Please confirm your information before submitting.
        </p>
      </div>

      {/* Personal & Emergency */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        {rows.map(({ label, value, step }, idx) => (
          <div
            key={label}
            className={`flex items-start gap-3 px-4 py-3 ${
              idx < rows.length - 1 ? 'border-b border-gray-800' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs">{label}</p>
              <p className="text-white text-sm font-medium truncate">{value}</p>
            </div>
            <button
              onClick={() => onEdit(step)}
              className="text-red-500 hover:text-red-400 text-xs shrink-0 mt-0.5 transition-colors"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      {/* Headshot */}
      <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3">
        {data.headshotPreview ? (
          <>
            <img
              src={data.headshotPreview}
              alt="Headshot"
              className="w-10 h-10 rounded-full object-cover border-2 border-red-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-xs">Headshot</p>
              <p className="text-white text-sm font-medium truncate">{data.headshot?.name}</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-500">
              📷
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-xs">Headshot</p>
              <p className="text-gray-500 text-sm">Skipped — add later</p>
            </div>
          </>
        )}
        <button
          onClick={() => onEdit(4)}
          className="text-red-500 hover:text-red-400 text-xs shrink-0 transition-colors"
        >
          Edit
        </button>
      </div>

      {/* Credentials */}
      <div className="bg-gray-900 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-500 text-xs">Credentials</p>
          <button
            onClick={() => onEdit(5)}
            className="text-red-500 hover:text-red-400 text-xs transition-colors"
          >
            Edit
          </button>
        </div>
        {validCreds.length === 0 ? (
          <p className="text-gray-500 text-sm">Skipped — add later</p>
        ) : (
          <div className="space-y-1">
            {validCreds.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="text-green-400 text-xs">✓</span>
                <span className="text-white text-sm">
                  {c.certType}
                  {c.expiry && <span className="text-gray-500"> · exp {c.expiry}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {submitError && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
          {submitError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-[2] py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit Application'
          )}
        </button>
      </div>
    </div>
  )
}

function StepConfirmation({ email }: { email: string }) {
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-20 h-20 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-600">
          <span className="text-4xl">✓</span>
        </div>
        <h2 className="text-2xl font-bold text-white">You're all set!</h2>
        <p className="text-gray-400 text-sm mt-2">
          Your onboarding form has been submitted successfully.
        </p>
      </div>

      <div className="bg-gray-900 rounded-2xl p-5 text-left space-y-3">
        <h3 className="text-white font-semibold">What happens next?</h3>
        <ol className="space-y-2 text-sm text-gray-400">
          <li className="flex gap-2">
            <span className="text-red-500 font-bold shrink-0">1.</span>
            <span>
              Check your email at <strong className="text-white">{email}</strong> for your login
              credentials.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-500 font-bold shrink-0">2.</span>
            <span>
              An administrator will review your application and assign you to a unit.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-500 font-bold shrink-0">3.</span>
            <span>Log in and change your temporary password on first sign-in.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-red-500 font-bold shrink-0">4.</span>
            <span>
              You can upload credentials and add your headshot from your profile page anytime.
            </span>
          </li>
        </ol>
      </div>

      <Link
        to="/login"
        className="block w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
      >
        Go to Login →
      </Link>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

const initialData: FormData = {
  name: '',
  role: '',
  personal_email: '',
  phone: '',
  date_of_birth: '',
  home_address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  headshot: null,
  headshotPreview: null,
  credentials: [],
}

export default function OnboardPage() {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(initialData)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [confirmedEmail, setConfirmedEmail] = useState('')

  const setField = (field: string, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const goTo = (s: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setStep(s)
  }

  const next = () => goTo(step + 1)
  const back = () => goTo(step - 1)

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')

    try {
      // Step 1: Create employee + auth user
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          role: data.role,
          personal_email: data.personal_email.trim().toLowerCase(),
          phone: data.phone.trim(),
          date_of_birth: data.date_of_birth,
          home_address: data.home_address.trim() || undefined,
          emergency_contact_name: data.emergency_contact_name.trim(),
          emergency_contact_phone: data.emergency_contact_phone.trim(),
          emergency_contact_relationship: data.emergency_contact_relationship.trim(),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setSubmitError(
            'An account with this email already exists. Please contact your administrator.',
          )
        } else if (res.status === 429) {
          setSubmitError('Too many submissions. Please wait a while and try again.')
        } else {
          setSubmitError(json.error || 'Submission failed. Please try again.')
        }
        setSubmitting(false)
        return
      }

      const { employeeId, uploadToken } = json

      // Step 2: Upload headshot (if provided)
      if (data.headshot) {
        try {
          const fileBase64 = await fileToBase64(data.headshot)
          const uploadRes = await fetch('/api/onboard/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId,
              token: uploadToken,
              type: 'headshot',
              fileName: data.headshot.name,
              fileBase64,
            }),
          })
          if (!uploadRes.ok) {
            console.warn('[Onboard] Headshot upload failed (non-fatal):', await uploadRes.text())
          }
        } catch (uploadErr) {
          console.warn('[Onboard] Headshot upload error (non-fatal):', uploadErr)
        }
      }

      // Step 3: Upload credentials (sequentially)
      const validCreds = data.credentials.filter(c => c.certType && c.file)
      for (const cred of validCreds) {
        try {
          const fileBase64 = await fileToBase64(cred.file!)
          const uploadRes = await fetch('/api/onboard/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeId,
              token: uploadToken,
              type: 'credential',
              fileName: cred.file!.name,
              fileBase64,
              certType: cred.certType,
              expiry: cred.expiry || undefined,
            }),
          })
          if (!uploadRes.ok) {
            console.warn('[Onboard] Credential upload failed (non-fatal):', await uploadRes.text())
          }
        } catch (uploadErr) {
          console.warn('[Onboard] Credential upload error (non-fatal):', uploadErr)
        }
      }

      setConfirmedEmail(data.personal_email)
      goTo(7)
    } catch (err: any) {
      console.error('[Onboard] Submit error:', err)
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo on non-welcome steps */}
        {step > 1 && step < TOTAL_STEPS && (
          <div className="flex items-center gap-3 mb-6">
            <img
              src={LOGO_URL}
              alt={COMPANY}
              className="w-8 h-8 rounded-full object-contain bg-white p-0.5"
            />
            <span className="text-white font-semibold text-sm">{APP_TITLE}</span>
          </div>
        )}

        {/* Progress indicator */}
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Steps */}
        <div className="bg-gray-900 rounded-3xl p-6 shadow-2xl">
          {step === 1 && <StepWelcome onNext={next} />}
          {step === 2 && (
            <StepPersonalInfo
              data={data}
              onChange={setField}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 3 && (
            <StepEmergencyContact
              data={data}
              onChange={setField}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 4 && (
            <StepHeadshot
              headshot={data.headshot}
              headshotPreview={data.headshotPreview}
              onFile={(file, preview) =>
                setData(prev => ({ ...prev, headshot: file, headshotPreview: preview }))
              }
              onNext={next}
              onBack={back}
            />
          )}
          {step === 5 && (
            <StepCredentials
              credentials={data.credentials}
              onChange={creds => setData(prev => ({ ...prev, credentials: creds }))}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 6 && (
            <StepReview
              data={data}
              onEdit={goTo}
              onSubmit={handleSubmit}
              onBack={back}
              submitting={submitting}
              submitError={submitError}
            />
          )}
          {step === 7 && <StepConfirmation email={confirmedEmail} />}
        </div>

        {/* Already have an account? */}
        {step < 7 && (
          <p className="text-center text-xs text-gray-600 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-gray-400 hover:text-white transition-colors">
              Sign in →
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
