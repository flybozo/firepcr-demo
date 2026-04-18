import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireEmployee, HttpError } from '../_auth.js'
import { createServiceClient } from '../_supabase.js'

/**
 * POST /api/chat/ensure-channels
 *
 * Called when the chat page loads. Lazily creates company/incident/unit channels
 * and ensures the employee is a member of all appropriate channels.
 * Returns the full channel list for the user.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { employee, isAdmin } = await requireEmployee(req)
    const supabase = createServiceClient()

    const { incident_id, unit_id } = (req.body || {}) as {
      incident_id?: string
      unit_id?: string
    }

    // ── 1. Ensure company-wide channel exists ────────────────────────────────
    let companyChannelId: string | null = null
    {
      const { data: existing } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('type', 'company')
        .limit(1)
        .single()

      if (existing) {
        companyChannelId = existing.id
      } else if (isAdmin) {
        // Only admins bootstrap the company channel
        const { data: created, error } = await supabase
          .from('chat_channels')
          .insert({ type: 'company', name: 'Company', created_by: employee.id })
          .select('id')
          .single()
        if (!error && created) companyChannelId = created.id
      }
    }

    // ── 2. Ensure incident channel exists ────────────────────────────────────
    let incidentChannelId: string | null = null
    if (incident_id) {
      const { data: existing } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('type', 'incident')
        .eq('incident_id', incident_id)
        .single()

      if (existing) {
        incidentChannelId = existing.id
      } else {
        // Get incident name
        const { data: incident } = await supabase
          .from('incidents')
          .select('name')
          .eq('id', incident_id)
          .single()

        const { data: created, error } = await supabase
          .from('chat_channels')
          .insert({
            type: 'incident',
            name: incident?.name || 'Incident',
            incident_id,
            created_by: employee.id,
          })
          .select('id')
          .single()
        if (!error && created) incidentChannelId = created.id
      }
    }

    // ── 3. Ensure unit channel exists ────────────────────────────────────────
    let unitChannelId: string | null = null
    if (unit_id) {
      const { data: existing } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('type', 'unit')
        .eq('unit_id', unit_id)
        .single()

      if (existing) {
        unitChannelId = existing.id
      } else {
        // Get unit name
        const { data: unit } = await supabase
          .from('units')
          .select('name')
          .eq('id', unit_id)
          .single()

        const { data: created, error } = await supabase
          .from('chat_channels')
          .insert({
            type: 'unit',
            name: unit?.name || 'Unit',
            unit_id,
            created_by: employee.id,
          })
          .select('id')
          .single()
        if (!error && created) unitChannelId = created.id
      }
    }

    // ── 4. Ensure employee is a member of all applicable channels ────────────
    const channelsToJoin = [companyChannelId, incidentChannelId, unitChannelId].filter(Boolean) as string[]

    if (channelsToJoin.length > 0) {
      // Get existing memberships
      const { data: existingMemberships } = await supabase
        .from('chat_members')
        .select('channel_id')
        .eq('employee_id', employee.id)
        .in('channel_id', channelsToJoin)

      const existingChannelIds = new Set((existingMemberships || []).map((m) => m.channel_id))
      const newMemberships = channelsToJoin
        .filter((id) => !existingChannelIds.has(id))
        .map((channel_id) => ({
          channel_id,
          employee_id: employee.id,
          role: 'member' as const,
        }))

      if (newMemberships.length > 0) {
        await supabase.from('chat_members').insert(newMemberships)
      }
    }

    // ── 5. Admin: auto-join ALL existing channels ────────────────────────────
    if (isAdmin) {
      // Fetch all channels
      const { data: allChannels } = await supabase
        .from('chat_channels')
        .select('id')

      if (allChannels?.length) {
        const allChannelIds = allChannels.map((c) => c.id)

        // Check which ones admin is already a member of
        const { data: existingAdmin } = await supabase
          .from('chat_members')
          .select('channel_id')
          .eq('employee_id', employee.id)
          .in('channel_id', allChannelIds)

        const existingAdminSet = new Set((existingAdmin || []).map((m) => m.channel_id))
        const adminNewMemberships = allChannelIds
          .filter((id) => !existingAdminSet.has(id))
          .map((channel_id) => ({
            channel_id,
            employee_id: employee.id,
            role: 'admin' as const,
          }))

        if (adminNewMemberships.length > 0) {
          await supabase.from('chat_members').insert(adminNewMemberships)
        }
      }
    }

    // ── 6. Return full channel list ──────────────────────────────────────────
    const { data: memberships } = await supabase
      .from('chat_members')
      .select('channel_id, last_read_at, role')
      .eq('employee_id', employee.id)

    if (!memberships?.length) return res.status(200).json({ channels: [] })

    const channelIds = memberships.map((m) => m.channel_id)

    const { data: channels } = await supabase
      .from('chat_channels')
      .select('id, type, name, description, incident_id, unit_id, created_at, updated_at')
      .in('id', channelIds)
      .order('updated_at', { ascending: false })

    // Get last messages
    const { data: lastMessages } = await supabase
      .from('chat_messages')
      .select('id, channel_id, content, message_type, created_at, sender:employees!sender_id(name)')
      .in('channel_id', channelIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    const lastMsgMap: Record<string, unknown> = {}
    for (const msg of lastMessages || []) {
      const m = msg as { channel_id: string }
      if (!lastMsgMap[m.channel_id]) lastMsgMap[m.channel_id] = msg
    }

    const membershipMap: Record<string, { last_read_at: string; role: string }> = {}
    for (const m of memberships) {
      membershipMap[m.channel_id] = { last_read_at: m.last_read_at, role: m.role }
    }

    // Count unread
    const unreadCounts: Record<string, number> = {}
    for (const msg of lastMessages || []) {
      const m = msg as { channel_id: string; created_at: string }
      const membership = membershipMap[m.channel_id]
      if (membership && m.created_at > membership.last_read_at) {
        unreadCounts[m.channel_id] = (unreadCounts[m.channel_id] || 0) + 1
      }
    }

    // ── Resolve DM display names per-viewer ─────────────────────────────────
    const directChannelIds = (channels || []).filter((ch) => ch.type === 'direct').map((ch) => ch.id)
    const dmNameMap: Record<string, string> = {}
    if (directChannelIds.length > 0) {
      const { data: dmMembers } = await supabase
        .from('chat_members')
        .select('channel_id, employee:employees!employee_id(id, name)')
        .in('channel_id', directChannelIds)

      // Group members by channel, pick names that aren't the current user
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
      name: dmNameMap[ch.id] || ch.name, // Override DM names with other participant's name
      last_message: lastMsgMap[ch.id] || null,
      unread_count: unreadCounts[ch.id] || 0,
      my_role: membershipMap[ch.id]?.role || 'member',
      last_read_at: membershipMap[ch.id]?.last_read_at || null,
    }))

    return res.status(200).json({ channels: result })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/ensure-channels]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
