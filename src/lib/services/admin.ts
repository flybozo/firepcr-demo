/**
 * Admin service — queries and mutations for admin dashboard, analytics,
 * company settings, push notifications, and announcements.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get app settings */
export function queryAppSettings() {
  return createClient()
    .from('app_settings')
    .select('*')
    .single()
}

/** Get all employees (for admin views) */
export function queryAllEmployees() {
  return createClient()
    .from('employees')
    .select('id, name, role, status, app_role, headshot_url, wf_email')
    .order('name')
}

/** Get push subscriptions count */
export function queryPushSubscriptionCount() {
  return createClient()
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
}

/** Get organization info */
export function queryOrganization() {
  return createClient()
    .from('organizations')
    .select('*')
    .limit(1)
    .maybeSingle()
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Update app settings */
export function updateAppSettings(data: Record<string, unknown>) {
  return createClient()
    .from('app_settings')
    .update(data)
    .eq('id', data.id as string)
}

/** Update organization */
export function updateOrganization(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('organizations')
    .update(data)
    .eq('id', id)
}
