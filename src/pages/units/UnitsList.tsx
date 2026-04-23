
import { FieldGuard } from '@/components/FieldGuard'

import { useEffect, useState } from 'react'
import { usePermission } from '@/hooks/usePermission'
import { createClient } from '@/lib/supabase/client'
import { Link } from 'react-router-dom'
import { useNavigate, useMatch } from 'react-router-dom'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { loadList } from '@/lib/offlineFirst'

const ROLE_COLORS: Record<string, string> = {
  'MD': 'bg-purple-900 text-purple-300',
  'DO': 'bg-purple-900 text-purple-300',
  'NP': 'bg-blue-900 text-blue-300',
  'PA': 'bg-blue-900 text-blue-300',
  'RN': 'bg-teal-900 text-teal-300',
  'Paramedic': 'bg-red-900 text-red-300',
  'EMT': 'bg-orange-900 text-orange-300',
  'Tech': 'bg-gray-700 text-gray-300',
}
import { PageHeader, LoadingSkeleton, EmptyState, ConfirmDialog } from '@/components/ui'

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
  const detailMatch = useMatch('/units/:id')
  const isAdmin = usePermission('units.view')
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_service' | 'out_of_service' | 'archived'>('all')
  const [cyclingStatus, setCyclingStatus] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)


  const load = async () => {
    // Show cached data only when offline
    if (!navigator.onLine) {
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cached = await getCachedData('units') as any[]
        if (cached.length > 0) {
          const sorted = (cached as Unit[]).sort((a, b) => {
            const aType = (a.unit_type as any)?.name || 'REMS'
            const bType = (b.unit_type as any)?.name || 'REMS'
            const orderDiff = (TYPE_ORDER[aType] ?? 99) - (TYPE_ORDER[bType] ?? 99)
            if (orderDiff !== 0) return orderDiff
            return a.name.localeCompare(b.name)
          })
          setUnits(sorted)
          setLoading(false)
          return
        }
      } catch {}
    }
    const unitResult = await loadList<Unit>(
      () => supabase
        .from('units')
        .select(`
          id, name, active, unit_status, vin, license_plate, plate_state, make, model, year, photo_url,
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
    )
    const sorted = unitResult.data.sort((a, b) => {
      const aType = (a.unit_type as any)?.name || 'REMS'
      const bType = (b.unit_type as any)?.name || 'REMS'
      const orderDiff = (TYPE_ORDER[aType] ?? 99) - (TYPE_ORDER[bType] ?? 99)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })
    setUnits(sorted)
    setLoading(false)
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

  const setUnitStatus = async (e: React.ChangeEvent<HTMLSelectElement>, unitId: string, currentStatus: string | null) => {
    e.stopPropagation()
    if (!isAdmin) return
    const next = e.target.value
    if (next === currentStatus) return

    const unit = units.find(u => u.id === unitId)
    const unitName = unit?.name || 'this unit'
    const activeIU = unit ? activeIncidentUnit(unit) : null
    const isLeavingService = next === 'out_of_service' || next === 'archived'

    // If unit is currently deployed, confirm and fully release from incident
    if (isLeavingService && activeIU) {
      const incidentName = (activeIU as any).incident?.name || 'its current incident'
      const label = next === 'archived' ? 'Archive' : 'Mark Out of Service'
      setConfirmAction({
        action: async () => {
          const now = new Date().toISOString()
          await supabase.from('unit_assignments').update({ released_at: now }).eq('incident_unit_id', activeIU.id).is('released_at', null)
          await supabase.from('incident_units').update({ released_at: now }).eq('id', activeIU.id)
          await supabase.from('units').update({ unit_status: next }).eq('id', unitId)
          await load()
        },
        title: `${label} ${unitName}`,
        message: `This will:\n• Release ${unitName} from ${incidentName}\n• Release all assigned crew\n\nThis cannot be undone automatically.`,
        icon: '⚠️',
      })
      return
    }

    setCyclingStatus(unitId)
    await supabase.from('units').update({ unit_status: next }).eq('id', unitId)
    setCyclingStatus(null)
    await load()
  }

  const filteredUnits = statusFilter === 'all' ? units : units.filter(u => (u.unit_status || 'in_service') === statusFilter)

  return (
    <div className="p-4 md:p-6 mt-8 md:mt-0">
      <PageHeader
        title="Units"
        subtitle={`${filteredUnits.length} unit${filteredUnits.length !== 1 ? 's' : ''}`}
        actions={
          <Link to="/units/new"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors">
            + Add Unit
          </Link>
        }
        className="mb-4"
      />

      {isOffline && (
        <div className="mb-4 bg-red-950/60 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm flex items-center gap-2">
          📶 <span>Offline — showing cached unit data.</span>
        </div>
      )}

      {/* Status filter tabs — desktop: pills, mobile: dropdown */}
      <div className="hidden md:flex gap-1.5 flex-wrap mb-4">
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
      <select
        value={statusFilter}
        onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
        className="md:hidden w-full mb-4 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
      >
        <option value="all">All ({units.length})</option>
        <option value="in_service">In Service ({units.filter(u => (u.unit_status || 'in_service') === 'in_service').length})</option>
        <option value="out_of_service">Out of Service ({units.filter(u => u.unit_status === 'out_of_service').length})</option>
        <option value="archived">Archived ({units.filter(u => u.unit_status === 'archived').length})</option>
      </select>

      {loading ? (
        <LoadingSkeleton rows={6} header />
      ) : filteredUnits.length === 0 ? (
        <EmptyState icon="🚑" message="No units found." actionHref="/units/new" actionLabel="Add a unit" />
      ) : (
        <div className="theme-card rounded-xl border overflow-x-auto">
          {/* Header */}
          <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b theme-card-header min-w-[760px]">
            <span className="w-8 shrink-0" />{/* photo */}
            <span className="w-32 shrink-0">Unit</span>
            <span className="w-24 shrink-0 hidden sm:block">Type</span>
            <span className="w-20 shrink-0 hidden lg:block font-mono">VIN</span>
            <span className="w-28 shrink-0 hidden lg:block">Plate</span>
            <span className="w-32 shrink-0 hidden md:block">Incident</span>
            <span className="w-48 shrink-0">Crew</span>
            <span className="w-24 shrink-0 text-right">Status</span>
          </div>

          {filteredUnits.map(unit => {
            const active = activeIncidentUnit(unit)
            const crew = (active?.unit_assignments || []).filter((ua: any) => !ua.released_at)
            const typeName = (unit.unit_type as any)?.name || '—'
            const emoji = TYPE_EMOJI[typeName] || '🚐'
            const colorClass = TYPE_COLORS[typeName] || 'bg-gray-700 text-gray-400'

            return (
              <div key={unit.id} onClick={() => navigate(`/units/${unit.id}`)}
                className={`flex items-center px-4 py-2 cursor-pointer border-b border-gray-800/50 text-sm min-w-[760px] ${detailMatch?.params?.id === unit.id ? 'bg-gray-700' : 'hover:bg-gray-800'}`}>

                {/* Unit photo */}
                <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center mr-3">
                  {unit.photo_url ? (
                    <img src={unit.photo_url} alt={unit.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs">{emoji}</span>
                  )}
                </div>

                {/* Unit name */}
                <span className="w-32 shrink-0 font-medium truncate pr-2 flex items-center gap-1.5">
                  <span className="truncate">{unit.name}</span>
                </span>

                {/* Type badge */}
                <span className="w-24 shrink-0 hidden sm:block">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                    {typeName}
                  </span>
                </span>

                {/* VIN — narrow with hover expand */}
                <span className="w-20 shrink-0 text-gray-500 text-xs font-mono truncate pr-2 hidden lg:block hover:w-auto hover:overflow-visible hover:bg-gray-900 hover:px-1 hover:rounded hover:z-10 hover:relative transition-all cursor-default" title={unit.vin || ''}>{unit.vin ? `…${unit.vin.slice(-6)}` : '—'}</span>
                {/* Plate */}
                <span className="w-28 shrink-0 text-gray-400 text-xs truncate pr-2 hidden lg:block">{unit.license_plate ? (unit.plate_state ? `${unit.license_plate} (${unit.plate_state})` : unit.license_plate) : "—"}</span>
                {/* Incident */}
                <span className="w-32 shrink-0 text-gray-400 text-xs truncate pr-2 hidden md:block">
                  {active ? (active.incident as any)?.name : '—'}
                </span>

                {/* Crew — read-only, assign via detail pane */}
                <span className="w-56 shrink-0 text-xs text-gray-300 pr-2 flex flex-wrap items-center gap-1"
                  title={crew.map((ua: any) => ua.employee?.name).filter(Boolean).join(', ')}>
                  {crew.length > 0
                    ? crew.map((ua: any, i: number) => {
                        const emp = ua.employee
                        if (!emp?.name) return null
                        const lastName = emp.name.split(' ').filter(Boolean).slice(-1)[0]
                        const role = emp.role || ''
                        const roleClass = ROLE_COLORS[role] || ROLE_COLORS.Tech
                        return (
                          <span key={ua.id} className="inline-flex items-center gap-0.5 shrink-0">
                            <span>{lastName}</span>
                            {role && <span className={`text-[9px] px-1 py-px rounded-full leading-tight ${roleClass}`}>{role === 'Paramedic' ? 'PM' : role}</span>}
                            {i < crew.length - 1 && <span className="text-gray-600 mr-0.5">,</span>}
                          </span>
                        )
                      })
                    : <span className="text-gray-600">—</span>
                  }
                </span>

                                {/* Status */}
                <span className="w-32 shrink-0 text-right" onClick={e => e.stopPropagation()}>
                  {isAdmin ? (
                    <select
                      value={unit.unit_status || 'in_service'}
                      onChange={e => setUnitStatus(e, unit.id, unit.unit_status)}
                      disabled={cyclingStatus === unit.id}
                      onClick={e => e.stopPropagation()}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium bg-transparent border-0 outline-none cursor-pointer appearance-none text-right ${
                        activeIncidentUnit(unit) && (unit.unit_status || 'in_service') === 'in_service' ? 'text-green-400' :
                        (unit.unit_status || 'in_service') === 'out_of_service' ? 'text-yellow-400' :
                        unit.unit_status === 'archived' ? 'text-gray-600' :
                        'text-gray-400'
                      }`}
                    >
                      <option value="in_service">{activeIncidentUnit(unit) ? '● Deployed' : '○ Available'}</option>
                      <option value="out_of_service">⚠ Out of Service</option>
                      <option value="archived">Archived</option>
                    </select>
                  ) : (
                    <span className={`text-xs font-medium ${
                      getStatusBadge(unit).cls
                    }`}>{getStatusBadge(unit).label}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
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
