import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'
import { validateBody } from '../_validate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') return await listChannels(req, res)
    if (req.method === 'POST') return await createChannel(req, res)
    if (req.method === 'DELETE') return await deleteChannel(req, res)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/channels]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function listChannels(req: VercelRequest, res: VercelResponse) {
  const { employee, isAdmin } = await requireEmployee(req)
  const supabase = createServiceClient()

  // Get all channel IDs this employee is a member of, with last_read_at
  const { data: memberships, error: mErr } = await supabase
    .from('chat_members')
    .select('channel_id, last_read_at, role')
    .eq('employee_id', employee.id)

  if (mErr) throw new Error(mErr.message)

  // Admin: auto-join any channels they're not yet a member of
  if (isAdmin) {
    const { data: allChannels } = await supabase
      .from('chat_channels')
      .select('id')

    if (allChannels?.length) {
      const memberSet = new Set((memberships || []).map((m) => m.channel_id))
      const toJoin = allChannels
        .filter((c) => !memberSet.has(c.id))
        .map((c) => ({
          channel_id: c.id,
          employee_id: employee.id,
          role: 'admin' as const,
        }))

      if (toJoin.length > 0) {
        await supabase.from('chat_members').insert(toJoin)
        // Re-fetch memberships now that we've joined new channels
        const { data: refreshed } = await supabase
          .from('chat_members')
          .select('channel_id, last_read_at, role')
          .eq('employee_id', employee.id)
        if (refreshed) {
          memberships!.length = 0
          memberships!.push(...refreshed)
        }
      }
    }
  }

  if (!memberships?.length) return res.status(200).json({ channels: [] })

  const channelIds = memberships.map((m) => m.channel_id)

  // Get channel details
  const { data: channels, error: cErr } = await supabase
    .from('chat_channels')
    .select('id, type, name, description, incident_id, unit_id, created_at, updated_at')
    .in('id', channelIds)
    .order('updated_at', { ascending: false })

  if (cErr) throw new Error(cErr.message)

  // Get last message for each channel
  const { data: lastMessages, error: lErr } = await supabase
    .from('chat_messages')
    .select('id, channel_id, content, message_type, created_at, sender_id, sender:employees!sender_id(name)')
    .in('channel_id', channelIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (lErr) console.warn('[chat/channels] lastMessages error:', lErr.message)

  // Build last-message map (first entry per channel = most recent)
  const lastMsgMap: Record<string, unknown> = {}
  for (const msg of lastMessages || []) {
    const m = msg as { channel_id: string }
    if (!lastMsgMap[m.channel_id]) lastMsgMap[m.channel_id] = msg
  }

  // Build membership map
  const membershipMap: Record<string, { last_read_at: string; role: string }> = {}
  for (const m of memberships) {
    membershipMap[m.channel_id] = { last_read_at: m.last_read_at, role: m.role }
  }

  // Count unread per channel
  const unreadCounts: Record<string, number> = {}
  for (const msg of lastMessages || []) {
    const m = msg as { channel_id: string; created_at: string }
    const membership = membershipMap[m.channel_id]
    if (membership && m.created_at > membership.last_read_at) {
      unreadCounts[m.channel_id] = (unreadCounts[m.channel_id] || 0) + 1
    }
  }

  // ── Resolve DM display names per-viewer ──────────────────────────────────
  const directChannelIds = (channels || []).filter((ch) => ch.type === 'direct').map((ch) => ch.id)
  const dmNameMap: Record<string, string> = {}
  if (directChannelIds.length > 0) {
    const { data: dmMembers } = await supabase
      .from('chat_members')
      .select('channel_id, employee:employees!employee_id(id, name)')
      .in('channel_id', directChannelIds)

    const byChannel: Record<string, string[]> = {}
    for (const m of dmMembers || []) {
      const emp = m.employee as unknown as { id: string; name: string } | null
      if (!emp) continue
      if (!byChannel[m.channel_id]) byChannel[m.channel_id] = []
      if (emp.id !== employee.id) byChannel[m.channel_id].push(emp.name)
    }
    for (const [chId, names] of Object.entries(byChannel)) {
      if (names.length > 0) dmNameMap[chId] = names.join(', ')
    }
  }

  const result = (channels || []).map((ch) => ({
    ...ch,
    name: dmNameMap[ch.id] || ch.name,
    last_message: lastMsgMap[ch.id] || null,
    unread_count: unreadCounts[ch.id] || 0,
    my_role: membershipMap[ch.id]?.role || 'member',
    last_read_at: membershipMap[ch.id]?.last_read_at || null,
  }))

  return res.status(200).json({ channels: result })
}

async function createChannel(req: VercelRequest, res: VercelResponse) {
  const { employee, isAdmin } = await requireEmployee(req)
  const supabase = createServiceClient()

  validateBody(req.body, [
    { field: 'type', type: 'string', required: true },
    { field: 'name', type: 'string', maxLength: 100 },
    { field: 'employee_ids', type: 'array', required: true },
  ])

  const { type, name, employee_ids } = req.body as {
    type: string
    name?: string
    employee_ids: string[]
  }

  // Only admins can create non-direct channels
  if (type !== 'direct' && !isAdmin) {
    throw new HttpError(403, 'Only admins can create company/incident/unit channels')
  }

  // For DMs, check if a channel already exists between these exact users
  if (type === 'direct') {
    // Fetch owner flag — owner can create DMs between others without joining
    const { data: creatorFlags } = await supabase
      .from('employees').select('is_owner').eq('id', employee.id).single()
    const creatorIsOwner = creatorFlags?.is_owner === true

    // If the owner is creating a DM between other employees, don't add themselves
    // as a visible participant. Otherwise include the creator.
    const allParticipants = creatorIsOwner && employee_ids.length >= 2
      ? [...new Set(employee_ids)]
      : [...new Set([employee.id, ...employee_ids])]

    // Find channels where both employees are members
    const { data: existingMembers } = await supabase
      .from('chat_members')
      .select('channel_id, employee_id')
      .in('employee_id', allParticipants)

    if (existingMembers?.length) {
      // Group by channel_id
      const channelMemberMap: Record<string, Set<string>> = {}
      for (const m of existingMembers) {
        if (!channelMemberMap[m.channel_id]) channelMemberMap[m.channel_id] = new Set()
        channelMemberMap[m.channel_id].add(m.employee_id)
      }

      // Find a direct channel where membership matches exactly
      for (const [channelId, members] of Object.entries(channelMemberMap)) {
        if (members.size === allParticipants.length && allParticipants.every((id) => members.has(id))) {
          // Verify channel type is 'direct'
          const { data: ch } = await supabase
            .from('chat_channels')
            .select('id, type, name')
            .eq('id', channelId)
            .eq('type', 'direct')
            .single()
          if (ch) {
            // Resolve DM name per-viewer: show the other person's name
            const { data: chMembers } = await supabase
              .from('chat_members')
              .select('employee:employees!employee_id(id, name)')
              .eq('channel_id', channelId)

            const otherNames = (chMembers || [])
              .map((m) => m.employee as unknown as { id: string; name: string } | null)
              .filter((e) => e && e.id !== employee.id)
              .map((e) => e!.name)

            return res.status(200).json({
              channel: { ...ch, name: otherNames.length > 0 ? otherNames.join(', ') : ch.name },
              existing: true,
            })
          }
        }
      }
    }

    // Create new DM channel
    const otherIds = employee_ids.filter((id) => id !== employee.id)
    const { data: otherEmployees } = await supabase
      .from('employees')
      .select('name')
      .in('id', otherIds)

    const dmName = (otherEmployees || []).map((e: { name: string }) => e.name).join(', ') || 'Direct Message'

    const { data: channel, error: chErr } = await supabase
      .from('chat_channels')
      .insert({ type: 'direct', name: dmName, created_by: employee.id })
      .select()
      .single()

    if (chErr) throw new Error(chErr.message)

    // Add all participants as members
    const memberRows = allParticipants.map((id) => ({
      channel_id: channel.id,
      employee_id: id,
      role: 'member',
    }))
    await supabase.from('chat_members').insert(memberRows)

    return res.status(201).json({ channel, existing: false })
  }

  // Non-DM channel (admin only)
  const { data: channel, error: chErr } = await supabase
    .from('chat_channels')
    .insert({ type, name: name || 'New Channel', created_by: employee.id })
    .select()
    .single()

  if (chErr) throw new Error(chErr.message)

  const allParticipants = [...new Set([employee.id, ...employee_ids])]
  const memberRows = allParticipants.map((id) => ({
    channel_id: channel.id,
    employee_id: id,
    role: id === employee.id ? 'admin' : 'member',
  }))
  await supabase.from('chat_members').insert(memberRows)

  return res.status(201).json({ channel, existing: false })
}

async function deleteChannel(req: VercelRequest, res: VercelResponse) {
  const { employee } = await requireEmployee(req)
  const supabase = createServiceClient()

  const channelId = (req.query.channelId as string) || (req.body as Record<string, unknown>)?.channelId as string
  if (!channelId) throw new HttpError(400, 'channelId is required')

  // Verify the channel exists and is a DM
  const { data: channel, error: chErr } = await supabase
    .from('chat_channels')
    .select('id, type')
    .eq('id', channelId)
    .single()

  if (chErr || !channel) throw new HttpError(404, 'Channel not found')
  if (channel.type !== 'direct') throw new HttpError(403, 'Only direct message threads can be deleted')

  // Verify the employee is a member
  const { data: membership } = await supabase
    .from('chat_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('employee_id', employee.id)
    .single()

  if (!membership) throw new HttpError(403, 'You are not a member of this channel')

  // Soft-delete the channel itself so it won't reappear
  // (ensure-channels filters by deleted_at IS NULL)
  await supabase
    .from('chat_channels')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', channelId)

  return res.status(200).json({ success: true })
}
