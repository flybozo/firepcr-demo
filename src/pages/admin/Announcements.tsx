

import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { LoadingSkeleton, EmptyState, ConfirmDialog } from '@/components/ui'
import { authFetch } from '@/lib/authFetch'
import { inputCls, labelCls } from '@/components/ui/FormField'

// ── Push Notification constants ───────────────────────────────────────────────
const PUSH_ROLES = ['EMT', 'Paramedic', 'RN', 'NP', 'PA', 'MD', 'DO', 'Tech']
const PUSH_UNITS = ['Medic 1', 'Medic 2', 'Medic 3', 'Medic 4', 'Aid 1', 'Aid 2', 'Command 1', 'Rescue 1', 'Rescue 2']

type Announcement = {
  id: string
  message: string
  priority: 'normal' | 'urgent'
  active: boolean
  expires_at: string | null
  created_at: string
  created_by: string | null
  audience: string
  audience_list: string[]
}

const EXPIRES_OPTIONS = [
  { label: '1 day', value: '1d' },
  { label: '3 days', value: '3d' },
  { label: '1 week', value: '1w' },
  { label: '2 weeks', value: '2w' },
  { label: '1 month', value: '1mo' },
  { label: 'Never', value: 'never' },
]

function addDuration(value: string): string | null {
  if (value === 'never') return null
  const now = new Date()
  if (value === '1d') now.setDate(now.getDate() + 1)
  else if (value === '3d') now.setDate(now.getDate() + 3)
  else if (value === '1w') now.setDate(now.getDate() + 7)
  else if (value === '2w') now.setDate(now.getDate() + 14)
  else if (value === '1mo') now.setMonth(now.getMonth() + 1)
  return now.toISOString()
}


  const EMOJIS = [
    // Status / alerts
    '⚠️','🚨','🔴','🟡','🟢','✅','❌','🛑','📢','📣','🔔','🔕','💡','📌','📍',
    // Medical
    '🚑','💊','🩺','🩻','🩹','🧬','🏥','🩸','💉','🧪','🫀','🫁',
    // Fire / ops
    '🔥','🚒','🚁','⛑️','🪖','🏕️','🌲','🌡️','💧','🌬️','☁️','⛈️',
    // People / comms
    '👥','👨‍⚕️','👩‍⚕️','🤝','📞','📱','💬','✉️','📝','📋','📄',
    // Symbols
    '➡️','⬆️','⬇️','🔁','⏰','📅','🕐','🗓️','🔒','🔓','⭐','🏆',
  ]

export default function AnnouncementsPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  // Form state
  const [message, setMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [expiresIn, setExpiresIn] = useState('1w')
  const [audienceList, setAudienceList] = useState<string[]>(['all'])

  // Push notification state
  const [pushForm, setPushForm] = useState({ title: '', body: '', url: '', roles: [] as string[], units: [] as string[], sendEmail: false })
  const [pushSending, setPushSending] = useState(false)
  const [pushResult, setPushResult] = useState<{ delivered: number; failed: number } | null>(null)
  const [pushError, setPushError] = useState('')
  const [pushHistory, setPushHistory] = useState<any[]>([])
  const [csSettings, setCsSettings] = useState({ enabled: true, frequency_hours: 12, reminder_threshold_hours: 24 })
  const [savingCs, setSavingCs] = useState(false)
  const [csSuccess, setCsSuccess] = useState(false)

  const togglePushRole = (role: string) => setPushForm(prev => ({ ...prev, roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role] }))
  const togglePushUnit = (unit: string) => setPushForm(prev => ({ ...prev, units: prev.units.includes(unit) ? prev.units.filter(u => u !== unit) : [...prev.units, unit] }))

  const handleSendPush = async () => {
    if (!pushForm.title || !pushForm.body) { setPushError('Title and body are required.'); return }
    setPushSending(true); setPushError(''); setPushResult(null)
    try {
      const res = await authFetch('/api/push/send', {
        method: 'POST',
        body: JSON.stringify({ title: pushForm.title, body: pushForm.body, url: pushForm.url || '/', target_roles: pushForm.roles.length > 0 ? pushForm.roles : undefined, target_units: pushForm.units.length > 0 ? pushForm.units : undefined, send_email: pushForm.sendEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setPushResult({ delivered: data.delivered, failed: data.failed })
      setPushForm({ title: '', body: '', url: '', roles: [], units: [], sendEmail: false })
      loadPushHistory()
    } catch (err: any) { setPushError(err.message) }
    finally { setPushSending(false) }
  }

  const loadPushHistory = () => {
    supabase.from('push_notifications').select('*').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setPushHistory(data || []))
  }

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAnnouncements()
    loadPushHistory()
    supabase.from('app_settings').select('value').eq('key', 'cs_count_reminder').single()
      .then(({ data }) => { if (data?.value) setCsSettings(data.value as any) })
  }, [])

  const handleCreate = async () => {
    if (!message.trim()) { toast.warning('Message is required.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('announcements').insert({
        message: message.trim(),
        priority,
        expires_at: addDuration(expiresIn),
        audience: audienceList.join(','),
        audience_list: audienceList,
        active: true,
        created_by: assignment.user?.email || 'admin',
      })
      if (error) throw new Error(error.message)
      setMessage('')
      setPriority('normal')
      setExpiresIn('1w')
      setAudienceList(['all'])
      await loadAnnouncements()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error creating announcement')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('announcements').update({ active: !current }).eq('id', id)
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, active: !current } : a))
  }

  const deleteAnnouncement = (id: string) => {
    setConfirmAction({
      action: async () => {
        setDeletingId(id)
        await supabase.from('announcements').delete().eq('id', id)
        setAnnouncements(prev => prev.filter(a => a.id !== id))
        setDeletingId(null)
      },
      title: 'Delete Announcement',
      message: 'Delete this announcement?',
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  const formatExpiry = (exp: string | null) => {
    if (!exp) return 'Never'
    const d = new Date(exp)
    const now = new Date()
    if (d < now) return '⚠️ Expired'
    return d.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white mt-8 md:mt-0">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">⚙️ Announcements</h1>
          <p className="text-xs text-gray-500 mt-1">Manage ticker announcements shown to all users.</p>
        </div>

        {/* Create Form */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">New Announcement</h2>
          <div>
            <label className={labelCls}>Message *</label>
            <div className="relative">
              <textarea
                className={`${inputCls} h-20 resize-none pr-10`}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Enter announcement text..."
              />
              <button
                type="button"
                onClick={() => setShowEmoji(e => !e)}
                className="absolute top-2 right-2 text-lg hover:scale-110 transition-transform"
                title="Emoji picker"
              >😊</button>
            </div>
            {showEmoji && (
              <div className="mt-2 bg-gray-800 border border-gray-700 rounded-xl p-3">
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { setMessage(prev => prev + emoji); setShowEmoji(false) }}
                      className="text-xl hover:scale-125 transition-transform p-0.5 rounded hover:bg-gray-700"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Priority</label>
              <div className="flex gap-2">
                {(['normal', 'urgent'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      priority === p
                        ? p === 'urgent' ? 'bg-orange-600 text-white' : 'bg-red-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Expires In</label>
              <select className={inputCls} value={expiresIn} onChange={e => setExpiresIn(e.target.value)}>
                {EXPIRES_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Audience (select one or more)</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  ['all', 'All Employees'],
                  ['admin', 'Admin'],
                  ['MD', 'MD / Physician'],
                  ['NP', 'Nurse Practitioner'],
                  ['PA', 'Physician Assistant'],
                  ['RN', 'Registered Nurse'],
                  ['Paramedic', 'Paramedic'],
                  ['EMT', 'EMT'],
                  ['providers', 'All Clinicians (MD/NP/PA/RN/Paramedic)'],
                ].map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={audienceList.includes(val)}
                      onChange={e => {
                        if (val === 'all') {
                          setAudienceList(e.target.checked ? ['all'] : [])
                        } else {
                          setAudienceList(prev => {
                            const without = prev.filter(x => x !== 'all' && x !== val)
                            return e.target.checked ? [...without, val] : without
                          })
                        }
                      }}
                      className="w-4 h-4 accent-red-500"
                    />
                    <span className="text-xs text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Creating...' : '📢 Create Announcement'}
          </button>
        </div>

        {/* Announcements List */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
            Current Announcements
            {!loading && <span className="ml-2 text-gray-600 font-normal normal-case">({announcements.length})</span>}
          </h2>

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : announcements.length === 0 ? (
            <EmptyState icon="📢" message="No announcements yet." />
          ) : (
            announcements.map(a => (
              <div
                key={a.id}
                className={`bg-gray-900 rounded-xl p-4 border flex gap-3 ${
                  a.active ? 'border-gray-800' : 'border-gray-800/40 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-white leading-snug">{a.message}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      a.priority === 'urgent' ? 'bg-orange-900 text-orange-300' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {a.priority}
                    </span>
                    <span>Expires: {formatExpiry(a.expires_at)}</span>
                    <span>Audience: {a.audience_list?.join(', ') || a.audience}</span>
                    {a.created_by && <span>By: {a.created_by}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => toggleActive(a.id, a.active)}
                    className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${
                      a.active
                        ? 'bg-green-900 text-green-300 hover:bg-green-800'
                        : 'bg-gray-700 text-gray-500 hover:bg-gray-600'
                    }`}
                  >
                    {a.active ? '● Active' : '○ Inactive'}
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deleteAnnouncement(a.id)}
                    disabled={deletingId === a.id}
                    className="text-xs px-3 py-1 rounded-lg bg-red-950 text-red-400 hover:bg-red-900 disabled:opacity-50 transition-colors"
                  >
                    {deletingId === a.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Push Notifications ── */}
        <div className="mt-10 space-y-6">
          <div>
            <h2 className="text-lg font-bold">🔔 Push Notifications</h2>
            <p className="text-gray-500 text-xs mt-0.5">Send push notifications to crew devices</p>
          </div>

          {/* CS Count Reminder Settings */}
          <div className="theme-card rounded-xl p-4 border space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">CS Count Reminder Settings</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Automated CS Count Reminders</p>
                <p className="text-xs text-gray-500">Push + email reminders when a unit hasn’t counted in time</p>
              </div>
              <button onClick={() => setCsSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${csSettings.enabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {csSettings.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            {csSettings.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Overdue After (hours)</label>
                  <select className={inputCls} value={csSettings.reminder_threshold_hours}
                    onChange={e => setCsSettings(prev => ({ ...prev, reminder_threshold_hours: Number(e.target.value) }))}>
                    <option value={12}>12 hours</option><option value={24}>24 hours</option>
                    <option value={36}>36 hours</option><option value={48}>48 hours</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Reminder Frequency</label>
                  <select className={inputCls} value={csSettings.frequency_hours}
                    onChange={e => setCsSettings(prev => ({ ...prev, frequency_hours: Number(e.target.value) }))}>
                    <option value={8}>Every 8 hours</option>
                    <option value={12}>Every 12 hours</option>
                    <option value={24}>Every 24 hours</option>
                  </select>
                </div>
              </div>
            )}
            <button
              onClick={async () => {
                setSavingCs(true)
                await supabase.from('app_settings').upsert({ key: 'cs_count_reminder', value: csSettings, updated_at: new Date().toISOString() })
                setSavingCs(false); setCsSuccess(true); setTimeout(() => setCsSuccess(false), 2000)
              }}
              disabled={savingCs}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
              {savingCs ? 'Saving...' : csSuccess ? '✅ Saved' : 'Save Settings'}
            </button>
          </div>

          {/* Compose */}
          <div className="theme-card rounded-xl p-4 border space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Compose Notification</h3>
            <div><label className={labelCls}>Title *</label>
              <input className={inputCls} value={pushForm.title} onChange={e => setPushForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Morning Briefing" /></div>
            <div><label className={labelCls}>Message *</label>
              <textarea className={inputCls + ' resize-none'} rows={3} value={pushForm.body} onChange={e => setPushForm(p => ({ ...p, body: e.target.value }))} placeholder="Notification body text..." /></div>
            <div><label className={labelCls}>Link (optional)</label>
              <input className={inputCls} value={pushForm.url} onChange={e => setPushForm(p => ({ ...p, url: e.target.value }))} placeholder="/cs/count or /encounters" /></div>
            <div>
              <label className={labelCls}>Target Roles <span className="text-gray-600 font-normal normal-case">(empty = all)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {PUSH_ROLES.map(role => (
                  <button key={role} type="button" onClick={() => togglePushRole(role)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      pushForm.roles.includes(role) ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>{role}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Target Units <span className="text-gray-600 font-normal normal-case">(empty = all)</span></label>
              <div className="flex flex-wrap gap-1.5">
                {PUSH_UNITS.map(unit => (
                  <button key={unit} type="button" onClick={() => togglePushUnit(unit)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      pushForm.units.includes(unit) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>{unit}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={pushForm.sendEmail} onChange={e => setPushForm(p => ({ ...p, sendEmail: e.target.checked }))} className="accent-red-500 w-4 h-4" />
              <span className="text-sm text-gray-300">Also send as email</span>
            </label>
            {pushError && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{pushError}</div>}
            {pushResult && <div className="bg-green-900/40 border border-green-700 rounded-lg px-3 py-2 text-green-300 text-sm">✅ Sent — {pushResult.delivered} delivered, {pushResult.failed} failed</div>}
            <button onClick={handleSendPush} disabled={pushSending}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
              {pushSending ? 'Sending...' : '📤 Send Notification'}
            </button>
          </div>

          {/* History */}
          <div className="theme-card rounded-xl border">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-400">Recent Notifications</h3>
            </div>
            {pushHistory.length === 0 ? (
              <p className="px-4 py-8 text-gray-600 text-sm text-center">No notifications sent yet</p>
            ) : (
              <div className="divide-y divide-gray-800/50">
                {pushHistory.map((n: any) => (
                  <div key={n.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{n.title}</span>
                      <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{n.body}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>By: {n.sent_by}</span>
                      <span className="text-green-400">{n.delivered_count} delivered</span>
                      {n.failed_count > 0 && <span className="text-red-400">{n.failed_count} failed</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        icon={confirmAction?.icon || '⚠️'}
        confirmColor={confirmAction?.confirmColor}
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null) }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}
