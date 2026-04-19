
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { createIncident } from '@/lib/services/incidents'

type UnitOption = { id: string; name: string }
type ConflictInfo = { unitName: string; incidentName: string; employeeCount: number }

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
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Conflict dialog state
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  // Load units from DB (active, non-storage only)
  useEffect(() => {
    supabase
      .from('units')
      .select('id, name')
      .eq('active', true)
      .eq('is_storage', false)
      .order('name')
      .then(({ data }) => setAvailableUnits(data || []))
  }, [])

  const toggleUnit = (unit: string) => {
    setSelectedUnits(prev =>
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    )
  }

  // Check if any selected units are already assigned to an active incident
  const checkConflicts = async (): Promise<ConflictInfo[]> => {
    const { data: units } = await supabase
      .from('units')
      .select('id, name')
      .in('name', selectedUnits)

    if (!units?.length) return []

    const unitIds = units.map(u => u.id)

    // Find active incident_units for these units (not released)
    const { data: activeIUs } = await supabase
      .from('incident_units')
      .select(`
        id,
        unit:units(name),
        incident:incidents(id, name, status),
        unit_assignments(id, released_at)
      `)
      .in('unit_id', unitIds)
      .is('released_at', null)

    const found: ConflictInfo[] = []
    for (const iu of (activeIUs || [])) {
      const incident = (iu as any).incident
      if (!incident || incident.status !== 'Active') continue
      const unitName = (iu as any).unit?.name || 'Unknown'
      const activeAssignments = ((iu as any).unit_assignments || []).filter((a: any) => !a.released_at)
      found.push({
        unitName,
        incidentName: incident.name,
        employeeCount: activeAssignments.length,
      })
    }
    return found
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) { setError('Incident name is required'); return }
    if (selectedUnits.length === 0) { setError('Select at least one unit'); return }

    setError('')

    // Check for conflicts before submitting
    if (!pendingSubmit) {
      setSubmitting(true)
      const found = await checkConflicts()
      setSubmitting(false)
      if (found.length > 0) {
        setConflicts(found)
        setShowConflictDialog(true)
        return
      }
    }

    await doSubmit()
  }

  const doSubmit = async () => {
    setSubmitting(true)
    setError('')
    setShowConflictDialog(false)
    setPendingSubmit(false)

    try {
      if (!navigator.onLine) {
        const { queueOfflineWrite } = await import('@/lib/offlineStore')
        await queueOfflineWrite('incidents', 'insert', { id: crypto.randomUUID(), ...form, status: 'Active' })
        alert('Incident saved offline — will sync when back online.')
        navigate('/incidents')
        return
      }

      // Create incident
      const { data: incident, error: incErr } = await createIncident(form)
      if (incErr || !incident) throw incErr || new Error('Failed to create incident')

      // Get unit IDs for selected names
      const { data: units } = await supabase
        .from('units')
        .select('id, name')
        .in('name', selectedUnits)

      if (units && units.length > 0) {
        const unitIds = units.map(u => u.id)

        // Release any existing active assignments for these units
        const { data: existingIUs } = await supabase
          .from('incident_units')
          .select('id')
          .in('unit_id', unitIds)
          .is('released_at', null)

        if (existingIUs && existingIUs.length > 0) {
          const existingIUIds = existingIUs.map(iu => iu.id)

          // Release all employee assignments under those incident_units
          await supabase
            .from('unit_assignments')
            .update({ released_at: new Date().toISOString() })
            .in('incident_unit_id', existingIUIds)
            .is('released_at', null)

          // Release the incident_units themselves
          await supabase
            .from('incident_units')
            .update({ released_at: new Date().toISOString() })
            .in('id', existingIUIds)
        }

        // Assign units to new incident
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
          await supabase.from('incidents').update({
            contract_url: uploadData.path,
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

  const inputClass = 'w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
  const labelClass = 'text-xs text-gray-400'

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="pt-4">
          <h1 className="text-2xl font-bold">New Incident</h1>
          <p className="text-gray-400 text-sm">Create incident and assign units</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Incident Details */}
          <div className="bg-gray-900 rounded-xl p-4 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Incident Details</h2>
            <div>
              <label className={labelClass}>Incident Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Mosquito Fire 2026" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Shasta County, CA" className={inputClass} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Incident Number</label>
                <input value={form.incident_number} onChange={e => setForm(p => ({ ...p, incident_number: e.target.value }))}
                  placeholder="e.g. CA-SHU-123456" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className={inputClass} />
              </div>
            </div>
          </div>

          {/* Finance & Contract */}
          <div className="bg-gray-900 rounded-xl p-4 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Finance & Contract</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Agreement Number</label>
                <input value={form.agreement_number} onChange={e => setForm(p => ({ ...p, agreement_number: e.target.value }))}
                  placeholder="e.g. AG-2026-001" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Resource Order Number</label>
                <input value={form.resource_order_number} onChange={e => setForm(p => ({ ...p, resource_order_number: e.target.value }))}
                  placeholder="e.g. RO-2026-001" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Financial Code</label>
              <input value={form.financial_code} onChange={e => setForm(p => ({ ...p, financial_code: e.target.value }))}
                placeholder="e.g. FC-2026" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contract Document (optional)</label>
              <input type="file" accept=".pdf,.doc,.docx"
                onChange={e => setContractFile(e.target.files?.[0] || null)}
                className="w-full mt-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-700 file:text-gray-300" />
              {contractFile && <p className="text-xs text-gray-500 mt-1">Selected: {contractFile.name}</p>}
            </div>
          </div>

          {/* Assign Units */}
          <div className="bg-gray-900 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-400">Assign Units *</h2>
            {availableUnits.length === 0 ? (
              <p className="text-gray-500 text-sm">Loading units…</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableUnits.map(unit => (
                  <button key={unit.id} type="button" onClick={() => toggleUnit(unit.name)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      selectedUnits.includes(unit.name)
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    {unit.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold rounded-xl text-lg transition-colors">
            {submitting ? 'Checking…' : 'Create Incident'}
          </button>
        </form>

        <Link to="/incidents" className="block text-center text-gray-600 text-sm">← Cancel</Link>
      </div>

      {/* Conflict confirmation dialog */}
      {showConflictDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-600/50 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-bold text-white">Units Already Deployed</h3>
                <p className="text-gray-400 text-sm mt-1">The following units are currently assigned to active incidents:</p>
              </div>
            </div>
            <ul className="space-y-2">
              {conflicts.map((c, i) => (
                <li key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-sm">
                  <span className="font-semibold text-white">{c.unitName}</span>
                  <span className="text-gray-400"> → {c.incidentName}</span>
                  {c.employeeCount > 0 && (
                    <span className="text-yellow-400 text-xs block mt-0.5">
                      {c.employeeCount} employee{c.employeeCount !== 1 ? 's' : ''} will be released
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-gray-300 text-sm">
              Reassigning these units will <span className="text-yellow-300 font-semibold">end their current deployments</span> and release all assigned employees. Continue?
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowConflictDialog(false); setPendingSubmit(false) }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-medium transition-colors">
                Cancel
              </button>
              <button onClick={() => { setPendingSubmit(true); doSubmit() }}
                className="flex-1 py-2.5 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-sm font-bold transition-colors">
                Reassign & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
