import { type ChangeEvent } from 'react'
import type { FormState } from './AMAFormTypes'
import { UNITS } from './AMAConstants'

interface Props {
  form: FormState
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

export function AMAPatientInfoSection({ form, onChange }: Props) {
  return (
    <section className="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 className="font-bold text-sm uppercase tracking-wide text-gray-300">Patient Information</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400">First Name *</label>
          <input name="patient_first_name" value={form.patient_first_name} onChange={onChange}
            className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Last Name *</label>
          <input name="patient_last_name" value={form.patient_last_name} onChange={onChange}
            className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400">Date of Birth</label>
          <input name="dob" type="date" value={form.dob} onChange={onChange}
            className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Unit</label>
          <select name="unit" value={form.unit} onChange={onChange}
            className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Select...</option>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400">Incident</label>
        <input name="incident" value={form.incident} onChange={onChange}
          className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
      </div>
    </section>
  )
}
