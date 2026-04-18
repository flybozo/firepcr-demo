import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'
import { sendEmail, buildEmailHtml } from '../_email.js'
import webpush from 'web-push'
import { ensureVapid } from '../_vapid.js'

// POST /api/push/cs-discrepancy-alert
// Called when a CS count finds discrepancies. Alerts all admins via push + email.

type AlertRequest = {
  unit: string
  counter: string
  witness: string
  discrepancies: string[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    ensureVapid()
    // Authenticate the caller (any employee can submit a count)
    await requireEmployee(req)

    const { unit, counter, witness, discrepancies } = req.body as AlertRequest
    if (!unit || !discrepancies?.length) return res.status(400).json({ error: 'Missing fields' })

    const supabase = createServiceClient()

    // 1. Get all admin employees
    const { data: admins } = await supabase
      .from('employees')
      .select('id, name, wf_email, personal_email')
      .eq('status', 'Active')
      .eq('app_role', 'admin')

    if (!admins?.length) return res.json({ message: 'No admins found', push: 0, emails: 0 })

    const adminIds = admins.map(a => a.id)
    const discrepancyText = discrepancies.join('\n')
    const shortSummary = discrepancies.length === 1
      ? discrepancies[0].split(':')[0]
      : `${discrepancies.length} items with discrepancies`

    // 2. Send push notifications to admins
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, employee_id')
      .in('employee_id', adminIds)

    let pushDelivered = 0
    let pushFailed = 0
    const staleEndpoints: string[] = []

    if (subscriptions?.length) {
      const payload = JSON.stringify({
        title: `🚨 CS Discrepancy — ${unit}`,
        body: `${shortSummary} | Counted by ${counter}`,
        url: '/cs/audit',
      })

      await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
            pushDelivered++
          } catch (err: any) {
            pushFailed++
            if (err.statusCode === 410 || err.statusCode === 404) staleEndpoints.push(sub.endpoint)
          }
        })
      )
      if (staleEndpoints.length > 0) {
        await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
      }
    }

    // 3. Build email list for admins
    const emailTargets = admins
      .map(a => a.wf_email || a.personal_email)
      .filter(Boolean) as string[]

    // 4. Log the alert
    await supabase.from('push_notifications').insert({
      title: `CS Discrepancy Alert — ${unit}`,
      body: `Counter: ${counter} | Witness: ${witness}\n\n${discrepancyText}`,
      url: '/cs/audit',
      sent_by: 'System (CS Count)',
      target_units: [unit],
      target_employee_ids: adminIds,
      delivered_count: pushDelivered,
      failed_count: pushFailed,
    })

    // 5. Send email to admins
    let emailsSent = 0
    if (emailTargets.length > 0) {
      const discrepancyHtml = discrepancies
        .map(d => `<li style="margin-bottom:8px;color:#991b1b"><strong>${d.split(':')[0]}</strong>: ${d.split(':').slice(1).join(':')}</li>`)
        .join('')

      const sent = await sendEmail({
        to: emailTargets,
        subject: `🚨 CS Discrepancy Alert — ${unit}`,
        html: buildEmailHtml({
          title: `Controlled Substance Discrepancy — ${unit}`,
          body: `
            <p>A controlled substances count on <strong>${unit}</strong> found discrepancies:</p>
            <ul style="padding-left:20px">${discrepancyHtml}</ul>
            <p style="margin-top:16px;color:#6b7280;font-size:13px">
              <strong>Counted by:</strong> ${counter}<br>
              <strong>Witnessed by:</strong> ${witness}<br>
              <strong>Time:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
            </p>
            <p style="margin-top:16px;color:#991b1b;font-weight:600">This requires immediate review.</p>
          `,
          ctaText: 'Review CS Audit Log',
          ctaUrl: 'https://firepcr-demo.vercel.app/cs/audit',
        }),
      })
      if (sent) emailsSent = emailTargets.length
    }

    return res.json({
      push_delivered: pushDelivered,
      push_failed: pushFailed,
      emails_sent: emailsSent,
      email_targets: emailTargets,
      discrepancy_count: discrepancies.length,
    })
  } catch (err: any) {
    console.error('CS discrepancy alert error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
