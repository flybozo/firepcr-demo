

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { Link } from 'react-router-dom'

type Unit = {
  id: string
  name: string
  unit_type?: { name: string } | null
}

type Incident = {
  id: string
  name: string
}

type Employee = {
  id: string
  name: string
  role?: string
}

function getLeaderPosition(unitTypeName: string | null | undefined): string {
  if (!unitTypeName) return ''
  if (unitTypeName.toLowerCase().includes('ambulance')) return 'EMS Supervisor'
  if (unitTypeName.toLowerCase().includes('med unit')) return 'EMS Supervisor'
  if (unitTypeName.toLowerCase().includes('rems')) return 'REMS Leader'
  return 'EMS Supervisor'
}

// Get ICS position from employee role
function roleToICSPosition(role: string): string {
  const map: Record<string, string> = {
    'MD': 'MD', 'MD/DO': 'MD', 'DO': 'MD',
    'NP': 'NP', 'PA': 'PA',
    'RN': 'RN', 'Paramedic': 'Paramedic',
    'EMT': 'EMT', 'AEMT': 'AEMT',
    'Tech': 'Rescue Tech', 'Admin': 'Admin',
  }
  return map[role] || role
}

function todayStr() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}

export default function NewICS214Page() {
  const supabase = createClient()
  const navigate = useNavigate()
  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'MD/DO', 'Admin'].includes(assignment?.employee?.role || '')

  const [units, setUnits] = useState<Unit[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [crew, setCrew] = useState<Employee[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])

  const [unitId, setUnitId] = useState('')
  const [unitName, setUnitName] = useState('')
  const [unitType, setUnitType] = useState('')
  const [incidentId, setIncidentId] = useState('')
  const [incidentName, setIncidentName] = useState('')
  const [opDate, setOpDate] = useState(todayStr())
  const [shift, setShift] = useState<'day' | 'night'>('day')
  const [opStart, setOpStart] = useState('06:00')
  const [opEnd, setOpEnd] = useState('18:00')
  const [leaderName, setLeaderName] = useState('')
  const [leaderPosition, setLeaderPosition] = useState('')
  const [notes, setNotes] = useState('')
  const [initialActivity, setInitialActivity] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isAdminOverride, setIsAdminOverride] = useState(false)

  // Load units + incidents
  useEffect(() => {
    if (assignment.loading) return

    const load = async () => {
      const [{ data: unitsData }, { data: incData }] = await Promise.all([
        supabase.from('units').select('id, name, unit_type:unit_types(name)').eq('is_storage', false).order('name'),
        supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
      ])
      setUnits((unitsData as unknown as Unit[]) || [])
      setIncidents((incData as Incident[]) || [])
      const { data: empData } = await supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name')
      setAllEmployees((empData as any) || [])

      // Pre-fill from assignment
      if (!isAdmin && assignment.unit) {
        const u = (unitsData as unknown as Unit[])?.find(u => u.id === assignment.unit!.id)
        if (u) {
          setUnitId(u.id)
          setUnitName(u.name)
          const typeName = (u as any).unit_type?.name ?? ''
          setUnitType(typeName)
          setLeaderPosition(getLeaderPosition(typeName))
        }
      }
      if (!isAdmin && assignment.incident) {
        setIncidentId(assignment.incident.id)
        setIncidentName(assignment.incident.name)
      }
      if (assignment.employee) {
        setLeaderName(assignment.employee.name)
      }
    }
    load()
  }, [assignment.loading])

  // Load crew when unit changes
  useEffect(() => {
    if (!unitId) { setCrew([]); return }
    const load = async () => {
      const { data } = await supabase
        .from('unit_assignments')
        .select('employee:employees(id, name, role)')
        .eq('incident_unit_id', unitId)
        .is('released_at', null)
      // Actually need incident_unit_id, but we need to find the incident_unit first
      // unit_assignments links to incident_units, not units directly
      // So we need to find active incident_unit for this unit
      // Find incident_unit for this unit (filter by incident if selected, else latest)
      let iuQuery = supabase
        .from('incident_units')
        .select('id')
        .eq('unit_id', unitId)
        .is('released_at', null)
        .limit(1)
      if (incidentId) iuQuery = iuQuery.eq('incident_id', incidentId) as typeof iuQuery

      const { data: iuData } = await iuQuery

      if (iuData && iuData.length > 0) {
        const iuId = iuData[0].id
        const { data: assignData } = await supabase
          .from('unit_assignments')
          .select('employee:employees(id, name, role)')
          .eq('incident_unit_id', iuId)
          .is('released_at', null)
        const employees = ((assignData || []) as any[]).map(a => a.employee).filter(Boolean)
        setCrew(employees)
      } else {
        // Fallback: no released_at filter (some deployments may not set it)
        const { data: iuData2 } = await supabase
          .from('incident_units')
          .select('id')
          .eq('unit_id', unitId)
          .limit(1)
        if (iuData2 && iuData2.length > 0) {
          const { data: assignData } = await supabase
            .from('unit_assignments')
            .select('employee:employees(id, name, role)')
            .eq('incident_unit_id', iuData2[0].id)
            .is('released_at', null)
          const employees = ((assignData || []) as any[]).map(a => a.employee).filter(Boolean)
          setCrew(employees)
        } else {
          setCrew([])
        }
      }
    }
    load()
  }, [unitId, incidentId])

  // Shift toggle
  useEffect(() => {
    if (shift === 'day') {
      setOpStart('06:00')
      setOpEnd('18:00')
    } else {
      setOpStart('18:00')
      setOpEnd('06:00')
    }
  }, [shift])

  const handleUnitChange = async (id: string) => {
    setUnitId(id)
    const u = units.find(u => u.id === id)
    if (u) {
      setUnitName(u.name)
      const typeName = (u as any).unit_type?.name ?? ''
      setUnitType(typeName)
      setLeaderPosition(getLeaderPosition(typeName))
    }
    if (isAdmin) setIsAdminOverride(true)
    // Auto-fill incident from active incident_unit
    if (id) {
      const { data: iuData } = await supabase
        .from('incident_units')
        .select('incident_id, incident:incidents(id, name)')
        .eq('unit_id', id)
        .is('released_at', null)
        .order('assigned_at', { ascending: false })
        .limit(1)
      const iu = (iuData as any)?.[0]
      if (iu?.incident) {
        setIncidentId(iu.incident.id)
        setIncidentName(iu.incident.name)
      }
    }
  }

  const handleIncidentChange = async (id: string) => {
    setIncidentId(id)
    const inc = incidents.find(i => i.id === id)
    if (inc) setIncidentName(inc.name)
    // Admin: suggest a unit currently assigned to this incident (can be overridden — dropdown stays unrestricted)
    if (isAdmin && id) {
      setIsAdminOverride(true)
      const { data: iuData } = await supabase
        .from('incident_units')
        .select('unit_id, unit:units(id, name, unit_type:unit_types(name))')
        .eq('incident_id', id)
        .is('released_at', null)
        .order('assigned_at', { ascending: false })
        .limit(1)
      const iu = (iuData as any)?.[0]
      if (iu?.unit) {
        setUnitId(iu.unit.id)
        setUnitName(iu.unit.name)
        const typeName = (iu.unit as any).unit_type?.name ?? ''
        setUnitType(typeName)
        setLeaderPosition(getLeaderPosition(typeName))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unitId || !incidentId || !initialActivity.trim()) {
      setError('Unit, Incident, and Initial Activity are required.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      // Generate ICS 214 ID
      const dateStr = opDate.replace(/-/g, '')
      const unitClean = unitName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const { count } = await supabase
        .from('ics214_headers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${opDate}T00:00:00`)
        .lte('created_at', `${opDate}T23:59:59`)
      const seq = String((count ?? 0) + 1).padStart(3, '0')
      const ics214Id = `ICS214-${dateStr}-${unitClean}-${seq}`

      // Find the incident_unit_id for this unit + incident
      let incidentUnitId: string | null = null
      const { data: iuData } = await supabase
        .from('incident_units')
        .select('id')
        .eq('unit_id', unitId)
        .eq('incident_id', incidentId)
        .limit(1)
      if (iuData && iuData.length > 0) {
        incidentUnitId = iuData[0].id
      }

      // 1. INSERT header
      const { error: headerError } = await supabase.from('ics214_headers').insert({
        ics214_id: ics214Id,
        incident_id: incidentId,
        incident_name: incidentName,
        unit_id: unitId,
        unit_name: unitName,
        op_date: opDate,
        op_start: opStart,
        op_end: opEnd,
        leader_name: leaderName,
        leader_position: leaderPosition,
        status: 'Open',
        notes: notes || null,
        created_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
      })
      if (headerError) throw headerError

      // 2. Snapshot crew to ics214_personnel
      if (crew.length > 0) {
        await supabase.from('ics214_personnel').insert(
          crew.map(emp => ({
            ics214_id: ics214Id,
            employee_name: emp.name,
            ics_position: emp.role || '',
            home_agency: 'Sierra Valley EMS',
          }))
        )
      }

      // 3. INSERT initial activity
      await supabase.from('ics214_activities').insert({
        ics214_id: ics214Id,
        log_datetime: new Date().toISOString(),
        description: initialActivity.trim(),
        logged_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
        activity_type: 'activity',
      })

      // 4. Auto-link patient encounters (non-admin, unit-assigned users)
      if (!isAdmin && incidentUnitId) {
        await supabase
          .from('patient_encounters')
          .update({ ics214_id: ics214Id } as any)
          .eq('incident_id', incidentId)
          .eq('unit', unitName)
          .gte('date', opDate)
          .lte('date', opDate)
      }

      navigate(`/ics214/${ics214Id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create ICS 214')
      setSubmitting(false)
    }
  }

  if (assignment.loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      <div className="max-w-lg mx-auto p-4 md:p-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pt-2">
          <Link to="/ics214" className="text-gray-500 hover:text-white text-sm">← ICS 214 Logs</Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm">New ICS 214</span>
        </div>

        <h1 className="text-xl font-bold mb-6">Start New ICS 214</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Unit */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Unit <span className="text-red-500">*</span>
            </label>
{/* Everyone gets the unit dropdown — field users pre-filled from assignment but can change if not yet assigned */}
            {unitId && !isAdmin ? (
              <div className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 flex items-center justify-between">
                <span>{unitName}</span>
                <button type="button" onClick={() => { setUnitId(''); setUnitName(''); setUnitType('') }}
                  className="text-xs text-gray-500 hover:text-gray-300 ml-2">× change</button>
              </div>
            ) : (
              <select
                value={unitId}
                onChange={e => handleUnitChange(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select unit...</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Incident */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Incident <span className="text-red-500">*</span>
            </label>
{/* Everyone gets the incident dropdown — field users pre-filled from assignment but can change if not yet assigned */}
            {incidentId && !isAdmin ? (
              <div className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 flex items-center justify-between">
                <span>{incidentName}</span>
                <button type="button" onClick={() => { setIncidentId(''); setIncidentName('') }}
                  className="text-xs text-gray-500 hover:text-gray-300 ml-2">× change</button>
              </div>
            ) : (
              <select
                value={incidentId}
                onChange={e => handleIncidentChange(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select incident...</option>
                {incidents.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Admin override notice */}
          {isAdmin && isAdminOverride && (
            <div className="bg-amber-950/60 border border-amber-700 rounded-lg px-3 py-2 text-amber-400 text-xs">
              ⚠️ Admin override — for backdated 214s. Unit and incident auto-suggested but can be changed freely.
            </div>
          )}

          {/* Op Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Operational Period Date
            </label>
            <input
              type="date"
              value={opDate}
              onChange={e => setOpDate(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Shift toggle + times */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Shift
            </label>
            <div className="flex gap-2 mb-3">
              {(['day', 'night'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    shift === s
                      ? s === 'day' ? 'bg-yellow-600 text-white' : 'bg-indigo-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s === 'day' ? '☀️ Day' : '🌙 Night'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                <input
                  type="time"
                  value={opStart}
                  onChange={e => setOpStart(e.target.value)}
                  className="w-full min-w-0 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs text-gray-500 mb-1">End Time</label>
                <input
                  type="time"
                  value={opEnd}
                  onChange={e => setOpEnd(e.target.value)}
                  className="w-full min-w-0 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Assigned Personnel — preview + edit before save */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Assigned Personnel (Section 6)
              </label>
              {unitId && (
                <span className="text-xs text-gray-500">
                  {crew.length > 0 ? `${crew.length} from roster` : 'None assigned to unit'}
                </span>
              )}
            </div>
            {crew.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 divide-y divide-gray-700/50 mb-2">
                {crew.map((emp, i) => (
                  <div key={emp.id} className="flex items-center px-3 py-2 text-sm gap-3">
                    <span className="flex-1 text-white">{emp.name}</span>
                    <span className="text-gray-500 text-xs w-28 truncate">{emp.role || '—'}</span>
                    <span className="text-gray-600 text-xs w-32 truncate">Sierra Valley EMS</span>
                    <button type="button" onClick={() => setCrew(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition-colors">✕</button>
                  </div>
                ))}
              </div>
            )}
            {/* Add extra personnel — constrained dropdown */}
            {(() => {
              const crewIds = new Set(crew.map(c => c.id))
              const available = allEmployees.filter((e: any) => !crewIds.has(e.id))
              return (
                <div className="flex gap-2 items-center">
                  <select
                    id="extraPersonSelect"
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                    defaultValue=""
                  >
                    <option value="">Add person from roster...</option>
                    {available.map((e: any) => (
                      <option key={e.id} value={e.id} data-name={e.name} data-role={e.role}>
                        {e.name} — {e.role}
                      </option>
                    ))}
                  </select>
                  <button type="button"
                    onClick={() => {
                      const sel = document.getElementById('extraPersonSelect') as HTMLSelectElement
                      const opt = sel?.selectedOptions[0]
                      if (!opt?.value) return
                      const empId = opt.value
                      const empName = opt.getAttribute('data-name') || ''
                      const empRole = opt.getAttribute('data-role') || ''
                      setCrew(prev => [...prev, { id: empId, name: empName, role: empRole }])
                      sel.value = ''
                    }}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
                    + Add
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Unit Leader */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Unit Leader Name
            </label>
            {crew.length > 0 ? (
              <select
                value={leaderName}
                onChange={e => {
                  setLeaderName(e.target.value)
                  const emp = crew.find(c => c.name === e.target.value)
                  if (emp?.role) setLeaderPosition(roleToICSPosition(emp.role))
                }}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select or type below...</option>
                {crew.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={leaderName}
              onChange={e => setLeaderName(e.target.value)}
              placeholder="Leader name"
              className={`w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 ${crew.length > 0 ? 'mt-2' : ''}`}
            />
          </div>

          {/* ICS Position */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Leader ICS Position
            </label>
            <input
              type="text"
              value={leaderPosition}
              onChange={e => setLeaderPosition(e.target.value)}
              placeholder="e.g. EMS Supervisor, Medical Unit Leader"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Initial Activity */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Initial Activity <span className="text-red-500">*</span>
            </label>
            <textarea
              value={initialActivity}
              onChange={e => setInitialActivity(e.target.value)}
              required
              rows={3}
              placeholder="Arrived on scene. Established operations. Briefed crew on assignments."
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-bold transition-colors"
          >
            {submitting ? 'Creating ICS 214...' : 'Start ICS 214 Log'}
          </button>
        </form>

      </div>
    </div>
  )
}
