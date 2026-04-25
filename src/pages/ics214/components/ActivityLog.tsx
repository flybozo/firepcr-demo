import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Activity, ICS214Header } from './types'
import { formatTime } from './utils'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

interface Props {
  activities: Activity[]
  header: ICS214Header
  ics214IdParam: string
  onAddActivity: (data: { datetime: string; description: string }) => Promise<void>
}

export function ActivityLog({ activities, header, ics214IdParam, onAddActivity }: Props) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const [showForm, setShowForm] = useState(false)
  const [datetime, setDatetime] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (showForm) {
      const now = new Date()
      now.setSeconds(0, 0)
      setDatetime(now.toISOString().slice(0, 16))
    }
  }, [showForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    await onAddActivity({ datetime, description })
    setDescription('')
    setShowForm(false)
    setSubmitting(false)
  }

  return (
    <div className={lc.container}>
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Activity Log ({activities.filter(a => a.activity_type !== 'system').length} entries)
        </h2>
        {header.status === 'Open' && (
          <Link
            to={`/ics214/${ics214IdParam}/activity`}
            className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            + Add Activity
          </Link>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-600 text-center">No activities logged yet.</p>
      ) : (
        <div className="divide-y divide-gray-800/40 max-h-[500px] overflow-y-auto">
          {activities.map(act => (
            <div
              key={act.id}
              className={`flex gap-3 px-4 py-3 ${
                act.activity_type === 'patient_contact'
                  ? 'bg-amber-950/30 border-l-2 border-amber-600'
                  : act.activity_type === 'system'
                  ? 'bg-gray-800/20'
                  : ''
              }`}
            >
              <div className="shrink-0 mt-0.5">
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${
                  act.activity_type === 'patient_contact'
                    ? 'bg-amber-900 text-amber-300'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {formatTime(act.log_datetime)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${act.activity_type === 'patient_contact' ? 'text-amber-100 font-semibold' : 'text-white'}`}>
                  {act.description}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{act.logged_by}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {header.status === 'Open' && (
        <div className="border-t border-gray-800 p-4">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2 border border-dashed border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              + Add Activity Entry
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={datetime}
                    onChange={e => setDatetime(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  rows={3}
                  placeholder="Describe the activity..."
                  className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  {submitting ? 'Logging...' : 'Log Activity'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setDescription('') }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
