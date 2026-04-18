/**
 * POST /api/onboard
 * Public endpoint — no auth required.
 * Creates a new employee record + Supabase auth user.
 * Returns { employeeId, uploadToken } for subsequent file uploads.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomBytes } from 'crypto'
import { createServiceClient } from './_supabase.js'
import { validateBody } from './_validate.js'
import { HttpError } from './_auth.js'
import { sendEmail, buildEmailHtml } from './_email.js'
import { rateLimit } from './_rateLimit.js'

// ── Rate limiting ──────────────────────────────────────────────────────────
// Max 10 submissions per IP per hour (per serverless instance)
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

// ── Upload token helpers ───────────────────────────────────────────────────
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function getHmacSecret(): string {
  return (
    process.env.ONBOARD_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'insecure-fallback-change-me'
  )
}

export function generateUploadToken(employeeId: string): string {
  const ts = Date.now()
  const payload = `${employeeId}:${ts}`
  const sig = createHmac('sha256', getHmacSecret()).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ employeeId, ts, sig })).toString('base64url')
}

export function verifyUploadToken(token: string, employeeId: string): boolean {
  try {
    const { employeeId: tid, ts, sig } = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8'),
    )
    if (tid !== employeeId) return false
    if (Date.now() - ts > TOKEN_TTL_MS) return false
    const expected = createHmac('sha256', getHmacSecret())
      .update(`${tid}:${ts}`)
      .digest('hex')
    return sig === expected
  } catch {
    return false
  }
}

// ── Password generation ────────────────────────────────────────────────────
function generateTempPassword(): string {
  // 12 chars alphanumeric, mobile-friendly (no ambiguous chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  return Array.from(randomBytes(12))
    .map(b => chars[b % chars.length])
    .join('')
}

// ── wf_email generation ────────────────────────────────────────────────────
async function generateWfEmail(supabase: ReturnType<typeof createServiceClient>, name: string): Promise<string> {
  const domain = process.env.ONBOARD_EMAIL_DOMAIN || 'wildfiremedical.com'
  const firstName = name.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')
  if (!firstName) throw new HttpError(400, 'Could not derive email from name')

  // Check existing emails with this base
  const { data: existing } = await supabase
    .from('employees')
    .select('wf_email')
    .like('wf_email', `${firstName}%@${domain}`)

  const taken = new Set((existing || []).map((e: any) => e.wf_email))

  const base = `${firstName}@${domain}`
  if (!taken.has(base)) return base

  for (let i = 2; i <= 99; i++) {
    const candidate = `${firstName}${i}@${domain}`
    if (!taken.has(candidate)) return candidate
  }

  throw new HttpError(500, 'Could not generate a unique email address')
}

// ── Main handler ───────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limit by IP
  const ip = (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
  const rl = rateLimit(`onboard:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
  if (!rl.ok) {
    return res.status(429).json({
      error: 'Too many submissions. Please try again later.',
      retryAfterMs: rl.retryAfterMs,
    })
  }

  try {
    const body = req.body as Record<string, unknown>

    validateBody(body, [
      { field: 'name', type: 'string', required: true, maxLength: 200 },
      { field: 'role', type: 'string', required: true, maxLength: 100 },
      { field: 'personal_email', type: 'string', required: true, maxLength: 320 },
      { field: 'phone', type: 'string', required: true, maxLength: 30 },
      { field: 'date_of_birth', type: 'string', required: true },
      { field: 'home_address', type: 'string', required: false, maxLength: 500 },
      { field: 'emergency_contact_name', type: 'string', required: true, maxLength: 200 },
      { field: 'emergency_contact_phone', type: 'string', required: true, maxLength: 30 },
      { field: 'emergency_contact_relationship', type: 'string', required: true, maxLength: 100 },
    ])

    const supabase = createServiceClient()

    // Check for duplicate personal email
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('personal_email', (body.personal_email as string).trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return res.status(409).json({
        error: 'An employee with this email address already exists.',
        field: 'personal_email',
      })
    }

    // Generate wf_email
    const wfEmail = await generateWfEmail(supabase, body.name as string)

    // Generate temp password
    const tempPassword = generateTempPassword()

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: wfEmail,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError || !authData?.user) {
      console.error('[Onboard] Auth user creation failed:', authError)
      throw new HttpError(500, 'Failed to create account. Please try again.')
    }

    const authUserId = authData.user.id

    // Insert employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .insert({
        name: (body.name as string).trim(),
        role: (body.role as string).trim(),
        personal_email: (body.personal_email as string).trim().toLowerCase(),
        phone: (body.phone as string).trim(),
        date_of_birth: body.date_of_birth as string,
        home_address: body.home_address ? (body.home_address as string).trim() : null,
        emergency_contact_name: (body.emergency_contact_name as string).trim(),
        emergency_contact_phone: (body.emergency_contact_phone as string).trim(),
        emergency_contact_relationship: (body.emergency_contact_relationship as string).trim(),
        wf_email: wfEmail,
        email: wfEmail,
        status: 'Pending',
        app_role: 'field',
        auth_user_id: authUserId,
      })
      .select('id')
      .single()

    if (empError || !employee) {
      console.error('[Onboard] Employee insert failed:', empError)
      // Roll back auth user
      await supabase.auth.admin.deleteUser(authUserId).catch(() => {})
      throw new HttpError(500, 'Failed to create employee record. Please try again.')
    }

    const employeeId = employee.id

    // Generate upload token for subsequent file uploads
    const uploadToken = generateUploadToken(employeeId)

    // Send welcome email
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://app.wildfiremedical.com'
    const companyName = process.env.VITE_COMPANY_DBA || 'Remote Area Medicine'
    const appTitle = process.env.VITE_APP_TITLE || 'RAM Field Ops'

    const emailHtml = buildEmailHtml({
      title: `Welcome to ${companyName}!`,
      body: `
        <p>Hi ${(body.name as string).trim().split(' ')[0]},</p>
        <p>Your account has been created. Here are your login credentials for <strong>${appTitle}</strong>:</p>
        <table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:400px">
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb">Login Email</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace">${wfEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#f3f4f6;font-weight:600;border:1px solid #e5e7eb">Temporary Password</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace">${tempPassword}</td>
          </tr>
        </table>
        <p><strong>Important:</strong> Please log in and change your password immediately after your first login.</p>
        <p>Your account is currently <strong>Pending</strong> review. An administrator will assign you to a unit once your information has been verified.</p>
        <p>If you have any questions, contact your supervisor or operations manager.</p>
      `,
      ctaText: `Log in to ${appTitle}`,
      ctaUrl: `${appUrl}/login`,
      footer: `${companyName} &bull; This is an automated message — do not reply.`,
    })

    await sendEmail({
      to: (body.personal_email as string).trim(),
      subject: `Welcome to ${companyName} — Your Login Credentials`,
      html: emailHtml,
      text: `Welcome! Your login: ${wfEmail} / Temporary password: ${tempPassword}. Log in at ${appUrl}/login and change your password.`,
    })

    return res.status(200).json({
      success: true,
      employeeId,
      wfEmail,
      uploadToken,
    })
  } catch (err: any) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('[Onboard] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
