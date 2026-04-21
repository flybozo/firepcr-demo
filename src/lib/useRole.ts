'use client'

import { useContext } from 'react'
import { PermissionContext } from '@/hooks/usePermission'
import { useUserAssignment } from './useUserAssignment'

export type AppRole = 'admin' | 'field'

export function useRole(): { role: AppRole; loading: boolean; isAdmin: boolean; isField: boolean } {
  const assignment = useUserAssignment()
  const { permissions, loading: permLoading } = useContext(PermissionContext)

  if (assignment.loading || permLoading) {
    return { role: 'field', loading: true, isAdmin: false, isField: false }
  }

  let isAdmin: boolean
  if (permissions.size > 0) {
    isAdmin = permissions.has('*') ||
              permissions.has('admin.settings') ||
              permissions.has('admin.*') ||
              permissions.has('admin.analytics') ||
              permissions.has('encounters.*')
  } else {
    isAdmin = assignment.employee?.app_role === 'admin'
  }

  const role: AppRole = isAdmin ? 'admin' : 'field'
  return { role, loading: false, isAdmin, isField: !isAdmin }
}
