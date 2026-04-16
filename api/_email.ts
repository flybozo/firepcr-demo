/**
 * Shared email utility for all API routes.
 * Uses Resend for transactional email delivery.
 * 
 * Multi-tenant: in the future, each org can configure their own
 * Resend API key and sending domain in the organizations table.
 * For now, uses the global RESEND_API_KEY env var.
 */

import { Resend } from 'resend'

let resendClient: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY)
  return resendClient
}

export type EmailParams = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

/**
 * Send an email via Resend. Returns true on success, false on failure.
 * Fails silently if RESEND_API_KEY is not configured (logs warning).
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not configured — email not sent:', params.subject)
    return false
  }

  const from = params.from || 'FirePCR <notifications@sierravalleyems.com>'
  const to = Array.isArray(params.to) ? params.to : [params.to]

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
    })
    if (error) {
      console.error('[Email] Send failed:', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[Email] Exception:', err)
    return false
  }
}

/**
 * Build a simple branded HTML email.
 */
export function buildEmailHtml(opts: {
  title: string
  body: string
  ctaText?: string
  ctaUrl?: string
  footer?: string
}): string {
  const { title, body, ctaText, ctaUrl, footer } = opts
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff">
    <tr>
      <td style="background:#dc2626;padding:16px 24px">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700">FirePCR</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px">
        <h2 style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600">${title}</h2>
        <div style="color:#374151;font-size:14px;line-height:1.6">${body}</div>
        ${ctaText && ctaUrl ? `
        <div style="margin:24px 0">
          <a href="${ctaUrl}" style="display:inline-block;padding:10px 24px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${ctaText}</a>
        </div>` : ''}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px">
        ${footer || 'Sierra Valley EMS &bull; Sierra Valley EMS P.C.'}
      </td>
    </tr>
  </table>
</body>
</html>`
}
