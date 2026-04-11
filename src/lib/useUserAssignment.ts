'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserAssignment = {
  user: { id: string; email?: string } | null
  employee: { id: string; name: string; role: string; app_role: string } | null
  incidentUnit: { id: string; unit_id: string; incident_id: string } | null
  unit: { id: string; name: string } | null
  incident: { id: string; name: string } | null
  loading: boolean
}

export function useUserAssignment(): UserAssignment {
  const supabase = createClient()
  const [state, setState] = useState<UserAssignment>({
    user: null,
    employee: null,
    incidentUnit: null,
    unit: null,
    incident: null,
    loading: true,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setState(s => ({ ...s, loading: false }))
          return
        }

        // Get employee record by auth_user_id
        const { data: empData } = await supabase
          .from('employees')
          .select('id, name, role, app_role')
          .eq('auth_user_id', user.id)
          .single()

        if (!empData) {
          setState({ user: { id: user.id, email: user.email }, employee: null, incidentUnit: null, unit: null, incident: null, loading: false })
          return
        }

        // Get active unit assignment via employee_id (most reliable join)
        const { data: assignments } = await supabase
          .from('unit_assignments')
          .select(`
            id,
            released_at,
            incident_unit:incident_units(
              id,
              unit_id,
              incident_id,
              released_at,
              unit:units(id, name),
              incident:incidents(id, name, status)
            )
          `)
          .eq('employee_id', empData.id)
          .is('released_at', null)
          .order('assigned_at', { ascending: false })
          .limit(5)

        type IU = {
          id: string; unit_id: string; incident_id: string; released_at: string | null
          unit?: { id: string; name: string } | null
          incident?: { id: string; name: string; status: string } | null
        }
        type Row = { id: string; released_at: string | null; incident_unit?: IU | null }

        // Find the best active assignment: prefer active incident + non-released incident_unit
        const rows = ((assignments || []) as unknown as Row[])
        const best = rows.find(r => {
          const iu = r.incident_unit
          if (!iu) return false
          if (iu.released_at) return false
          return (iu.incident as any)?.status === 'Active'
        }) ?? rows.find(r => r.incident_unit && !r.incident_unit.released_at) ?? rows[0]

        const iu = best?.incident_unit ?? null

        setState({
          user: { id: user.id, email: user.email },
          employee: empData,
          incidentUnit: iu ? { id: iu.id, unit_id: iu.unit_id, incident_id: iu.incident_id } : null,
          unit: iu?.unit ?? null,
          incident: iu?.incident ?? null,
          loading: false,
        })
      } catch {
        setState(s => ({ ...s, loading: false }))
      }
    }
    load()
  }, [])

  return state
}
