
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import FormField, { inputCls, selectCls } from '@/components/ui/FormField'
import PageHeader from '@/components/ui/PageHeader'

const CLINICAL_ROLES = ['EMT', 'Paramedic', 'RN', 'NP', 'PA', 'MD', 'DO', 'Tech'] as const

function rbacRoleName(role: string): string {
  if (role === 'MD' || role === 'DO') return 'medical_director'
  return 'field_medic'
}

function generatePassword(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = (parts[0]?.[0] ?? 'X').toUpperCase()
  const last = (parts[parts.length - 1]?.[0] ?? 'X').toUpperCase()
  return `${first}${last}EMS2026!`
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${value ? 'bg-red-600' : 'bg-gray-700'}`}
    >
      <span className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function StepPills({ current }: { current: number }) {
  const labels = ['Basic Info', 'Employment', 'Create Account']
  return (
    <div className="flex items-center gap-2 mb-6">
      {labels.map((label, i) => {
        const n = i + 1
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              current === n ? 'bg-red-600 text-white' : current > n ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-500'
            }`}>{n}</div>
            {n < 3 && <div className={`w-6 h-0.5 ${current > n ? 'bg-red-800' : 'bg-gray-800'}`} />}
          </div>
        )
      })}
      <span className="ml-1 text-xs text-gray-500">{labels[current - 1]}</span>
    </div>
  )
}

export default function NewEmployeePage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    app_role: 'field',
    daily_rate: '',
    experience_level: '2',
    rems_capable: false,
    is_medical_director: false,
    admin_notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))
  const tempPassword = form.name.trim() ? generatePassword(form.name) : ''

  function validateStep1(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.role) e.role = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const { data: emp, error: empErr } = await supabase
        .from('employees')
        .insert({
          name: form.name.trim(),
          role: form.role,
          roles: [form.role],
          personal_email: form.email.trim(),
          phone: form.phone.trim() || null,
          emergency_contact_name: form.emergency_contact_name.trim() || null,
          emergency_contact_phone: form.emergency_contact_phone.trim() || null,
          emergency_contact_relationship: form.emergency_contact_relationship || null,
          app_role: form.app_role === 'admin' ? 'admin' : 'field',
          daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : null,
          experience_level: parseInt(form.experience_level) || 2,
          rems_capable: form.rems_capable,
          is_medical_director: form.is_medical_director,
          admin_notes: form.admin_notes.trim() || null,
          status: 'Active',
          wf_email: null,
        })
        .select('id')
        .single()
      if (empErr) throw empErr

      const employeeId = emp.id

      const provRes = await fetch('/api/admin/provision-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provision-secret': 'ram-provision-2026',
        },
        body: JSON.stringify({
          email: form.email.trim(),
          name: form.name.trim(),
          password: tempPassword,
          employee_id: employeeId,
        }),
      })
      if (!provRes.ok) {
        const body = await provRes.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to provision auth account')
      }

      const rbacNames = [rbacRoleName(form.role)]
      if (form.app_role === 'admin') rbacNames.push('super_admin')

      const { data: roleRows } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', rbacNames)

      if (roleRows && roleRows.length > 0) {
        await supabase.from('employee_roles').insert(
          roleRows.map((r: { id: string }) => ({ employee_id: employeeId, role_id: r.id }))
        )
      }

      setCreatedId(employeeId)
      toast.success(`${form.name} added to roster`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create employee'
      toast.error(msg)
      setSubmitting(false)
    }
  }

  if (createdId) {
    return (
      <div className="p-6 md:p-8 max-w-lg mt-8 md:mt-0">
        <PageHeader title="Employee Created" backHref="/roster" backLabel="← Roster" />
        <div className="mt-6 bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center text-green-300 text-lg font-bold">
              ✓
            </div>
            <div>
              <div className="font-semibold text-white">{form.name}</div>
              <div className="text-xs text-gray-400">{form.role} · {form.app_role === 'admin' ? 'Admin' : 'Field'}</div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Login Credentials</p>
            <div className="bg-gray-900 rounded-lg px-4 py-3 space-y-1 font-mono text-sm">
              <div><span className="text-gray-500">Email:    </span><span className="text-white">{form.email}</span></div>
              <div><span className="text-gray-500">Password: </span><span className="text-yellow-300">{tempPassword}</span></div>
            </div>
            <p className="text-xs text-gray-600">Share these credentials with the employee — they can update their password after first login.</p>
          </div>
          <button
            onClick={() => navigate(`/roster/${createdId}`)}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors text-sm"
          >
            View Profile →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-lg mt-8 md:mt-0">
      <PageHeader
        title="Add Employee"
        subtitle="Create a new employee record and login"
        backHref="/roster"
        backLabel="← Roster"
      />
      <div className="mt-6">
        <StepPills current={step} />

        {step === 1 && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Basic Info</p>
            <FormField label="Full Name" required error={errors.name}>
              <input
                className={inputCls}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Jane Smith"
                autoFocus
              />
            </FormField>
            <FormField label="Role" required error={errors.role}>
              <select className={selectCls} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="">Select role…</option>
                {CLINICAL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Personal Email" required error={errors.email} hint="Used for app login">
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="employee@example.com"
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="tel"
                className={inputCls}
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="(555) 555-5555"
              />
            </FormField>
            <div className="border-t border-gray-700 pt-4 mt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Emergency Contact</p>
              <div className="space-y-3">
                <FormField label="Contact Name">
                  <input
                    className={inputCls}
                    value={form.emergency_contact_name}
                    onChange={e => set('emergency_contact_name', e.target.value)}
                    placeholder="e.g. Jane Doe"
                  />
                </FormField>
                <FormField label="Contact Phone">
                  <input
                    type="tel"
                    className={inputCls}
                    value={form.emergency_contact_phone}
                    onChange={e => set('emergency_contact_phone', e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </FormField>
                <FormField label="Relationship">
                  <select className={selectCls} value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Partner">Partner</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child</option>
                    <option value="Friend">Friend</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { if (validateStep1()) setStep(2) }}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors text-sm"
            >
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Employment Settings</p>
            <FormField label="App Role" hint="Admin users can access management features">
              <select className={selectCls} value={form.app_role} onChange={e => set('app_role', e.target.value)}>
                <option value="field">Field</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            <FormField label="Daily Rate" hint="Used for payroll calculations (optional)">
              <input
                type="number"
                className={inputCls}
                value={form.daily_rate}
                onChange={e => set('daily_rate', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </FormField>
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-sm text-white">REMS Capable</span>
                <p className="text-xs text-gray-500">Qualified to operate REMS</p>
              </div>
              <Toggle value={form.rems_capable} onChange={v => set('rems_capable', v)} />
            </div>
            <FormField label="Experience Level" hint="Used for crew scheduling and team composition">
              <select className={selectCls} value={form.experience_level} onChange={e => set('experience_level', e.target.value)}>
                <option value="1">⭐ Junior</option>
                <option value="2">⭐⭐ Mid</option>
                <option value="3">⭐⭐⭐ Senior</option>
              </select>
            </FormField>
            {(form.role === 'MD' || form.role === 'DO') && (
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-sm text-white">Is Medical Director</span>
                  <p className="text-xs text-gray-500">Grants medical oversight permissions</p>
                </div>
                <Toggle value={form.is_medical_director} onChange={v => set('is_medical_director', v)} />
              </div>
            )}
            <FormField label="Admin Notes" hint="Internal notes — only visible to admins">
              <textarea
                className={inputCls}
                value={form.admin_notes}
                onChange={e => set('admin_notes', e.target.value)}
                placeholder="Optional internal notes…"
                rows={3}
              />
            </FormField>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-xl transition-colors text-sm">
                ← Back
              </button>
              <button type="button" onClick={() => setStep(3)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors text-sm">
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Create Account</p>
            <div className="bg-gray-900 rounded-lg px-4 py-3 space-y-1.5 text-sm">
              <div><span className="text-gray-500">Name: </span><span className="text-white">{form.name}</span></div>
              <div><span className="text-gray-500">Role: </span><span className="text-white">{form.role}</span></div>
              <div><span className="text-gray-500">Email: </span><span className="text-white">{form.email}</span></div>
              <div><span className="text-gray-500">App Role: </span><span className="text-white capitalize">{form.app_role}</span></div>
              <div><span className="text-gray-500">Experience: </span><span className="text-white">{form.experience_level === '1' ? '⭐ Junior' : form.experience_level === '3' ? '⭐⭐⭐ Senior' : '⭐⭐ Mid'}</span></div>
              {form.daily_rate && <div><span className="text-gray-500">Daily Rate: </span><span className="text-white">${form.daily_rate}</span></div>}
              {form.emergency_contact_name && <div><span className="text-gray-500">Emergency: </span><span className="text-white">{form.emergency_contact_name}{form.emergency_contact_relationship ? ` (${form.emergency_contact_relationship})` : ''}{form.emergency_contact_phone ? ` — ${form.emergency_contact_phone}` : ''}</span></div>}
              {form.admin_notes.trim() && <div><span className="text-gray-500">Admin Notes: </span><span className="text-white">{form.admin_notes.trim()}</span></div>}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2">Temporary Password</p>
              <div className="bg-gray-900 rounded-lg px-4 py-3 font-mono text-yellow-300 tracking-wider text-sm">
                {tempPassword}
              </div>
              <p className="text-xs text-gray-600 mt-1">Auto-generated from name initials. Share with employee after creation.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(2)} disabled={submitting}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 font-bold rounded-xl transition-colors text-sm">
                ← Back
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors text-sm">
                {submitting ? 'Creating…' : 'Create Employee'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
