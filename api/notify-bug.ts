import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireEmployee } from './_auth'
import { sanitize } from './_validate'
import { rateLimit } from './_rateLimit'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req, { admin: true })

    // Rate limit: 5 bug reports per minute
    const rl = rateLimit(`bug:${employee.id}`, 5, 60_000)
    if (!rl.ok) return res.status(429).json({ error: 'Too many reports. Slow down.' })

    const employee_name = sanitize(req.body?.employee_name, 200)
    const content = sanitize(req.body?.content, 5000)
    const admin_notes = sanitize(req.body?.admin_notes, 2000)
    const request_id = sanitize(req.body?.request_id, 100)

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID || '8464621928'

    if (!botToken) {
      return res.json({ ok: true, skipped: true })
    }

    const message = [
      '🐛 *Bug Report Approved — Dev Task*',
      '',
      `*Reported by:* ${employee_name || 'Unknown'}`,
      `*Bug description:*`,
      content,
      admin_notes ? `\n*Admin notes:* ${admin_notes}` : '',
      '',
      `_Request ID: ${request_id}_`,
    ].filter(l => l !== undefined).join('\n')

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    })

    return res.json({ ok: true })
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ ok: false, error: err.message })
    }
    return res.status(500).json({ ok: false, error: err.message })
  }
}
