import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireEmployee } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'

// GET /api/pin/status — returns whether the caller has a signing PIN set
// Never exposes the hash itself to the browser
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req)
    const supabase = createServiceClient()

    const { data } = await supabase
      .from('employees')
      .select('signing_pin_hash')
      .eq('id', employee.id)
      .single()

    return res.json({ hasPin: !!data?.signing_pin_hash })
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
