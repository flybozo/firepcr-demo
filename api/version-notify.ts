
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { HttpError, requireAuthUser } from './_auth.js'
import { createServiceClient } from './_supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { version } = req.body || {}
  if (!version) return res.status(400).json({ error: 'Missing version' })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = '8464621928'

  try {
    await requireAuthUser(req)
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('app_version_log')
      .insert({ version, notified_at: new Date().toISOString() })

    if (error) {
      return res.json({ ok: true, skipped: true, reason: 'already_notified' })
    }

    if (botToken) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🚀 FirePCR v${version} deployed and live on app.firepcr.com`,
          parse_mode: 'Markdown',
        }),
      })
    }

    return res.json({ ok: true, sent: true })
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ ok: false, error: err.message })
    }
    return res.status(500).json({ ok: false, error: err.message })
  }
}
