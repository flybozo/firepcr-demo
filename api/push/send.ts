import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase.js'
import { requireEmployee } from '../_auth.js'
import { sendEmail, buildEmailHtml } from '../_email.js'
import webpush from 'web-push'
import { brand } from '../_brand.js'
import { ensureVapid } from '../_vapid.js'

type SendRequest = {
  title: string
  body: string
  url?: string
  target_roles?: string[]
  target_units?: string[]
  target_employee_ids?: string[]
  send_email?: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    ensureVapid()
    const { employee } = await requireEmployee(req, { admin: true })
    const { title, body, url, target_roles, target_units, target_employee_ids, send_email: shouldEmail } = req.body as SendRequest

    if (!title || !body) return res.status(400).json({ error: 'title and body required' })

    const supabase = createServiceClient()

    // Build target employee IDs
    let employeeIds: string[] = []

    if (target_employee_ids?.length) {
      employeeIds = target_employee_ids
    } else {
      // Query employees matching role and/or unit filters.
      // Roles use case-insensitive EXACT match — prior code used .includes() which would have
      // matched (and almost did, depending on inputs) substrings like 'md' inside other roles.
      const { data: allEmployees } = await supabase
        .from('employees')
        .select('id, role')
        .eq('status', 'Active')
      let filtered = allEmployees || []

      if (target_roles?.length) {
        const wanted = new Set(target_roles.map((r: string) => r.toLowerCase().trim()))
        filtered = filtered.filter((e: any) => e.role && wanted.has(String(e.role).toLowerCase().trim()))
      }

      if (target_units?.length) {
        // Get employees currently assigned (released_at IS NULL) to any of these units.
        const { data: assignments } = await supabase
          .from('unit_assignments')
          .select('employee_id, released_at, incident_unit:incident_units(unit:units(name))')
          .is('released_at', null)
        const unitEmployeeIds = new Set(
          (assignments || [])
            .filter((a: any) => target_units.includes(a.incident_unit?.unit?.name))
            .map((a: any) => a.employee_id)
        )
        filtered = filtered.filter((e: any) => unitEmployeeIds.has(e.id))
      }

      employeeIds = filtered.map((e: any) => e.id)
    }

    if (employeeIds.length === 0) {
      return res.status(200).json({
        delivered: 0, failed: 0, recipients: 0, devices: 0,
        message: 'No matching employees',
      })
    }

    // Get push subscriptions for these employees
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, employee_id')
      .in('employee_id', employeeIds)

    const recipientsWithSubs = new Set((subscriptions || []).map((s: any) => s.employee_id)).size
    const recipientsTargeted = employeeIds.length
    const recipientsWithoutSubs = recipientsTargeted - recipientsWithSubs

    if (!subscriptions?.length) {
      return res.status(200).json({
        delivered: 0, failed: 0, recipients: 0, devices: 0,
        targeted: recipientsTargeted,
        without_subs: recipientsWithoutSubs,
        message: `${recipientsTargeted} employee(s) targeted but none have push notifications enabled.`,
      })
    }

    const payload = JSON.stringify({ title, body, url: url || '/' })
    let delivered = 0
    let failed = 0
    const staleEndpoints: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
          delivered++
        } catch (err: any) {
          failed++
          // Remove stale subscriptions (410 Gone or 404)
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint)
          }
        }
      })
    )

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
    }

    // Log the notification
    await supabase.from('push_notifications').insert({
      title,
      body,
      url: url || null,
      sent_by: employee.name,
      target_roles: target_roles || null,
      target_units: target_units || null,
      target_employee_ids: employeeIds,
      delivered_count: delivered,
      failed_count: failed,
    })

    // Optionally send email too
    let emailsSent = 0
    if (shouldEmail && employeeIds.length > 0) {
      const { data: emps } = await supabase
        .from('employees')
        .select('wf_email, personal_email')
        .in('id', employeeIds)
      const emails = (emps || [])
        .map((e: any) => e.wf_email || e.personal_email)
        .filter(Boolean) as string[]
      if (emails.length > 0) {
        const sent = await sendEmail({
          to: emails,
          subject: title,
          html: buildEmailHtml({
            title,
            body: `<p>${body.replace(/\n/g, '<br>')}</p>`,
            ctaText: url ? `Open in ${brand.appBrand}` : undefined,
            ctaUrl: url ? `${brand.appUrl}${url}` : undefined,
          }),
        })
        if (sent) emailsSent = emails.length
      }
    }

    return res.json({
      delivered,
      failed,
      emails_sent: emailsSent,
      total_subscriptions: subscriptions.length,
      recipients: recipientsWithSubs,
      devices: subscriptions.length,
      targeted: recipientsTargeted,
      without_subs: recipientsWithoutSubs,
    })
  } catch (err: any) {
    console.error('Push send error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
