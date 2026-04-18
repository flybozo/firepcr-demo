

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, useParams } from 'react-router-dom'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { Link } from 'react-router-dom'

export default function AddActivityPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const params = useParams()
  const ics214Id = params.id as string
  const assignment = useUserAssignment()

  const [description, setDescription] = useState('')
  const [actDateTime, setActDateTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [header, setHeader] = useState<{ ics214_id: string; unit_name: string; incident_name: string; status: string } | null>(null)

  useEffect(() => {
    const now = new Date()
    now.setSeconds(0, 0)
    setActDateTime(now.toISOString().slice(0, 16))

    supabase
      .from('ics214_headers')
      .select('ics214_id, unit_name, incident_name, status')
      .eq('ics214_id', ics214Id)
      .single()
      .then(({ data }) => setHeader(data))
  }, [ics214Id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    setError('')

    const activityData = {
      ics214_id: ics214Id,
      log_datetime: actDateTime ? new Date(actDateTime).toISOString() : new Date().toISOString(),
      description: description.trim(),
      logged_by: assignment.employee?.name || assignment.user?.email || 'Unknown',
      activity_type: 'activity',
    }

    try {
      const { getIsOnline } = await import('@/lib/syncManager')
      const { queueOfflineWrite } = await import('@/lib/offlineStore')

      if (getIsOnline()) {
        const { error: insertError } = await supabase.from('ics214_activities').insert(activityData)
        if (insertError) {
          setError(insertError.message)
          setSubmitting(false)
          return
        }
      } else {
        await queueOfflineWrite('ics214_activities', 'insert', {
          id: crypto.randomUUID(),
          ...activityData,
        })
      }
    } catch (err: any) {
      setError(err.message || 'Save failed')
      setSubmitting(false)
      return
    }

    navigate(`/ics214/${ics214Id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-8">
      <div className="max-w-lg mx-auto p-4 md:p-6">

        <div className="flex items-center gap-3 mb-6 pt-2">
          <Link to={`/ics214/${ics214Id}`} className="text-gray-500 hover:text-white text-sm">
            ← {ics214Id}
          </Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm">Add Activity</span>
        </div>

        {header && (
          <div className="theme-card rounded-xl border px-4 py-3 mb-5">
            <p className="text-xs text-gray-500 font-mono">{header.ics214_id}</p>
            <p className="text-sm text-white font-semibold">{header.unit_name} — {header.incident_name}</p>
          </div>
        )}

        <h1 className="text-xl font-bold mb-5">Log Activity</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={actDateTime}
              onChange={e => setActDateTime(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Activity Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={5}
              placeholder="Describe the notable activity..."
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 rounded-lg text-sm font-bold transition-colors"
          >
            {submitting ? 'Logging...' : 'Log Activity'}
          </button>
        </form>

      </div>
    </div>
  )
}
