

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
  assigned_at?: string | null
  released_at?: string | null
  daily_contract_rate?: number | null
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
  // Row 1: 1/3 each
  'units',
  'encounters',
  'supply-runs',
  // Row 2: 1/3 each
  'reorder-summary',
  'mar',
  'ics214',
  // Row 3: 1/3 each
  'billing-summary',
  'expenses',
  'comp-claims',
  // Row 4: full-width
  'deployments',
  // Row 5: full-width
  'unit-revenue',
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

// Merged view: unit_assignment enriched with optional deployment_records data
type CrewDeployment = {
  assignment_id: string
  employee_id: string
  employee_name: string
  employee_role: string
  employee_headshot_url: string | null
  unit_name: string
  daily_rate: number
  hours_per_day: number
  released_at: string | null
  assigned_at: string | null
  // From unit_assignment or deployment_records
  deployment_id: string | null
  travel_date: string | null
  check_in_at: string | null
  check_out_at: string | null
  deploy_status: string
  notes: string | null
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
  expandedChildren,
  viewAllHref,
  newHref,
  newLabel,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  title: string
  count: number | string
  children?: React.ReactNode
  expandedChildren?: React.ReactNode
  viewAllHref?: string
  newHref?: string
  newLabel?: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [overlayAnimate, setOverlayAnimate] = useState(false)
  // Origin rect for slide-from-card animation
  const [originRect, setOriginRect] = useState<DOMRect | null>(null)

  const openExpanded = () => {
    // Capture card position before expanding
    if (cardRef.current) {
      setOriginRect(cardRef.current.getBoundingClientRect())
    }
    setExpanded(true)
    setOverlayVisible(true)
    // Trigger animation on next frame
    requestAnimationFrame(() => requestAnimationFrame(() => setOverlayAnimate(true)))
  }

  const closeExpanded = () => {
    setOverlayAnimate(false)
    // Wait for exit animation then unmount
    setTimeout(() => {
      setOverlayVisible(false)
      setExpanded(false)
      setOriginRect(null)
    }, 300)
  }

  // Compute the transform to go from center-of-viewport to origin card position
  const getOriginTransform = () => {
    if (!originRect) return 'scale(0.92) translateY(16px)'
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Target overlay is centered, max-w-4xl (56rem = 896px), max-h 90vh
    const targetW = Math.min(896, vw - 32)
    const targetH = Math.min(vh * 0.9, vh - 32)
    const targetX = (vw - targetW) / 2
    const targetY = (vh - targetH) / 2
    // Offset from target center to origin card center
    const dx = (originRect.left + originRect.width / 2) - (targetX + targetW / 2)
    const dy = (originRect.top + originRect.height / 2) - (targetY + targetH / 2)
    const scaleX = originRect.width / targetW
    const scaleY = originRect.height / targetH
    const s = Math.min(scaleX, scaleY, 0.95)
    return `translate(${dx}px, ${dy}px) scale(${s})`
  }

  // Expanded overlay — slides up from card position
  const expandedOverlay = overlayVisible ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: overlayAnimate ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0)',
        transition: 'background-color 300ms ease-out',
      }}
      onClick={closeExpanded}
    >
      <div
        className="rounded-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col"
        style={{
          backgroundColor: 'var(--color-card-bg, #111827)',
          borderColor: 'var(--color-border, #1f2937)',
          transform: overlayAnimate ? 'translate(0,0) scale(1)' : getOriginTransform(),
          opacity: overlayAnimate ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ backgroundColor: 'var(--color-header-bg, #030712)', borderColor: 'var(--color-border, #1f2937)' }}>
          <h2 className="text-sm font-bold text-white flex-1">{title}</h2>
          <span className="text-xl font-bold text-white mr-2">{count}</span>
          <button onClick={closeExpanded} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {expandedChildren || children}
        </div>
        <div className="px-6 py-3 border-t theme-border flex items-center gap-2">
          {viewAllHref && (
            <Link to={viewAllHref} className="text-xs text-gray-400 hover:text-white transition-colors">View all →</Link>
          )}
          <div className="flex-1" />
          {newHref && (
            <Link to={newHref} className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">{newLabel || '+ New'}</Link>
          )}
          <button onClick={closeExpanded} className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Close</button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
    {expandedOverlay}
    <div ref={cardRef} className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
      {/* Card header — uses theme header color */}
      <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none"
            title="Drag to reorder"
          >
            ⠿
          </div>
        )}
        {cycleSpan && (
          <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
            className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0 hidden md:inline-block">
            {`${span || 3}/3`}
          </button>
        )}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">{title}</h3>
        <span className="text-2xl font-bold text-white">{count}</span>
        {(expandedChildren || children) && (
          <button
            onClick={openExpanded}
            className="ml-1 text-gray-500 hover:text-white transition-colors text-sm"
            title="Expand"
          >
            ⤢
          </button>
        )}
      </div>
      {/* Collapsed rows — fills remaining card height */}
      {children && (
        <div className="divide-y divide-gray-800/60 overflow-y-auto flex-1">
          {children}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-2 theme-card-footer mt-auto">
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
    </>
  )
}

// ─── Sortable Card Wrapper ───────────────────────────────────────────────────

// Mobile always col-span-1; spans only apply at md+ (2-col) and lg+ (3-col)
const COL_SPAN_CLASSES: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-1 md:col-span-2',
  3: 'col-span-1 md:col-span-2 lg:col-span-3',
}

function SortableCard({
  id,
  children,
  colSpan = 3,
}: {
  id: string
  colSpan?: 1 | 2 | 3
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
    <div ref={setNodeRef} style={{ ...style, display: 'flex', flexDirection: 'column' }} className={`group ${COL_SPAN_CLASSES[colSpan] || 'col-span-3'}`}>
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
  const [allIncidentUnits, setAllIncidentUnits] = useState<IncidentUnit[]>([]) // includes released, for revenue
  const [allUnits, setAllUnits] = useState<Unit[]>([])
  const [assigningUnit, setAssigningUnit] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadingContract, setUploadingContract] = useState(false)

  // Default fire preference (localStorage)
  const [defaultFireId, setDefaultFireId] = useState<string | null>(() => {
    try { return localStorage.getItem('default_incident_id') } catch { return null }
  })
  const isDefaultFire = defaultFireId === activeIncidentId
  const toggleDefaultFire = () => {
    try {
      if (isDefaultFire) {
        localStorage.removeItem('default_incident_id')
        setDefaultFireId(null)
      } else {
        localStorage.setItem('default_incident_id', activeIncidentId)
        setDefaultFireId(activeIncidentId)
      }
    } catch {}
  }

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

  // Deployments (merged view from unit_assignments + deployment_records)
  const [crewDeployments, setCrewDeployments] = useState<CrewDeployment[]>([])
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

  // Comp claims rows
  const [compRows, setCompRows] = useState<{ id: string; patient_name: string | null; unit: string | null; date_of_injury: string | null; status: string | null; injury_type: string | null; pdf_url: string | null }[]>([])
  // Reorder rows
  const [reorderRows, setReorderRows] = useState<{ id: string; item_name: string; quantity: number; par_qty: number; unit_name: string }[]>([])
  // ICS 214
  const [ics214Rows, setIcs214Rows] = useState<{ ics214_id: string; unit_name: string; op_date: string; status: string }[]>([])

  // Expenses
  const [expenses, setExpenses] = useState<{ id: string; expense_type: string; amount: number; description: string | null; expense_date: string; unit_id: string | null; employee_id: string | null; created_by: string | null; receipt_url: string | null; employees?: { name: string } | null }[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ type: 'Gas', amount: '', description: '', date: new Date().toISOString().split('T')[0], unitId: '' })
  const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null)
  const [expenseNoReceiptReason, setExpenseNoReceiptReason] = useState('')
  const [expenseSubmitting, setExpenseSubmitting] = useState(false)
  const expenseReceiptRef = useRef<HTMLInputElement>(null)
  // Contract rate editing
  const [editingRateIuId, setEditingRateIuId] = useState<string | null>(null)
  const [editRateVal, setEditRateVal] = useState('')
  // Card order + widths
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_CARD_ORDER)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Default column spans per card (out of 4)
  const DEFAULT_SPANS: Record<string, number> = {
    'units': 1, 'encounters': 1, 'supply-runs': 1,
    'reorder-summary': 1, 'mar': 1, 'ics214': 1,
    'billing-summary': 1, 'expenses': 1, 'comp-claims': 1,
    'deployments': 3, 'unit-revenue': 3,
  }
  const [cardSpans, setCardSpans] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('incident_card_spans') || '{}') } catch { return {} }
  })
  const getSpan = (cardId: string): 1 | 2 | 3 => {
    const s = cardSpans[cardId] ?? DEFAULT_SPANS[cardId] ?? 3
    return Math.min(3, Math.max(1, s)) as 1 | 2 | 3
  }
  const cycleCardSpan = (cardId: string) => {
    setCardSpans(prev => {
      const current = prev[cardId] ?? DEFAULT_SPANS[cardId] ?? 3
      // Cycle: 1 → 2 → 3 → 1
      const next = current >= 3 ? 1 : current + 1
      const updated: Record<string, number> = { ...prev, [cardId]: next }
      localStorage.setItem('incident_card_spans', JSON.stringify(updated))
      return updated
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const load = useCallback(async () => {
    // Show cached data instantly
    try {
      const cached = await getCachedById('incidents', activeIncidentId) as any
      if (cached) {
        setIncident(cached)
        setLoading(false)
      }
    } catch {}
    const supabaseClient = createClient()

    // Load incident with offline fallback
    const incResult = await loadSingle(
      () => supabaseClient.from('incidents').select('*').eq('id', activeIncidentId).single() as any,
      'incidents',
      activeIncidentId
    )
    const inc = incResult.data
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
      const [iuRes, allIuRes, unitsRes, authRes] = await Promise.all([
        supabaseClient.from('incident_units').select(`
          id,
          assigned_at,
          released_at,
          daily_contract_rate,
          unit:units(id, name, photo_url, unit_type:unit_types(name, default_contract_rate)),
          unit_assignments(id)
        `).eq('incident_id', activeIncidentId).is('released_at', null),
        // ALL units (including released) for revenue tracking
        supabaseClient.from('incident_units').select(`
          id,
          assigned_at,
          released_at,
          daily_contract_rate,
          unit:units(id, name, photo_url, unit_type:unit_types(name, default_contract_rate)),
          unit_assignments(id)
        `).eq('incident_id', activeIncidentId),
        supabaseClient.from('units').select('id, name, unit_type:unit_types(name, default_contract_rate)').eq('is_storage', false).order('name'),
        supabaseClient.auth.getUser(),
      ])
      iUnits = iuRes.data; allUnitsData = unitsRes.data; userData = authRes.data
      // Map ALL incident units (for revenue card)
      const allIuMapped: IncidentUnit[] = ((allIuRes.data as unknown as any[]) || []).map((u: any) => {
        const rawType = u.unit?.unit_type
        const unitType = Array.isArray(rawType) ? rawType[0] : rawType
        const defaultRate = unitType?.default_contract_rate ?? 0
        return {
          id: u.id,
          unit: u.unit,
          _crew_count: u.unit_assignments?.length ?? 0,
          assigned_at: u.assigned_at,
          released_at: u.released_at,
          daily_contract_rate: u.daily_contract_rate ?? defaultRate,
        }
      })
      setAllIncidentUnits(allIuMapped)
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
      assigned_at?: string
      released_at?: string | null
      daily_contract_rate?: number | null
      unit: { id: string; name: string; unit_type?: { name: string; default_contract_rate?: number } | { name: string; default_contract_rate?: number }[] | null } | null
      unit_assignments: { id: string }[]
    }>) || []).map(u => {
      // Normalize unit_type (may be array from Supabase join)
      const rawType = (u.unit as any)?.unit_type
      const unitType = Array.isArray(rawType) ? rawType[0] : rawType
      const defaultRate = unitType?.default_contract_rate ?? 0
      return {
        id: u.id,
        unit: u.unit,
        _crew_count: u.unit_assignments?.length ?? 0,
        assigned_at: u.assigned_at,
        released_at: u.released_at,
        daily_contract_rate: u.daily_contract_rate ?? defaultRate,
      }
    })
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
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(5)
        if (r1.count && r1.count > 0) return r1
        // Fallback: match by incident name text (for older encounters without incident_id set)
        if ((inc as any)?.name) {
          return supabaseClient
            .from('patient_encounters')
            .select('id, date, patient_last_name, patient_first_name, unit, initial_acuity', { count: 'exact' })
            .ilike('incident', `%${(inc as any).name}%`)
            .is('deleted_at', null)
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
          .is('deleted_at', null)
        // Fallback: name-based match
        if (!encIds?.length && (inc as any)?.name) {
          const r2 = await supabaseClient.from('patient_encounters').select('encounter_id').ilike('incident', `%${(inc as any).name}%`).is('deleted_at', null)
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

    // Load comp claims rows (separate from count to avoid complicating Promise.all)
    ;(async () => {
      try {
        const { data } = await supabaseClient
          .from('comp_claims')
          .select('id, patient_name, unit, date_of_injury, status, injury_type, pdf_url')
          .eq('incident_id', activeIncidentId)
          .is('deleted_at', null)
          .order('date_of_injury', { ascending: false })
          .limit(50)
        setCompRows((data as any[]) || [])
      } catch { setCompRows([]) }
    })()

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
          .is('deleted_at', null)
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

        // Also load reorder rows with item names and unit names
        if (allIuIds.length > 0) {
          const { data: reorderData } = await supabaseClient
            .from('unit_inventory')
            .select('id, item_name, quantity, par_qty, incident_unit_id')
            .in('incident_unit_id', allIuIds)
            .lte('quantity', supabaseClient.rpc ? 0 : 999999)
          // Filter client-side for quantity <= par_qty and map unit names
          const iuToUnit = new Map<string, string>()
          for (const iu of mappedUnits) {
            if (iu.unit) iuToUnit.set(iu.id, (iu.unit as any)?.name || '?')
          }
          // Also check released units
          if (allIuData) {
            for (const iu of (allIuData as any[])) {
              if (!iuToUnit.has(iu.id)) {
                // Fetch unit name
                const matchedUnit = allUnitsData?.find((u: any) => mappedUnits.some(mu => mu.id === iu.id))
                if (matchedUnit) iuToUnit.set(iu.id, (matchedUnit as any).name || '?')
              }
            }
          }
          const rows = ((reorderData as any[]) || [])
            .filter((r: any) => r.par_qty != null && r.quantity <= r.par_qty)
            .map((r: any) => ({
              id: r.id,
              item_name: r.item_name || '?',
              quantity: r.quantity ?? 0,
              par_qty: r.par_qty ?? 0,
              unit_name: iuToUnit.get(r.incident_unit_id) || '?',
            }))
            .sort((a: any, b: any) => a.quantity - b.quantity)
          setReorderRows(rows.slice(0, 100))
        }
      } catch {
        setReorderCount(0)
        setReorderRows([])
      }
    })()

    // Load expenses
    ;(async () => {
      try {
        const { data } = await supabaseClient
          .from('incident_expenses')
          .select('id, expense_type, amount, description, expense_date, unit_id, employee_id, created_by, receipt_url, no_receipt_reason, employees(name)')
          .eq('incident_id', activeIncidentId)
          .order('expense_date', { ascending: false })
          .limit(100)
        setExpenses((data as any[]) || [])
      } catch { setExpenses([]) }
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

    // Load deployments: merge unit_assignments (primary) with deployment_records (payroll enrichment)
    ;(async () => {
      try {
        // Get ALL incident_unit IDs for this incident (active + released)
        const { data: allIUData } = await supabaseClient
          .from('incident_units')
          .select('id, units(name), released_at')
          .eq('incident_id', activeIncidentId)
        const allIUs = ((allIUData || []) as unknown as { id: string; units: { name: string } | { name: string }[] | null; released_at: string | null }[]).map(iu => ({
          id: iu.id,
          unitName: Array.isArray(iu.units) ? iu.units[0]?.name || '?' : iu.units?.name || '?',
          released_at: iu.released_at,
        }))
        const allIUIds = allIUs.map(iu => iu.id)

        const [{ data: uaData }, { data: depData }, { data: empData }] = await Promise.all([
          // All unit_assignments for this incident's units
          allIUIds.length > 0
            ? supabaseClient
                .from('unit_assignments')
                .select('id, employee_id, incident_unit_id, assigned_at, released_at, daily_rate_override, hours_per_day, travel_date, check_in_at, check_out_at, notes, employees(id, name, role, daily_rate, default_hours_per_day, headshot_url)')
                .in('incident_unit_id', allIUIds)
            : Promise.resolve({ data: [] }),
          // Deployment records (payroll layer)
          supabaseClient
            .from('deployment_records')
            .select('id, employee_id, travel_date, check_in_date, check_out_date, daily_rate, status, notes, employees(name, role)')
            .eq('incident_id', activeIncidentId)
            .order('travel_date', { ascending: false }),
          supabaseClient
            .from('employees')
            .select('id, name, role, daily_rate')
            .eq('status', 'Active')
            .order('name'),
        ])

        setDeployments((depData as unknown as DeploymentRecord[]) ?? [])
        setAllEmployees((empData as Employee[]) ?? [])

        // Build merged crew deployment list
        const depByEmployee = new Map<string, any>()
        for (const dep of (depData || [])) {
          depByEmployee.set((dep as any).employee_id, dep)
        }

        const iuMap = new Map<string, { unitName: string; released: string | null }>()
        for (const iu of allIUs) {
          iuMap.set(iu.id, { unitName: iu.unitName, released: iu.released_at })
        }

        const merged: CrewDeployment[] = ((uaData || []) as any[]).map(ua => {
          const emp = ua.employees || {}
          const iu = iuMap.get(ua.incident_unit_id)
          const dep = depByEmployee.get(ua.employee_id)
          // Rate priority: assignment override > deployment_record > employee default
          const rate = ua.daily_rate_override ?? dep?.daily_rate ?? emp.daily_rate ?? 0
          const hours = ua.hours_per_day ?? emp.default_hours_per_day ?? 16
          return {
            assignment_id: ua.id,
            employee_id: ua.employee_id,
            employee_name: emp.name || '?',
            employee_role: emp.role || '?',
            employee_headshot_url: emp.headshot_url || null,
            unit_name: iu?.unitName || '?',
            daily_rate: rate,
            hours_per_day: hours,
            released_at: ua.released_at || iu?.released || null,
            assigned_at: ua.assigned_at || null,
            deployment_id: dep?.id || null,
            travel_date: ua.travel_date || dep?.travel_date || null,
            check_in_at: ua.check_in_at || dep?.checked_in_at || null,
            check_out_at: ua.check_out_at || dep?.checked_out_at || null,
            deploy_status: ua.released_at ? 'Released' : (dep?.status || 'On Scene'),
            notes: ua.notes || dep?.notes || null,
          }
        })
        // Sort: active first, then by name
        merged.sort((a, b) => {
          if (!a.released_at && b.released_at) return -1
          if (a.released_at && !b.released_at) return 1
          return a.employee_name.localeCompare(b.employee_name)
        })
        setCrewDeployments(merged)
      } catch {
        setDeployments([])
        setCrewDeployments([])
      }
    })()

    setLoading(false)
  }, [activeIncidentId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  // Reset unit filter when switching incidents
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUnitFilter('All') }, [activeIncidentId])

  const handleContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingContract(true)
    const path = `contracts/${activeIncidentId}/${file.name}`
    const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploadingContract(false); return }
    await supabase.from('incidents').update({
      contract_url: data.path,
      contract_file_name: file.name,
    }).eq('id', activeIncidentId)
    setIncident((prev: any) => prev ? { ...prev, contract_url: data.path, contract_file_name: file.name } : prev)
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
    // Keep unit_status in sync — reassigned unit is still in service
    await supabase.from('units').update({ unit_status: 'in_service' }).eq('id', unitId)
    load()
  }

  const assignUnit = async () => {
    if (!selectedUnitId) return
    // Look up default contract rate from unit type
    const selectedUnit = allUnits.find(u => u.id === selectedUnitId) as any
    const unitType = Array.isArray(selectedUnit?.unit_type) ? selectedUnit.unit_type[0] : selectedUnit?.unit_type
    const defaultRate = unitType?.default_contract_rate ?? 0
    await supabase.from('incident_units').insert({
      incident_id: activeIncidentId,
      unit_id: selectedUnitId,
      daily_contract_rate: defaultRate || null,
    })
    // Keep unit_status in sync — assigning a unit to an incident means it's in service/deployed
    await supabase.from('units').update({ unit_status: 'in_service' }).eq('id', selectedUnitId)
    setAssigningUnit(false)
    setSelectedUnitId('')
    load()
  }

  // ─── Deployment handlers ────────────────────────────────────────────────────

  const deployedEmployeeIds = new Set(crewDeployments.map(d => d.employee_id))
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

    // Check if employee is assigned to a unit on this incident
    const empAssignments = incidentUnits.flatMap((iu: any) =>
      (iu.unit_assignments || []).map((ua: any) => ua.employee?.id)
    )
    if (!empAssignments.includes(deployForm.employeeId)) {
      const empName = allEmployees.find((e: any) => e.id === deployForm.employeeId)?.name || 'This employee'
      const unitNames = incidentUnits.map((iu: any) => iu.unit?.name).filter(Boolean)
      if (unitNames.length > 0) {
        const assignToUnit = prompt(`${empName} is not assigned to a unit on this incident.\n\nAssign to a unit? Enter unit name:\n${unitNames.join(', ')}\n\n(Leave blank to skip)`)
        if (assignToUnit) {
          const matchedIU = incidentUnits.find((iu: any) => iu.unit?.name?.toLowerCase() === assignToUnit.toLowerCase())
          if (matchedIU) {
            await supabase.from('unit_assignments').insert({
              incident_unit_id: matchedIU.id,
              employee_id: deployForm.employeeId,
              role_on_unit: '',
            })
          }
        }
      }
    }

    setShowAddDeployment(false)
    setDeployForm({ employeeId: '', travelDate: new Date().toISOString().split('T')[0], dailyRate: '', notes: '' })
    setDeploySubmitting(false)
    // Reload all deployment data (unit_assignments + deployment_records merged)
    load()
  }

  const handleDeleteDeployment = async (id: string) => {
    if (!confirm('Delete this deployment record?')) return
    await supabase.from('deployment_records').delete().eq('id', id)
    load()
  }

  const handleSaveDeployEdit = async (id: string) => {
    const fields = { ...editDeployFields }
    // Auto-set status when check_out_date set
    if (fields.check_out_date && fields.check_out_date !== '') {
      fields.status = 'Released'
    }
    await supabase.from('deployment_records').update({
      ...fields,
      admin_override_by: assignment.employee?.name ?? 'Admin',
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setEditingDeployId(null)
    setEditDeployFields({})
    load()
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
  // Filter out warehouses and already-assigned units
  const availableUnits = allUnits.filter(u => {
    if (assignedUnitIds.has(u.id)) return false
    const ut = (u as any).unit_type
    const typeName = Array.isArray(ut) ? ut[0]?.name : ut?.name
    if (typeName === 'Warehouse') return false
    return true
  })

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

  const renderCard = (cardId: string, dragHandleProps: React.HTMLAttributes<HTMLDivElement>, cycleSpan?: () => void, span?: number) => {
    switch (cardId) {

      case 'incident-info':
        if (!isAdmin) return null
        return (
          <div className="theme-card rounded-xl border overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              {dragHandleProps && (
                <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
              )}
              {cycleSpan && (
                <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
                  className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🔥 Incident Info</h3>
              {isAdmin && (
                <button
                  onClick={toggleDefaultFire}
                  title={isDefaultFire ? 'Remove as default fire' : 'Set as default fire'}
                  className={`text-sm transition-colors shrink-0 ${
                    isDefaultFire ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-600 hover:text-yellow-400'
                  }`}
                >
                  {isDefaultFire ? '★' : '☆'}
                </button>
              )}
              {incident.status === 'Active'
                ? <span className="text-xs text-gray-600 italic">Click any field to edit</span>
                : <span className="text-xs text-gray-600 italic">Closed — read only</span>}
            </div>

            {/* Incident fields — 2-column grid */}
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                <div className="col-span-2 md:col-span-4">
                  <EditField label="Name" value={incident.name} fieldKey="name" onSave={saveField} />
                </div>
                <div className="col-span-2">
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
                </div>
                <EditField label="Incident Number" value={incident.incident_number} fieldKey="incident_number" onSave={saveField} />
                <EditField label="Start Date" value={incident.start_date} fieldKey="start_date" type="date" onSave={saveField} />
                <EditField label="Agreement Number" value={(incident as any).agreement_number} fieldKey="agreement_number" onSave={saveField} />
                <EditField label="Resource Order #" value={(incident as any).resource_order_number} fieldKey="resource_order_number" onSave={saveField} />
                <EditField label="Financial Code" value={(incident as any).financial_code} fieldKey="financial_code" onSave={saveField} />
                <EditField label="Status" value={incident.status} fieldKey="status" onSave={saveField}
                  options={[{ label: 'Active', value: 'Active' }, { label: 'Closed', value: 'Closed' }]} />
              </div>
            </div>

            {/* Contacts — 4 columns */}
            <div className="border-t border-gray-800">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
                {[
                  { label: 'Med Unit Leader', nameKey: 'med_unit_leader_name', emailKey: 'med_unit_leader_email', phoneKey: 'med_unit_leader_phone',
                    name: incident.med_unit_leader_name, email: incident.med_unit_leader_email, phone: incident.med_unit_leader_phone },
                  { label: 'Logs Contact', nameKey: 'logs_contact_name', emailKey: 'logs_contact_email', phoneKey: 'logs_contact_phone',
                    name: incident.logs_contact_name, email: incident.logs_contact_email, phone: incident.logs_contact_phone },
                  { label: 'Comp Claims', nameKey: 'comp_claims_name', emailKey: 'comp_claims_email', phoneKey: 'comp_claims_phone',
                    name: incident.comp_claims_name, email: incident.comp_claims_email, phone: incident.comp_claims_phone },
                  { label: 'Finance (OF-297)', nameKey: 'finance_contact_name', emailKey: 'finance_contact_email', phoneKey: 'finance_contact_phone',
                    name: (incident as any).finance_contact_name, email: (incident as any).finance_contact_email, phone: (incident as any).finance_contact_phone },
                ].map(contact => (
                  <div key={contact.label} className="p-3 space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{contact.label}</p>
                      {(contact.email || contact.phone) && (
                        <div className="flex gap-1.5">
                          {contact.phone && (<>
                            <a href={`tel:${contact.phone}`} className="text-green-400 hover:text-green-300 text-xs" title="Call">📞</a>
                            <a href={`sms:${contact.phone}`} className="text-blue-400 hover:text-blue-300 text-xs" title="Text">💬</a>
                          </>)}
                          {contact.email && <a href={`mailto:${contact.email}`} className="text-yellow-400 hover:text-yellow-300 text-xs" title="Email">✉️</a>}
                        </div>
                      )}
                    </div>
                    <EditField label="Name" value={contact.name} fieldKey={contact.nameKey} onSave={saveField} />
                    <EditField label="Email" value={contact.email} fieldKey={contact.emailKey} type="email" onSave={saveField} />
                    <EditField label="Phone" value={contact.phone} fieldKey={contact.phoneKey} type="tel" onSave={saveField} />
                  </div>
                ))}
              </div>
            </div>

            {/* Contract upload — bottom bar */}
            {isAdmin && (
              <div className="border-t border-gray-800 px-4 py-3 flex items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 shrink-0">Contract</p>
                {uploadingContract && <span className="text-xs text-gray-500 animate-pulse">Uploading...</span>}
                {incident.contract_url ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <a href={incident.contract_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 truncate">
                      📄 {incident.contract_file_name || 'View Contract'}
                    </a>
                    <label className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer shrink-0">
                      Replace
                      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleContractUpload} />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                    <span className="text-xs text-gray-400">📎 Upload Contract PDF</span>
                    <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleContractUpload} />
                  </label>
                )}
              </div>
            )}
          </div>
        )

      case 'units':
        return (
          <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              {dragHandleProps && (
                <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
              )}
              {cycleSpan && (
                <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
                  className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🚑 Units ({incidentUnits.length})</h3>
              {isAdmin && (
                <button onClick={() => setAssigningUnit(v => !v)}
                  className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                  {assigningUnit ? '✕' : '+ Assign Unit'}
                </button>
              )}
            </div>
            {assigningUnit && (
              <div className="px-4 py-3 border-b theme-card-header flex gap-2">
                <select value={selectedUnitId} onChange={e => setSelectedUnitId(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                  <option value="">Select unit...</option>
                  {availableUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name}{(u as any).unit_type?.name ? ` (${(u as any).unit_type.name})` : ''}</option>
                  ))}
                </select>
                <button onClick={assignUnit} disabled={!selectedUnitId}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
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
                      <div className="w-9 h-9 rounded overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                        {(iu.unit as any)?.photo_url ? (
                          <img src={(iu.unit as any).photo_url} alt={iu.unit?.name || ''} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm">{(() => { const t = (iu.unit as any)?.unit_type?.name; return t === 'Ambulance' ? '🚑' : t === 'Med Unit' ? '🏥' : t === 'REMS' ? '🧗' : '🚐' })()}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{iu.unit?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{iu._crew_count} crew assigned</p>
                      </div>
                      {(iu.unit as any)?.unit_type?.name && (() => {
                        const t = (iu.unit as any).unit_type.name
                        const cls = t === 'Ambulance' ? 'bg-red-900 text-red-300' : t === 'Med Unit' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
                        return <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cls}`}>{t}</span>
                      })()}
                    </Link>
                    {isAdmin && (
                      <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        {activeIncidents.length > 0 && (
                          <select className="text-xs bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500 max-w-[130px] w-[130px]"
                            defaultValue="" onChange={e => { if (e.target.value) reassignUnit(iu.id, e.target.value, iu.unit?.id || '', iu.unit?.name || 'unit') }}
                            title="Move to another active incident">
                            <option value="" disabled>Move to fire...</option>
                            {activeIncidents.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                        )}
                        <button onClick={() => demobilizeUnit(iu.id, iu.unit?.name || 'unit')}
                          className="text-xs px-2 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 rounded transition-colors whitespace-nowrap"
                          title="Remove from incident">Demob</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'deployments':
        if (!isAdmin) return null
        {
        const activeCrewCount = crewDeployments.filter(d => !d.released_at).length
        const totalCrewCount = crewDeployments.length
        return (
          <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              {dragHandleProps && (
                <div
                  {...dragHandleProps}
                  className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none"
                >⠿</div>
              )}
              {cycleSpan && (
                <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
                  className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">
                  {`${span || 3}/3`}
                </button>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">👥 Deployments</h3>
              <div className="text-right">
                <span className="text-xl font-bold text-white">{activeCrewCount}</span>
                {totalCrewCount > activeCrewCount && (
                  <span className="text-xs text-gray-500 ml-1">({totalCrewCount} total)</span>
                )}
              </div>
            </div>

            {/* Crew Deployment Table — derived from unit_assignments + deployment_records */}
            {crewDeployments.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr className="border-b theme-card-header">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Employee</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Role</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Unit</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Status</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Rate</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Days</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase tracking-wide">Owed</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {crewDeployments.map(dep => {
                      const isActive = !dep.released_at
                      const isEditing = editingDeployId === dep.deployment_id
                      // Calculate days: from travel_date or assigned_at to released_at or today
                      const startDate = dep.travel_date || (dep.assigned_at ? dep.assigned_at.split('T')[0] : null) || incident?.start_date || null
                      const endDate = dep.released_at ? dep.released_at.split('T')[0] : null
                      const days = startDate ? calcDays(startDate, endDate) : 0
                      const totalHours = days * dep.hours_per_day
                      const owed = days * dep.daily_rate

                      if (isEditing && dep.deployment_id) {
                        return (
                          <tr key={dep.assignment_id} className="bg-gray-800/50">
                            <td className="px-3 py-2 text-white font-medium" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                                  {dep.employee_headshot_url ? (
                                    <img src={dep.employee_headshot_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-gray-400 text-xs font-bold">{dep.employee_name.charAt(0)}</span>
                                  )}
                                </div>
                                {dep.employee_name} · {dep.employee_role}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-400">{dep.unit_name}</td>
                            <td className="px-3 py-2">
                              <select defaultValue={dep.deploy_status}
                                onChange={e => setEditDeployFields(f => ({ ...f, status: e.target.value }))}
                                className={inputCls}>
                                {['Traveling', 'On Scene', 'Released', 'Emergency Release'].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" step="1" defaultValue={dep.daily_rate}
                                onChange={e => setEditDeployFields(f => ({ ...f, daily_rate: parseFloat(e.target.value) || 0 }))}
                                className={inputCls + ' w-20 text-right'} />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-400">{days}{isActive && '+'}</td>
                            <td className="px-3 py-2 text-right text-green-400">{fmtCurrency(owed)}{isActive && '+'}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                <button onClick={() => handleSaveDeployEdit(dep.deployment_id!)}
                                  className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-semibold">Save</button>
                                <button onClick={() => { setEditingDeployId(null); setEditDeployFields({}) }}
                                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={dep.assignment_id} className={`hover:bg-gray-800/30 transition-colors ${dep.released_at ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 text-white font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                                {dep.employee_headshot_url ? (
                                  <img src={dep.employee_headshot_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-gray-400 text-xs font-bold">{dep.employee_name.charAt(0)}</span>
                                )}
                              </div>
                              {dep.employee_name}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-400">{dep.employee_role}</td>
                          <td className="px-3 py-2 text-gray-400">{dep.unit_name}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              dep.deploy_status === 'On Scene' ? 'bg-green-900/60 text-green-300' :
                              dep.deploy_status === 'Traveling' ? 'bg-yellow-900/60 text-yellow-300' :
                              dep.deploy_status === 'Released' ? 'bg-gray-700 text-gray-400' :
                              'bg-red-900/60 text-red-300'
                            }`}>
                              {isActive && '🔴 '}{dep.deploy_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-green-400">
                            {dep.daily_rate > 0 ? fmtCurrency(dep.daily_rate) : <span className="text-gray-600">—</span>}
                            <span className="text-gray-600 text-xs">/d</span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {days > 0 ? days : <span className="text-gray-600">—</span>}
                            {isActive && days > 0 && <span className="ml-0.5 text-gray-500 text-xs">+</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-400">
                            {owed > 0 ? fmtCurrency(owed) : <span className="text-gray-600">—</span>}
                            {isActive && owed > 0 && <span className="ml-0.5 text-gray-500 text-xs">+</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              {dep.deployment_id ? (
                                <>
                                  <button onClick={() => { setEditingDeployId(dep.deployment_id); setEditDeployFields({}) }}
                                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Edit</button>
                                  <button onClick={() => handleDeleteDeployment(dep.deployment_id!)}
                                    className="px-2 py-1 bg-red-900/60 hover:bg-red-800 text-red-300 rounded text-xs">Del</button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-600 italic">via unit assign</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Totals footer */}
                  {(() => {
                    let totalDays = 0, totalHrs = 0, totalOwed = 0
                    for (const dep of crewDeployments) {
                      const start = dep.travel_date || (dep.assigned_at ? dep.assigned_at.split('T')[0] : null) || incident?.start_date || null
                      const end = dep.released_at ? dep.released_at.split('T')[0] : null
                      const d = start ? calcDays(start, end) : 0
                      totalDays += d
                      totalHrs += d * dep.hours_per_day
                      totalOwed += d * dep.daily_rate
                    }
                    return (
                      <tfoot>
                        <tr className="border-t border-gray-700 bg-gray-800/50">
                          <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-gray-400">Totals</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-400">{totalHrs.toLocaleString()} hrs</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-white">{totalDays}</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-green-400">{fmtCurrency(totalOwed)}</td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>
            )}

            {crewDeployments.length === 0 && !showAddDeployment && (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No crew assigned to this incident</p>
            )}

            {/* Add Deployment Form */}
            {showAddDeployment && (
              <form onSubmit={handleAddDeployment} className="border-t border-gray-800 p-4 space-y-3 theme-card-footer">
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

            <div className="flex items-center gap-2 px-4 py-2 theme-card-footer">
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
        }

      case 'unit-revenue': {
        if (!isAdmin) return null
        // Calculate revenue per unit: days on incident × daily contract rate
        // Also need ALL incident_units (including released) for full revenue picture
        const revenueUnits = allIncidentUnits.map(iu => {
          const rate = iu.daily_contract_rate ?? 0
          const start = iu.assigned_at || incident?.start_date || null
          const end = iu.released_at || null
          const days = start ? calcDays(start.split('T')[0], end ? end.split('T')[0] : null) : 0
          const revenue = days * rate
          const typeName = (() => {
            const ut = (iu.unit as any)?.unit_type
            const t = Array.isArray(ut) ? ut[0] : ut
            return t?.name || ''
          })()
          return { ...iu, rate, days, revenue, typeName }
        })
        const totalRevenue = revenueUnits.reduce((s, u) => s + u.revenue, 0)
        const totalUnitDays = revenueUnits.reduce((s, u) => s + u.days, 0)
        // Net revenue = gross - payroll - expenses
        const totalPayroll = crewDeployments.reduce((sum, dep) => {
          const start = dep.travel_date || (dep.assigned_at ? dep.assigned_at.split('T')[0] : null) || incident?.start_date || null
          const end = dep.released_at ? dep.released_at.split('T')[0] : null
          const d = start ? calcDays(start, end) : 0
          return sum + (d * dep.daily_rate)
        }, 0)
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
        const netRevenue = totalRevenue - totalPayroll - totalExpenses
        return (
          <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              {dragHandleProps && (
                <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
              )}
              {cycleSpan && (
                <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
                  className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">💵 Incident Revenue</h3>
              <div className="text-right">
                <span className="text-xl font-bold text-green-400">{fmtCurrency(totalRevenue)}</span>
                <span className={`text-xs ml-2 font-semibold ${netRevenue >= 0 ? 'text-green-400/70' : 'text-red-400'}`}>
                  (net {fmtCurrency(netRevenue)})
                </span>
              </div>
            </div>
            {revenueUnits.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-opacity-30 theme-border">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Unit</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Type</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Rate/Day</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Days</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border">
                    {revenueUnits.map(u => {
                      const isActive = !u.released_at
                      const isEditingRate = editingRateIuId === u.id
                      return (
                        <tr key={u.id} className={`hover:bg-gray-800/30 transition-colors ${u.released_at ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 text-white font-medium">{(u.unit as any)?.name || '?'}</td>
                          <td className="px-3 py-2 text-gray-400">{u.typeName}</td>
                          <td className="px-3 py-2 text-right">
                            {isEditingRate ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-gray-500">$</span>
                                <input type="number" step="100" value={editRateVal}
                                  onChange={e => setEditRateVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      const val = parseFloat(editRateVal) || 0
                                      supabase.from('incident_units').update({ daily_contract_rate: val }).eq('id', u.id)
                                        .then(() => { setEditingRateIuId(null); load() })
                                    }
                                    if (e.key === 'Escape') setEditingRateIuId(null)
                                  }}
                                  autoFocus
                                  className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-white text-right text-xs focus:outline-none focus:ring-1 focus:ring-red-500" />
                                <button onClick={() => {
                                  const val = parseFloat(editRateVal) || 0
                                  supabase.from('incident_units').update({ daily_contract_rate: val }).eq('id', u.id)
                                    .then(() => { setEditingRateIuId(null); load() })
                                }} className="text-green-400 hover:text-green-300 text-xs">✓</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingRateIuId(u.id); setEditRateVal(String(u.rate)) }}
                                className="text-green-400 hover:text-green-300 transition-colors" title="Click to edit rate">
                                {u.rate > 0 ? fmtCurrency(u.rate) : <span className="text-gray-600">—</span>}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {u.days}{isActive && <span className="text-gray-500 ml-0.5">+</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-green-400">
                            {u.revenue > 0 ? fmtCurrency(u.revenue) : <span className="text-gray-600">—</span>}
                            {isActive && u.revenue > 0 && <span className="text-gray-500 ml-0.5">+</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t theme-card-header">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-400">Gross Revenue</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-white">{totalUnitDays} days</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-green-400">{fmtCurrency(totalRevenue)}</td>
                    </tr>
                    <tr style={{ backgroundColor: 'var(--color-header-bg, #030712)' }}>
                      <td colSpan={3} className="px-3 py-1 text-right text-xs text-gray-500">− Payroll</td>
                      <td colSpan={2} className="px-3 py-1 text-right text-xs text-red-400">{fmtCurrency(totalPayroll)}</td>
                    </tr>
                    <tr style={{ backgroundColor: 'var(--color-header-bg, #030712)' }}>
                      <td colSpan={3} className="px-3 py-1 text-right text-xs text-gray-500">− Expenses</td>
                      <td colSpan={2} className="px-3 py-1 text-right text-xs text-red-400">{fmtCurrency(totalExpenses)}</td>
                    </tr>
                    <tr className="border-t theme-card-header">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-300">Net Revenue</td>
                      <td colSpan={2} className={`px-3 py-2 text-right text-sm font-bold ${netRevenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtCurrency(netRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {revenueUnits.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No units assigned</p>
            )}
          </div>
        )
      }

      case 'expenses': {
        const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0)
        const EXPENSE_TYPES = ['Gas', 'Repairs', 'Supplies', 'Hotel', 'Food', 'Other']
        const unitOptions = incidentUnits.filter(iu => iu.unit).map(iu => ({ id: iu.unit!.id, name: (iu.unit as any)?.name || '?' }))
        return (
          <div className="theme-card rounded-xl border overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2 px-4 py-3 border-b theme-card-header">
              {dragHandleProps && (
                <div {...dragHandleProps} className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing transition-colors shrink-0 opacity-0 group-hover:opacity-100 select-none">⠿</div>
              )}
              {cycleSpan && (
                <button onClick={cycleSpan} title={`Column span: ${span || 3}/3 — click to cycle`}
                  className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity select-none shrink-0">{`${span || 3}/3`}</button>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex-1">🧾 Expenses</h3>
              <span className="text-xl font-bold text-red-400">{fmtCurrency(totalExp)}</span>
            </div>

            {expenses.length > 0 && (
              <div className="overflow-x-auto" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b theme-border">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Date</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Type</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">Description</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold uppercase">By</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold uppercase">Amount</th>
                      <th className="px-2 py-2 text-gray-500 font-semibold uppercase text-center">🧃</th>
                      {isAdmin && <th className="px-2 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-3 py-2 text-gray-400">{exp.expense_date}</td>
                        <td className="px-3 py-2 text-white">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            exp.expense_type === 'Gas' ? 'bg-yellow-900/60 text-yellow-300' :
                            exp.expense_type === 'Hotel' ? 'bg-purple-900/60 text-purple-300' :
                            exp.expense_type === 'Repairs' ? 'bg-red-900/60 text-red-300' :
                            exp.expense_type === 'Food' ? 'bg-orange-900/60 text-orange-300' :
                            exp.expense_type === 'Supplies' ? 'bg-blue-900/60 text-blue-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>{exp.expense_type}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-300 truncate max-w-[150px]">{exp.description || '—'}</td>
                        <td className="px-3 py-2 text-gray-400 truncate max-w-[100px]">{(exp.employees as any)?.name || exp.created_by || '—'}</td>
                        <td className="px-3 py-2 text-right font-medium text-red-400">{fmtCurrency(exp.amount)}</td>
                        <td className="px-2 py-2 text-center">
                          {exp.receipt_url ? (
                            <button onClick={async () => {
                              const { data } = await supabase.storage.from('documents').createSignedUrl(exp.receipt_url!, 3600)
                              if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                            }} className="text-xs text-blue-400 hover:text-blue-300" title="View receipt">🧃</button>
                          ) : (
                            <span className="text-gray-600 text-xs italic" title={(exp as any).no_receipt_reason || 'No receipt'}>
                              {(exp as any).no_receipt_reason === "I'm a knucklehead" ? '🤦' : '—'}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-2 py-2">
                            <button onClick={async () => {
                              if (!confirm('Delete this expense?')) return
                              await supabase.from('incident_expenses').delete().eq('id', exp.id)
                              setExpenses(prev => prev.filter(e => e.id !== exp.id))
                            }} className="text-xs text-red-500 hover:text-red-400">✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expenses.length === 0 && !showAddExpense && (
              <p className="px-4 py-6 text-sm text-gray-600 text-center">No expenses logged</p>
            )}

            {/* Add Expense Form */}
            {showAddExpense && (
              <div className="border-t p-4 space-y-3 theme-border">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Log Expense</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Type</label>
                    <select value={expenseForm.type} onChange={e => setExpenseForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                      {EXPENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Amount ($)</label>
                    <input type="number" step="0.01" value={expenseForm.amount}
                      onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00" required
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Date</label>
                    <input type="date" value={expenseForm.date}
                      onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Unit (optional)</label>
                    <select value={expenseForm.unitId} onChange={e => setExpenseForm(f => ({ ...f, unitId: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                      <option value="">None</option>
                      {unitOptions.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Description</label>
                    <input type="text" value={expenseForm.description}
                      onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="What was this expense for?"
                      className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Receipt Photo (optional)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => expenseReceiptRef.current?.click()}
                        className="px-3 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors">
                        {expenseReceipt ? `📎 ${expenseReceipt.name}` : '📷 Attach Receipt'}
                      </button>
                      {expenseReceipt && (
                        <button type="button" onClick={() => { setExpenseReceipt(null); if (expenseReceiptRef.current) expenseReceiptRef.current.value = '' }}
                          className="text-xs text-gray-500 hover:text-red-400">✕ Remove</button>
                      )}
                      <input ref={expenseReceiptRef} type="file" accept="image/*,.pdf" className="hidden"
                        onChange={e => setExpenseReceipt(e.target.files?.[0] || null)} />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">JPG, PNG, or PDF</p>
                  </div>
                  {/* No-receipt reason — required when no receipt attached */}
                  {!expenseReceipt && (
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">No receipt? Reason required</label>
                      <select value={expenseNoReceiptReason} onChange={e => setExpenseNoReceiptReason(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">Select reason...</option>
                        <option value="Lost">Lost</option>
                        <option value="Vendor did not provide">Vendor did not provide</option>
                        <option value="Destroyed">Destroyed</option>
                        <option value="I'm a knucklehead">I'm a knucklehead</option>
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">Logged by: <span className="text-white">{assignment.employee?.name || 'Unknown'}</span></p>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!expenseForm.amount) return
                    // Require receipt OR reason
                    if (!expenseReceipt && !expenseNoReceiptReason) {
                      alert('Please attach a receipt or select a reason for no receipt.')
                      return
                    }
                    setExpenseSubmitting(true)
                    // Upload receipt if attached
                    let receiptPath: string | null = null
                    if (expenseReceipt) {
                      const ext = expenseReceipt.name.split('.').pop()?.toLowerCase() || 'jpg'
                      const fname = `${Date.now()}_${expenseForm.type.toLowerCase()}.${ext}`
                      const storagePath = `expenses/${activeIncidentId}/${fname}`
                      const { error: upErr } = await supabase.storage.from('documents').upload(storagePath, expenseReceipt, { upsert: false })
                      if (!upErr) receiptPath = storagePath
                    }
                    await supabase.from('incident_expenses').insert({
                      incident_id: activeIncidentId,
                      expense_type: expenseForm.type,
                      amount: parseFloat(expenseForm.amount) || 0,
                      description: expenseForm.description || null,
                      expense_date: expenseForm.date,
                      unit_id: expenseForm.unitId || null,
                      employee_id: assignment.employee?.id || null,
                      created_by: assignment.employee?.name || 'Unknown',
                      receipt_url: receiptPath,
                      no_receipt_reason: receiptPath ? null : expenseNoReceiptReason || null,
                    })
                    setShowAddExpense(false)
                    setExpenseForm({ type: 'Gas', amount: '', description: '', date: new Date().toISOString().split('T')[0], unitId: '' })
                    setExpenseReceipt(null)
                    setExpenseNoReceiptReason('')
                    if (expenseReceiptRef.current) expenseReceiptRef.current.value = ''
                    setExpenseSubmitting(false)
                    load()
                  }} disabled={expenseSubmitting || !expenseForm.amount}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors">
                    {expenseSubmitting ? 'Saving...' : 'Log Expense'}
                  </button>
                  <button onClick={() => setShowAddExpense(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 px-4 py-2 theme-card-footer">
              <div className="flex-1" />
              {!showAddExpense && (
                <button onClick={() => setShowAddExpense(true)}
                  className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-colors">
                  + Log Expense
                </button>
              )}
            </div>
          </div>
        )
      }

      case 'encounters':
        return (
          <StatCard
            title="Patient Encounters"
            count={encounterCount}
            viewAllHref={`/encounters?activeIncidentId=${activeIncidentId}`}
            newHref={`/encounters/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New PCR"
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
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
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
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
            cycleSpan={cycleSpan}
            span={span}
          >
            {marEntries.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
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

      case 'comp-claims': {
        const filteredComps = effectiveUnitFilter === 'All' ? compRows : compRows.filter(c => c.unit === effectiveUnitFilter)
        return (
          <StatCard
            title="Comp Claims"
            count={compCount}
            viewAllHref={`/comp-claims?activeIncidentId=${activeIncidentId}`}
            newHref={`/comp-claims/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New Claim"
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
            expandedChildren={
              filteredComps.length > 0 ? (
                <>
                  <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
                    <span className="w-24 shrink-0">Date</span>
                    <span className="flex-1 min-w-0">Patient</span>
                    <span className="w-20 shrink-0">Unit</span>
                    <span className="w-20 shrink-0">Injury</span>
                    <span className="w-10 shrink-0 text-right">PDF</span>
                  </div>
                  {filteredComps.map(c => (
                    <Link key={c.id} to={`/comp-claims/${c.id}`}
                      className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm">
                      <span className="w-24 shrink-0 text-gray-400 text-xs">{c.date_of_injury || '—'}</span>
                      <span className="flex-1 min-w-0 truncate pr-1 text-xs text-white">{c.patient_name || '—'}</span>
                      <span className="w-20 shrink-0 text-xs text-gray-400">{c.unit || '—'}</span>
                      <span className="w-20 shrink-0 text-xs text-gray-400 truncate">{c.injury_type || '—'}</span>
                      <span className="w-10 shrink-0 text-right text-xs">{c.pdf_url ? '📄' : '⚠️'}</span>
                    </Link>
                  ))}
                </>
              ) : undefined
            }
          >
            {filteredComps.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
                  <span className="w-24 shrink-0">Date</span>
                  <span className="flex-1 min-w-0">Patient</span>
                  <span className="w-10 shrink-0 text-right">PDF</span>
                </div>
                {filteredComps.slice(0, 5).map(c => (
                  <Link key={c.id} to={`/comp-claims/${c.id}`}
                    className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm">
                    <span className="w-24 shrink-0 text-gray-400 text-xs">{c.date_of_injury || '—'}</span>
                    <span className="flex-1 min-w-0 truncate pr-1 text-xs text-white">{c.patient_name || '—'}</span>
                    <span className="w-10 shrink-0 text-right text-xs">{c.pdf_url ? '📄' : '⚠️'}</span>
                  </Link>
                ))}
              </>
            ) : (
              <p className="text-center text-gray-600 text-sm py-4">No claims filed</p>
            )}
          </StatCard>
        )
      }

      case 'supply-runs':
        return (
          <StatCard
            title="Supply Runs"
            count={supplyCount}
            viewAllHref={`/supply-runs?activeIncidentId=${activeIncidentId}`}
            newHref={`/supply-runs/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New Run"
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          >
            {supplyRuns.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
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
            cycleSpan={cycleSpan}
            span={span}
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

      case 'reorder-summary': {
        const filteredReorder = effectiveUnitFilter === 'All' ? reorderRows : reorderRows.filter(r => r.unit_name === effectiveUnitFilter)
        return (
          <StatCard
            title="Reorder Needed"
            count={reorderCount ?? '…'}
            viewAllHref={`/inventory/reorder?activeIncidentId=${activeIncidentId}`}
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
            expandedChildren={
              filteredReorder.length > 0 ? (
                <>
                  <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
                    <span className="flex-1 min-w-0">Item</span>
                    <span className="w-20 shrink-0">Unit</span>
                    <span className="w-14 shrink-0 text-right">Qty</span>
                    <span className="w-14 shrink-0 text-right">Par</span>
                  </div>
                  {filteredReorder.map(r => (
                    <div key={r.id} className="flex items-center px-4 py-1.5 text-xs hover:bg-gray-800/50 transition-colors">
                      <span className="flex-1 min-w-0 truncate pr-1 text-white">{r.item_name}</span>
                      <span className="w-20 shrink-0 text-gray-400">{r.unit_name}</span>
                      <span className={`w-14 shrink-0 text-right font-medium ${r.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}`}>{r.quantity}</span>
                      <span className="w-14 shrink-0 text-right text-gray-500">{r.par_qty}</span>
                    </div>
                  ))}
                </>
              ) : undefined
            }
          >
            {filteredReorder.length > 0 ? (
              <>
                <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
                  <span className="flex-1 min-w-0">Item</span>
                  <span className="w-14 shrink-0 text-right">Qty</span>
                  <span className="w-14 shrink-0 text-right">Par</span>
                </div>
                {filteredReorder.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center px-4 py-1.5 text-xs hover:bg-gray-800/50 transition-colors">
                    <span className="flex-1 min-w-0 truncate pr-1 text-white">{r.item_name}</span>
                    <span className={`w-14 shrink-0 text-right font-medium ${r.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}`}>{r.quantity}</span>
                    <span className="w-14 shrink-0 text-right text-gray-500">{r.par_qty}</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-400">
                {reorderCount != null ? (
                  reorderCount === 0
                    ? <p className="text-green-400 text-xs">All items at or above par. ✓</p>
                    : <p className="text-xs">{reorderCount} item{reorderCount !== 1 ? 's' : ''} at or below par. Expand to see details.</p>
                ) : (
                  <p className="text-gray-600 text-xs">Calculating...</p>
                )}
              </div>
            )}
          </StatCard>
        )
      }

      case 'ics214':
        return (
          <StatCard
            title="ICS 214 Logs"
            count={effectiveUnitFilter === 'All' ? ics214Rows.length : ics214Rows.filter(r => r.unit_name === effectiveUnitFilter).length}
            viewAllHref={`/ics214?activeIncidentId=${activeIncidentId}`}
            newHref={`/ics214/new?activeIncidentId=${activeIncidentId}`}
            newLabel="+ New 214"
            dragHandleProps={dragHandleProps}
            cycleSpan={cycleSpan}
            span={span}
          >
            {(() => {
              const filteredIcs = effectiveUnitFilter === 'All' ? ics214Rows : ics214Rows.filter(r => r.unit_name === effectiveUnitFilter)
              if (filteredIcs.length === 0) return <p className="text-center text-gray-600 text-sm py-4">No 214 logs for this unit/incident</p>
              return (
                <>
                  <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
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
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
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

        {/* Incident switcher dropdown + unit filter — full width */}
        {isAdmin && activeIncidents.length > 1 && (
          <select
            value={activeIncidentId}
            onChange={e => setActiveIncidentId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4">
            {activeIncidents.map(inc => (
              <option key={inc.id} value={inc.id}>🔥 {inc.name}</option>
            ))}
          </select>
        )}

        {/* Fixed incident info header — full width */}
        <div className="mb-4">
          {renderCard('incident-info', {})}
        </div>

        {/* Draggable card dashboard */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                  {cardOrder.map(cardId => (
                    <SortableCard key={cardId} id={cardId} colSpan={getSpan(cardId)}>
                      {(dragHandleProps) => renderCard(cardId, dragHandleProps, () => cycleCardSpan(cardId), getSpan(cardId)) ?? <div />}
                    </SortableCard>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

        </div>

      </div>
    </div>
  )
}
