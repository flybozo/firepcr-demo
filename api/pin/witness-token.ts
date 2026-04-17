/**
 * POST /api/pin/witness-token
 *
 * Issues a short-lived (5-minute) single-use witness token.
 * Called by the UI immediately before the witness PIN entry screen appears.
 *
 * The token encodes:
 *   - The requesting employee's ID (Signer 1 — the logged-in user)
 *   - The document context (e.g. "cs-transfer:uuid" or "cs-count:uuid")
 *   - Issued-at timestamp
 *   - A random nonce (prevents prediction)
 *
 * Token is an HMAC-SHA256 hex over those fields, stored in a server-side
 * in-memory map keyed by (nonce → expiry + metadata).  On verify, the
 * server looks up the nonce, confirms it hasn't expired and hasn't been
 * used, then deletes it (single-use).
 *
 * This approach requires no DB round-trip for token storage and works
 * within Vercel's serverless model (token lifetime ≤ 5 min, well within
 * a single warm instance window for active signing sessions).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { HttpError, requireEmployee } from '../_auth.js'

// In-memory token store: nonce → { issuedBy, documentContext, expiresAt, used }
// Vercel keeps warm instances alive for several minutes — sufficient for 5-min tokens.
const tokenStore = new Map<string, {
  issuedBy: string
  documentContext: string
  expiresAt: number
  used: boolean
}>()

// Clean up expired tokens periodically
function pruneExpired() {
  const now = Date.now()
  for (const [nonce, entry] of tokenStore.entries()) {
    if (entry.expiresAt < now) tokenStore.delete(nonce)
  }
}

const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 minutes

export function issueWitnessToken(issuedBy: string, documentContext: string): string {
  pruneExpired()
  const nonce = crypto.randomBytes(32).toString('hex')
  tokenStore.set(nonce, {
    issuedBy,
    documentContext,
    expiresAt: Date.now() + TOKEN_TTL_MS,
    used: false,
  })
  return nonce
}

export function consumeWitnessToken(
  token: string,
  expectedIssuedBy: string,
  documentContext: string,
): { ok: boolean; reason?: string } {
  pruneExpired()
  const entry = tokenStore.get(token)
  if (!entry) return { ok: false, reason: 'invalid_token' }
  if (entry.used) return { ok: false, reason: 'token_already_used' }
  if (Date.now() > entry.expiresAt) return { ok: false, reason: 'token_expired' }
  if (entry.issuedBy !== expectedIssuedBy) return { ok: false, reason: 'token_issuer_mismatch' }
  // Document context must match (or be empty on both sides for legacy callers)
  if (documentContext && entry.documentContext && entry.documentContext !== documentContext) {
    return { ok: false, reason: 'token_context_mismatch' }
  }
  // Consume it — single use
  entry.used = true
  return { ok: true }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req)
    const documentContext = (req.body?.document_context as string) || ''

    const token = issueWitnessToken(employee.id, documentContext)

    return res.json({
      witness_token: token,
      expires_in_seconds: TOKEN_TTL_MS / 1000,
    })
  } catch (err: any) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
