import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

// Simple cross-component event so the inbox can instantly tell the badge to refresh
export function triggerNotificationBadgeRefresh() {
  window.dispatchEvent(new CustomEvent('notif-badge-refresh'))
}

export function useUnreadNotificationCount(): { count: number } {
  const { employee, unit } = useUser()
  const [count, setCount] = useState(0)

  const fetchCount = useCallback(async () => {
    if (!employee?.id) return

    const employeeId = employee.id
    const role = employee.role
    const unitName = unit?.name
    const supabase = createClient()

    const orParts = [
      'target_employee_ids.is.null',
      `target_employee_ids.cs.{${employeeId}}`,
    ]
    if (role) orParts.push(`target_roles.cs.{${role}}`)
    if (unitName) orParts.push(`target_units.cs.{${unitName}}`)

    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase
        .from('push_notifications')
        .select('id')
        .or(orParts.join(',')),
      supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('employee_id', employeeId),
    ])

    const allIds = new Set((notifs || []).map((n: { id: string }) => n.id))
    const readIds = new Set((reads || []).map((r: { notification_id: string }) => r.notification_id))
    setCount([...allIds].filter(id => !readIds.has(id)).length)
  }, [employee?.id, employee?.role, unit?.name])

  useEffect(() => {
    if (!employee?.id) return

    fetchCount()
    const interval = setInterval(fetchCount, 60_000)

    // Instantly refresh when the inbox marks notifications as read or deletes them
    window.addEventListener('notif-badge-refresh', fetchCount)

    return () => {
      clearInterval(interval)
      window.removeEventListener('notif-badge-refresh', fetchCount)
    }
  }, [fetchCount, employee?.id])

  return { count }
}
