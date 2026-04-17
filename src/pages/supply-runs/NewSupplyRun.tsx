

import { useEffect, useRef, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { getIsOnline } from '@/lib/syncManager'
import { queueOfflineWrite } from '@/lib/offlineStore'
import { useNavigate, useSearchParams } from 'react-router-dom'

type Incident = {
  id: string
  name: string
  status: string
}

type IncidentUnit = {
  id: string
  incident_id: string
  unit: { id: string; name: string } | null
}

type Employee = {
  id: string
  name: string
  role: string
}

type CrewMember = {
  id: string
  name: string
  role: string
  role_on_unit: string | null
}

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

function SupplyRunNewInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const requestId = useRef(crypto.randomUUID())
  const [searchParams] = useSearchParams()
  const presetIncidentId = searchParams.get('incidentId') ?? ''

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const nowTime = now.toTimeString().slice(0, 5)

  // Mode: 'loading' | 'crew' (pre-filled, locked) | 'admin' (dropdowns)
  const [mode, setMode] = useState<'loading' | 'crew' | 'admin'>('loading')
  const [submitting, setSubmitting] = useState(false)

  // Locked values (crew mode)
  const [lockedIncident, setLockedIncident] = useState<Incident | null>(null)
  const [lockedUnit, setLockedUnit] = useState<{ id: string; name: string } | null>(null)
  const [lockedIncidentUnitId, setLockedIncidentUnitId] = useState('')
  const [autoName, setAutoName] = useState('')

  // Admin mode data
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [incidentUnits, setIncidentUnits] = useState<IncidentUnit[]>([])

  // Crew dropdown for "Dispensed By"
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [dispensedByMode, setDispensedByMode] = useState<'auto' | 'dropdown' | 'text'>('auto')

  const [form, setForm] = useState({
    incident_id: presetIncidentId,
    incident_unit_id: '',
    run_date: today,
    time: nowTime,
    resource_number: '',
    dispensed_by: '',
    notes: '',
  })

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // Load crew for a given incident_unit_id
  const loadCrew = async (incidentUnitId: string) => {
    if (!incidentUnitId) { setCrew([]); return }
    const { data } = await supabase
      .from('unit_assignments')
      .select('id, role_on_unit, employee:employees(id, name, role)')
      .eq('incident_unit_id', incidentUnitId)
      .is('released_at', null)
    const rows = (data as unknown as Array<{
      id: string
      role_on_unit: string | null
      employee: { id: string; name: string; role: string } | null
    }>) || []
    setCrew(rows
      .filter(r => r.employee)
      .map(r => ({
        id: r.employee!.id,
        name: r.employee!.name,
        role: r.employee!.role,
        role_on_unit: r.role_on_unit,
      }))
    )
  }

  // Load incident units when incident changes (admin mode)
  const handleIncidentChange = async (incidentId: string) => {
    set('incident_id', incidentId)
    set('incident_unit_id', '')
    setCrew([])
    if (!incidentId) { setIncidentUnits([]); return }
    const { data } = await supabase
      .from('incident_units')
      .select('id, incident_id, unit:units(id, name)')
      .eq('incident_id', incidentId)
      .is('released_at', null)
      .order('id')
    setIncidentUnits((data as unknown as IncidentUnit[]) || [])
  }

  const handleUnitChange = async (incidentUnitId: string) => {
    set('incident_unit_id', incidentUnitId)
    await loadCrew(incidentUnitId)
  }

  // Initial load
  useEffect(() => {
    const init = async () => {
      // Preload dropdown data from cache
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedInc = await getCachedData('incidents') as any[]
        if (cachedInc.length > 0) setIncidents(cachedInc as Incident[])
        const cachedEmps = await getCachedData('employees') as any[]
        if (cachedEmps.length > 0) setAllEmployees(cachedEmps as Employee[])
      } catch {}
      const { data: { user } } = await supabase.auth.getUser()

      // Try to find active unit assignment for this user
      if (user) {
        // Get employee record first, then find assignment via employee_id
        const { data: empRecord } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('auth_user_id', user.id)
          .single()

        const assignmentData = empRecord ? await supabase
          .from('unit_assignments')
          .select(`
            id,
            role_on_unit,
            incident_unit:incident_units(
              id,
              incident_id,
              unit_id,
              incident:incidents(id, name, status),
              unit:units(id, name)
            )
          `)
          .eq('employee_id', empRecord.id)
          .is('released_at', null)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle() : { data: null }

        const assignment = assignmentData?.data

        if (assignment) {
          const iu = (assignment as unknown as {
            incident_unit: {
              id: string
              incident_id: string
              unit_id: string
              incident: { id: string; name: string; status: string } | null
              unit: { id: string; name: string } | null
            } | null
          }).incident_unit

          if (iu && iu.incident && iu.unit) {
            setLockedIncident(iu.incident)
            setLockedUnit(iu.unit)
            setLockedIncidentUnitId(iu.id)
            setForm(prev => ({
              ...prev,
              incident_id: iu.incident_id,
              incident_unit_id: iu.id,
            }))
            await loadCrew(iu.id)
            setMode('crew')

            // Auto-fill Dispensed By
            const { data: emp } = await supabase
              .from('employees')
              .select('name')
              .eq('auth_user_id', user.id)
              .maybeSingle()
            if (emp?.name) {
              setAutoName(emp.name)
              setForm(prev => ({ ...prev, dispensed_by: emp.name }))
              setDispensedByMode('auto')
            } else {
              setDispensedByMode('dropdown')
            }
            return
          }
        }

        // No active assignment — admin mode
        // Try to auto-fill name anyway
        const { data: emp } = await supabase
          .from('employees')
          .select('id, name, role')
          .eq('auth_user_id', user.id)
          .maybeSingle()
        if (emp?.name) {
          setAutoName(emp.name)
          setForm(prev => ({ ...prev, dispensed_by: emp.name }))
          setDispensedByMode('auto')
        } else {
          setDispensedByMode('text')
        }
      }

      // Admin mode — load incidents + all employees
      const [incResult, empResult] = await Promise.all([
        loadList<Incident>(
          () => supabase.from('incidents').select('id, name, status').in('status', ['Active', 'Closed']).order('status').order('name'),
          'incidents'
        ),
        loadList<Employee>(
          () => supabase.from('employees').select('id, name, role').eq('status', 'Active').order('name'),
          'employees'
        ),
      ])
      setIncidents(incResult.data)
      setAllEmployees(empResult.data)

      // If preset incident from URL, load its units
      if (presetIncidentId) {
        const { data: iuData } = await supabase
          .from('incident_units')
          .select('id, incident_id, unit:units(id, name)')
          .eq('incident_id', presetIncidentId)
          .is('released_at', null)
          .order('id')
        setIncidentUnits((iuData as unknown as IncidentUnit[]) || [])
        setForm(prev => ({ ...prev, incident_id: presetIncidentId }))
      }

      setMode('admin')
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!form.incident_unit_id) {
      alert('Please select an incident and unit.')
      return
    }
    setSubmitting(true)
    const payload = {
      incident_unit_id: form.incident_unit_id,
      incident_id: form.incident_id || null,
      run_date: form.run_date,
      time: form.time || null,
      resource_number: form.resource_number || null,
      dispensed_by: form.dispensed_by || null,
      notes: form.notes || null,
      client_request_id: requestId.current,
    }
    if (getIsOnline()) {
      try {
        const { data, error } = await supabase
          .from('supply_runs')
          .insert(payload)
          .select('id')
          .single()
        if (error) {
          if (error.code === '23505') {
            // Duplicate — already saved
            console.warn('[SupplyRun] Duplicate client_request_id — already saved')
            navigate('/supply-runs?success=1')
            return
          }
          throw new Error(error.message)
        }
        navigate(`/supply-runs/${data.id}`)
      } catch (err: unknown) {
        setSubmitting(false)
        const msg = err instanceof Error ? err.message : 'Unknown error'
        alert(`Error: ${msg}`)
      }
    } else {
      const tempId = crypto.randomUUID()
      await queueOfflineWrite('supply_runs', 'insert', { id: tempId, ...payload })
      setSubmitting(false)
      navigate('/supply-runs?offline=1')
    }
  }

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  const dispensedByOptions: CrewMember[] = crew.length > 0
    ? crew
    : allEmployees.map(e => ({ id: e.id, name: e.name, role: e.role, role_on_unit: null }))

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8 mt-8 md:mt-0">
      <div className="max-w-lg mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-white text-sm">← Back</button>
          <div>
            <h1 className="text-xl font-bold">New Supply Run</h1>
            <p className="text-xs text-gray-500">Create a run record, then add items</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">

          {/* Incident */}
          <div>
            <label className={labelCls}>Incident *</label>
            {mode === 'crew' && lockedIncident ? (
              <div className="flex items-center gap-2">
                <div className={`${inputCls} bg-gray-700 text-gray-300 cursor-not-allowed`}>
                  🔥 {lockedIncident.name}
                </div>
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.incident_id}
                onChange={e => handleIncidentChange(e.target.value)}
              >
                <option value="">Select active incident</option>
                {incidents.map(inc => (
                  <option key={inc.id} value={inc.id}>{inc.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Unit */}
          <div>
            <label className={labelCls}>Unit *</label>
            {mode === 'crew' && lockedUnit ? (
              <div className={`${inputCls} bg-gray-700 text-gray-300 cursor-not-allowed`}>
                🚑 {lockedUnit.name}
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.incident_unit_id}
                onChange={e => handleUnitChange(e.target.value)}
                disabled={!form.incident_id}
              >
                <option value="">{form.incident_id ? 'Select unit' : 'Select incident first'}</option>
                {incidentUnits.map(iu => {
                  const unit = iu.unit as unknown as { id: string; name: string } | null
                  return unit ? <option key={iu.id} value={iu.id}>{unit.name}</option> : null
                })}
              </select>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={labelCls}>Date *</label>
              <input type="date" className={inputCls + ' min-w-0'} value={form.run_date} onChange={e => set('run_date', e.target.value)} />
            </div>
            <div className="min-w-0">
              <label className={labelCls}>Time</label>
              <input type="time" className={inputCls + ' min-w-0'} value={form.time} onChange={e => set('time', e.target.value)} />
            </div>
          </div>

          {/* Resource Number */}
          <div>
            <label className={labelCls}>Resource Number</label>
            <input
              type="text"
              className={inputCls}
              value={form.resource_number}
              onChange={e => set('resource_number', e.target.value)}
              placeholder="Crew resource number"
            />
          </div>

          {/* Dispensed By */}
          <div>
            <label className={labelCls}>Dispensed By</label>
            {dispensedByMode === 'auto' ? (
              <div className="flex items-center gap-2">
                <div className={`flex-1 ${inputCls} bg-gray-700 text-gray-200 cursor-default`}>
                  {autoName}
                </div>
                <button
                  type="button"
                  onClick={() => setDispensedByMode('dropdown')}
                  className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Change
                </button>
              </div>
            ) : dispensedByMode === 'dropdown' ? (
              <div className="flex items-center gap-2">
                <select
                  className={`flex-1 ${inputCls}`}
                  value={form.dispensed_by}
                  onChange={e => set('dispensed_by', e.target.value)}
                >
                  <option value="">
                    {dispensedByOptions.length > 0 ? 'Select crew member...' : 'Select employee...'}
                  </option>
                  {dispensedByOptions.map(m => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.role_on_unit || m.role})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setDispensedByMode('text')}
                  className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Type
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className={`flex-1 ${inputCls}`}
                  value={form.dispensed_by}
                  onChange={e => set('dispensed_by', e.target.value)}
                  placeholder="Name of person dispensing"
                />
                {dispensedByOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDispensedByMode('dropdown')}
                    className="text-xs px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Crew
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded-xl transition-colors"
        >
          {submitting ? 'Creating...' : '🚚 Create Supply Run'}
        </button>

        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 text-blue-300 text-xs">
          💡 After creating the supply run, you&apos;ll be taken to the run detail page where you can scan barcodes to add items.
        </div>
      </div>
    </div>
  )
}

export default function SupplyRunNewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    }>
      <SupplyRunNewInner />
    </Suspense>
  )
}
