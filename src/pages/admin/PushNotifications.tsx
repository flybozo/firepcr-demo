import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/lib/useRole'
import { authFetch } from '@/lib/authFetch'
import { LoadingSkeleton } from '@/components/ui'

const ROLES = ['EMT', 'Paramedic', 'RN', 'NP', 'PA', 'MD', 'DO', 'Tech']
const UNITS = ['RAMBO 1', 'RAMBO 2', 'RAMBO 3', 'RAMBO 4', 'MSU 1', 'MSU 2', 'The Beast', 'REMS 1', 'REMS 2']

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

type NotifLog = {
  id: string
  title: string
  body: string
  sent_by: string
  target_roles: string[] | null
  target_units: string[] | null
  delivered_count: number
  failed_count: number
  created_at: string
}

function PushNotificationsInner() {
  const supabase = createClient()
  const { isAdmin } = useRole()
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ delivered: number; failed: number } | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<NotifLog[]>([])
  const [csSettings, setCsSettings] = useState({ enabled: true, frequency_hours: 12, reminder_threshold_hours: 24 })
  const [savingCs, setSavingCs] = useState(false)
  const [csSuccess, setCsSuccess] = useState(false)

  const [form, setForm] = useState({
    title: '',
    body: '',
    url: '',
    roles: [] as string[],
    units: [] as string[],
    sendEmail: false,
  })

  useEffect(() => {
    supabase.from('push_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory(data || []))
    // Load CS reminder settings
    supabase.from('app_settings').select('value').eq('key', 'cs_count_reminder').single()
      .then(({ data }) => { if (data?.value) setCsSettings(data.value as any) })
  }, [result])

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }))
  }

  const toggleUnit = (unit: string) => {
    setForm(prev => ({
      ...prev,
      units: prev.units.includes(unit) ? prev.units.filter(u => u !== unit) : [...prev.units, unit],
    }))
  }

  const handleSend = async () => {
    if (!form.title || !form.body) { setError('Title and body are required.'); return }
    setSending(true)
    setError('')
    setResult(null)
    try {
      const res = await authFetch('/api/push/send', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          url: form.url || '/',
          target_roles: form.roles.length > 0 ? form.roles : undefined,
          target_units: form.units.length > 0 ? form.units : undefined,
          send_email: form.sendEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setResult({ delivered: data.delivered, failed: data.failed })
      setForm({ title: '', body: '', url: '', roles: [], units: [], sendEmail: false })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (!isAdmin) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center"><p className="text-gray-500">Admin access required</p></div>

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 mt-8 md:mt-0">
        <div>
          <h1 className="text-xl font-bold">Push Notifications</h1>
          <p className="text-gray-500 text-xs mt-0.5">Send notifications to crew devices</p>
        </div>

        {/* CS Count Reminder Settings */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">CS Count Reminder Settings</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Automated CS Count Reminders</p>
              <p className="text-xs text-gray-500">Push + email reminders when a unit hasn't counted in time</p>
            </div>
            <button
              onClick={() => setCsSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                csSettings.enabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {csSettings.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {csSettings.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Overdue After (hours)</label>
                <select className={inputCls} value={csSettings.reminder_threshold_hours}
                  onChange={e => setCsSettings(prev => ({ ...prev, reminder_threshold_hours: Number(e.target.value) }))}>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={36}>36 hours</option>
                  <option value={48}>48 hours</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Reminder Frequency</label>
                <select className={inputCls} value={csSettings.frequency_hours}
                  onChange={e => setCsSettings(prev => ({ ...prev, frequency_hours: Number(e.target.value) }))}>
                  <option value={8}>Every 8 hours</option>
                  <option value={12}>Every 12 hours (2x daily)</option>
                  <option value={24}>Every 24 hours (1x daily)</option>
                </select>
              </div>
            </div>
          )}
          <button
            onClick={async () => {
              setSavingCs(true)
              await supabase.from('app_settings').upsert({
                key: 'cs_count_reminder',
                value: csSettings,
                updated_at: new Date().toISOString(),
              })
              setSavingCs(false)
              setCsSuccess(true)
              setTimeout(() => setCsSuccess(false), 2000)
            }}
            disabled={savingCs}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {savingCs ? 'Saving...' : csSuccess ? '✅ Saved' : 'Save Settings'}
          </button>
        </div>

        {/* Compose */}
        <div className="theme-card rounded-xl p-4 border space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Compose Notification</h2>
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Morning Briefing" />
          </div>
          <div>
            <label className={labelCls}>Message *</label>
            <textarea className={inputCls + ' resize-none'} rows={3} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Notification body text..." />
          </div>
          <div>
            <label className={labelCls}>Link (optional)</label>
            <input className={inputCls} value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="/cs/count or /encounters" />
          </div>

          {/* Target: Roles */}
          <div>
            <label className={labelCls}>Target Roles <span className="text-gray-600 font-normal normal-case">(leave empty for all)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map(role => (
                <button key={role} type="button" onClick={() => toggleRole(role)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    form.roles.includes(role) ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Target: Units */}
          <div>
            <label className={labelCls}>Target Units <span className="text-gray-600 font-normal normal-case">(leave empty for all)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {UNITS.map(unit => (
                <button key={unit} type="button" onClick={() => toggleUnit(unit)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    form.units.includes(unit) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* Also send email */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.sendEmail}
              onChange={e => setForm(p => ({ ...p, sendEmail: e.target.checked }))}
              className="accent-red-500 w-4 h-4" />
            <span className="text-sm text-gray-300">Also send as email to targeted employees</span>
          </label>

          {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}
          {result && (
            <div className="bg-green-900/40 border border-green-700 rounded-lg px-3 py-2 text-green-300 text-sm">
              ✅ Sent — {result.delivered} delivered, {result.failed} failed
            </div>
          )}

          <button onClick={handleSend} disabled={sending}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">
            {sending ? 'Sending...' : '📤 Send Notification'}
          </button>
        </div>

        {/* History */}
        <div className="theme-card rounded-xl border">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Recent Notifications</h2>
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-gray-600 text-sm text-center">No notifications sent yet</p>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {history.map(n => (
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
                    {n.target_roles?.length ? <span>Roles: {n.target_roles.join(', ')}</span> : null}
                    {n.target_units?.length ? <span>Units: {n.target_units.join(', ')}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PushNotificationsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton fullPage />}>
      <PushNotificationsInner />
    </Suspense>
  )
}
