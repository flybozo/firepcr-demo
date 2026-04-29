import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { HttpError, requireEmployee } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { validateBody } from '../_validate.js'
import { rateLimit } from '../_rateLimit.js'
import { consumeWitnessToken } from './witness-token.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee: caller } = await requireEmployee(req)
    const supabase = createServiceClient()

    validateBody(req.body, [
      { field: 'pin', type: 'string', required: true, maxLength: 20 },
      { field: 'employee_id', type: 'uuid', required: true },
      { field: 'document_context', type: 'string', maxLength: 500 },
      { field: 'witness_token', type: 'string', maxLength: 200 },
    ])

    const { pin, employee_id, document_context, witness_token } = req.body

    // ── Security check ──────────────────────────────────────────────────────
    // Self-signing: caller verifying their own PIN — always allowed.
    // Witness signing: caller verifying a DIFFERENT employee's PIN — requires
    // a valid short-lived witness token issued by this same session moments ago.
    // This prevents any authenticated user from brute-forcing another employee's PIN.
    const isSelfSign = caller.id === employee_id
    if (!isSelfSign) {
      if (!witness_token) {
        return res.status(403).json({
          error: 'Witness token required to verify another employee\'s PIN',
          code: 'witness_token_required',
        })
      }
      const tokenResult = consumeWitnessToken(witness_token, caller.id, document_context || '')
      if (!tokenResult.ok) {
        return res.status(403).json({
          error: 'Invalid or expired witness token. Please restart the witness signing flow.',
          code: tokenResult.reason,
        })
      }
    }
    // ────────────────────────────────────────────────────────────────────────

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
      hour: '2-digit', minute: '2-digit', hour12: false,
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
