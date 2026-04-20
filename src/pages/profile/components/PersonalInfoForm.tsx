const inputCls = 'w-full max-w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 box-border'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

interface FormValues {
  name: string
  date_of_birth: string
  phone: string
  personal_email: string
  personal_phone: string
  home_address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
}

interface Props {
  form: FormValues
  set: (k: string, v: string) => void
}

export function PersonalInfoForm({ form, set }: Props) {
  return (
    <>
      {/* Name & DOB */}
      <div className="theme-card rounded-xl p-4 border mb-4 space-y-4">
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
      <div className="theme-card rounded-xl p-4 border mb-4 space-y-4">
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
      <div className="theme-card rounded-xl p-4 border mb-4 space-y-4">
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
    </>
  )
}
