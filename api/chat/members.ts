import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { validateBody } from '../_validate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') return await listMembers(req, res)
    if (req.method === 'POST') return await addMember(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/members]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function listMembers(req: VercelRequest, res: VercelResponse) {
  const { employee } = await requireEmployee(req)
  const supabase = createServiceClient()

  const channelId = req.query.channelId as string
  if (!channelId) throw new HttpError(400, 'channelId is required')

  // Verify requester is a member
  const { data: myMembership } = await supabase
    .from('chat_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('employee_id', employee.id)
    .single()

  if (!myMembership) throw new HttpError(403, 'Not a member of this channel')

  const { data: members, error } = await supabase
    .from('chat_members')
    .select(`
      id,
      role,
      joined_at,
      last_read_at,
      employee:employees!employee_id(id, name, headshot_url, role, status)
    `)
    .eq('channel_id', channelId)
    .order('joined_at', { ascending: true })

  if (error) throw new Error(error.message)

  return res.status(200).json({ members: members || [] })
}

async function addMember(req: VercelRequest, res: VercelResponse) {
  const { employee, isAdmin } = await requireEmployee(req)
  const supabase = createServiceClient()

  validateBody(req.body, [
    { field: 'channel_id', type: 'uuid', required: true },
    { field: 'employee_id', type: 'uuid', required: true },
  ])

  const { channel_id, employee_id } = req.body as {
    channel_id: string
    employee_id: string
  }

  // Must be admin or channel admin
  const { data: myMembership } = await supabase
    .from('chat_members')
    .select('role')
    .eq('channel_id', channel_id)
    .eq('employee_id', employee.id)
    .single()

  if (!myMembership) throw new HttpError(403, 'Not a member of this channel')
  if (!isAdmin && myMembership.role !== 'admin') throw new HttpError(403, 'Channel admin access required')

  const { data: member, error } = await supabase
    .from('chat_members')
    .upsert({ channel_id, employee_id, role: 'member' }, { onConflict: 'channel_id,employee_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)

  return res.status(201).json({ member })
}
