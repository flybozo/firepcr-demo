import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useICS214DataLoad, getLeaderPosition, type Unit, type Incident, type Employee } from './useICS214DataLoad'
import { createICS214 } from '@/lib/services/ics214'

function roleToICSPosition(role: string): string {
  const map: Record<string, string> = {
    'MD': 'MD', 'DO': 'MD',
    'NP': 'NP', 'PA': 'PA',
    'RN': 'RN', 'Paramedic': 'Paramedic',
    'EMT': 'EMT', 'AEMT': 'AEMT',
    'Tech': 'Rescue Tech', 'Admin': 'Admin',
  }
  return map[role] || role
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useICS214Form() {
  const navigate = useNavigate()
  const assignment = useUserAssignment()
  const isAdmin = ['MD', 'DO', 'Admin'].includes(assignment?.employee?.role || '')
  const supabase = createClient()

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
  const [initialActivityTime, setInitialActivityTime] = useState(() => {
    const now = new Date(); now.setSeconds(0, 0); return now.toISOString().slice(0, 16)
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isAdminOverride, setIsAdminOverride] = useState(false)

  useICS214DataLoad({
    unitId, incidentId, assignment, isAdmin,
    setUnits, setIncidents, setAllEmployees,
    applyPreFill: (data) => {
      if (data.unitId !== undefined) setUnitId(data.unitId)
      if (data.unitName !== undefined) setUnitName(data.unitName)
      if (data.unitType !== undefined) setUnitType(data.unitType)
      if (data.leaderPosition !== undefined) setLeaderPosition(data.leaderPosition)
      if (data.incidentId !== undefined) setIncidentId(data.incidentId)
      if (data.incidentName !== undefined) setIncidentName(data.incidentName)
      if (data.leaderName !== undefined) setLeaderName(data.leaderName)
    },
    setCrew,
  })

  useEffect(() => {
    if (shift === 'day') { setOpStart('06:00'); setOpEnd('18:00') }
    else { setOpStart('18:00'); setOpEnd('06:00') }
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
      const createdBy = assignment.employee?.name || assignment.user?.email || 'Unknown'
      const ics214Id = await createICS214({
        unitId, unitName, incidentId, incidentName,
        opDate, opStart, opEnd, leaderName, leaderPosition,
        notes, initialActivity, initialActivityTime, crew, createdBy, isAdmin,
      })
      navigate(`/ics214/${ics214Id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create ICS 214')
      setSubmitting(false)
    }
  }

  return {
    assignment,
    units, incidents, crew, allEmployees,
    setCrew,
    unitId, unitName, unitType,
    incidentId, incidentName,
    opDate, setOpDate,
    shift, setShift,
    opStart, setOpStart,
    opEnd, setOpEnd,
    leaderName, setLeaderName,
    leaderPosition, setLeaderPosition,
    notes, setNotes,
    initialActivity, setInitialActivity,
    initialActivityTime, setInitialActivityTime,
    submitting, error,
    isAdminOverride, isAdmin,
    handleUnitChange, handleIncidentChange, handleSubmit,
    roleToICSPosition,
  }
}
