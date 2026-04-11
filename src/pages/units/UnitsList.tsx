
import { FieldGuard } from '@/components/FieldGuard'

import { useEffect, useState } from 'react'
import { useRole } from '@/lib/useRole'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { loadList } from '@/lib/offlineFirst'

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
  unit_type: { name: string } | null
  incident_units: {
    id: string
    incident: { name: string; status: string }
    unit_assignments: { id: string; employee: { id: string; name: string; role: string } | null }[]
  }[]
}

// Consistent color scheme across the whole app
const TYPE_COLORS: Record<string, string> = {
  'Warehouse': 'bg-purple-900 text-purple-300',
  'Med Unit':  'bg-blue-900 text-blue-300',
  'Ambulance': 'bg-red-900 text-red-300',
  'REMS':      'bg-green-900 text-green-300',
}

const TYPE_EMOJI: Record<string, string> = {
  'Warehouse': '🏭',
  'Med Unit':  '🏥',
  'Ambulance': '🚑',
  'REMS':      '🧗',
}

// Sort order: Warehouse first, then Med Unit, then Ambulance, then REMS
const TYPE_ORDER: Record<string, number> = {
  'Warehouse': 0,
  'Med Unit':  1,
  'Ambulance': 2,
  'REMS':      3,
}

function UnitsPageInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const { isAdmin } = useRole()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_service' | 'out_of_service' | 'archived'>('all')
  const [cyclingStatus, setCyclingStatus] = useState<string | null>(null)
  const [allEmployees, setAllEmployees] = useState<{id: string; name: string; role: string}[]>([])
  const [editingCrew, setEditingCrew] = useState<{iuId: string; slotIndex: number; assignmentId?: string} | null>(null)
  const [savingCrew, setSavingCrew] = useState(false)
  const [moveConfirm, setMoveConfirm] = useState<{
    iuId: string; assignmentId?: string; employeeId: string;
    employeeName: string; fromUnit: string; toUnit: string;
  } | null>(null)

  const load = async () => {
    const [unitResult, empResult] = await Promise.all([
      loadList<Unit>(
        () => supabase
          .from('units')
          .select(`
            id, name, active, unit_status, vin, license_plate, plate_state, make, model, year,
            unit_type:unit_types(name),
            incident_units(
              id, released_at,
              incident:incidents(name, status),
              unit_assignments(id, released_at, employee:employees(id, name, role))
            )
          `)
          .eq('active', true)
          .order('name') as any,
        'units'
      ),
      loadList<{id: string; name: string; role: string}>(
        () => supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name'),
        'employees'
      ),
    ])
    const sorted = unitResult.data.sort((a, b) => {
      const aType = (a.unit_type as any)?.name || 'REMS'
      const bType = (b.unit_type as any)?.name || 'REMS'
      const orderDiff = (TYPE_ORDER[aType] ?? 99) - (TYPE_ORDER[bType] ?? 99)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })
    setUnits(sorted)
    setAllEmployees(empResult.data)
    setLoading(false)
  }

  const assignCrewMember = async (iuId: string, assignmentId: string | undefined, employeeId: string) => {
    if (!employeeId) {
      // Removing — just do it
      setSavingCrew(true)
      if (assignmentId) await supabase.from('unit_assignments').delete().eq('id', assignmentId)
      setEditingCrew(null)
      setSavingCrew(false)
      await load()
      return
    }
    // Check if employee is already assigned to another active unit
    const existing = units.flatMap(u => {
      const active = activeIncidentUnit(u)
      if (!active) return []
      return (active.unit_assignments || []).filter(ua => (ua.employee as any)?.id === employeeId)
        .map(ua => ({ iuId: active.id, unitName: u.name, assignmentId: ua.id }))
    })
    const otherAssignment = existing.find(e => e.iuId !== iuId)
    if (otherAssignment) {
      const emp = allEmployees.find(e => e.id === employeeId)
      const toUnit = units.find(u => activeIncidentUnit(u)?.id === iuId)?.name || 'this unit'
      setEditingCrew(null)
      setMoveConfirm({
        iuId, assignmentId, employeeId,
        employeeName: emp?.name || 'This employee',
        fromUnit: otherAssignment.unitName,
        toUnit,
      })
      return
    }
    setSavingCrew(true)
    if (assignmentId) {
      await supabase.from('unit_assignments').update({ employee_id: employeeId }).eq('id', assignmentId)
    } else {
      await supabase.from('unit_assignments').insert({ incident_unit_id: iuId, employee_id: employeeId, role_on_unit: '' })
    }
    setEditingCrew(null)
    setSavingCrew(false)
    await load()
  }

  const confirmMove = async () => {
    if (!moveConfirm) return
    setSavingCrew(true)
    // Remove from old unit
    const existing = units.flatMap(u => {
      const active = activeIncidentUnit(u)
      if (!active) return []
      return (active.unit_assignments || []).filter(ua => (ua.employee as any)?.id === moveConfirm.employeeId)
        .filter(ua => activeIncidentUnit(u)?.id !== moveConfirm.iuId)
        .map(ua => ua.id)
    })
    for (const id of existing) await supabase.from('unit_assignments').delete().eq('id', id)
    // Assign to new unit
    if (moveConfirm.assignmentId) {
      await supabase.from('unit_assignments').update({ employee_id: moveConfirm.employeeId }).eq('id', moveConfirm.assignmentId)
    } else {
      await supabase.from('unit_assignments').insert({ incident_unit_id: moveConfirm.iuId, employee_id: moveConfirm.employeeId, role_on_unit: '' })
    }
    setMoveConfirm(null)
    setSavingCrew(false)
    await load()
  }

  useEffect(() => {
    setIsOffline(!getIsOnline())
    return onConnectionChange((online) => { setIsOffline(!online); if (online) load() })
  }, [])

  useEffect(() => { load() }, [])

  const activeIncidentUnit = (u: Unit) =>
    u.incident_units?.find(iu => (iu.incident as any)?.status === 'Active' && !(iu as any).released_at)

  const getStatusBadge = (unit: Unit) => {
    const active = activeIncidentUnit(unit)
    const status = unit.unit_status || 'in_service'
    if (status === 'in_service' && active) return { label: '● Deployed', cls: 'text-green-400' }
    if (status === 'in_service') return { label: '○ Available', cls: 'text-gray-400' }
    if (status === 'out_of_service') return { label: '⚠ Out of Service', cls: 'text-yellow-400' }
    if (status === 'archived') return { label: 'Archived', cls: 'text-gray-600' }
    return { label: '—', cls: 'text-gray-600' }
  }

  const cycleUnitStatus = async (e: React.MouseEvent, unitId: string, currentStatus: string | null) => {
    e.stopPropagation()
    if (!isAdmin) return
    const cycle: Record<string, string> = {
      'in_service': 'out_of_service',
      'out_of_service': 'archived',
      'archived': 'in_service',
    }
    const next = cycle[currentStatus || 'in_service'] || 'in_service'
    setCyclingStatus(unitId)
    await supabase.from('units').update({ unit_status: next }).eq('id', unitId)
    setCyclingStatus(null)
    await load()
  }

  const filteredUnits = statusFilter === 'all' ? units : units.filter(u => (u.unit_status || 'in_service') === statusFilter)

  return (
    <div className="p-4 md:p-6 mt-8 md:mt-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Units</h1>
          <p className="text-gray-500 text-xs">{filteredUnits.length} unit{filteredUnits.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/units/new"
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
          + Add Unit
        </Link>
      </div>

      {isOffline && (
        <div className="mb-4 bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
          📶 <span>Offline — showing cached unit data.</span>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {(['all', 'in_service', 'out_of_service', 'archived'] as const).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === f ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            {f === 'all' ? `All (${units.length})` :
             f === 'in_service' ? `In Service (${units.filter(u => (u.unit_status || 'in_service') === 'in_service').length})` :
             f === 'out_of_service' ? `Out of Service (${units.filter(u => u.unit_status === 'out_of_service').length})` :
             `Archived (${units.filter(u => u.unit_status === 'archived').length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filteredUnits.length === 0 ? (
        <p className="text-center text-gray-600 py-8">No units found.</p>
      ) : (
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
          {/* Header */}
          <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-700 bg-gray-800">
            <span className="w-32 shrink-0">Unit</span>
            <span className="w-24 shrink-0 hidden sm:block">Type</span>
            <span className="w-36 shrink-0 hidden lg:block font-mono">VIN</span>
            <span className="w-28 shrink-0 hidden lg:block">Plate</span>
            <span className="w-32 shrink-0 hidden md:block">Incident</span>
            <span className="flex-1 min-w-0">Crew</span>
            <span className="w-24 shrink-0 text-right">Status</span>
          </div>

          {filteredUnits.map(unit => {
            const active = activeIncidentUnit(unit)
            const crew = active?.unit_assignments || []
            const typeName = (unit.unit_type as any)?.name || '—'
            const emoji = TYPE_EMOJI[typeName] || '🚐'
            const colorClass = TYPE_COLORS[typeName] || 'bg-gray-700 text-gray-400'

            return (
              <div key={unit.id} onClick={() => navigate(`/units/${unit.id}`)}
                className="flex items-start px-4 py-2.5 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 text-sm">

                {/* Unit name + emoji */}
                <span className="w-32 shrink-0 font-medium truncate pr-2 flex items-center gap-1.5">
                  <span>{emoji}</span>
                  <span className="truncate">{unit.name}</span>
                </span>

                {/* Type badge */}
                <span className="w-24 shrink-0 hidden sm:block">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                    {typeName}
                  </span>
                </span>

                {/* VIN */}
                <span className="w-36 shrink-0 text-gray-500 text-xs font-mono truncate pr-2 hidden lg:block">{unit.vin || '—'}</span>
                {/* Plate */}
                <span className="w-28 shrink-0 text-gray-400 text-xs truncate pr-2 hidden lg:block">{unit.license_plate ? (unit.plate_state ? `${unit.license_plate} (${unit.plate_state})` : unit.license_plate) : "—"}</span>
                {/* Incident */}
                <span className="w-32 shrink-0 text-gray-400 text-xs truncate pr-2 hidden md:block">
                  {active ? (active.incident as any)?.name : '—'}
                </span>

                {/* Crew — up to 4 inline-editable slots */}
                <span className="flex-1 min-w-0 text-xs" onClick={e => e.stopPropagation()}>
                  <span className="flex flex-wrap gap-1">
                    {Array.from({ length: 4 }).map((_, slotIdx) => {
                      const ua = crew[slotIdx]
                      const isEditing = editingCrew?.iuId === active?.id && editingCrew?.slotIndex === slotIdx
                      if (isEditing && isAdmin) return (
                        <select key={slotIdx} autoFocus
                          className="bg-gray-700 text-white text-xs rounded px-1 py-0.5 max-w-[140px]"
                          defaultValue={(ua?.employee as any)?.id || ''}
                          onChange={e => assignCrewMember(active!.id, ua?.id, e.target.value)}
                          onBlur={() => setEditingCrew(null)}>
                          <option value="">— Remove —</option>
                          {allEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>)}
                        </select>
                      )
                      return (
                        <button key={slotIdx} type="button"
                          onClick={() => isAdmin && active && setEditingCrew({ iuId: active.id, slotIndex: slotIdx, assignmentId: ua?.id })}
                          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${isAdmin ? 'cursor-pointer' : 'cursor-default'} ${ua?.employee ? 'text-gray-200 hover:bg-gray-700' : isAdmin ? 'text-gray-600 hover:text-gray-400 border border-dashed border-gray-700 hover:border-gray-500' : 'text-gray-600 border border-dashed border-gray-800'}`}
                        >
                          {ua?.employee ? (ua.employee as any).name.split(' ').slice(-1)[0] : '+ Crew'}
                        </button>
                      )
                    })}
                  </span>
                </span>

                                {/* Status */}
                <span className="w-24 shrink-0 text-right" onClick={e => e.stopPropagation()}>
                  {(() => {
                    const badge = getStatusBadge(unit)
                    return (
                      <button
                        type="button"
                        onClick={e => isAdmin ? cycleUnitStatus(e, unit.id, unit.unit_status) : e.stopPropagation()}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all ${isAdmin ? 'cursor-pointer hover:ring-1 hover:ring-white/30' : 'cursor-default'} ${
                          badge.label.includes('Deployed') ? 'bg-green-900/60 text-green-400' :
                          badge.label.includes('Available') ? 'bg-gray-800 text-gray-400' :
                          badge.label.includes('Out') ? 'bg-yellow-900/60 text-yellow-400' :
                          'bg-gray-800/40 text-gray-600'
                        }`}
                        title={isAdmin ? 'Click to change status' : undefined}
                      >
                        {cyclingStatus === unit.id ? '⟳ ...' : badge.label}
                      </button>
                    )
                  })()}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {/* Move confirmation dialog */}
      {moveConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h2 className="text-white font-bold text-lg">Move Employee?</h2>
            <p className="text-gray-300 text-sm">
              <strong>{moveConfirm.employeeName}</strong> is currently assigned to <strong>{moveConfirm.fromUnit}</strong>.
              Move them to <strong>{moveConfirm.toUnit}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMoveConfirm(null)}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={confirmMove}
                disabled={savingCrew}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {savingCrew ? 'Moving...' : 'Yes, Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function UnitsPageWrapped() {
  return (
    <FieldGuard redirectFn={(a) => a.unit?.id ? `/units/${a.unit.id}` : null}>
      <UnitsPageInner />
    </FieldGuard>
  )
}
