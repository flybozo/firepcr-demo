/**
 * One-shot user provisioning endpoint.
 * POST with { email, name, role, password, employee_id }
 * Creates auth user via GoTrue admin API + links to employee row.
 * Protected by a shared secret header.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'

const PROVISION_SECRET = process.env.PROVISION_SECRET || 'ram-provision-2026'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.headers['x-provision-secret'] !== PROVISION_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { email, name, password, employee_id } = req.body ?? {}
  if (!email || !name || !password || !employee_id) {
    return res.status(400).json({ error: 'email, name, password, employee_id required' })
  }

  const supabase = createServiceClient()

  // Use Supabase Admin API (goes through GoTrue properly)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, must_change_password: true },
  })

  if (error) return res.status(400).json({ error: error.message })

  const authUserId = data.user.id

  // Link to employee row
  const { error: updateErr } = await supabase
    .from('employees')
    .update({ auth_user_id: authUserId })
    .eq('id', employee_id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  return res.json({ ok: true, auth_user_id: authUserId })
}
