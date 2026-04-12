import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { version } = req.body || {}
  if (!version) return res.status(400).json({ error: 'Missing version' })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = '8464621928'

  // Check if this version was already announced using Supabase as shared state
  // This prevents every device from firing the notification
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kfkpvazkikpuwatthtow.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Try to insert a unique record for this version — will fail if already exists
    const { error } = await supabase
      .from('app_version_log')
      .insert({ version, notified_at: new Date().toISOString() })

    if (error) {
      // Already notified for this version (unique constraint violation)
      return res.json({ ok: true, skipped: true, reason: 'already_notified' })
    }

    // First device to report this version — send the notification
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
    return res.status(500).json({ ok: false, error: err.message })
  }
}
