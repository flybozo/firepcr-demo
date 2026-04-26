import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserAssignment } from '@/lib/useUserAssignment'

type Unit = { id: string; name: string; unit_type?: { name: string } | null }
type Incident = { id: string; name: string }
type Employee = { id: string; name: string; role?: string }

type PreFill = {
  unitId?: string
  unitName?: string
  unitType?: string
  leaderPosition?: string
  incidentId?: string
  incidentName?: string
  leaderName?: string
}

export type { Unit, Incident, Employee }

export function getLeaderPosition(unitTypeName: string | null | undefined): string {
  if (!unitTypeName) return ''
  if (unitTypeName.toLowerCase().includes('ambulance')) return 'EMS Supervisor'
  if (unitTypeName.toLowerCase().includes('med unit')) return 'EMS Supervisor'
  if (unitTypeName.toLowerCase().includes('rems')) return 'REMS Leader'
  if (unitTypeName.toLowerCase() === 'truck') return 'Driver/Operator'
  return 'EMS Supervisor'
}

export function useICS214DataLoad(params: {
  unitId: string
  incidentId: string
  assignment: UserAssignment
  isAdmin: boolean
  setUnits: (v: Unit[]) => void
  setIncidents: (v: Incident[]) => void
  setAllEmployees: (v: Employee[]) => void
  applyPreFill: (v: PreFill) => void
  setCrew: (v: Employee[]) => void
}) {
  const { unitId, incidentId, assignment, isAdmin, setUnits, setIncidents, setAllEmployees, applyPreFill, setCrew } = params
  const supabase = createClient()

  useEffect(() => {
    if (assignment.loading) return
    const load = async () => {
      const [{ data: unitsData }, { data: incData }] = await Promise.all([
        supabase.from('units').select('id, name, unit_type:unit_types(name)').eq('is_storage', false).order('name'),
        supabase.from('incidents').select('id, name').eq('status', 'Active').order('name'),
      ])
      setUnits((unitsData as unknown as Unit[]) || [])
      setIncidents((incData as Incident[]) || [])
      const { data: empData } = await supabase.from('employees_sync').select('id, name, role').eq('status', 'Active').order('name')
      setAllEmployees((empData as any) || [])

      const preFill: PreFill = {}
      if (!isAdmin && assignment.unit) {
        const u = (unitsData as unknown as Unit[])?.find(u => u.id === assignment.unit!.id)
        if (u) {
          preFill.unitId = u.id
          preFill.unitName = u.name
          const typeName = (u as any).unit_type?.name ?? ''
          preFill.unitType = typeName
          preFill.leaderPosition = getLeaderPosition(typeName)
        }
      }
      if (!isAdmin && assignment.incident) {
        preFill.incidentId = assignment.incident.id
        preFill.incidentName = assignment.incident.name
      }
      if (assignment.employee) {
        preFill.leaderName = assignment.employee.name
      }
      applyPreFill(preFill)
    }
    load()
  }, [assignment.loading])

  useEffect(() => {
    if (!unitId) { setCrew([]); return }
    const load = async () => {
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
}
