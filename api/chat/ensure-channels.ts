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

    // ── 3.5. Join external channels for the incident ─────────────────────────
    if (incident_id) {
      const { data: extChannels } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('incident_id', incident_id)
        .eq('type', 'external')
        .is('deleted_at', null)

      if (extChannels?.length) {
        const extIds = extChannels.map((c) => c.id)
        const { data: existingExtMems } = await supabase
          .from('chat_members')
          .select('channel_id')
          .eq('employee_id', employee.id)
          .in('channel_id', extIds)

        const existingExtSet = new Set((existingExtMems || []).map((m) => m.channel_id))
        const newExtMems = extIds
          .filter((id) => !existingExtSet.has(id))
          .map((channel_id) => ({ channel_id, employee_id: employee.id, role: 'member' as const }))

        if (newExtMems.length > 0) {
          await supabase.from('chat_members').insert(newExtMems)
        }
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

    // ── 5. Admin: auto-join non-DM channels ───────────────────────────────────
    if (isAdmin) {
      // Check if this admin is the org owner (is_owner flag on employees table)
      const { data: empFlags } = await supabase
        .from('employees').select('is_owner').eq('id', employee.id).single()
      const isOwner = empFlags?.is_owner === true

      // ALL admins only auto-join non-DM channels.
      // DM visibility for the owner is handled separately below (read-only, no membership).
      const { data: allChannels } = await supabase
        .from('chat_channels')
        .select('id, type')
        .is('deleted_at', null)
        .neq('type', 'direct')

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

      // Clean up: remove ALL admin-role memberships from DM channels
      // (auto-joined previously — admin should never be a member of others' DMs)
      const { data: directChannels } = await supabase
        .from('chat_channels').select('id').eq('type', 'direct').is('deleted_at', null)
      if (directChannels?.length) {
        const directIds = directChannels.map(c => c.id)
        await supabase.from('chat_members').delete()
          .eq('employee_id', employee.id)
          .eq('role', 'admin')
          .in('channel_id', directIds)
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
      .select('id, type, name, description, incident_id, unit_id, created_at, updated_at, archived_at')
      .in('id', channelIds)
      .is('deleted_at', null)
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

    let allChannels2 = channels || []

    // ── Super Admin: silently append DM channels (read-only, no membership) ─────
    // Check if user has '*' permission (super admin role) or is org owner
    const { data: ownerCheck } = await supabase
      .from('employees').select('is_owner').eq('id', employee.id).single()
    const { data: empRolePerms } = await supabase
      .from('employee_roles')
      .select('roles(permissions)')
      .eq('employee_id', employee.id)
    const allPerms = (empRolePerms || []).flatMap((er: any) => er.roles?.permissions || [])
    const isSuperAdmin = (ownerCheck?.is_owner === true) || allPerms.includes('*') || allPerms.includes('chat.admin')
    if (isSuperAdmin) {
      const existingIds = new Set(allChannels2.map(c => c.id))
      const { data: allDMs } = await supabase
        .from('chat_channels')
        .select('id, type, name, description, incident_id, unit_id, created_at, updated_at, archived_at')
        .eq('type', 'direct')
        .is('deleted_at', null)

      // Add DMs not already in the list
      for (const dm of allDMs || []) {
        if (!existingIds.has(dm.id)) {
          allChannels2.push(dm as typeof allChannels2[0])
          // Resolve DM display name for owner
          const { data: dmMems } = await supabase
            .from('chat_members')
            .select('employee:employees!employee_id(id, name)')
            .eq('channel_id', dm.id)
          const names = (dmMems || [])
            .map((m: any) => m.employee?.name)
            .filter(Boolean)
          dmNameMap[dm.id] = names.join(' ↔ ') // Show both participants for owner

          // Get last message for this DM
          const { data: lastMsgArr } = await supabase
            .from('chat_messages')
            .select('id, channel_id, content, message_type, created_at, sender_id, sender:employees!sender_id(name)')
            .eq('channel_id', dm.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
          if (lastMsgArr?.[0]) lastMsgMap[dm.id] = lastMsgArr[0]
        }
      }
    }

    const result = allChannels2.map((ch) => ({
      ...ch,
      name: dmNameMap[ch.id] || ch.name,
      last_message: lastMsgMap[ch.id] || null,
      unread_count: unreadCounts[ch.id] || 0,
      my_role: membershipMap[ch.id]?.role || 'observer', // 'observer' for DMs owner isn't a member of
      last_read_at: membershipMap[ch.id]?.last_read_at || null,
    }))

    return res.status(200).json({ channels: result })
  } catch (err: unknown) {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[chat/ensure-channels]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
