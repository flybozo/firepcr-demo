'use client'

import { useUserAssignment } from './useUserAssignment'

export type AppRole = 'admin' | 'field'

export function useRole(): { role: AppRole; loading: boolean; isAdmin: boolean; isField: boolean } {
  const assignment = useUserAssignment()

  // Still resolving — return loading state with isField: false AND isAdmin: false
  // so neither branch acts on stale data. Pages guard on `loading` explicitly.
  if (assignment.loading) {
    return { role: 'field', loading: true, isAdmin: false, isField: false }
  }

  // Use app_role for access control; role is the clinical/medical role
  const isAdmin = assignment.employee?.app_role === 'admin'
  const role: AppRole = isAdmin ? 'admin' : 'field'
  return { role, loading: false, isAdmin, isField: !isAdmin }
}
