

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCachedData, getCachedById, cacheData } from '@/lib/offlineStore'
import { loadSingle, loadList } from '@/lib/offlineFirst'
import { Link } from 'react-router-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ──────────────────────────────────────────────────────────────────

type Incident = {
  id: string
  name: string
  location: string | null
  latitude: number | null
  longitude: number | null
  incident_number: string | null
  agreement_number: string | null
  financial_code: string | null
  resource_order_number: string | null
  finance_contact_name: string | null
  finance_contact_email: string | null
  finance_contact_phone: string | null
  start_date: string | null
  status: string
  med_unit_leader_name?: string | null
  med_unit_leader_email?: string | null
  med_unit_leader_phone?: string | null
  logs_contact_name?: string | null
  logs_contact_email?: string | null
  logs_contact_phone?: string | null
  comp_claims_name?: string | null
  comp_claims_email?: string | null
  comp_claims_phone?: string | null
  contract_url?: string | null
  contract_file_name?: string | null
}

type IncidentUnit = {
  id: string
  unit: { id: string; name: string; type?: string } | null
  _crew_count: number
  released_at?: string | null
}

type Unit = {
  id: string
  name: string
  type?: string | null
}

type EncounterRow = {
  id: string
  date: string | null
  patient_last_name: string | null
  patient_first_name: string | null
  unit: string | null
  acuity?: string | null
}

type MARRow = {
  id: string
  date: string | null
  item_name: string | null
  med_unit: string | null
}

type SupplyRunRow = {
  id: string
  run_date: string
  incident_unit: { unit: { name: string } | null } | null
  item_count?: number
}

const DEFAULT_CARD_ORDER = [
  'deployments',
  'encounters',
  'mar',
  'comp-claims',
  'supply-runs',
  'ics214',
  'billing-summary',
  'reorder-summary',
]

// ─── Deployment types ────────────────────────────────────────────────────────

type Employee = {
  id: string
  name: string
  role: string
  daily_rate: number | null
}

type DeploymentRecord = {
  id: string
  employee_id: string
  travel_date: string
  check_in_date: string | null
  check_out_date: string | null
  daily_rate: number
  status: string
  notes: string | null
  employees: { name: string; role: string } | null
}

function calcDays(travelDate: string, checkOutDate: string | null): number {
  const start = new Date(travelDate)
  const end = checkOutDate ? new Date(checkOutDate) : new Date()
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endMs = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1)
}

function formatDeployDate(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit',
  })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

// ─── Inline-editable field ───────────────────────────────────────────────────


function LocationEditField({
  value,
  latitude,
  longitude,
  onSave,
}: {
  value: string | null | undefined
  latitude: number | null | undefined
  longitude: number | null | undefined
  onSave: (key: string, val: string) => void
  onSaveCoords: (lat: number, lng: number, label: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  useEffect(() => { setDraft(value ?? '') }, [value])

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave('location', draft)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }

  const useGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported on this device')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lng = parseFloat(pos.coords.longitude.toFixed(6))
        const label = `${lat}, ${lng}`
        setDraft(label)
        setGpsLoading(false)
        // Save both location string and lat/lng
        onSave('location', label)
        onSave('latitude', String(lat))
        onSave('longitude', String(lng))
        setEditing(false)
      },
      (err) => {
        setGpsLoading(false)
        setGpsError(
          err.code === 1 ? 'Location access denied — check browser permissions' :
          err.code === 2 ? 'Position unavailable — try again' :
          'GPS timed out — try again'
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const hasCoords = latitude != null && longitude != null

  return (
    <div className="flex flex-col gap-0.5 px-1.5 py-1">
      <span className="text-xs text-gray-500">Location</span>
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
            placeholder="Type a location or use GPS below"
            className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 min-w-[220px]"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={useGPS}
              disabled={gpsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 rounded-lg text-xs font-semibold transition-colors"
            >
              {gpsLoading ? (
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : '📍'}
              {gpsLoading ? 'Getting GPS...' : 'Use My Location'}
            </button>
            <button type="button" onClick={commit}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-semibold">
              Save
            </button>
            <button type="button" onClick={() => { setDraft(value ?? ''); setEditing(false); setGpsError(null) }}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold">
              Cancel
            </button>
          </div>
          {gpsError && <p className="text-xs text-red-400">{gpsError}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-white text-left hover:text-red-400 transition-colors group flex items-center gap-1"
        >
          <span>{value || <span className="text-gray-600 italic">Click to add location</span>}</span>
          <span className="text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
        </button>
      )}
      {hasCoords && !editing && (
        <a
          href={`https://maps.google.com/?q=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
        >
          📍 {latitude}, {longitude} — Open in Maps
        </a>
      )}
    </div>
  )
}

function EditField({
  label,
  value,
  fieldKey,
  type = 'text',
  onSave,
  options,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  type?: string
  onSave: (key: string, val: string) => void
  options?: { label: string; value: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null)

  useEffect(() => { setDraft(value ?? '') }, [value])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== (value ?? '')) onSave(fieldKey, draft)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false) }
  }

  if (editing) {
    if (options) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-500">{label}</span>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKey}
            className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-gray-500">{label}</span>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          className="bg-gray-800 text-white text-sm rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 min-w-0"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex flex-col gap-0.5 text-left group w-full hover:bg-gray-800/50 rounded-md px-1.5 py-1 transition-colors"
    >
      <span className="text-xs text-gray-500 group-hover:text-gray-400">{label}</span>
      <span className={`text-sm ${value ? 'text-white' : 'text-gray-600 italic'}`}>
        {value || 'Click to edit'}
      </span>
    </button>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  count,
  children,
  viewAllHref,
  newHref,
  newLabel,
  dragHandleProps,
}: {
  title: string
  count: number | string
  children?: React.ReactNode
  viewAllHref?: string
  newHref?: string
  newLabel?: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Card header — distinct bg from body */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-slate-800/90">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none"
            title="Drag to reorder"
          >
            ⠿
          </div>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">{title}</h3>
        <span className="text-2xl font-bold text-white">{count}</span>
      </div>
      {/* Scrollable rows — max 5 visible (~44px each) */}
      {children && (
        <div className="divide-y divide-gray-800/60 overflow-y-auto" style={{maxHeight: '220px'}}>
          {children}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/30">
        {viewAllHref && (
          <Link to={viewAllHref} className="text-xs text-gray-400 hover:text-white transition-colors">
            View all →
          </Link>
        )}
        <div className="flex-1" />
        {newHref && (
          <Link to={newHref} className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">
            {newLabel || '+ New'}
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Sortable Card Wrapper ───────────────────────────────────────────────────

function SortableCard({
  id,
  children,
}: {
  id: string
  children: (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IncidentDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const navigate = useNavigate()
  const incidentId = params.id as string

  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'MD/DO', 'Admin'].includes(assignment?.employee?.role || '')

  const [activeIncidentId, setActiveIncidentId] = useState(incidentId)
  const [incident, setIncident] = useState<Incident | null>(null)
  const [activeIncidents, setActiveIncidents] = useState<{id: string, name: string}[]>([])
  const [incidentUnits, setIncidentUnits] = useState<IncidentUnit[]>([])
  const [allUnits, setAllUnits] = useState<Unit[]>([])
  const [assigningUnit, setAssigningUnit] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadingContract, setUploadingContract] = useState(false)

  // Stats
  // Unit filter for dashboard cards
  const [unitFilter, setUnitFilter] = useState('All')
  // For field users, always filter to their assigned unit; admins use the unitFilter picker
  const effectiveUnitFilter = isAdmin ? unitFilter : (assignment.unit?.name || 'All')

  const [encounterCount, setEncounterCount] = useState(0)
  const [encounters, setEncounters] = useState<EncounterRow[]>([])
  const [marCount, setMarCount] = useState(0)
  const [marEntries, setMarEntries] = useState<MARRow[]>([])
  const [compCount, setCompCount] = useState(0)
  const [supplyCount, setSupplyCount] = useState(0)
  const [supplyRuns, setSupplyRuns] = useState<SupplyRunRow[]>([])

  // Deployments
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [showAddDeployment, setShowAddDeployment] = useState(false)
  const [deployForm, setDeployForm] = useState({ employeeId: '', travelDate: new Date().toISOString().split('T')[0], dailyRate: '', notes: '' })
  const [deploySubmitting, setDeploySubmitting] = useState(false)
  const [editingDeployId, setEditingDeployId] = useState<string | null>(null)
  const [editDeployFields, setEditDeployFields] = useState<Partial<DeploymentRecord>>({})

  // Billing & reorder summary
  const [billingTotal, setBillingTotal] = useState<number | null>(null)
  const [reorderCount, setReorderCount] = useState<number | null>(null)
  const [encounterSubFilter, setEncounterSubFilter] = useState<'unit'|'mine'>('unit')
  const [closingOut, setClosingOut] = useState(false)
  const [closeoutDt, setCloseoutDt] = useState('')
  const [isOfflineData, setIsOfflineData] = useState(false)

  // ICS 214
  const [ics214Rows, setIcs214Rows] = useState<{ ics214_id: string; unit_name: string; op_date: string; status: string }[]>([])

  // Card order
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_CARD_ORDER)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  const load = useCallback(async () => {
    const supabaseClient = createClient()

    // Load incident with offline fallback
    const incResult = await loadSingle(
      () => supabaseClient.from('incidents').select('*').eq('id', activeIncidentId).single() as any,
      'incidents',
      activeIncidentId
    )
    let inc = incResult.data
    let iUnits: any[] | null = null
    let allUnitsData: any[] | null = null
    let userData: any = null

    if (incResult.offline) {
      // Offline — load everything from IndexedDB
      if (inc) {
        setIsOfflineData(true)
        setIncident(inc as Incident)
        const cachedUnits = await getCachedData('units')
        setAllUnits(cachedUnits)
        // Load incident units from cache
        const cachedIUs = await getCachedData('incident_units')
        const filteredIUs = cachedIUs.filter((iu: any) => iu.incident_id === activeIncidentId && !iu.released_at)
        const mappedIUs = filteredIUs.map((iu: any) => ({
          id: iu.id,
          unit: iu.unit || cachedUnits.find((u: any) => u.id === iu.unit_id) || null,
          _crew_count: 0,
        }))
        setIncidentUnits(mappedIUs)
        const cachedEncs = await getCachedData('encounters')
        const filteredEncs = cachedEncs.filter((e: any) => e.incident_id === activeIncidentId)
        setEncounters(filteredEncs.slice(0, 5))
        setEncounterCount(filteredEncs.length)
        const cachedMar = await getCachedData('mar_entries')
        setMarEntries(cachedMar.slice(0, 3))
        setMarCount(cachedMar.length)
        // Supply runs
        const cachedRuns = await getCachedData('supply_runs')
        setSupplyRuns(cachedRuns.filter((r: any) => r.incident_id === activeIncidentId).slice(0, 3))
      }
      setLoading(false)
      return
    }

    // Online — load the rest
    try {
      const [iuRes, unitsRes, authRes] = await Promise.all([
        supabaseClient.from('incident_units').select(`
          id,
          unit:units(id, name, unit_type:unit_types(name)),
          unit_assignments(id)
        `).eq('incident_id', activeIncidentId).is('released_at', null),
        supabaseClient.from('units').select('id, name, unit_type:unit_types(name)').eq('is_storage', false).order('name'),
        supabaseClient.auth.getUser(),
      ])
      iUnits = iuRes.data; allUnitsData = unitsRes.data; userData = authRes.data
    } catch {}

    setIncident(inc as Incident | null)
    // Load active incidents for reassign dropdown
    const { data: actInc } = await supabaseClient
      .from('incidents')
      .select('id, name')
      .eq('status', 'Active')
      .order('name')
    // Include current incident so switcher shows all active incidents
    const allActive = actInc || []
    if (inc && !allActive.find(i => i.id === inc.id)) {
      allActive.unshift({ id: inc.id, name: inc.name })
    }
    setActiveIncidents(allActive)

    const userId = userData.user?.id ?? null
    setCurrentUserId(userId)

    // Load saved card order
    if (userId) {
      const { data: prefData } = await supabaseClient
        .from('user_preferences')
        .select('dashboard_card_order')
        .eq('auth_user_id', userId)
        .single()
      if (prefData?.dashboard_card_order && Array.isArray(prefData.dashboard_card_order)) {
        // Merge: saved order + any new cards not yet in saved order
        const savedOrder = prefData.dashboard_card_order as string[]
        const merged = [
          ...savedOrder.filter((id: string) => DEFAULT_CARD_ORDER.includes(id)),
          ...DEFAULT_CARD_ORDER.filter(id => !savedOrder.includes(id)),
        ]
        setCardOrder(merged)
      }
    }

    const mappedUnits: IncidentUnit[] = ((iUnits as unknown as Array<{
      id: string
      unit: { id: string; name: string; type?: string } | null
      unit_assignments: { id: string }[]
    }>) || []).map(u => ({
      id: u.id,
      unit: u.unit,
      _crew_count: u.unit_assignments?.length ?? 0,
    }))
    setIncidentUnits(mappedUnits)
    setAllUnits((allUnitsData as Unit[]) || [])

    const assignedUnitIds = mappedUnits.map(u => u.unit?.id).filter(Boolean) as string[]

    const [
      { count: encCount, data: encData },
      { count: marC, data: marData },
      { count: compC },
      { data: srData },
    ] = await Promise.all([
      (async () => {
        // Primary: match by incident UUID
        const r1 = await supabaseClient
          .from('patient_encounters')
          .select('id, date, patient_last_name, patient_first_name, unit, initial_acuity', { count: 'exact' })
          .eq('incident_id', activeIncidentId)
          .order('date', { ascending: false })
          .limit(5)
        if (r1.count && r1.count > 0) return r1
        // Fallback: match by incident name text (for older encounters without incident_id set)
        if ((inc as any)?.name) {
          return supabaseClient
            .from('patient_encounters')
            .select('id, date, patient_last_name, patient_first_name, unit, initial_acuity', { count: 'exact' })
            .ilike('incident', `%${(inc as any).name}%`)
            .order('date', { ascending: false })
            .limit(5)
        }
        return r1
      })(),

      // MAR: join through patient_encounters.incident_id
      (async () => {
        let { data: encIds } = await supabaseClient
          .from('patient_encounters')
          .select('encounter_id')
          .eq('incident_id', activeIncidentId)
        // Fallback: name-based match
        if (!encIds?.length && (inc as any)?.name) {
          const r2 = await supabaseClient.from('patient_encounters').select('encounter_id').ilike('incident', `%${(inc as any).name}%`)
          encIds = r2.data
        }
        const ids = (encIds || []).map((e: { encounter_id: string }) => e.encounter_id)
        if (ids.length === 0) return { count: 0, data: [] }
        return supabaseClient
          .from('dispense_admin_log')
          .select('id, date, item_name, med_unit', { count: 'exact' })
          .in('encounter_id', ids)
          .order('date', { ascending: false })
          .limit(3)
      })(),

      (async () => {
        try {
          // comp_claims now has incident_id UUID column
          let compQuery = supabaseClient
            .from('comp_claims')
            .select('id', { count: 'exact', head: true })
            .eq('incident_id', activeIncidentId)
          if (!isAdmin && assignment.unit?.name) compQuery = (compQuery as any).eq('unit', assignment.unit.name)
          const { count: directCount } = await compQuery
          if (directCount && directCount > 0) return { count: directCount }
          // Fallback: match by incident name text
          const incName = (inc as any)?.name
          if (incName) {
            return supabaseClient.from('comp_claims').select('id', { count: 'exact', head: true }).ilike('incident', `%${incName}%`)
          }
          return { count: 0 }
        } catch { return { count: 0 } }
      })(),

      (async () => {
        const iuIds = mappedUnits.map(u => u.id)
        if (iuIds.length === 0) return { data: [] }
        return supabaseClient
          .from('supply_runs')
          .select('id, run_date, incident_unit:incident_units(unit:units(name))')
          .eq('incident_id', activeIncidentId)
          .order('run_date', { ascending: false })
          .limit(3)
      })(),
    ])

    setEncounterCount(encCount ?? 0)
    setEncounters((encData as EncounterRow[]) || [])
    setMarCount(marC ?? 0)
    setMarEntries((marData as MARRow[]) || [])
    setCompCount(compC ?? 0)

    const srRows = (srData as unknown as SupplyRunRow[]) || []
    setSupplyRuns(srRows)

    if (mappedUnits.length > 0) {
      const iuIds = mappedUnits.map(u => u.id)
      const { count: srCount } = await supabaseClient
        .from('supply_runs')
        .select('id', { count: 'exact', head: true })
        .in('incident_unit_id', iuIds)
      setSupplyCount(srCount ?? 0)
    }

    // Billing summary: sum of supply run items + MAR costs
    ;(async () => {
      try {
        const iuIds = mappedUnits.map(u => u.id)
        let supplyTotal = 0
        if (iuIds.length > 0) {
          const { data: srItems } = await supabaseClient
            .from('supply_run_items')
            .select('total_cost, unit_cost, quantity, supply_run:supply_runs!inner(incident_unit_id)')
            .in('supply_run.incident_unit_id', iuIds)
          supplyTotal = ((srItems as any[]) || []).reduce((sum: number, item: any) => {
            const line = item.total_cost ?? ((item.unit_cost ?? 0) * (item.quantity ?? 1))
            return sum + (line ?? 0)
          }, 0)
        }

        // MAR cost via encounters
        const { data: encIds } = await supabaseClient
          .from('patient_encounters')
          .select('encounter_id')
          .eq('incident_id', activeIncidentId)
        const ids = ((encIds as any[]) || []).map((e: any) => e.encounter_id)
        let marTotal = 0
        if (ids.length > 0) {
          const { data: marCostData } = await supabaseClient
            .from('dispense_admin_log')
            .select('qty_used, formulary:formulary_templates(case_cost, units_per_case)')
            .in('encounter_id', ids)
          marTotal = ((marCostData as any[]) || []).reduce((sum: number, row: any) => {
            const unitCost = row.formulary?.case_cost != null && row.formulary?.units_per_case > 0
              ? row.formulary.case_cost / row.formulary.units_per_case
              : 0
            return sum + unitCost * (row.qty_used ?? 1)
          }, 0)
        }

        setBillingTotal(supplyTotal + marTotal)
      } catch {
        setBillingTotal(0)
      }
    })()

    // Reorder summary: scope to field user's unit or all units for admin
    ;(async () => {
      try {
        if (assignedUnitIds.length === 0) { setReorderCount(0); return }
        // For field users, only count their unit
        const scopedUnitIds = !isAdmin && assignment.unit?.id
          ? assignedUnitIds.filter(uid => uid === assignment.unit!.id)
          : assignedUnitIds
        if (scopedUnitIds.length === 0) { setReorderCount(0); return }
        const { data: allIuData } = await supabaseClient
          .from('incident_units')
          .select('id')
          .in('unit_id', scopedUnitIds)
        const allIuIds = ((allIuData as any[]) || []).map((r: any) => r.id)
        if (allIuIds.length === 0) { setReorderCount(0); return }
        const { data: invData } = await supabaseClient
          .from('unit_inventory')
          .select('id, quantity, par_qty')
          .in('incident_unit_id', allIuIds)
        const low = ((invData as any[]) || []).filter((row: any) =>
          row.par_qty != null && row.quantity <= row.par_qty
        )
        setReorderCount(low.length)
      } catch {
        setReorderCount(0)
      }
    })()

    // ICS 214 logs for this incident
    ;(async () => {
      try {
        const { data: ics214Data } = await supabaseClient
          .from('ics214_headers')
          .select('ics214_id, unit_name, op_date, status')
          .eq('incident_id', activeIncidentId)
          .order('created_at', { ascending: false })
          .limit(5)
        setIcs214Rows((ics214Data as { ics214_id: string; unit_name: string; op_date: string; status: string }[]) || [])
      } catch {
        setIcs214Rows([])
      }
    })()

    // Load deployments
    ;(async () => {
      try {
        const [{ data: depData }, { data: empData }] = await Promise.all([
          supabaseClient
            .from('deployment_records')
            .select('id, employee_id, travel_date, check_in_date, check_out_date, daily_rate, status, notes, employees(name, role)')
            .eq('incident_id', activeIncidentId)
            .order('travel_date', { ascending: false }),
          supabaseClient
            .from('employees')
            .select('id, name, role, daily_rate')
            .eq('is_active', true)
            .order('name'),
        ])
        setDeployments((depData as unknown as DeploymentRecord[]) ?? [])
        setAllEmployees((empData as Employee[]) ?? [])
      } catch {
        setDeployments([])
      }
    })()

    setLoading(false)
  }, [activeIncidentId])

  useEffect(() => { load() }, [load])
  // Reset unit filter when switching incidents
  useEffect(() => { setUnitFilter('All') }, [activeIncidentId])

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingContract(true)
    const path = `contracts/${activeIncidentId}/${file.name}`
    const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploadingContract(false); return }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
    await supabase.from('incidents').update({
      contract_url: urlData.publicUrl,
      contract_file_name: file.name,
    }).eq('id', activeIncidentId)
    setIncident((prev: any) => prev ? { ...prev, contract_url: urlData.publicUrl, contract_file_name: file.name } : prev)
    setUploadingContract(false)
  }

  const saveField = async (key: string, value: string) => {
    if (!incident) return
    await supabase.from('incidents').update({ [key]: value || null }).eq('id', activeIncidentId)
    setIncident(prev => prev ? { ...prev, [key]: value || null } : prev)
  }


  const demobilizeUnit = async (incidentUnitId: string, unitName: string) => {
    if (!confirm(`Remove ${unitName} from this incident? This will release all crew assignments too.`)) return
    await supabase.from('unit_assignments').update({ released_at: new Date().toISOString() }).eq('incident_unit_id', incidentUnitId)
    await supabase.from('incident_units').update({ released_at: new Date().toISOString() }).eq('id', incidentUnitId)
    load()
  }

  const reassignUnit = async (incidentUnitId: string, targetIncidentId: string, unitId: string, unitName: string) => {
    const targetInc = activeIncidents.find(i => i.id === targetIncidentId)
    if (!confirm(`Move ${unitName} to "${targetInc?.name}"? Crew will be released from current assignment.`)) return
    // Release crew from current assignment
    await supabase.from('unit_assignments').update({ released_at: new Date().toISOString() }).eq('incident_unit_id', incidentUnitId)
    // Release current incident_unit
    await supabase.from('incident_units').update({ released_at: new Date().toISOString() }).eq('id', incidentUnitId)
    // Assign unit to new incident
    await supabase.from('incident_units').insert({ incident_id: targetIncidentId, unit_id: unitId })
    load()
  }

  const assignUnit = async () => {
    if (!selectedUnitId) return
    await supabase.from('incident_units').insert({
      incident_id: activeIncidentId,
      unit_id: selectedUnitId,
    })
    setAssigningUnit(false)
    setSelectedUnitId('')
    load()
  }

  // ─── Deployment handlers ────────────────────────────────────────────────────

  const deployedEmployeeIds = new Set(deployments.map(d => d.employee_id))
  const availableEmployees = allEmployees.filter(e => !deployedEmployeeIds.has(e.id))

  const handleEmployeeSelect = (empId: string) => {
    const emp = allEmployees.find(e => e.id === empId)
    setDeployForm(f => ({
      ...f,
      employeeId: empId,
      dailyRate: emp?.daily_rate != null ? String(emp.daily_rate) : f.dailyRate,
    }))
  }

  const handleAddDeployment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deployForm.employeeId) return
    setDeploySubmitting(true)
    const { error } = await supabase.from('deployment_records').insert({
      employee_id: deployForm.employeeId,
      incident_id: activeIncidentId,
      travel_date: deployForm.travelDate,
      daily_rate: parseFloat(deployForm.dailyRate) || 0,
      status: 'Traveling',
      notes: deployForm.notes || null,
      created_by: assignment.employee?.name ?? 'Admin',
    })
    if (error) { alert('Failed to add deployment: ' + error.message); setDeploySubmitting(false); return }
    setShowAddDeployment(false)
    setDeployForm({ employeeId: '', travelDate: new Date().toISOString().split('T')[0], dailyRate: '', notes: '' })
    // Reload deployments
    const { data } = await supabase
      .from('deployment_records')
      .select('id, employee_id, travel_date, check_in_date, check_out_date, daily_rate, status, notes, employees(name, role)')
      .eq('incident_id', activeIncidentId)
      .order('travel_date', { ascending: false })
    setDeployments((data as unknown as DeploymentRecord[]) ?? [])
    setDeploySubmitting(false)
  }

  const handleDeleteDeployment = async (id: string) => {
    if (!confirm('Delete this deployment record?')) return
    await supabase.from('deployment_records').delete().eq('id', id)
    setDeployments(prev => prev.filter(d => d.id !== id))
  }

  const handleSaveDeployEdit = async (id: string) => {
    const fields = editDeployFields
    // Auto-set status when check_out_date set
    if (fields.check_out_date && fields.check_out_date !== '') {
      fields.status = 'Released'
    }
    await supabase.from('deployment_records').update({
      ...fields,
      admin_override_by: assignment.employee?.name ?? 'Admin',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    const { data } = await supabase
      .from('deployment_records')
      .select('id, employee_id, travel_date, check_in_date, check_out_date, daily_rate, status, notes, employees(name, role)')
      .eq('incident_id', activeIncidentId)
      .order('travel_date', { ascending: false })
    setDeployments((data as unknown as DeploymentRecord[]) ?? [])
    setEditingDeployId(null)
    setEditDeployFields({})
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = cardOrder.indexOf(active.id as string)
    const newIndex = cardOrder.indexOf(over.id as string)
    const newOrder = arrayMove(cardOrder, oldIndex, newIndex)
    setCardOrder(newOrder)

    // Persist to user_preferences
    if (currentUserId) {
      await supabase.from('user_preferences').upsert({
        auth_user_id: currentUserId,
        dashboard_card_order: newOrder,
      }, { onConflict: 'auth_user_id' })
    }
  }

  const assignedUnitIds = new Set(incidentUnits.map(iu => iu.unit?.id).filter(Boolean))
  const availableUnits = allUnits.filter(u => !assignedUnitIds.has(u.id))

  if (loading) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Loading incident...</p>
      </div>
    </div>
  )

  if (!incident) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 mb-4">Incident not found.</p>
        <Link to="/incidents" className="text-red-400 underline text-sm">← All Incidents</Link>
      </div>
    </div>
  )

  // ─── Card render map ────────────────────────────────────────────────────────

  const inputCls = 'bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500'
  const labelCls = 'text-xs text-gray-500 uppercase tracking-wide font-bold mb-1 block'

  const renderCard = (cardId: string, dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => {
    switch (cardId) {

      case 'deployments':
        if (!isAdmin) return null
        return (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-slate-800/90">
              {dragHandleProps && (
                <div
                  {...dragHandleProps}
                  className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none"
                >⠿</div>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">👥 Deployments</h3>
              <span className="text-xl font-bold text-white">{deployments.length}</span>
            </div>

            {/* Table */}
            {deployments.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-800/30">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Employee</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Role</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Travel</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Check-In</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Check-Out</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Status</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Days</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Pay</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {deployments.map(dep => {
                      const days = calcDays(dep.travel_date, dep.check_out_date)
                      const pay = days * dep.daily_rate
                      const isActive = dep.status === 'Traveling' || dep.status === 'On Scene'
                      const isEditing = editingDeployId === dep.id

                      if (isEditing) {
                        return (
                          <tr key={dep.id} className="bg-gray-800/50">
                            <td className="px-3 py-2 text-white font-medium" colSpan={2}>
                              {dep.employees?.name ?? '—'} · {dep.employees?.role ?? ''}
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" defaultValue={dep.travel_date}
                                onChange={e => setEditDeployFields(f => ({ ...f, travel_date: e.target.value, admin_override_checkin: e.target.value }))}
                                className={inputCls} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" defaultValue={dep.check_in_date ?? ''}
                                onChange={e => setEditDeployFields(f => ({ ...f, check_in_date: e.target.value || null, admin_override_checkin: e.target.value }))}
                                className={inputCls} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="date" defaultValue={dep.check_out_date ?? ''}
                                onChange={e => setEditDeployFields(f => ({ ...f, check_out_date: e.target.value || null, admin_override_checkout: e.target.value }))}
                                className={inputCls} />
                            </td>
                            <td className="px-3 py-2">
                              <select defaultValue={dep.status}
                                onChange={e => setEditDeployFields(f => ({ ...f, status: e.target.value }))}
                                className={inputCls}>
                                {['Traveling', 'On Scene', 'Released', 'Emergency Release'].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">{days}</td>
                            <td className="px-3 py-2 text-right text-green-400">{fmtCurrency(pay)}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button onClick={() => handleSaveDeployEdit(dep.id)}
                                  className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-semibold">Save</button>
                                <button onClick={() => { setEditingDeployId(null); setEditDeployFields({}) }}
                                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={dep.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="px-3 py-2 text-white font-medium">{dep.employees?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-400">{dep.employees?.role ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-400">{formatDeployDate(dep.travel_date)}</td>
                          <td className="px-3 py-2 text-gray-400">{formatDeployDate(dep.check_in_date)}</td>
                          <td className="px-3 py-2 text-gray-400">{formatDeployDate(dep.check_out_date)}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              dep.status === 'On Scene' ? 'bg-green-900/60 text-green-300' :
                              dep.status === 'Traveling' ? 'bg-yellow-900/60 text-yellow-300' :
                              dep.status === 'Released' ? 'bg-gray-700 text-gray-400' :
                              'bg-red-900/60 text-red-300'
                            }`}>
                              {isActive && '🔴 '}{dep.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {days}
                            {isActive && <span className="ml-1 text-gray-500 text-xs">+</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-400">{fmtCurrency(pay)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => { setEditingDeployId(dep.id); setEditDeployFields({}) }}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Edit</button>
                              <button onClick={() => handleDeleteDeployment(dep.id)}
                                className="px-2 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 rounded text-xs">Del</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {deployments.length === 0 && !showAddDeployment && (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No deployments on this incident</p>
            )}

            {/* Add Deployment Form */}
            {showAddDeployment && (
              <form onSubmit={handleAddDeployment} className="border-t border-gray-800 p-4 space-y-3 bg-gray-800/30">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Add Deployment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Employee</label>
                    <select value={deployForm.employeeId} onChange={e => handleEmployeeSelect(e.target.value)}
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                      <option value="">Select employee...</option>
                      {availableEmployees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Travel Date</label>
                    <input type="date" value={deployForm.travelDate}
                      onChange={e => setDeployForm(f => ({ ...f, travelDate: e.target.value }))}
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className={labelCls}>Daily Rate ($)</label>
                    <input type="number" step="0.01" value={deployForm.dailyRate}
                      onChange={e => setDeployForm(f => ({ ...f, dailyRate: e.target.value }))}
                      placeholder="e.g. 1800"
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Notes (optional)</label>
                    <input type="text" value={deployForm.notes}
                      onChange={e => setDeployForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any notes..."
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={deploySubmitting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
                    {deploySubmitting ? 'Adding...' : 'Add Deployment'}
                  </button>
                  <button type="button" onClick={() => setShowAddDeployment(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/30">
              <div className="flex-1" />
              {!showAddDeployment && (
                <button onClick={() => setShowAddDeployment(true)}
                  className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">
                  + Add Deployment
                </button>
              )}
            </div>
          </div>
        )

      case 'encounters':
        return (
          <StatCard
            title="Patient Encounters"
            count={encounterCount}
            viewAllHref={`/encounters?activeIncidentId=${activeIncidentId}`}
            newHref={`/encounters/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New PCR"
            dragHandleProps={dragHandleProps}
          >
            {/* Sub-filter for field users */}
            {isAdmin ? null : (
              <div className="flex gap-1.5 px-4 pt-2">
                <button onClick={() => setEncounterSubFilter('unit')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${encounterSubFilter === 'unit' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  Unit Encounters
                </button>
                <button onClick={() => setEncounterSubFilter('mine')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${encounterSubFilter === 'mine' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  My Encounters
                </button>
              </div>
            )}
            {(() => {
              const myName = assignment.employee?.name
              const filteredEncs = encounters.filter(enc => {
                if (isAdmin) return unitFilter === 'All' || enc.unit === unitFilter
                if (encounterSubFilter === 'mine') return (enc as any).created_by === myName || (enc as any).provider_of_record === myName
                return enc.unit === assignment.unit?.name
              })
              return filteredEncs.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-800/30">
                  <span className="w-20 shrink-0">Date</span>
                  <span className="flex-1 min-w-0">Patient</span>
                  <span className="w-24 shrink-0 hidden sm:block">Unit</span>
                  <span className="w-16 shrink-0 text-right">Acuity</span>
                </div>
                {filteredEncs.map(enc => (
                  <Link
                    key={enc.id}
                    to={`/encounters/${enc.id}`}
                    className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
                  >
                    <span className="w-20 shrink-0 text-gray-400 text-xs">{enc.date || '—'}</span>
                    <span className="flex-1 min-w-0 truncate pr-1">
                      {[enc.patient_last_name, enc.patient_first_name].filter(Boolean).join(', ') || 'Unknown'}
                    </span>
                    <span className="w-24 shrink-0 text-gray-400 text-xs truncate hidden sm:block">{enc.unit || '—'}</span>
                    <span className="w-16 shrink-0 text-right text-xs text-gray-400">{(enc as any).initial_acuity?.split(' ')[0] || '—'}</span>
                  </Link>
                ))}
              </>
            ) : (
              <p className="text-center text-gray-600 text-sm py-4">No encounters recorded</p>
            )
            })()}
          </StatCard>
        )

      case 'mar':
        return (
          <StatCard
            title="Medication Administration"
            count={marCount}
            viewAllHref={`/mar?activeIncidentId=${activeIncidentId}`}
            dragHandleProps={dragHandleProps}
          >
            {marEntries.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-800/30">
                  <span className="w-20 shrink-0">Date</span>
                  <span className="flex-1 min-w-0">Med</span>
                  <span className="w-24 shrink-0 text-right">Unit</span>
                </div>
                {marEntries.filter(e => {
                    if (isAdmin) return unitFilter === 'All' || e.med_unit === unitFilter
                    return e.med_unit === assignment.unit?.name
                  }).map(entry => (
                  <Link
                    key={entry.id}
                    to={`/mar/${entry.id}`}
                    className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
                  >
                    <span className="w-20 shrink-0 text-gray-400 text-xs">{entry.date || '—'}</span>
                    <span className="flex-1 min-w-0 truncate pr-1">{entry.item_name || '—'}</span>
                    <span className="w-24 shrink-0 text-right text-xs text-gray-400 truncate">{entry.med_unit || '—'}</span>
                  </Link>
                ))}
              </>
            ) : (
              <p className="text-center text-gray-600 text-sm py-4">No MAR entries</p>
            )}
          </StatCard>
        )

      case 'comp-claims':
        return (
          <StatCard
            title="Comp Claims"
            count={compCount}
            viewAllHref={`/comp-claims?activeIncidentId=${activeIncidentId}`}
            newHref={`/comp-claims/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New Claim"
            dragHandleProps={dragHandleProps}
          >
            {compCount === 0 && (
              <p className="text-center text-gray-600 text-sm py-4">No claims filed</p>
            )}
          </StatCard>
        )

      case 'supply-runs':
        return (
          <StatCard
            title="Supply Runs"
            count={supplyCount}
            viewAllHref={`/supply-runs?activeIncidentId=${activeIncidentId}`}
            newHref={`/supply-runs/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New Run"
            dragHandleProps={dragHandleProps}
          >
            {supplyRuns.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-800/30">
                  <span className="w-24 shrink-0">Date</span>
                  <span className="flex-1 min-w-0">Unit</span>
                  <span className="w-16 shrink-0 text-right">Items</span>
                </div>
                {supplyRuns.filter(sr => effectiveUnitFilter === 'All' || (sr.incident_unit as any)?.unit?.name === effectiveUnitFilter).map(sr => (
                  <Link
                    key={sr.id}
                    to={`/supply-runs/${sr.id}`}
                    className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
                  >
                    <span className="w-24 shrink-0 text-gray-400 text-xs">{sr.run_date || '—'}</span>
                    <span className="flex-1 min-w-0 truncate pr-1 text-xs">
                      {(sr.incident_unit as unknown as { unit?: { name?: string } } | null)?.unit?.name || '—'}
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs text-gray-400">{sr.item_count ?? 0}</span>
                  </Link>
                ))}
              </>
            ) : (
              <p className="text-center text-gray-600 text-sm py-4">No supply runs</p>
            )}
          </StatCard>
        )

      case 'billing-summary':
        if (!isAdmin) return null
        return (
          <StatCard
            title="Billing Summary"
            count={billingTotal != null
              ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(billingTotal)
              : '…'}
            viewAllHref={`/billing?activeIncidentId=${activeIncidentId}`}
            dragHandleProps={dragHandleProps}
          >
            <div className="px-4 py-3 text-sm text-gray-400">
              {billingTotal != null ? (
                <p>Total billed cost across supply runs and medications.</p>
              ) : (
                <p className="text-gray-600 text-xs">Calculating...</p>
              )}
            </div>
          </StatCard>
        )

      case 'reorder-summary':
        return (
          <StatCard
            title="Reorder Needed"
            count={reorderCount ?? '…'}
            viewAllHref={`/inventory/reorder?activeIncidentId=${activeIncidentId}`}
            dragHandleProps={dragHandleProps}
          >
            <div className="px-4 py-3 text-sm text-gray-400">
              {reorderCount != null ? (
                reorderCount === 0
                  ? <p className="text-green-400 text-xs">All items at or above par. ✓</p>
                  : <p>{reorderCount} item{reorderCount !== 1 ? 's' : ''} at or below par{!isAdmin && assignment.unit?.name ? ` on ${assignment.unit.name}` : ' across all units'}.</p>
              ) : (
                <p className="text-gray-600 text-xs">Calculating...</p>
              )}
            </div>
          </StatCard>
        )

      case 'ics214':
        return (
          <StatCard
            title="ICS 214 Logs"
            count={effectiveUnitFilter === 'All' ? ics214Rows.length : ics214Rows.filter(r => r.unit_name === effectiveUnitFilter).length}
            viewAllHref={`/ics214?activeIncidentId=${activeIncidentId}`}
            newHref={`/ics214/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New 214"
            dragHandleProps={dragHandleProps}
          >
            {(() => {
              const filteredIcs = effectiveUnitFilter === 'All' ? ics214Rows : ics214Rows.filter(r => r.unit_name === effectiveUnitFilter)
              if (filteredIcs.length === 0) return <p className="text-center text-gray-600 text-sm py-4">No 214 logs for this unit/incident</p>
              return (
                <>
                  <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-800/30">
                    <span className="flex-1 min-w-0">214 ID</span>
                    <span className="w-24 shrink-0">Unit</span>
                    <span className="w-16 shrink-0 text-right">Status</span>
                  </div>
                  {filteredIcs.map(row => (
                    <Link
                      key={row.ics214_id}
                      to={`/ics214/${row.ics214_id}`}
                      className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
                    >
                      <span className="flex-1 min-w-0 font-mono text-xs text-gray-300 truncate pr-1">{row.ics214_id}</span>
                      <span className="w-24 shrink-0 text-gray-400 text-xs truncate">{row.unit_name}</span>
                      <span className={`w-16 shrink-0 text-right text-xs font-semibold ${
                        row.status === 'Open' ? 'text-green-400' : 'text-gray-500'
                      }`}>{row.status}</span>
                    </Link>
                  ))}
                </>
              )
            })()}
          </StatCard>
        )

      default:
        return null
    }
  }


  const handleCloseOut = async () => {
    if (!closeoutDt) return
    const closedAt = new Date(closeoutDt).toISOString()
    const { error } = await supabase.from('incidents').update({
      status: 'Closed',
      end_date: closeoutDt.split('T')[0],
      closed_at: closedAt,
      closed_by: assignment.employee?.name || 'Admin',
    }).eq('id', activeIncidentId)
    if (error) { alert('Failed to close incident: ' + error.message); return }
    setIncident(prev => prev ? { ...prev, status: 'Closed', end_date: closeoutDt.split('T')[0], closed_at: closedAt } : prev)
    setClosingOut(false)
    // Trigger payroll report generation
    generatePayrollReport(closedAt)
  }

  const generatePayrollReport = async (closedAt: string) => {
    // Gather all deployments + hours for this incident
    const { data: deps } = await supabase
      .from('deployments')
      .select('employee_name, employee_role, check_in, check_out, hours_worked, daily_rate')
      .eq('incident_id', activeIncidentId)
      .order('check_in', { ascending: true })
    const rows = (deps || []) as any[]
    const totalHours = rows.reduce((s: number, r: any) => s + (r.hours_worked || 0), 0)
    const totalPay = rows.reduce((s: number, r: any) => {
      const h = r.hours_worked || 0
      const rate = r.daily_rate || 0
      return s + (rate > 0 ? (h / 24) * rate : 0)
    }, 0)
    // Save report to payroll_reports table (create if needed) or just notes for now
    // For now save as a note in the incident
    const reportText = [
      `FINAL PAYROLL REPORT — ${incident?.name}`,
      `Closed: ${new Date(closedAt).toLocaleString()}`,
      `Closed by: ${assignment.employee?.name || 'Admin'}`,
      ``,
      `PERSONNEL SUMMARY (${rows.length} deployment records)`,
      ...rows.map((r: any) => `  ${r.employee_name || 'Unknown'} (${r.employee_role || '—'}): ${r.hours_worked || 0}h`),
      ``,
      `Total Hours: ${totalHours.toFixed(1)}`,
      `Total Est. Pay: $${totalPay.toFixed(2)}`,
      ``,
      `Report generated: ${new Date().toLocaleString()}`,
      `For: Amanda Bragg (Bookkeeper)`,
    ].join('\n')
    await supabase.from('incidents').update({ notes: reportText }).eq('id', activeIncidentId)
    alert(`✅ Incident closed. Payroll report generated and saved to incident notes. Ready for Amanda Bragg.`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-5xl mx-auto p-4 md:p-6">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-5 pt-2">
          <Link to="/incidents" className="text-gray-500 hover:text-white text-sm">← Incidents</Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm font-medium truncate">{incident.name}</span>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full shrink-0 ${
            incident.status === 'Active'
              ? 'bg-green-900 text-green-300'
              : 'bg-gray-700 text-gray-400'
          }`}>
            {incident.status}
          </span>
          {isAdmin && incident.status === 'Active' && (
            <a href={`/incidents/${activeIncidentId}/shift-ticket`}
              className="ml-2 text-xs px-3 py-1 bg-blue-800 hover:bg-blue-700 text-blue-200 rounded-lg font-medium transition-colors shrink-0">
              📄 OF-297
            </a>
          )}
          {isAdmin && incident.status === 'Active' && !closingOut && (
            <button onClick={() => {
              setCloseoutDt(new Date().toISOString().slice(0,16))
              setClosingOut(true)
            }} className="ml-2 text-xs px-3 py-1 bg-orange-800 hover:bg-orange-700 text-orange-200 rounded-lg font-medium transition-colors shrink-0">
              Close Out
            </button>
          )}
        </div>

        {/* Close-out panel */}
        {closingOut && isAdmin && (
          <div className="bg-orange-950/60 border border-orange-700 rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-bold text-orange-300">🔒 Close Out Incident</h3>
            <p className="text-xs text-orange-200/80">Set the official close date/time. This will mark the incident as Closed, record the timestamp, and generate a final payroll report for Amanda Bragg (bookkeeper).</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Close Date &amp; Time</label>
                <input type="datetime-local" value={closeoutDt} onChange={e => setCloseoutDt(e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleCloseOut} disabled={!closeoutDt}
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  Confirm Close Out
                </button>
                <button onClick={() => setClosingOut(false)}
                  className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offline Data Banner */}
        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-2">
            📦 Showing cached data — changes will sync when back online
          </div>
        )}

        {/* Closed banner */}
        {incident.status === 'Closed' && (incident as any).closed_at && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-3">
            <span className="text-gray-400 text-sm">📁 Closed</span>
            <span className="text-gray-300 text-sm font-medium">{new Date((incident as any).closed_at).toLocaleString()}</span>
            {(incident as any).closed_by && <span className="text-gray-500 text-xs">by {(incident as any).closed_by}</span>}
          </div>
        )}

        {/* Incident switcher pills moved to top-left above incident card */}

        {/* 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4">

            {/* Incident switcher pills — top-left above incident card */}
            {isAdmin && activeIncidents.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {activeIncidents.map((inc, i) => (
                  <button key={inc.id}
                    onClick={() => setActiveIncidentId(inc.id)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      inc.id === activeIncidentId
                        ? ['bg-teal-700 text-white','bg-amber-700 text-white','bg-indigo-700 text-white'][i % 3]
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    🔥 {inc.name}
                  </button>
                ))}
              </div>
            )}

            {/* Incident Info Card */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Incident Info</h2>
                {incident.status === "Active" ? <span className="text-xs text-gray-600 italic">Click any field to edit</span> : <span className="text-xs text-gray-600 italic">Closed — read only</span>}
              </div>
              <div className="p-4 space-y-1">
                <div className="grid grid-cols-1 gap-1">
                  <EditField label="Name" value={incident.name} fieldKey="name" onSave={saveField} />
                  <LocationEditField
                    value={incident.location}
                    latitude={incident.latitude}
                    longitude={incident.longitude}
                    onSave={saveField}
                    onSaveCoords={(lat, lng, label) => {
                      saveField('location', label)
                      saveField('latitude', String(lat))
                      saveField('longitude', String(lng))
                    }}
                  />
                  <EditField label="Incident Number" value={incident.incident_number} fieldKey="incident_number" onSave={saveField} />
                  <EditField label="Agreement Number" value={(incident as any).agreement_number} fieldKey="agreement_number" onSave={saveField} />
                  <EditField label="Resource Order Number" value={(incident as any).resource_order_number} fieldKey="resource_order_number" onSave={saveField} />
                  <EditField label="Financial Code" value={(incident as any).financial_code} fieldKey="financial_code" onSave={saveField} />
                  <EditField label="Start Date" value={incident.start_date} fieldKey="start_date" type="date" onSave={saveField} />
                  <EditField
                    label="Status"
                    value={incident.status}
                    fieldKey="status"
                    onSave={saveField}
                    options={[
                      { label: 'Active', value: 'Active' },
                      { label: 'Closed', value: 'Closed' },
                    ]}
                  />
                </div>

                {isAdmin && (
                  <div className="pt-2 border-t border-gray-800 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Contract Document</p>
                      {uploadingContract && <span className="text-xs text-gray-500 animate-pulse">Uploading...</span>}
                    </div>
                    {incident.contract_url ? (
                      <div className="flex items-center gap-2">
                        <a href={incident.contract_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 truncate flex-1">
                          📄 {incident.contract_file_name || 'View Contract'}
                        </a>
                        <label className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
                          Replace
                          <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleContractUpload} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                        <span className="text-sm text-gray-400">📎 Upload Contract PDF</span>
                        <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleContractUpload} />
                      </label>
                    )}
                  </div>
                )}

                {[
                  { label: 'Med Unit Leader', name: incident.med_unit_leader_name, nameKey: 'med_unit_leader_name', email: incident.med_unit_leader_email, emailKey: 'med_unit_leader_email', phone: incident.med_unit_leader_phone, phoneKey: 'med_unit_leader_phone' },
                  { label: 'Logs Contact', name: incident.logs_contact_name, nameKey: 'logs_contact_name', email: incident.logs_contact_email, emailKey: 'logs_contact_email', phone: incident.logs_contact_phone, phoneKey: 'logs_contact_phone' },
                  { label: 'Comp Claims Contact', name: incident.comp_claims_name, nameKey: 'comp_claims_name', email: incident.comp_claims_email, emailKey: 'comp_claims_email', phone: incident.comp_claims_phone, phoneKey: 'comp_claims_phone' },
                  { label: 'Finance Contact (OF-297)', name: (incident as any).finance_contact_name, nameKey: 'finance_contact_name', email: (incident as any).finance_contact_email, emailKey: 'finance_contact_email', phone: (incident as any).finance_contact_phone, phoneKey: 'finance_contact_phone' },
                ].map(contact => (
                  <div key={contact.label} className="pt-2 border-t border-gray-800 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{contact.label}</p>
                      {(contact.email || contact.phone) && (
                        <div className="flex gap-2">
                          {contact.phone && (
                            <>
                              <a href={`tel:${contact.phone}`} className="text-green-400 hover:text-green-300 text-sm" title="Call">📞</a>
                              <a href={`sms:${contact.phone}`} className="text-blue-400 hover:text-blue-300 text-sm" title="Text">💬</a>
                            </>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-yellow-400 hover:text-yellow-300 text-sm" title="Email">✉️</a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      <EditField label="Name" value={contact.name} fieldKey={contact.nameKey} onSave={saveField} />
                      <EditField label="Email" value={contact.email} fieldKey={contact.emailKey} type="email" onSave={saveField} />
                      <EditField label="Phone" value={contact.phone} fieldKey={contact.phoneKey} type="tel" onSave={saveField} />
                    </div>
                  </div>
                ))}
                <div />
              </div>
            </div>

            {/* Units Card */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Units ({incidentUnits.length})</h2>
                {isAdmin && (
                  <button
                    onClick={() => setAssigningUnit(v => !v)}
                    className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {assigningUnit ? '✕' : '+ Assign Unit'}
                  </button>
                )}
              </div>

              {assigningUnit && (
                <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/50 flex gap-2">
                  <select
                    value={selectedUnitId}
                    onChange={e => setSelectedUnitId(e.target.value)}
                    className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Select unit...</option>
                    {availableUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.name}{(u as any).unit_type?.name ? ` (${(u as any).unit_type.name})` : ''}</option>
                    ))}
                  </select>
                  <button
                    onClick={assignUnit}
                    disabled={!selectedUnitId}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Assign
                  </button>
                </div>
              )}

              {incidentUnits.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-600 text-center">No units assigned yet.</p>
              ) : (
                <div className="divide-y divide-gray-800/60">
                  {incidentUnits.map(iu => (
                    <div key={iu.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors group">
                      <Link to={`/units/${iu.unit?.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                        <div>
                          <p className="text-sm font-medium">{iu.unit?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{iu._crew_count} crew assigned</p>
                        </div>
                        {(iu.unit as any)?.unit_type?.name && (() => {
                          const t = (iu.unit as any).unit_type.name
                          const cls = t === 'Ambulance' ? 'bg-red-900 text-red-300' : t === 'Med Unit' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
                          return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{t}</span>
                        })()}
                      </Link>
                      {isAdmin && <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-2">
                        {activeIncidents.length > 0 && (
                          <select
                            className="text-xs bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500"
                            defaultValue=""
                            onChange={e => { if (e.target.value) reassignUnit(iu.id, e.target.value, iu.unit?.id || '', iu.unit?.name || 'unit') }}
                            title="Move to another active incident"
                          >
                            <option value="" disabled>Move to fire...</option>
                            {activeIncidents.map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => demobilizeUnit(iu.id, iu.unit?.name || 'unit')}
                          className="text-xs px-2 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 rounded transition-colors whitespace-nowrap"
                          title="Remove from incident"
                        >
                          Demob
                        </button>
                      </div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* ── RIGHT COLUMN — Draggable Cards ── */}
          <div>
            {/* Unit filter tabs — sorted: Warehouse → Med Unit → Ambulance → REMS */}
            {/* Build unit list from ALL data ever linked to incident, not just currently assigned units */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
              {(() => {
                const unitTypeOrderMap: Record<string, number> = { 'Warehouse': 0, 'Med Unit': 1, 'Ambulance': 2, 'REMS': 3 }
                const unitTypeColorMap: Record<string, string> = { 'Warehouse': 'bg-purple-700 text-white', 'Med Unit': 'bg-blue-700 text-white', 'Ambulance': 'bg-red-700 text-white', 'REMS': 'bg-green-700 text-white' }
                // Collect all unique units from encounters, MAR, supply runs that ever appeared for this incident
                const unitsFromData = new Set<string>()
                encounters.forEach(enc => { if (enc.unit) unitsFromData.add(enc.unit) })
                marEntries.forEach(mar => { if ((mar as any).med_unit) unitsFromData.add((mar as any).med_unit) })
                supplyRuns.forEach(sr => { if ((sr as any).unit) unitsFromData.add((sr as any).unit) })
                // Sort by type priority, then name
                const sortedUnits = Array.from(unitsFromData)
                  .map(unitName => {
                    const currentAssignment = incidentUnits.find(iu => (iu.unit as any)?.name === unitName)?.unit
                    const typeName = (currentAssignment as any)?.unit_type?.name || ''
                    return { name: unitName, typeName }
                  })
                  .sort((a, b) => {
                    const aOrder = unitTypeOrderMap[a.typeName] ?? 99
                    const bOrder = unitTypeOrderMap[b.typeName] ?? 99
                    return aOrder !== bOrder ? aOrder - bOrder : a.name.localeCompare(b.name)
                  })
                return ['All', ...sortedUnits.map(u => u.name)].map(u => {
                  const typeName = u === 'All' ? 'All' : sortedUnits.find(su => su.name === u)?.typeName || ''
                  const activeClass = u === 'All' ? 'bg-gray-600 text-white' : (unitTypeColorMap[typeName] || 'bg-gray-600 text-white')
                  return (
                    <button key={u} onClick={() => setUnitFilter(u)}
                      className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                        unitFilter === u ? activeClass : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>{u}</button>
                  )
                })
              })()}
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {cardOrder.map(cardId => (
                    <SortableCard key={cardId} id={cardId}>
                      {(dragHandleProps) => renderCard(cardId, dragHandleProps) ?? <div />}
                    </SortableCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

        </div>

      </div>
    </div>
  )
}
