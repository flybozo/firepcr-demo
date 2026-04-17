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

type Props = {
  /** 'admin' — admin only; 'assigned' — must be assigned; 'any' — any logged-in user */
  require?: 'admin' | 'assigned' | 'any'
  /** If true, field users are redirected to their own unit detail instead of the list */
  unitListGuard?: boolean
}

export default function RouteGuard({ require: level = 'any', unitListGuard = false }: Props) {
  const { isAdmin, isField, unit, loading } = useUser()
  const location = useLocation()

  // Wait for context to resolve
  if (loading) return null

  // Admin-only routes
  if (level === 'admin' && !isAdmin) {
    return <Navigate to="/profile" replace state={{ accessDenied: true }} />
  }

  // Assignment-required routes — field users without a unit get bounced
  if (level === 'assigned' && isField && !unit) {
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
