

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { loadList } from '@/lib/offlineFirst'
import { LoadingSkeleton } from '@/components/ui'
import { queryAllIncidents, queryUnitsWithIncidents } from '@/lib/services/encounters'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { inputCls, labelCls } from '@/components/ui/FormField'

// Step 1 fields — common to ALL encounter types
type Step1Form = {
  unit_id: string
  unit_name: string
  unit_type: string
  incident_id: string
  incident_name: string
  date: string
  time: string
  crew_resource_number: string
  dispatch_datetime: string
  arrive_scene_datetime: string
  patient_contact_datetime: string
}

type UnitOption = {
  id: string
  name: string
  unit_type: { name: string } | null
  incident_units: { id: string; released_at: string | null; incident: { id: string; name: string; status: string } | null }[]
}

function NewEncounterInner() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const incidentIdParam = searchParams.get('incidentId')
  const unitIdParam = searchParams.get('unitId')
  const assignment = useUserAssignment()

  const [loading, setLoading] = useState(true)
  const [units, setUnits] = useState<UnitOption[]>([])
  const [displayedUnits, setDisplayedUnits] = useState<UnitOption[]>([])
  const [incidents, setIncidents] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  const now = new Date()
  const [form, setForm] = useState<Step1Form>({
    unit_id: unitIdParam || '',
    unit_name: '',
    unit_type: '',
    incident_id: incidentIdParam || '',
    incident_name: '',
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5),
    crew_resource_number: '',
    dispatch_datetime: now.toISOString().slice(0, 16),
    arrive_scene_datetime: now.toISOString().slice(0, 16),
    patient_contact_datetime: now.toISOString().slice(0, 16),
  })

  const set = (k: keyof Step1Form, v: string) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    const load = async () => {
      // Preload dropdown data from cache — unblock UI immediately
      try {
        const { getCachedData } = await import('@/lib/offlineStore')
        const cachedUnits = await getCachedData('units') as any[]
        if (cachedUnits.length > 0) { setUnits(cachedUnits as any); setDisplayedUnits(cachedUnits as any) }
        const cachedInc = await getCachedData('incidents') as any[]
        if (cachedInc.length > 0) setIncidents(cachedInc)
      } catch {}
      // Unblock UI as soon as cache is loaded — don't wait for network
      setLoading(false)
      // Background network refresh (non-blocking)
      if (!navigator.onLine) return
      try {
        const [unitResult, incResult] = await Promise.all([
          loadList(() => queryUnitsWithIncidents() as any, 'units'),
          loadList(() => queryAllIncidents(), 'incidents'),
        ])
        setUnits(unitResult.data as any)
        setDisplayedUnits(unitResult.data as any)
        setIncidents(incResult.data)
      } catch { /* offline — already showing cached data */ }
    }
    load()
  }, [])

  // Auto-fill from assignment
  useEffect(() => {
    if (!assignment.loading && assignment.unit && units.length > 0) {
      const matchedUnit = units.find(u => u.name === assignment.unit?.name)
      if (matchedUnit) {
        const typeName = (matchedUnit.unit_type as any)?.name || ''
        const activeIU = matchedUnit.incident_units?.find((iu: any) => iu.incident?.status === 'Active' && !iu.released_at)
        set('unit_id', matchedUnit.id)
        set('unit_name', matchedUnit.name)
        set('unit_type', typeName)
        if (activeIU?.incident?.id && !form.incident_id) {
          set('incident_id', activeIU.incident.id)
          set('incident_name', activeIU.incident.name || '')
        }
      }
    }
  }, [assignment.loading, assignment.unit, units])

  // When unit changes, auto-fill incident
  const handleUnitChange = (unitId: string) => {
    const unit = units.find(u => u.id === unitId)
    const typeName = (unit?.unit_type as any)?.name || ''
    const activeIU = unit?.incident_units?.find((iu: any) => iu.incident?.status === 'Active' && !iu.released_at)
    set('unit_id', unitId)
    set('unit_name', unit?.name || '')
    set('unit_type', typeName)
    if (activeIU?.incident?.id) {
      set('incident_id', activeIU.incident.id)
      set('incident_name', activeIU.incident.name || '')
    }
  }

  const handleIncidentChange = (incidentId: string) => {
    const inc = incidents.find(i => i.id === incidentId)
    set('incident_id', incidentId)
    set('incident_name', inc?.name || '')
    if (incidentId) {
      const filtered = units.filter(u =>
        u.incident_units?.some((iu: any) => !iu.released_at && iu.incident?.id === incidentId)
      )
      setDisplayedUnits(filtered)
      // If current unit is no longer valid for selected incident, clear it
      if (form.unit_id && !filtered.find(u => u.id === form.unit_id)) {
        set('unit_id', '')
        set('unit_name', '')
        set('unit_type', '')
      }
    } else {
      setDisplayedUnits(units)
    }
  }

  const isLocked = !!assignment.unit && !assignment.loading
  const isIncidentLocked = isLocked && !!assignment.incidentUnit?.incident_id

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.unit_id) return
    const isAmbulance = form.unit_type === 'Ambulance' || form.unit_name.startsWith('Medic')
    const path = isAmbulance ? 'pcr' : 'simple'
    const params = new URLSearchParams({
      unitId: form.unit_id,
      unitName: form.unit_name,
      ...(form.incident_id && { incidentId: form.incident_id }),
      ...(form.incident_name && { incidentName: form.incident_name }),
      date: form.date,
      time: form.time,
      crew_resource_number: form.crew_resource_number,
      ...(form.dispatch_datetime && { dispatch_datetime: form.dispatch_datetime }),
      ...(form.arrive_scene_datetime && { arrive_scene_datetime: form.arrive_scene_datetime }),
      ...(form.patient_contact_datetime && { patient_contact_datetime: form.patient_contact_datetime }),
    })
    navigate(`/encounters/new/${path}?${params.toString()}`)
  }

  if (loading || assignment.loading) return <LoadingSkeleton fullPage />

  const selectedUnit = units.find(u => u.id === form.unit_id)
  const isAmbulance = form.unit_type === 'Ambulance' || form.unit_name.startsWith('Medic')

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto mt-8 md:mt-0 pb-16">
      <h1 className="text-2xl font-bold mb-1">New Patient Encounter</h1>
      <p className="text-gray-400 text-sm mb-6">
        {form.unit_name
          ? `${form.unit_name} · ${isAmbulance ? 'NEMSIS PCR' : 'Simple EHR'}`
          : 'Select a unit to begin'}
      </p>

      <form onSubmit={handleContinue} className="space-y-4">

        {/* Unit & Incident */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Unit & Incident</h2>

          <div>
            <label className={labelCls}>Unit *</label>
            {isLocked ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                <span className="text-sm text-white font-medium">{form.unit_name}</span>
                <span className="text-xs text-gray-500">(your assigned unit)</span>
              </div>
            ) : (
              <select value={form.unit_id} onChange={e => handleUnitChange(e.target.value)} className={inputCls}>
                <option value="">Select unit...</option>
                {['Med Unit', 'Ambulance', 'Rescue'].map(type => {
                  const typeUnits = displayedUnits.filter(u => (u.unit_type as any)?.name === type)
                  if (!typeUnits.length) return null
                  return (
                    <optgroup key={type} label={type}>
                      {typeUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </optgroup>
                  )
                })}
              </select>
            )}
          </div>

          <div>
            <label className={labelCls}>Incident</label>
            {isIncidentLocked ? (
              <div className={inputCls + ' flex items-center gap-2 opacity-75 cursor-not-allowed select-none'}>
                <span className="flex-1">{form.incident_name || 'Loading...'}</span>
                <span className="text-xs text-gray-500">🔒</span>
              </div>
            ) : (
              <select value={form.incident_id} onChange={e => handleIncidentChange(e.target.value)} className={inputCls}>
                <option value="">Select incident (optional)...</option>
                {incidents.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Date / Time / Crew */}
        <div className="theme-card rounded-xl p-4 border space-y-4 overflow-hidden">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Date, Time & Crew</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className={labelCls}>Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls + ' w-full min-w-0'} />
            </div>
            <div className="min-w-0">
              <label className={labelCls}>Time</label>
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)} className={inputCls + ' w-full min-w-0'} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Crew Resource Number</label>
            <input value={form.crew_resource_number} onChange={e => set('crew_resource_number', e.target.value)}
              placeholder="e.g. ICS-046" className={inputCls} />
          </div>
        </div>



        <button type="submit" disabled={!form.unit_id}
          className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors">
          {form.unit_id
            ? `Continue to ${isAmbulance ? 'NEMSIS PCR' : 'Patient Encounter'} →`
            : 'Select a unit to continue'}
        </button>

        <button type="button" onClick={() => navigate(-1)}
          className="w-full text-center text-gray-600 text-xs py-2">← Cancel</button>
      </form>
    </div>
  )
}

export default function NewEncounterPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <NewEncounterInner />
    </Suspense>
  )
}
