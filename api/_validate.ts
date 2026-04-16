/**
 * Lightweight request validation for Vercel API routes.
 * No external deps — keeps the bundle small.
 */

import { HttpError } from './_auth.js'

type Rule = {
  field: string
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'array'
  required?: boolean
  maxLength?: number
  min?: number
  max?: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validate a body object against a set of rules.
 * Throws HttpError(400) on the first violation.
 */
export function validateBody(body: Record<string, unknown> | null | undefined, rules: Rule[]): void {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Request body is required')

  for (const rule of rules) {
    const val = body[rule.field]

    // Required check
    if (rule.required && (val === undefined || val === null || val === '')) {
      throw new HttpError(400, `${rule.field} is required`)
    }

    // Skip optional missing fields
    if (val === undefined || val === null) continue

    // Type checks
    switch (rule.type) {
      case 'string':
        if (typeof val !== 'string') throw new HttpError(400, `${rule.field} must be a string`)
        if (rule.maxLength && val.length > rule.maxLength) {
          throw new HttpError(400, `${rule.field} exceeds max length of ${rule.maxLength}`)
        }
        break
      case 'number':
        if (typeof val !== 'number' || isNaN(val)) throw new HttpError(400, `${rule.field} must be a number`)
        if (rule.min !== undefined && val < rule.min) throw new HttpError(400, `${rule.field} must be >= ${rule.min}`)
        if (rule.max !== undefined && val > rule.max) throw new HttpError(400, `${rule.field} must be <= ${rule.max}`)
        break
      case 'boolean':
        if (typeof val !== 'boolean') throw new HttpError(400, `${rule.field} must be a boolean`)
        break
      case 'uuid':
        if (typeof val !== 'string' || !UUID_RE.test(val)) {
          throw new HttpError(400, `${rule.field} must be a valid UUID`)
        }
        break
      case 'array':
        if (!Array.isArray(val)) throw new HttpError(400, `${rule.field} must be an array`)
        break
    }
  }
}

/**
 * Strip HTML tags from a string to prevent XSS when rendering user content.
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize a string: trim, strip HTML, enforce max length.
 */
export function sanitize(val: unknown, maxLength = 5000): string {
  if (typeof val !== 'string') return ''
  return stripHtml(val.trim()).slice(0, maxLength)
}
