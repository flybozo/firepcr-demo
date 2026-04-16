import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServiceClient } from '../_supabase'
import { sendEmail, buildEmailHtml } from '../_email'
import webpush from 'web-push'

const VAPID_PUBLIC = 'BCW3KyLolVrvyMdd4H9UkG9gcLbuxnS02WEL-8zOXt0yP20LfCklisBo4-HeE4tfx_qtpqVj3vrJm7elLZqm63c'
const VAPID_PRIVATE = '1aoCYCPIEMr0PsjrSwzUyuwtv7iPToKHA53l3nAIBjM'

webpush.setVapidDetails('mailto:admin@sierravalleyems.com', VAPID_PUBLIC, VAPID_PRIVATE)

// GET /api/push/cs-count-reminder
// Called by cron twice daily. Checks which units haven't done a CS count
// in the past 24 hours and sends push + email reminders to assigned crew.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple auth — cron secret or admin
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Try admin auth as fallback
    try {
      const { requireEmployee } = await import('../_auth')
      await requireEmployee(req, { admin: true })
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const supabase = createServiceClient()

  // Check if CS reminders are enabled
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'cs_count_reminder')
    .single()
  const settings = settingsRow?.value as { enabled?: boolean; reminder_threshold_hours?: number } | null
  if (settings?.enabled === false) {
    return res.json({ message: 'CS count reminders are disabled', reminders_sent: 0 })
  }
  const thresholdHours = settings?.reminder_threshold_hours || 24

  const now = new Date()
  const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000).toISOString()

  // 1. Get all units that have CS inventory
  const { data: csUnits } = await supabase
    .from('unit_inventory')
    .select('unit_id')
    .eq('category', 'CS')
    .gt('quantity', 0)
  const unitIdsWithCS = [...new Set((csUnits || []).map((r: any) => r.unit_id).filter(Boolean))]

  if (unitIdsWithCS.length === 0) {
    return res.json({ message: 'No units with CS inventory', reminders_sent: 0 })
  }

  // 2. Get unit names
  const { data: units } = await supabase
    .from('units')
    .select('id, name')
    .in('id', unitIdsWithCS)
  const unitNameMap: Record<string, string> = {}
  ;(units || []).forEach((u: any) => { unitNameMap[u.id] = u.name })

  // 3. Check which units have a CS count in the past 24 hours
  const unitNames = Object.values(unitNameMap)
  const { data: recentCounts } = await supabase
    .from('cs_daily_counts')
    .select('unit, created_at')
    .in('unit', unitNames)
    .gte('created_at', cutoff)

  const unitsWithRecentCount = new Set((recentCounts || []).map((c: any) => c.unit))
  const overdueUnits = unitNames.filter(name => !unitsWithRecentCount.has(name))

  if (overdueUnits.length === 0) {
    return res.json({ message: 'All units have counted in the past 24h', reminders_sent: 0 })
  }

  // 4. Get crew assigned to overdue units
  const overdueUnitIds = Object.entries(unitNameMap)
    .filter(([_, name]) => overdueUnits.includes(name))
    .map(([id]) => id)

  const { data: assignments } = await supabase
    .from('unit_assignments')
    .select('employee_id, unit_id')
    .in('unit_id', overdueUnitIds)

  const employeeUnitMap: Record<string, string[]> = {}
  ;(assignments || []).forEach((a: any) => {
    if (!employeeUnitMap[a.employee_id]) employeeUnitMap[a.employee_id] = []
    employeeUnitMap[a.employee_id].push(unitNameMap[a.unit_id] || 'Unknown')
  })

  const employeeIds = Object.keys(employeeUnitMap)
  if (employeeIds.length === 0) {
    return res.json({ message: 'No crew assigned to overdue units', reminders_sent: 0, overdue_units: overdueUnits })
  }

  // 5. Get employee emails + push subscriptions
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, wf_email, personal_email')
    .in('id', employeeIds)

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, employee_id')
    .in('employee_id', employeeIds)

  // 6. Send push notifications
  let pushDelivered = 0
  let pushFailed = 0
  const staleEndpoints: string[] = []

  if (subscriptions?.length) {
    const payload = JSON.stringify({
      title: '⚠️ CS Count Overdue',
      body: `Your unit hasn't completed a controlled substances count in the past 24 hours. Please complete one now.`,
      url: '/cs/count',
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

  // 7. Build email list for overdue crew
  const emailTargets: { email: string; name: string; units: string[] }[] = []
  ;(employees || []).forEach((emp: any) => {
    const email = emp.wf_email || emp.personal_email
    if (email) {
      emailTargets.push({ email, name: emp.name, units: employeeUnitMap[emp.id] || [] })
    }
  })

  // Log notification
  await supabase.from('push_notifications').insert({
    title: 'CS Count Overdue Reminder',
    body: `Overdue units: ${overdueUnits.join(', ')}`,
    url: '/cs/count',
    sent_by: 'System (Cron)',
    target_units: overdueUnits,
    target_employee_ids: employeeIds,
    delivered_count: pushDelivered,
    failed_count: pushFailed,
  })

  // 8. Send reminder emails to overdue crew
  let emailsSent = 0
  for (const target of emailTargets) {
    const sent = await sendEmail({
      to: target.email,
      subject: `⚠️ CS Count Overdue — ${target.units.join(', ')}`,
      html: buildEmailHtml({
        title: 'Controlled Substances Count Overdue',
        body: `
          <p>Hi ${target.name},</p>
          <p>Your unit <strong>${target.units.join(', ')}</strong> has not completed a controlled substances count in the required time window.</p>
          <p>Please complete your CS count as soon as possible.</p>
        `,
        ctaText: 'Complete CS Count',
        ctaUrl: 'https://demo.firepcr.com/cs/count',
      }),
    })
    if (sent) emailsSent++
  }

  return res.json({
    overdue_units: overdueUnits,
    push_delivered: pushDelivered,
    push_failed: pushFailed,
    emails_sent: emailsSent,
    email_targets: emailTargets.map(t => t.email),
    reminders_sent: pushDelivered + emailsSent,
  })
}
