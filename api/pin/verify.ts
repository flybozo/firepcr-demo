import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { HttpError, requireAuthUser } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { validateBody } from '../_validate.js'
import { rateLimit } from '../_rateLimit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await requireAuthUser(req)
    const supabase = createServiceClient()

    validateBody(req.body, [
      { field: 'pin', type: 'string', required: true, maxLength: 20 },
      { field: 'employee_id', type: 'uuid', required: true },
      { field: 'document_context', type: 'string', maxLength: 500 },
    ])

    const { pin, employee_id, document_context } = req.body

    // Rate limit PIN attempts per employee (5 per minute)
    const rl = rateLimit(`pin:${employee_id}`, 5, 60_000)
    if (!rl.ok) return res.status(429).json({ error: 'Too many PIN attempts. Try again in a minute.' })

    // Fetch the stored bcrypt hash
    const { data: emp, error: fetchErr } = await supabase
      .from('employees')
      .select('id, name, signing_pin_hash')
      .eq('id', employee_id)
      .single()

    if (fetchErr || !emp) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    if (!emp.signing_pin_hash) {
      return res.json({ valid: false, reason: 'no_pin_set', employeeName: emp.name })
    }

    // Check if hash is old-format SHA-256 (64 hex chars, no $2 prefix) or bcrypt
    const isLegacySha256 = emp.signing_pin_hash.length === 64 && !emp.signing_pin_hash.startsWith('$2')

    let pinValid = false

    if (isLegacySha256) {
      // Legacy: SHA-256(pin + employeeId)
      const crypto = require('crypto')
      const legacyHash = crypto.createHash('sha256').update(pin + employee_id).digest('hex')
      pinValid = legacyHash === emp.signing_pin_hash

      // If valid, migrate to bcrypt transparently
      if (pinValid) {
        const newHash = await bcrypt.hash(pin, 12)
        await supabase
          .from('employees')
          .update({ signing_pin_hash: newHash })
          .eq('id', employee_id)
      }
    } else {
      // Bcrypt comparison
      pinValid = await bcrypt.compare(pin, emp.signing_pin_hash)
    }

    if (!pinValid) {
      return res.json({ valid: false, reason: 'incorrect_pin' })
    }

    // Generate signature metadata server-side
    const signedAt = new Date().toISOString()
    const crypto = require('crypto')
    const signatureHash = crypto
      .createHash('sha256')
      .update(employee_id + (document_context || '') + signedAt + pin)
      .digest('hex')

    const displayText = `${emp.name} — digitally signed ${new Date(signedAt).toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })}`

    return res.json({
      valid: true,
      signedAt,
      signatureHash,
      employeeId: employee_id,
      employeeName: emp.name,
      displayText,
    })
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message })
    }
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
