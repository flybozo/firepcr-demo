

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'

const UNIT_NAMES = ['GRANITE 1', 'GRANITE 2', 'GRANITE MSU', 'GRANITE REMS']

export default function NewIncidentPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    location: '',
    incident_number: '',
    agreement_number: '',
    resource_order_number: '',
    financial_code: '',
    finance_contact_name: '',
    finance_contact_email: '',
    finance_contact_phone: '',
    start_date: new Date().toISOString().split('T')[0],
  })
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggleUnit = (unit: string) => {
    setSelectedUnits(prev =>
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { setError('Incident name is required'); return }
    if (selectedUnits.length === 0) { setError('Select at least one unit'); return }

    setSubmitting(true)
    setError('')

    try {
      if (!navigator.onLine) {
        const { queueOfflineWrite } = await import('@/lib/offlineStore')
        await queueOfflineWrite('incidents', 'insert', { id: crypto.randomUUID(), ...form, status: 'Active' })
        alert('Incident saved offline — will sync when back online.')
        navigate('/incidents')
        return
      }
      // Create incident
      const { data: incident, error: incErr } = await supabase
        .from('incidents')
        .insert({ ...form, status: 'Active' })
        .select()
        .single()
      if (incErr) throw incErr

      // Get unit IDs for selected names
      const { data: units } = await supabase
        .from('units')
        .select('id, name')
        .in('name', selectedUnits)

      // Assign units to incident
      if (units && units.length > 0) {
        await supabase.from('incident_units').insert(
          units.map(u => ({ incident_id: incident.id, unit_id: u.id }))
        )
      }

      // Upload contract file if provided
      if (contractFile) {
        const path = `contracts/${incident.id}/${contractFile.name}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(path, contractFile, { upsert: true })
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(uploadData.path)
          await supabase.from('incidents').update({
            contract_url: urlData.publicUrl,
            contract_file_name: contractFile.name,
          }).eq('id', incident.id)
        }
      }

      navigate(`/incidents/${incident.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create incident')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="pt-4">
          <h1 className="text-2xl font-bold">New Incident</h1>
          <p className="text-gray-400 text-sm">Create incident and assign units</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-gray-900 rounded-xl p-4 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Incident Details</h2>

            <div>
              <label className="text-xs text-gray-400">Incident Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Mosquito Fire 2026"
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <div>
              <label className="text-xs text-gray-400">Location</label>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Shasta County, CA"
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Incident Number</label>
                <input value={form.incident_number} onChange={e => setForm(p => ({ ...p, incident_number: e.target.value }))}
                  placeholder="e.g. CA-SHU-123456"
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Finance & Contract</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Agreement Number</label>
                <input value={form.agreement_number} onChange={e => setForm(p => ({ ...p, agreement_number: e.target.value }))}
                  placeholder="e.g. AG-2026-001"
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Resource Order Number</label>
                <input value={form.resource_order_number} onChange={e => setForm(p => ({ ...p, resource_order_number: e.target.value }))}
                  placeholder="e.g. RO-2026-001"
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400">Financial Code</label>
              <input value={form.financial_code} onChange={e => setForm(p => ({ ...p, financial_code: e.target.value }))}
                placeholder="e.g. FC-2026"
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 pt-1">Finance Contact (OF-297 Recipient)</p>
            <div>
              <label className="text-xs text-gray-400">Finance Contact Name</label>
              <input value={form.finance_contact_name} onChange={e => setForm(p => ({ ...p, finance_contact_name: e.target.value }))}
                placeholder="e.g. Jane Smith"
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Finance Contact Email</label>
                <input type="email" value={form.finance_contact_email} onChange={e => setForm(p => ({ ...p, finance_contact_email: e.target.value }))}
                  placeholder="jane@agency.gov"
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Finance Contact Phone</label>
                <input type="tel" value={form.finance_contact_phone} onChange={e => setForm(p => ({ ...p, finance_contact_phone: e.target.value }))}
                  placeholder="555-867-5309"
                  className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 space-y-4">
            <div>
              <label className="text-xs text-gray-400">Contract Document (optional, admin only)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => setContractFile(e.target.files?.[0] || null)}
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300"
              />
              {contractFile && (
                <p className="text-xs text-gray-500 mt-1">Selected: {contractFile.name}</p>
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Assign Units *</h2>
            <div className="grid grid-cols-3 gap-2">
              {UNIT_NAMES.map(unit => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => toggleUnit(unit)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedUnits.includes(unit)
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors">
            {submitting ? 'Creating...' : 'Create Incident'}
          </button>
        </form>

        <Link to="/incidents" className="block text-center text-gray-600 text-sm">← Cancel</Link>
      </div>
    </div>
  )
}
