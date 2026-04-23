import { useEffect, useState, useRef } from 'react'
import { toast } from '@/lib/toast'
import { usePermission } from '@/hooks/usePermission'
import { createClient } from '@/lib/supabase/client'
import { loadSingle } from '@/lib/offlineFirst'
import type { Unit, ChildUnit, InventoryItem, Employee, DeploymentRow, VehicleForm, VehicleDoc } from './types'

export function useUnitDetail(id: string) {
  const supabase = createClient()
  const isAdmin = usePermission('units.manage')

  const [unit, setUnit] = useState<Unit | null>(null)
  const [childUnits, setChildUnits] = useState<ChildUnit[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [deployments, setDeployments] = useState<DeploymentRow[]>([])
  const [incidentFilter, setIncidentFilter] = useState<string>('All')

  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [saving, setSaving] = useState(false)

  const [crewConflict, setCrewConflict] = useState<{
    empName: string; otherUnit: string; conflictId: string
  } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    action: () => void; title: string; message: string
    confirmLabel?: string; icon?: string; confirmColor?: string
  } | null>(null)

  const [editingVehicle, setEditingVehicle] = useState(false)
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>({
    make: '', model: '', year: '', vin: '', license_plate: '', plate_state: '', photo_url: '',
  })
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [vehicleDocUrls, setVehicleDocUrls] = useState<Record<string, string>>({})
  const [vehicleDocs, setVehicleDocs] = useState<VehicleDoc[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docType, setDocType] = useState('Registration')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const { getCachedById } = await import('@/lib/offlineStore')
      const cached = await getCachedById('units', id) as any
      if (cached) { setUnit(cached as Unit); setLoading(false) }
    } catch {}
    const { data: unitData, offline } = await loadSingle<Unit>(
      () => supabase
        .from('units')
        .select(`
          id, name, active, unit_status,
          vin, license_plate, plate_state, make, model, year, photo_url, vehicle_subtype,
          unit_type:unit_types(name, default_contract_rate),
          incident_units(
            id, released_at,
            incident:incidents(id, name, status),
            unit_assignments(
              id, role_on_unit, released_at,
              employee:employees(id, name, role, headshot_url)
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
    let depHistory: any[] | null = null
    try {
      const [{ data: _emps }, { data: _children }, { data: _deps }] = await Promise.all([
        supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name'),
        supabase.from('units').select('id, name, vin, license_plate, plate_state, vehicle_subtype').eq('parent_unit_id', id),
        supabase.from('incident_units')
          .select('id, assigned_at, released_at, daily_contract_rate, incident:incidents(id, name, status)')
          .eq('unit_id', id)
          .order('assigned_at', { ascending: false }),
      ])
      emps = _emps; children = _children; depHistory = _deps
    } catch (_offlineErr) {}

    const u = unitData as unknown as Unit
    setUnit(u)
    setAllEmployees((emps || []) as Employee[])
    setChildUnits((children || []) as ChildUnit[])
    setDeployments((depHistory || []) as DeploymentRow[])

    const { data: docsData } = await supabase
      .from('vehicle_documents')
      .select('id, doc_type, file_url, file_name, expiration_date, notes')
      .eq('unit_id', id)
      .order('uploaded_at', { ascending: false })
    setVehicleDocs(docsData || [])
    if (docsData && docsData.length > 0) {
      const urlMap: Record<string, string> = {}
      await Promise.all((docsData as any[]).map(async (doc: any) => {
        if (!doc.file_url) return
        if (doc.file_url.startsWith('http')) { urlMap[doc.id] = doc.file_url; return }
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
        make: u.make || '', model: u.model || '', year: u.year?.toString() || '',
        vin: u.vin || '', license_plate: u.license_plate || '',
        plate_state: u.plate_state || '', photo_url: u.photo_url || '',
      })
      // Load ALL inventory for this unit (by unit_id, not incident_unit_id)
      const { data: inv } = await supabase
        .from('unit_inventory')
        .select('id, item_name, category, quantity, par_qty, catalog_item_id')
        .eq('unit_id', u.id)
        .gt('quantity', 0)
        .order('category')
        .order('item_name')
      setInventory(inv || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const addCrewMember = async () => {
    if (!addingTo || !selectedEmployee) return
    setSaving(true)
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
      setCrewConflict({ empName: emp?.name || 'This employee', otherUnit: otherUnitName, conflictId: conflict.id })
      setSaving(false)
      return
    }
    await finishAddCrew()
  }

  const confirmCrewReassign = async () => {
    if (!crewConflict || !addingTo) return
    setSaving(true)
    await supabase.from('unit_assignments').update({ released_at: new Date().toISOString() }).eq('id', crewConflict.conflictId)
    setCrewConflict(null)
    await finishAddCrew()
  }

  const finishAddCrew = async () => {
    if (!addingTo || !selectedEmployee) return
    await supabase.from('unit_assignments').update({ released_at: new Date().toISOString() })
      .eq('employee_id', selectedEmployee).is('released_at', null).neq('incident_unit_id', addingTo)
    await supabase.from('unit_assignments').insert({
      incident_unit_id: addingTo, employee_id: selectedEmployee, role_on_unit: selectedRole || '',
    })
    setAddingTo(null); setSelectedEmployee(''); setSelectedRole(''); setSaving(false)
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
    const activeIU = unit.incident_units?.find(iu => iu.incident?.status === 'Active' && !iu.released_at)
    const isLeavingService = next === 'out_of_service' || next === 'archived'
    if (isLeavingService && activeIU) {
      const incidentName = (activeIU as any).incident?.name || 'its current incident'
      const label = next === 'archived' ? 'Archive' : 'Mark Out of Service'
      setConfirmAction({
        action: async () => {
          const now = new Date().toISOString()
          await supabase.from('unit_assignments').update({ released_at: now }).eq('incident_unit_id', activeIU.id).is('released_at', null)
          await supabase.from('incident_units').update({ released_at: now }).eq('id', activeIU.id)
          await supabase.from('units').update({ unit_status: next }).eq('id', unit.id)
          await load()
        },
        title: `${label} ${unit.name}`,
        message: `This will:\n• Release ${unit.name} from ${incidentName}\n• Release all assigned crew\n\nThis cannot be undone automatically.`,
        icon: '⚠️',
      })
      return
    }
    await supabase.from('units').update({ unit_status: next }).eq('id', unit.id)
    await load()
  }

  const saveVehicleDetails = async () => {
    setSavingVehicle(true)
    await supabase.from('units').update({
      make: vehicleForm.make || null, model: vehicleForm.model || null,
      year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
      vin: vehicleForm.vin || null, license_plate: vehicleForm.license_plate || null,
      plate_state: vehicleForm.plate_state || null, photo_url: vehicleForm.photo_url || null,
    }).eq('id', id)
    setSavingVehicle(false); setEditingVehicle(false); load()
  }

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingDoc(true)
    const path = `vehicles/${id}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingDoc(false); return }
    const { data: doc } = await supabase.from('vehicle_documents').insert({
      unit_id: id, doc_type: docType, file_url: data.path, file_name: file.name,
    }).select().single()
    if (doc) setVehicleDocs(prev => [doc, ...prev])
    setUploadingDoc(false); e.target.value = ''
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `units/${id}/photo.${ext}`
    const { data, error: upErr } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
    if (upErr) { toast.error('Upload failed: ' + upErr.message); setUploadingPhoto(false); return }
    const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(data.path)
    await supabase.from('units').update({ photo_url: urlData.publicUrl }).eq('id', id)
    setUnit(prev => prev ? { ...prev, photo_url: urlData.publicUrl } : prev)
    setUploadingPhoto(false)
  }

  return {
    unit, childUnits, inventory, allEmployees, loading, isOfflineData,
    deployments, incidentFilter, setIncidentFilter,
    addingTo, setAddingTo, selectedEmployee, setSelectedEmployee, saving,
    crewConflict, setCrewConflict, confirmCrewReassign,
    confirmAction, setConfirmAction,
    editingVehicle, setEditingVehicle, vehicleForm, setVehicleForm, savingVehicle,
    vehicleDocUrls, vehicleDocs, uploadingDoc, docType, setDocType,
    uploadingPhoto, photoInputRef,
    isAdmin,
    addCrewMember, removeCrewMember, setUnitStatus, saveVehicleDetails,
    handleDocUpload, handlePhotoUpload,
  }
}
