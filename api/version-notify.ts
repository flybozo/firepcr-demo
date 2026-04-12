import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { version } = req.body || {}
  if (!version) return res.status(400).json({ error: 'Missing version' })

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = '8464621928'

  if (!botToken) return res.json({ ok: true, skipped: true })

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚀 FirePCR v${version} deployed and live on app.firepcr.com`,
        parse_mode: 'Markdown',
      }),
    })
    return res.json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
