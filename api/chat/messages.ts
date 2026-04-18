import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { validateBody } from '../_validate.js'
import { ensureVapid } from '../_vapid.js'
import webpush from 'web-push'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') return await getMessages(req, res)
    if (req.method === 'POST') return await sendMessage(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/messages]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function getMessages(req: VercelRequest, res: VercelResponse) {
  const { employee } = await requireEmployee(req)
  const supabase = createServiceClient()

  const channelId = req.query.channelId as string
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
  const before = req.query.before as string | undefined

  if (!channelId) throw new HttpError(400, 'channelId is required')

  // Verify membership
  const { data: membership } = await supabase
    .from('chat_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('employee_id', employee.id)
    .single()

  if (!membership) throw new HttpError(403, 'Not a member of this channel')

  let query = supabase
    .from('chat_messages')
    .select(`
      id,
      channel_id,
      content,
      message_type,
      file_url,
      file_name,
      reply_to,
      edited_at,
      deleted_at,
      created_at,
      sender:employees!sender_id(id, name, headshot_url),
      reply_message:chat_messages!reply_to(id, content, sender:employees!sender_id(id, name))
    `)
    .eq('channel_id', channelId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    // Get the created_at of the 'before' message for cursor-based pagination
    const { data: cursorMsg } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('id', before)
      .single()
    if (cursorMsg) {
      query = query.lt('created_at', cursorMsg.created_at)
    }
  }

  const { data: messages, error } = await query
  if (error) throw new Error(error.message)

  // Return in ascending order for display (newest last)
  return res.status(200).json({ messages: (messages || []).reverse() })
}

async function sendMessage(req: VercelRequest, res: VercelResponse) {
  const { employee } = await requireEmployee(req)
  const supabase = createServiceClient()

  validateBody(req.body, [
    { field: 'channel_id', type: 'uuid', required: true },
    { field: 'content', type: 'string', required: true, maxLength: 4000 },
    { field: 'message_type', type: 'string' },
    { field: 'file_url', type: 'string' },
    { field: 'file_name', type: 'string' },
    { field: 'reply_to', type: 'uuid' },
  ])

  const { channel_id, content, message_type, file_url, file_name, reply_to } = req.body as {
    channel_id: string
    content: string
    message_type?: string
    file_url?: string
    file_name?: string
    reply_to?: string
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('chat_members')
    .select('id')
    .eq('channel_id', channel_id)
    .eq('employee_id', employee.id)
    .single()

  if (!membership) throw new HttpError(403, 'Not a member of this channel')

  // Insert message
  const { data: message, error: msgErr } = await supabase
    .from('chat_messages')
    .insert({
      channel_id,
      sender_id: employee.id,
      content,
      message_type: message_type || 'text',
      file_url: file_url || null,
      file_name: file_name || null,
      reply_to: reply_to || null,
    })
    .select(`
      id,
      channel_id,
      content,
      message_type,
      file_url,
      file_name,
      reply_to,
      edited_at,
      deleted_at,
      created_at,
      sender:employees!sender_id(id, name, headshot_url),
      reply_message:chat_messages!reply_to(id, content, sender:employees!sender_id(id, name))
    `)
    .single()

  if (msgErr) throw new Error(msgErr.message)

  // Update channel updated_at for sorting
  await supabase
    .from('chat_channels')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', channel_id)

  // Push notifications (fire-and-forget)
  sendPushNotifications(channel_id, employee.id, employee.name, content, message_type || 'text').catch(
    (e) => console.warn('[chat/messages] push error:', e)
  )

  return res.status(201).json({ message })
}

async function sendPushNotifications(
  channelId: string,
  senderId: string,
  senderName: string,
  content: string,
  messageType: string
) {
  ensureVapid()
  const supabase = createServiceClient()

  // Get channel info and other members' push subscriptions
  const [{ data: channel }, { data: members }] = await Promise.all([
    supabase.from('chat_channels').select('name').eq('id', channelId).single(),
    supabase
      .from('chat_members')
      .select('employee_id')
      .eq('channel_id', channelId)
      .neq('employee_id', senderId),
  ])

  if (!members?.length) return

  const otherEmployeeIds = members.map((m) => m.employee_id)

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, employee_id')
    .in('employee_id', otherEmployeeIds)

  if (!subscriptions?.length) return

  // Double-check: filter out any subscriptions belonging to the sender
  // (safety net in case of duplicate employee records or stale data)
  const filteredSubs = subscriptions.filter((s) => s.employee_id !== senderId)
  if (!filteredSubs.length) return

  const channelName = channel?.name || 'Team Chat'
  const body = messageType === 'image'
    ? `${senderName}: 📷 Photo`
    : messageType === 'file'
      ? `${senderName}: 📎 File`
      : `${senderName}: ${content.slice(0, 100)}`

  const payload = JSON.stringify({
    title: channelName,
    body,
    url: '/chat',
    tag: `chat-${channelId}`,
  })

  await Promise.allSettled(
    filteredSubs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch((err) => {
        // Remove invalid subscriptions (410 Gone = unsubscribed)
        if (err.statusCode === 410) {
          supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then(() => {})
        }
      })
    )
  )
}
