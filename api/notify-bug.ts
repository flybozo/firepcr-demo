import type { VercelRequest, VercelResponse } from "@vercel/node"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") return handleGET(req, res)
  if (req.method === "PATCH") return handlePATCH(req, res)
  return handlePOST(req, res)
}
async function handlePOST(req: VercelRequest, res: VercelResponse {
  try {
    const { employee_name, content, admin_notes, request_id } = req.body

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID || '8464621928'

    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not set — skipping bug notification')
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
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    return res.json({ ok: true })
  } catch (err: any) {
    console.error('notify-bug error:', err)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
