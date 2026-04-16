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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setState({ user: null, employee: null, incidentUnit: null, unit: null, incident: null, loading: false, isAdmin: false, isField: false })
        return
      }

      // Employee record
      const { data: emp } = await supabase
        .from('employees')
        .select('id, name, role, app_role')
        .eq('auth_user_id', user.id)
        .single()

      if (!emp) {
        setState({ user: { id: user.id, email: user.email }, employee: null, incidentUnit: null, unit: null, incident: null, loading: false, isAdmin: false, isField: false })
        return
      }

      // Active unit assignment
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
        .eq('employee_id', emp.id)
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
      const isAdmin = emp.app_role === 'admin'

      setState({
        user: { id: user.id, email: user.email },
        employee: emp,
        incidentUnit: iu ? { id: iu.id, unit_id: iu.unit_id, incident_id: iu.incident_id } : null,
        unit: iu?.unit ?? null,
        incident: iu?.incident ?? null,
        loading: false,
        isAdmin,
        isField: !isAdmin,
      })
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return (
    <UserContext.Provider value={{ ...state, refreshUser: fetchUser }}>
      {children}
    </UserContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUser(): UserState {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser() must be used inside <UserProvider>')
  return ctx
}
