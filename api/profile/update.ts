import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'

// Fields any authenticated employee can update on their own profile
const ALLOWED_FIELDS = [
  'name',
  'date_of_birth',
  'phone',
  'personal_email',
  'personal_phone',
  'home_address',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relationship',
]

// Additional fields only admins can update
const ADMIN_FIELDS = ['role', 'app_role', 'status', 'wf_email', 'daily_rate']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { employee, isAdmin } = await requireEmployee(req)
    const supabase = createServiceClient()

    const body = req.body as Record<string, any>
    const allowedKeys = isAdmin ? [...ALLOWED_FIELDS, ...ADMIN_FIELDS] : ALLOWED_FIELDS
    const updates: Record<string, any> = {}

    for (const key of allowedKeys) {
      if (key in body) {
        // Sanitize: trim strings, allow null to clear a field
        updates[key] = body[key] === '' ? null : (typeof body[key] === 'string' ? body[key].trim() : body[key])
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', employee.id)
      .select()
      .single()

    if (error) {
      console.error('[profile/update] DB error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true, employee: data })
  } catch (err: any) {
    console.error('[profile/update] Error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
