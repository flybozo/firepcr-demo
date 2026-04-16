import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase'
import { requireEmployee } from '../_auth'
import { sendEmail, buildEmailHtml } from '../_email'
import webpush from 'web-push'

const VAPID_PUBLIC = 'BCW3KyLolVrvyMdd4H9UkG9gcLbuxnS02WEL-8zOXt0yP20LfCklisBo4-HeE4tfx_qtpqVj3vrJm7elLZqm63c'
const VAPID_PRIVATE = '1aoCYCPIEMr0PsjrSwzUyuwtv7iPToKHA53l3nAIBjM'

webpush.setVapidDetails('mailto:admin@sierravalleyems.com', VAPID_PUBLIC, VAPID_PRIVATE)

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
    const { employee } = await requireEmployee(req, { admin: true })
    const { title, body, url, target_roles, target_units, target_employee_ids, send_email: shouldEmail } = req.body as SendRequest

    if (!title || !body) return res.status(400).json({ error: 'title and body required' })

    const supabase = createServiceClient()

    // Build target employee IDs
    let employeeIds: string[] = []

    if (target_employee_ids?.length) {
      employeeIds = target_employee_ids
    } else {
      // Query employees matching role and/or unit filters
      let query = supabase.from('employees').select('id, role').eq('status', 'Active')

      const { data: allEmployees } = await query
      let filtered = allEmployees || []

      if (target_roles?.length) {
        filtered = filtered.filter((e: any) => target_roles.some(r => e.role?.toLowerCase().includes(r.toLowerCase())))
      }

      if (target_units?.length) {
        // Get employees assigned to these units
        const { data: assignments } = await supabase
          .from('unit_assignments')
          .select('employee_id, unit:units(name)')
        const unitEmployeeIds = new Set(
          (assignments || [])
            .filter((a: any) => target_units.includes(a.unit?.name))
            .map((a: any) => a.employee_id)
        )
        if (target_units.length > 0) {
          filtered = filtered.filter((e: any) => unitEmployeeIds.has(e.id))
        }
      }

      employeeIds = filtered.map((e: any) => e.id)
    }

    if (employeeIds.length === 0) {
      return res.status(200).json({ delivered: 0, failed: 0, message: 'No matching employees' })
    }

    // Get push subscriptions for these employees
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, employee_id')
      .in('employee_id', employeeIds)

    if (!subscriptions?.length) {
      return res.status(200).json({ delivered: 0, failed: 0, message: 'No push subscriptions found' })
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
            ctaText: url ? 'Open in FirePCR' : undefined,
            ctaUrl: url ? `https://demo.firepcr.com${url}` : undefined,
          }),
        })
        if (sent) emailsSent = emails.length
      }
    }

    return res.json({ delivered, failed, emails_sent: emailsSent, total_subscriptions: subscriptions.length })
  } catch (err: any) {
    console.error('Push send error:', err)
    return res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  }
}
