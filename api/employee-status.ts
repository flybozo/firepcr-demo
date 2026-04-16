/**
 * POST /api/employee-status
 * Set an employee's status (Active/Inactive) and sync their Supabase auth user.
 *
 * When set to Inactive:
 *   - Employee status updated in employees table
 *   - Supabase auth user banned (can't log in)
 *   - Active unit assignments released
 *
 * When set to Active:
 *   - Employee status updated in employees table
 *   - Supabase auth user unbanned
 *
 * Requires admin app_role.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from './_auth'
import { createServiceClient } from './_supabase'
import { validateBody } from './_validate'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth check — must be an admin
  let caller: any
  try {
    caller = await requireEmployee(req, { admin: true })
  } catch (e: any) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message })
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    validateBody(req.body, [
      { field: 'employeeId', type: 'uuid', required: true },
      { field: 'status', type: 'string', required: true, maxLength: 20 },
    ])
  } catch (e: any) {
    return res.status(400).json({ error: e.message })
  }
  const { employeeId, status } = req.body as { employeeId: string; status: string }
  if (!['Active', 'Inactive'].includes(status)) return res.status(400).json({ error: 'status must be Active or Inactive' })

  const supabase = createServiceClient()

  // 1. Get the employee's auth_user_id
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('id, name, auth_user_id, status')
    .eq('id', employeeId)
    .single()

  if (empErr || !emp) return res.status(404).json({ error: 'Employee not found' })

  // 2. Update employee status
  const { error: updateErr } = await supabase
    .from('employees')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', employeeId)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  // 3. Ban/unban the Supabase auth user (if they have one)
  if (emp.auth_user_id) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(emp.auth_user_id, {
      ban_duration: status === 'Inactive' ? '876600h' : 'none', // 100 years = permanent ban; 'none' = unban
    })
    if (authErr) {
      // Non-fatal — log but don't fail the request
      console.error('[employee-status] Failed to update auth ban for', emp.name, authErr.message)
    }
  }

  // 4. If inactivating — release all active unit assignments
  if (status === 'Inactive') {
    const now = new Date().toISOString()
    await supabase
      .from('unit_assignments')
      .update({ released_at: now })
      .eq('employee_id', employeeId)
      .is('released_at', null)
  }

  return res.status(200).json({
    ok: true,
    employeeId,
    name: emp.name,
    status,
    authUpdated: !!emp.auth_user_id,
  })
}
