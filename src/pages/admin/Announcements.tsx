

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'

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

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

export default function AnnouncementsPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [message, setMessage] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [expiresIn, setExpiresIn] = useState('1w')
  const [audienceList, setAudienceList] = useState<string[]>(['all'])

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
  }, [])

  const handleCreate = async () => {
    if (!message.trim()) { alert('Message is required.'); return }
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
      alert(err instanceof Error ? err.message : 'Error creating announcement')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('announcements').update({ active: !current }).eq('id', id)
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, active: !current } : a))
  }

  const deleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return
    setDeletingId(id)
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
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
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
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
            <p className="text-gray-600 text-sm">Loading...</p>
          ) : announcements.length === 0 ? (
            <div className="bg-gray-900 rounded-xl p-6 text-center border border-gray-800">
              <p className="text-gray-500">No announcements yet.</p>
            </div>
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
      </div>
    </div>
  )
}
