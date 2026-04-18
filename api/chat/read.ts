import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { validateBody } from '../_validate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee } = await requireEmployee(req)
    const supabase = createServiceClient()

    validateBody(req.body, [
      { field: 'channel_id', type: 'uuid', required: true },
    ])

    const { channel_id } = req.body as { channel_id: string }

    const { error } = await supabase
      .from('chat_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', channel_id)
      .eq('employee_id', employee.id)

    if (error) throw new Error(error.message)

    return res.status(200).json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/read]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
