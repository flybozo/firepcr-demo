'use client'

/**
 * useUserAssignment — thin wrapper around UserContext.
 *
 * Previously: each caller made its own Supabase round-trip.
 * Now: reads from the single UserContext fetch done at app mount.
 *
 * Shape is identical to the old hook — zero page changes required.
 */

import { useUser } from '@/contexts/UserContext'

export type UserAssignment = {
  user: { id: string; email?: string } | null
  employee: { id: string; name: string; role: string; app_role: string } | null
  incidentUnit: { id: string; unit_id: string; incident_id: string } | null
  unit: { id: string; name: string } | null
  incident: { id: string; name: string } | null
  loading: boolean
}

export function useUserAssignment(): UserAssignment {
  const { user, employee, incidentUnit, unit, incident, loading } = useUser()
  return { user, employee, incidentUnit, unit, incident, loading }
}
