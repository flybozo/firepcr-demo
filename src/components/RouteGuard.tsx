/**
 * RouteGuard — enforces role-based and assignment-based access control.
 *
 * Rules for field users (app_role !== 'admin'):
 *
 * ALWAYS ALLOWED (no assignment required):
 *   /profile, /schedule/request, /roster (read-only), /documents
 *
 * ALLOWED ONLY WHEN ASSIGNED TO AN ACTIVE UNIT:
 *   /encounters, /mar, /cs, /inventory, /supply-runs, /incidents,
 *   /ics214, /unsigned-items, /patient-search, /payroll/my, /payroll
 *
 * UNIT DETAIL ONLY (no list view):
 *   /units — redirected to /units/<their_unit_id>; list blocked
 *
 * ADMIN ONLY:
 *   /admin/*, /roster/new, /roster/hr, /formulary, /analytics,
 *   /billing, /schedule (full — generate/calendar/admin view),
 *   /contacts, /units/new
 *
 * Unassigned field users hitting a restricted route → /profile with a banner.
 */

import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useUser } from '@/contexts/UserContext'
import { useAnyPermission, usePermissionLoading } from '@/hooks/usePermission'

type Props = {
  /** 'admin' — admin only; 'assigned' — must be assigned; 'any' — any logged-in user */
  require?: 'admin' | 'assigned' | 'any'
  /** If true, field users are redirected to their own unit detail instead of the list */
  unitListGuard?: boolean
  /** Alternative to 'admin': allow if user has ANY of these permissions */
  permissions?: string[]
}

export default function RouteGuard({ require: level = 'any', unitListGuard = false, permissions }: Props) {
  const { isAdmin, isField, unit, loading } = useUser()
  const permLoading = usePermissionLoading()
  const hasPermission = useAnyPermission(...(permissions || []))
  const location = useLocation()

  // Wait for context to resolve
  if (loading || permLoading) return null

  // Admin-only routes — but also allow users with explicit permissions
  if (level === 'admin' && !isAdmin && !(permissions?.length && hasPermission)) {
    return <Navigate to="/profile" replace state={{ accessDenied: true }} />
  }

  // Assignment-required routes — field users without a unit get bounced
  // But users with explicit permissions (e.g. inventory manager) bypass this
  if (level === 'assigned' && isField && !unit && !(permissions?.length && hasPermission)) {
    return <Navigate to="/profile" replace state={{ unassigned: true }} />
  }

  // Unit list guard — field users see their unit detail, not the list
  if (unitListGuard && isField) {
    if (unit) {
      // Only redirect if they're hitting exactly /units (the list)
      if (location.pathname === '/units') {
        return <Navigate to={`/units/${unit.id}`} replace />
      }
    } else {
      // Not assigned — no unit to show
      return <Navigate to="/profile" replace state={{ unassigned: true }} />
    }
  }

  return <Outlet />
}
