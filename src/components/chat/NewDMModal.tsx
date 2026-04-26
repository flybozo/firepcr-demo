import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from './Avatar'
import type { ChatChannel, Employee } from '@/types/chat'

export function NewDMModal({
  onClose,
  onChannelCreated,
}: {
  onClose: () => void
  onChannelCreated: (channel: ChatChannel) => void
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    authFetch('/api/chat/members?channelId=_roster')
      .then(() => {})
      .catch(() => {})

    const supabase = createClient()
    supabase
      .from('employees_sync')
      .select('id, name, headshot_url, role')
      .eq('status', 'Active')
      .order('name')
      .then(({ data }) => {
        setEmployees((data || []) as Employee[])
        setLoading(false)
      })
  }, [])

  const filtered = employees.filter(
    (e) =>
      !selected.find((s) => s.id === e.id) &&
      e.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!selected.length || creating) return
    setCreating(true)
    try {
      const resp = await authFetch('/api/chat/channels', {
        method: 'POST',
        body: JSON.stringify({
          type: 'direct',
          employee_ids: selected.map((e) => e.id),
        }),
      })
      if (!resp.ok) throw new Error('Failed to create DM')
      const data = await resp.json()
      onChannelCreated(data.channel as ChatChannel)
    } catch (e) {
      console.error('[Chat] create DM failed', e)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">New Direct Message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg">×</button>
        </div>

        <div className="px-4 pt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full bg-gray-800 text-white placeholder-gray-500 text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-red-600/50 border border-gray-700"
            autoFocus
          />
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-2">
            {selected.map((e) => (
              <span
                key={e.id}
                className="flex items-center gap-1 px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full border border-red-600/30"
              >
                {e.name}
                <button
                  onClick={() => setSelected((prev) => prev.filter((s) => s.id !== e.id))}
                  className="hover:text-red-200 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-56 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-4">No employees found</p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected((prev) => [...prev, e])}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-left"
              >
                <Avatar person={e} size={28} />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{e.name}</p>
                  {e.role && <p className="text-xs text-gray-500 truncate">{e.role}</p>}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-4 pb-4 pt-2 border-t border-gray-800">
          <button
            onClick={handleCreate}
            disabled={!selected.length || creating}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? 'Opening...' : selected.length ? `Message ${selected.map((e) => e.name).join(', ')}` : 'Select someone'}
          </button>
        </div>
      </div>
    </div>
  )
}
