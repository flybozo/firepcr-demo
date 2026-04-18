

import { useEffect, useState } from 'react'
import { useRole } from '@/lib/useRole'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useParams } from 'react-router-dom'

type Employee = { id: string; name: string; role: string }
type Assignment = { id: string; role_on_unit: string; employee: Employee | null }
type IncidentUnit = {
  id: string
  incident: { id: string; name: string; status: string } | null
  unit_assignments: Assignment[]
  released_at?: string | null
}
type Unit = {
  id: string
  name: string
  active: boolean
  unit_status: string | null
  vin: string | null
  license_plate: string | null
  plate_state: string | null
  make: string | null
  model: string | null
  year: number | null
  photo_url: string | null
  vehicle_subtype: string | null
  unit_type: { name: string } | null
  incident_units: IncidentUnit[]
}
type ChildUnit = {
  id: string
  name: string
  vin: string | null
  license_plate: string | null
  plate_state: string | null
  vehicle_subtype: string | null
}
type InventoryItem = {
  id: string
  item_name: string
  category: string
  quantity: number
  par_qty: number
}

const TYPE_COLORS: Record<string, string> = {
  'Ambulance': 'bg-red-900 text-red-300',
  'Med Unit': 'bg-blue-900 text-blue-300',
  'REMS': 'bg-green-900 text-green-300',
}

export default function UnitDetailPage() {
  const supabase = createClient()
  const { isAdmin } = useRole()
  const params = useParams()
  const id = params.id as string

  const [unit, setUnit] = useState<Unit | null>(null)
  const [childUnits, setChildUnits] = useState<ChildUnit[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)

  // Add crew state
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [saving, setSaving] = useState(false)

  // Vehicle edit state
  const [editingVehicle, setEditingVehicle] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({
    make: '', model: '', year: '', vin: '', license_plate: '', plate_state: '', photo_url: ''
  })
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [vehicleDocUrls, setVehicleDocUrls] = useState<Record<string, string>>({})
  const [vehicleDocs, setVehicleDocs] = useState<{id: string, doc_type: string, file_url: string, file_name: string|null, expiration_date: string|null, notes: string|null}[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docType, setDocType] = useState('Registration')

  const load = async () => {
    // Show cached data instantly
    try {
      const { getCachedById } = await import('@/lib/offlineStore')
      const cached = await getCachedById('units', id) as any
      if (cached) {
        setUnit(cached as Unit)
        setLoading(false)
      }
    } catch {}
    const { data: unitData, offline } = await loadSingle<Unit>(
      () => supabase
        .from('units')
        .select(`
          id, name, active, unit_status,
          vin, license_plate, plate_state, make, model, year, photo_url, vehicle_subtype,
          unit_type:unit_types(name),
          incident_units!inner(
            id, released_at,
            incident:incidents(id, name, status),
            unit_assignments(
              id, role_on_unit, released_at,
              employee:employees(id, name, role)
            )
          )
        `)
        .eq('id', id)
        .single() as any,
      'units',
      id
    )
    if (offline || !unitData) {
      if (unitData) setIsOfflineData(true)
      setUnit(unitData as unknown as Unit)
      setLoading(false)
      return
    }
    let emps: any[] | null = null
    let children: any[] | null = null
    try {
    const [{ data: _emps }, { data: _children }] = await Promise.all([
      supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name'),
      supabase
        .from('units')
        .select('id, name, vin, license_plate, plate_state, vehicle_subtype')
        .eq('parent_unit_id', id),
    ])
    emps = _emps; children = _children
    } catch (_offlineErr) {
      // Best-effort
    }

    const u = unitData as unknown as Unit
    setUnit(u)
    setAllEmployees((emps || []) as Employee[])
    setChildUnits((children || []) as ChildUnit[])

    // Load vehicle documents
    const { data: docsData } = await supabase
      .from('vehicle_documents')
      .select('id, doc_type, file_url, file_name, expiration_date, notes')
      .eq('unit_id', id)
      .order('uploaded_at', { ascending: false })
    setVehicleDocs(docsData || [])
    // Generate signed URLs for private documents bucket
    if (docsData && docsData.length > 0) {
      const urlMap: Record<string, string> = {}
      await Promise.all((docsData as any[]).map(async (doc: any) => {
        if (!doc.file_url) return
        if (doc.file_url.startsWith('http')) { urlMap[doc.id] = doc.file_url; return }
        // Legacy docs are in 'vehicle-docs' bucket; newer ones in 'documents' bucket
        const bucket = doc.file_url.startsWith('vehicle-docs/') ? 'vehicle-docs' : 'documents'
        const storagePath = doc.file_url.startsWith('vehicle-docs/')
          ? doc.file_url.replace(/^vehicle-docs\//, '')
          : doc.file_url
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600)
        if (signed?.signedUrl) urlMap[doc.id] = signed.signedUrl
      }))
      setVehicleDocUrls(urlMap)
    }

    if (u) {
      setVehicleForm({
        make: u.make || '',
        model: u.model || '',
        year: u.year?.toString() || '',
        vin: u.vin || '',
        license_plate: u.license_plate || '',
        plate_state: u.plate_state || '',
        photo_url: u.photo_url || '',
      })
    }

    // Load inventory for active incident_unit
    if (u) {
      const activeIU = u.incident_units?.find(iu => iu.incident?.status === 'Active' && !iu.released_at)
      if (activeIU) {
        const { data: inv } = await supabase
          .from('unit_inventory')
          .select('id, item_name, category, quantity, par_qty')
          .eq('incident_unit_id', activeIU.id)
          .in('category', ['CS', 'Rx'])
          .order('category')
          .order('item_name')
          .limit(10)
        setInventory(inv || [])
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const addCrewMember = async () => {
    if (!addingTo || !selectedEmployee) return
    setSaving(true)

    // Check if employee is already assigned to another unit (active assignment)
    const { data: existing } = await supabase
      .from('unit_assignments')
      .select('id, incident_unit_id, incident_unit:incident_units(unit:units(name))')
      .eq('employee_id', selectedEmployee)
      .is('released_at', null)
      .limit(1)

    const conflict = existing?.[0]
    if (conflict && conflict.incident_unit_id !== addingTo) {
      const otherUnitName = (conflict.incident_unit as any)?.unit?.name || 'another unit'
      const emp = allEmployees.find(e => e.id === selectedEmployee)
      const confirmed = window.confirm(
        `${emp?.name || 'This employee'} is currently assigned to ${otherUnitName}. ` +
        `Remove them from ${otherUnitName} and assign to this unit instead?`
      )
      if (!confirmed) {
        setSaving(false)
        return
      }
      // Release from old unit
      await supabase
        .from('unit_assignments')
        .update({ released_at: new Date().toISOString() })
        .eq('id', conflict.id)
    }

    // Also release any other active assignments for this employee (catch duplicates)
    await supabase
      .from('unit_assignments')
      .update({ released_at: new Date().toISOString() })
      .eq('employee_id', selectedEmployee)
      .is('released_at', null)
      .neq('incident_unit_id', addingTo)

    // Assign to new unit
    await supabase.from('unit_assignments').insert({
      incident_unit_id: addingTo,
      employee_id: selectedEmployee,
      role_on_unit: selectedRole || '',
    })
    setAddingTo(null)
    setSelectedEmployee('')
    setSelectedRole('')
    setSaving(false)
    load()
  }

  const removeCrewMember = async (assignmentId: string) => {
    await supabase.from('unit_assignments').delete().eq('id', assignmentId)
    load()
  }

  const setUnitStatus = async (next: string) => {
    if (!unit || !isAdmin) return
    const current = unit.unit_status || 'in_service'
    if (next === current) return
    const isLeavingService = next === 'out_of_service' || next === 'archived'
    if (isLeavingService && activeIU) {
      const incidentName = (activeIU as any).incident?.name || 'its current incident'
      const label = next === 'archived' ? 'Archive' : 'Mark Out of Service'
      const ok = confirm(`${label} ${unit.name}?\n\nThis will:\n• Release ${unit.name} from ${incidentName}\n• Release all assigned crew\n\nThis cannot be undone automatically.`)
      if (!ok) return
      const now = new Date().toISOString()
      await supabase.from('unit_assignments').update({ released_at: now }).eq('incident_unit_id', activeIU.id).is('released_at', null)
      await supabase.from('incident_units').update({ released_at: now }).eq('id', activeIU.id)
    }
    await supabase.from('units').update({ unit_status: next }).eq('id', unit.id)
    await load()
  }

  const saveVehicleDetails = async () => {
    setSavingVehicle(true)
    await supabase.from('units').update({
      make: vehicleForm.make || null,
      model: vehicleForm.model || null,
      year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
      vin: vehicleForm.vin || null,
      license_plate: vehicleForm.license_plate || null,
      plate_state: vehicleForm.plate_state || null,
      photo_url: vehicleForm.photo_url || null,
    }).eq('id', id)
    setSavingVehicle(false)
    setEditingVehicle(false)
    load()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!unit) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Unit not found.</p>
        <Link to="/units" className="text-red-400 underline">← Back</Link>
      </div>
    </div>
  )

  const typeName = (unit.unit_type as { name: string } | null)?.name || '—'
  const activeIU = unit.incident_units?.find((iu: any) => iu.incident?.status === 'Active' && !iu.released_at)
  const vehicleLabel = [unit.year, unit.make, unit.model].filter(Boolean).join(' ') || null

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingDoc(true)
    const path = `vehicles/${id}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploadingDoc(false); return }
    // Store path not public URL (bucket is private)
    const { data: doc } = await supabase.from('vehicle_documents').insert({
      unit_id: id, doc_type: docType, file_url: data.path, file_name: file.name
    }).select().single()
    if (doc) setVehicleDocs(prev => [doc, ...prev])
    setUploadingDoc(false)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">

        <Link to="/units" className="text-gray-500 hover:text-gray-300 text-sm">← Units</Link>

        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Header */}
        <div className="theme-card rounded-xl p-4 border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{unit.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[typeName] || 'bg-gray-700 text-gray-400'}`}>
                  {typeName}
                </span>
                {(() => {
                  const s = unit.unit_status || 'in_service'
                  const deployed = s === 'in_service' && !!activeIU
                  const label = deployed ? '● Deployed' : s === 'in_service' ? '○ Available' : s === 'out_of_service' ? '⚠ Out of Service' : 'Archived'
                  const cls = deployed ? 'text-green-400' : s === 'out_of_service' ? 'text-yellow-400' : 'text-gray-500'
                  return isAdmin ? (
                    <select value={s} onChange={e => setUnitStatus(e.target.value)}
                      className={`text-xs bg-transparent border-0 outline-none cursor-pointer appearance-none ${cls}`}>
                      <option value="in_service">{deployed ? '● Deployed' : '○ Available'}</option>
                      <option value="out_of_service">⚠ Out of Service</option>
                      <option value="archived">Archived</option>
                    </select>
                  ) : <span className={`text-xs ${cls}`}>{label}</span>
                })()}
              </div>
            </div>
          </div>

          {activeIU?.incident && (
            <div className="mt-3 text-sm text-gray-400">
              📍 <Link to={`/incidents/${activeIU.incident.id}`} className="hover:text-white underline">
                {activeIU.incident.name}
              </Link>
            </div>
          )}
        </div>

        {/* Vehicle Details */}
        <div className="theme-card rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle Details</h2>
            {!editingVehicle && isAdmin && (
              <button
                onClick={() => setEditingVehicle(true)}
                className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {!editingVehicle ? (
            <div className="p-4 flex gap-4">
              {/* Photo */}
              <div className="shrink-0">
                {unit.photo_url ? (
                  <img src={unit.photo_url} alt={unit.name} className="w-20 h-20 object-cover rounded-lg" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center text-gray-600 text-2xl">
                    📷
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 space-y-2 text-sm">
                {vehicleLabel ? (
                  <p className="font-semibold text-white">{vehicleLabel}</p>
                ) : (
                  <p className="text-gray-600 italic">No vehicle info</p>
                )}
                {unit.vin && (
                  <p className="font-mono text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded inline-block">
                    {unit.vin}
                  </p>
                )}
                {(unit.license_plate || unit.plate_state) && (
                  <p className="text-gray-400 text-xs">
                    {[unit.license_plate, unit.plate_state].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={vehicleForm.make}
                  onChange={e => setVehicleForm(f => ({ ...f, make: e.target.value }))}
                  placeholder="Make"
                  className="col-span-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  value={vehicleForm.model}
                  onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="Model"
                  className="col-span-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  value={vehicleForm.year}
                  onChange={e => setVehicleForm(f => ({ ...f, year: e.target.value }))}
                  placeholder="Year"
                  type="number"
                  className="col-span-1 bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <input
                value={vehicleForm.vin}
                onChange={e => setVehicleForm(f => ({ ...f, vin: e.target.value }))}
                placeholder="VIN"
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={vehicleForm.license_plate}
                  onChange={e => setVehicleForm(f => ({ ...f, license_plate: e.target.value }))}
                  placeholder="License Plate"
                  className="bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <input
                  value={vehicleForm.plate_state}
                  onChange={e => setVehicleForm(f => ({ ...f, plate_state: e.target.value }))}
                  placeholder="State (e.g. CA)"
                  className="bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <input
                value={vehicleForm.photo_url}
                onChange={e => setVehicleForm(f => ({ ...f, photo_url: e.target.value }))}
                placeholder="Photo URL"
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveVehicleDetails}
                  disabled={savingVehicle}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
                >
                  {savingVehicle ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingVehicle(false)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cluster Components (REMS child units) */}
        {childUnits.length > 0 && (
          <div className="theme-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-800">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Cluster Components</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {childUnits.map(child => (
                <div key={child.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{child.name}</p>
                    <p className="text-xs text-gray-500">
                      {child.vehicle_subtype && <span className="mr-2">{child.vehicle_subtype}</span>}
                      {child.vin && <span className="font-mono mr-2">{child.vin}</span>}
                      {child.license_plate && <span>{child.license_plate}{child.plate_state ? ` · ${child.plate_state}` : ''}</span>}
                    </p>
                  </div>
                  <Link to={`/units/${child.id}`} className="text-xs text-gray-500 hover:text-gray-300">
                    →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Crew */}
        {activeIU && (
          <div className="theme-card rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Crew</h2>
              {(() => { const activeCrew = activeIU.unit_assignments.filter((ua: any) => !ua.released_at); return isAdmin && activeCrew.length < 4 ? (
                <button
                  onClick={() => setAddingTo(activeIU.id)}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  + Add ({activeCrew.length}/4)
                </button>
              ) : isAdmin ? (
                <span className="text-xs text-gray-600">4/4 full</span>
              ) : null })()}
            </div>

            <div className="divide-y divide-gray-800">
              {activeIU.unit_assignments.filter((ua: any) => !ua.released_at).length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-600">No crew assigned</p>
              ) : (
                activeIU.unit_assignments.filter((ua: any) => !ua.released_at).map((ua: any) => (
                  <div key={ua.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{ua.employee?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{ua.employee?.role || ''}</p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => removeCrewMember(ua.id)}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {isAdmin && addingTo === activeIU.id && (
              <div className="px-4 py-3 border-t border-gray-700 space-y-2">
                <select
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select crew member...</option>
                  {allEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={addCrewMember}
                    disabled={saving || !selectedEmployee}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAddingTo(null)}
                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Summary */}
        {inventory.length > 0 && (
          <div className="theme-card rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">CS / Rx Inventory</h2>
              <Link to={`/inventory?unit=${unit.name}`}
                className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
            </div>
            <div className="divide-y divide-gray-800">
              {inventory.map(item => {
                const low = item.quantity <= item.par_qty


  return (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className={`flex-1 truncate ${low ? 'text-red-300' : 'text-white'}`}>{item.item_name}</span>
                    <span className={`w-8 text-right font-mono font-semibold ${low ? 'text-red-400' : 'text-gray-300'}`}>
                      {item.quantity}
                    </span>
                    {low && <span className="ml-2 text-xs text-red-500">⚠</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No active incident */}
        {!activeIU && (
          <div className="theme-card rounded-xl p-4 border text-center text-gray-600 text-sm">
            Not currently deployed to an active incident.
          </div>
        )}

        {/* Vehicle Documents */}
        <div className="theme-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle Documents</h2>
            <span className="text-xs text-gray-600">{vehicleDocs.length} files</span>
          </div>
          <div className="p-4 space-y-3">
            {/* Upload */}
            <div className="flex gap-2">
              <select value={docType} onChange={e => setDocType(e.target.value)}
                className="bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none">
                {['Registration','Title','Insurance','Inspection','Smog Certificate','Photo','VIN Sticker','Other'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <label className="flex-1 flex items-center justify-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium cursor-pointer transition-colors">
                {uploadingDoc ? 'Uploading...' : '📎 Upload Document / Photo'}
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.heic"
                  onChange={handleDocUpload} disabled={uploadingDoc} />
              </label>
            </div>
            {/* Doc list */}
            {vehicleDocs.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-2">No documents uploaded yet.</p>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {vehicleDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white">{doc.doc_type}</p>
                      <p className="text-xs text-gray-500 truncate">{doc.file_name || 'Document'}</p>
                    </div>
                    <a href={vehicleDocUrls[doc.id] || doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 ml-2">
                      Open
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
