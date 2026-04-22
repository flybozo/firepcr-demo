/**
 * UserContext — single source of truth for the current user's identity,
 * employee record, and active unit/incident assignment.
 *
 * Replaces the 52+ individual useUserAssignment() calls with one shared
 * React Context query. Pages never trigger a network round-trip for user
 * identity again after the initial mount.
 *
 * Provider placement: inside AuthGuard, so auth is guaranteed before fetch.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserEmployee = {
  id: string
  name: string
  role: string
  app_role: string
}

export type UserIncidentUnit = {
  id: string
  unit_id: string
  incident_id: string
}

export type UserUnit = {
  id: string
  name: string
}

export type UserIncident = {
  id: string
  name: string
}

export type UserState = {
  user: { id: string; email?: string } | null
  employee: UserEmployee | null
  incidentUnit: UserIncidentUnit | null
  unit: UserUnit | null
  incident: UserIncident | null
  /** true while the initial fetch is in flight */
  loading: boolean
  /** convenience: true when app_role === 'admin' */
  isAdmin: boolean
  /** convenience: true when app_role !== 'admin' */
  isField: boolean
  /** re-fetch from Supabase (e.g. after assignment change) */
  refreshUser: () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const UserContext = createContext<UserState | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()

  const [state, setState] = useState<Omit<UserState, 'refreshUser'>>({
    user: null,
    employee: null,
    incidentUnit: null,
    unit: null,
    incident: null,
    loading: true,
    isAdmin: false,
    isField: false,
  })

  const fetchUser = useCallback(async () => {
    try {
      const { getCachedData } = await import('../lib/offlineStore')

      // getSession() reads from localStorage — works offline
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (!user) {
        setState({ user: null, employee: null, incidentUnit: null, unit: null, incident: null, loading: false, isAdmin: false, isField: false })
        return
      }

      // Try cache first for employee
      let emp: any = null
      try {
        const cachedEmps = await getCachedData('employees') as any[]
        emp = cachedEmps.find(e => e.auth_user_id === user.id) ?? null
      } catch {}

      // If we have cached employee, set state immediately (unblock UI)
      if (emp) {
        let cachedUnit: UserUnit | null = null
        let cachedIncidentUnit: UserIncidentUnit | null = null
        let cachedIncident: UserIncident | null = null
        try {
          const cachedUnits = await getCachedData('units') as any[]
          for (const u of cachedUnits) {
            const iuList = u.incident_units || []
            for (const iu of iuList) {
              const assignments = iu.unit_assignments || []
              const myAssignment = assignments.find((a: any) => a.employee?.id === emp.id && !a.released_at)
              if (myAssignment && !iu.released_at && iu.incident?.status === 'Active') {
                cachedUnit = { id: u.id, name: u.name }
                cachedIncidentUnit = { id: iu.id, unit_id: u.id, incident_id: iu.incident_id }
                cachedIncident = iu.incident ? { id: iu.incident_id, name: iu.incident.name } : null
                break
              }
            }
            if (cachedUnit) break
          }
        } catch {}

        const isAdmin = emp.app_role === 'admin'
        setState({
          user: { id: user.id, email: user.email },
          employee: emp,
          incidentUnit: cachedIncidentUnit,
          unit: cachedUnit,
          incident: cachedIncident,
          loading: false,
          isAdmin,
          isField: !isAdmin,
        })
      }

      // Don't attempt network if offline
      if (!navigator.onLine) {
        if (!emp) setState(s => ({ ...s, loading: false }))
        return
      }

      try {
        const { data: freshEmp } = await supabase
          .from('employees')
          .select('id, name, role, app_role')
          .eq('auth_user_id', user.id)
          .single()

        if (!freshEmp) {
          if (!emp) {
            setState({ user: { id: user.id, email: user.email }, employee: null, incidentUnit: null, unit: null, incident: null, loading: false, isAdmin: false, isField: false })
          }
          return
        }

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
          .eq('employee_id', freshEmp.id)
          .is('released_at', null)
          .order('assigned_at', { ascending: false })
          .limit(5)

        type IU = { id: string; unit_id: string; incident_id: string; released_at: string | null; unit?: UserUnit | null; incident?: (UserIncident & { status: string }) | null }
        type Row = { id: string; released_at: string | null; incident_unit?: IU | null }

        const rows = ((assignments || []) as unknown as Row[])
        const best =
          rows.find(r => r.incident_unit && !r.incident_unit.released_at && (r.incident_unit.incident as any)?.status === 'Active') ??
          rows.find(r => r.incident_unit && !r.incident_unit.released_at) ??
          rows[0]

        const iu = best?.incident_unit ?? null
        const isAdmin = freshEmp.app_role === 'admin'

        setState({
          user: { id: user.id, email: user.email },
          employee: freshEmp,
          incidentUnit: iu ? { id: iu.id, unit_id: iu.unit_id, incident_id: iu.incident_id } : null,
          unit: iu?.unit ?? null,
          incident: iu?.incident ?? null,
          loading: false,
          isAdmin,
          isField: !isAdmin,
        })
      } catch {
        if (!emp) setState(s => ({ ...s, loading: false }))
      }
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUser()
  }, [fetchUser])

  // Safety net: if loading is still true after 4 s (e.g. Supabase hangs while
  // navigator.onLine is deceptively true), unblock downstream consumers.
  useEffect(() => {
    const t = setTimeout(() => {
      setState(s => s.loading ? { ...s, loading: false } : s)
    }, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <UserContext.Provider value={{ ...state, refreshUser: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useUser(): UserState {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser() must be used inside <UserProvider>')
  return ctx
}
