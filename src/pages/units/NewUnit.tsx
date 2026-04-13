

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'

const UNIT_TYPES = ['Ambulance', 'Med Unit', 'REMS']
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export default function NewUnitPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    unitType: '',
    make: '',
    model: '',
    year: '',
    vin: '',
    license_plate: '',
    plate_state: 'MT',
    // REMS cluster
    isRemsCluster: false,
    truck_name: '',
    trailer_name: '',
    utv_name: '',
  })

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { setError('Unit name is required'); return }
    if (!form.unitType) { setError('Unit type is required'); return }
    setSubmitting(true); setError('')

    try {
      // Get unit type ID
      const { data: typeData } = await supabase
        .from('unit_types').select('id').eq('name', form.unitType).single()
      const unit_type_id = typeData?.id

      // Create the main unit
      const { data: newUnit, error: err } = await supabase.from('units').insert({
        name: form.name,
        unit_type_id,
        make: form.make || null,
        model: form.model || null,
        year: form.year ? parseInt(form.year) : null,
        vin: form.vin || null,
        license_plate: form.license_plate || null,
        plate_state: form.plate_state || null,
        active: true,
      }).select().single()
      if (err) throw err

      // If REMS cluster, create child units
      if (form.unitType === 'REMS' && form.isRemsCluster) {
        const children = [
          { name: form.truck_name || `${form.name} Truck`, subtype: 'Truck' },
          { name: form.trailer_name || `${form.name} Trailer`, subtype: 'Trailer' },
          { name: form.utv_name || `${form.name} UTV`, subtype: 'UTV' },
        ]
        for (const child of children) {
          if (child.name) {
            await supabase.from('units').insert({
              name: child.name,
              unit_type_id,
              vehicle_subtype: child.subtype,
              parent_unit_id: newUnit.id,
              active: true,
            })
          }
        }
      }

      // Auto-populate formulary template at quantity 0
      // (will be filled in when unit is deployed to an incident)
      // Formulary seeding happens at incident assignment time

      navigate('/units')
    } catch (err: any) {
      setError(err.message || 'Failed to create unit')
      setSubmitting(false)
    }
  }

  const inputClass = "w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
  const labelClass = "text-xs text-gray-400"

  return (
    <div className="p-6 md:p-8 max-w-lg">
      <div className="mt-8 md:mt-0 mb-6">
        <h1 className="text-2xl font-bold">Add New Unit</h1>
        <p className="text-gray-400 text-sm mt-1">Formulary will auto-populate based on unit type when deployed to an incident.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Basic info */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-4 border border-gray-800">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Unit Info</h2>
          <div>
            <label className={labelClass}>Unit Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. GRANITE 3, MSU 2" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Unit Type *</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {UNIT_TYPES.map(t => (
                <button key={t} type="button" onClick={() => set('unitType', t)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    form.unitType === t ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Vehicle details */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-4 border border-gray-800">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Vehicle Details</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className={labelClass}>Year</label>
              <input type="number" value={form.year} onChange={e => set('year', e.target.value)}
                placeholder="2024" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Make</label>
              <input value={form.make} onChange={e => set('make', e.target.value)}
                placeholder="Ford, Dodge, Cargo Craft..." className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Model</label>
            <input value={form.model} onChange={e => set('model', e.target.value)}
              placeholder="F350, Ram 3500, MRZR D4..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>VIN</label>
            <input value={form.vin} onChange={e => set('vin', e.target.value.toUpperCase())}
              placeholder="17-character VIN" maxLength={17} className={inputClass + " font-mono tracking-wide"} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>License Plate</label>
              <input value={form.license_plate} onChange={e => set('license_plate', e.target.value.toUpperCase())}
                className={inputClass + " font-mono"} />
            </div>
            <div className="col-span-1">
              <label className={labelClass}>State</label>
              <select value={form.plate_state} onChange={e => set('plate_state', e.target.value)} className={inputClass}>
                {US_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* REMS cluster */}
        {form.unitType === 'REMS' && (
          <div className="bg-gray-900 rounded-xl p-4 space-y-4 border border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">REMS Cluster</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isRemsCluster}
                  onChange={e => set('isRemsCluster', e.target.checked)}
                  className="w-4 h-4 accent-red-500" />
                <span className="text-sm text-gray-400">Link truck + trailer + UTV</span>
              </label>
            </div>
            {form.isRemsCluster && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Name each component vehicle (leave blank to auto-name)</p>
                {[
                  { key: 'truck_name', label: '🚛 Truck name', placeholder: `${form.name} Truck` },
                  { key: 'trailer_name', label: '📦 Trailer name', placeholder: `${form.name} Trailer` },
                  { key: 'utv_name', label: '🏎️ UTV name', placeholder: `${form.name} UTV` },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    <input value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                      placeholder={placeholder} className={inputClass} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl transition-colors">
          {submitting ? 'Adding...' : 'Add Unit'}
        </button>
      </form>

      <Link to="/units" className="block text-center text-gray-600 text-sm mt-4">← Cancel</Link>
    </div>
  )
}
