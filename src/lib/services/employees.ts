/**
 * Employees service — queries and mutations for roster, credentials, profiles.
 */
import { createClient } from '@/lib/supabase/client'

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get all active employees */
export function queryActiveEmployees() {
  return createClient()
    .from('employees_sync')
    .select('id, name, role, status, headshot_url, wf_email, app_role')
    .eq('status', 'Active')
    .order('name')
}

/** Get a single employee by ID (full record) */
export function queryEmployee(id: string) {
  return createClient()
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()
}

/** Get employee credentials */
export function queryCredentials(employeeId: string) {
  return createClient()
    .from('employee_credentials')
    .select('*')
    .eq('employee_id', employeeId)
    .order('cert_type')
}

/** Get employee by auth_user_id */
export function queryEmployeeByAuth(authUserId: string) {
  return createClient()
    .from('employees')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Update employee fields */
export function updateEmployee(id: string, data: Record<string, unknown>) {
  return createClient()
    .from('employees')
    .update(data)
    .eq('id', id)
}

/** Upload headshot to storage */
export async function uploadHeadshot(employeeId: string, file: File) {
  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `headshots/${employeeId}.${ext}`
  const { error } = await supabase.storage.from('headshots').upload(path, file, { upsert: true })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('headshots').getPublicUrl(path)
  return urlData.publicUrl
}
