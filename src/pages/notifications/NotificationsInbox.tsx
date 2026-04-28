import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'
import PageHeader from '@/components/ui/PageHeader'
import { getIsOnline, onConnectionChange } from '@/lib/syncManager'
import { triggerNotificationBadgeRefresh } from '@/hooks/useUnreadNotificationCount'

type PushNotification = {
  id: string
  title: string
  body: string
  url: string | null
  sent_by: string | null
  target_employee_ids: string[] | null
  target_roles: string[] | null
  target_units: string[] | null
  created_at: string
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/** Returns true for absolute http(s) URLs (i.e. links to another site, not in-app routes). */
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** Short host hint to show next to the Open button so users see where they're going. */
function hostHint(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

export default function NotificationsInbox() {
  const { employee, unit } = useUser()
  const [notifications, setNotifications] = useState<PushNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())
  const [isOffline, setIsOffline] = useState(!getIsOnline())
  useEffect(() => onConnectionChange((online) => setIsOffline(!online)), [])

  useEffect(() => {
    if (!employee) return

    const employeeId = employee.id
    const role = employee.role
    const unitName = unit?.name
    const supabase = createClient()

    async function load() {
      const orParts = [
        'target_employee_ids.is.null',
        `target_employee_ids.cs.{${employeeId}}`,
      ]
      if (role) orParts.push(`target_roles.cs.{${role}}`)
      if (unitName) orParts.push(`target_units.cs.{${unitName}}`)

      const [{ data: notifs }, { data: reads }] = await Promise.all([
        supabase
          .from('push_notifications')
          .select('id, title, body, url, sent_by, target_employee_ids, target_roles, target_units, created_at')
          .or(orParts.join(','))
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('notification_reads')
          .select('notification_id, dismissed')
          .eq('employee_id', employeeId),
      ])

      const allReads = (reads || []) as { notification_id: string; dismissed: boolean }[]
      const dismissedIds = new Set(allReads.filter(r => r.dismissed).map(r => r.notification_id))
      const fetchedReadIds = new Set(allReads.map(r => r.notification_id))

      // Filter out dismissed notifications — they stay gone across reloads
      const fetchedNotifs = ((notifs || []) as PushNotification[]).filter(n => !dismissedIds.has(n.id))

      setNotifications(fetchedNotifs)
      setReadIds(fetchedReadIds)
      setLoading(false)

      // Mark all unread as read immediately
      const unreadIds = fetchedNotifs.filter(n => !fetchedReadIds.has(n.id)).map(n => n.id)
      if (unreadIds.length > 0) {
        await supabase
          .from('notification_reads')
          .upsert(
            unreadIds.map(nid => ({ employee_id: employeeId, notification_id: nid, dismissed: false })),
            { onConflict: 'employee_id,notification_id' }
          )
        setReadIds(new Set([...fetchedReadIds, ...unreadIds]))
        // Tell the badge to refresh right now
        triggerNotificationBadgeRefresh()
      }
    }

    load()
  }, [employee, unit])

  async function dismiss(notifId: string) {
    if (!employee?.id) return
    setDismissing(prev => new Set([...prev, notifId]))

    const supabase = createClient()

    // Upsert with dismissed=true so it stays gone across reloads
    await supabase
      .from('notification_reads')
      .upsert(
        [{ employee_id: employee.id, notification_id: notifId, dismissed: true }],
        { onConflict: 'employee_id,notification_id' }
      )

    // Remove from local list immediately for instant UI feedback
    setNotifications(prev => prev.filter(n => n.id !== notifId))
    setReadIds(prev => { const s = new Set(prev); s.add(notifId); return s })
    setDismissing(prev => { const s = new Set(prev); s.delete(notifId); return s })

    triggerNotificationBadgeRefresh()
  }

  async function dismissAll() {
    if (!employee?.id || notifications.length === 0) return
    const supabase = createClient()
    // Mark all as dismissed=true so they stay gone
    await supabase
      .from('notification_reads')
      .upsert(
        notifications.map(n => ({ employee_id: employee.id, notification_id: n.id, dismissed: true })),
        { onConflict: 'employee_id,notification_id' }
      )
    setNotifications([])
    triggerNotificationBadgeRefresh()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title="🔔 Notifications" className="mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-gray-800/50 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {isOffline && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs mb-4 flex items-center gap-2">
          📶 You're offline — showing cached notifications. New alerts won't appear until you reconnect.
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="🔔 Notifications" className="mb-0" />
        {notifications.length > 0 && (
          <button
            onClick={dismissAll}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <svg
            width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="mb-3 opacity-40"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const isUnread = !readIds.has(n.id)
            const isDismissing = dismissing.has(n.id)
            return (
              <div
                key={n.id}
                className={`rounded-xl px-4 py-3 border-l-4 transition-opacity ${
                  isDismissing ? 'opacity-40' : 'opacity-100'
                } ${
                  isUnread
                    ? 'border-amber-400 bg-amber-950/20'
                    : 'border-transparent bg-gray-800/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold leading-snug ${isUnread ? 'text-white' : 'text-gray-300'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5 leading-snug">{n.body}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {n.sent_by ? `from ${n.sent_by} · ` : ''}{relativeTime(n.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {n.url && n.url !== '/' && (
                      isExternalUrl(n.url) ? (
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-col items-end text-xs font-medium transition-colors whitespace-nowrap max-w-[140px]"
                          title={n.url}
                        >
                          <span className="text-blue-400 hover:text-blue-300">→ Open ↗</span>
                          <span className="text-gray-500 text-[10px] truncate w-full text-right">{hostHint(n.url)}</span>
                        </a>
                      ) : (
                        <Link
                          to={n.url}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors whitespace-nowrap"
                        >
                          → Open
                        </Link>
                      )
                    )}
                    <button
                      onClick={() => dismiss(n.id)}
                      disabled={isDismissing}
                      className="text-gray-600 hover:text-gray-400 transition-colors p-0.5"
                      title="Dismiss"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
