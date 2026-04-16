import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { HttpError, requireEmployee } from '../_auth'

const BCRYPT_ROUNDS = 12

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee, supabase } = await requireEmployee(req)
    const { pin } = req.body || {}

    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ error: 'PIN is required' })
    }

    if (pin.length < 4 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be at least 4 digits' })
    }

    const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS)

    const { error } = await supabase
      .from('employees')
      .update({ signing_pin_hash: hash })
      .eq('id', employee.id)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.json({ ok: true })
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message })
    }
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
