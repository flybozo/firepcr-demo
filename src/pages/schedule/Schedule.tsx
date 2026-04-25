
import { Link } from 'react-router-dom'

import { useEffect, useState, useCallback } from 'react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { LoadingSkeleton, ConfirmDialog, UnitFilterPills } from '@/components/ui'
import { getUnitTypeName } from '@/lib/unitColors'
import { getIsOnline } from '@/lib/syncManager'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { usePermission, usePermissionLoading } from '@/hooks/usePermission'
import { inputCls, labelCls } from '@/components/ui/FormField'
import { useListStyle } from '@/hooks/useListStyle'
import { getListClasses } from '@/lib/listStyles'

type DeploymentRecord = {
  id: string
  employee_id: string
  unit_id: string
  start_date: string
  end_date: string
  employee?: { name: string; role: string } | null
  unit?: { name: string; unit_type?: { name: string } | null } | null
}

const UNIT_TYPE_COLORS: Record<string, string> = {
  'Ambulance': 'bg-red-800 text-red-200 border-red-700',
  'Med Unit':  'bg-blue-800 text-blue-200 border-blue-700',
  'REMS':      'bg-green-800 text-green-200 border-green-700',
  'Warehouse': 'bg-purple-800 text-purple-200 border-purple-700',
}

function CalendarGrid({ deployments, units }: {
  deployments: DeploymentRecord[]
  units: { id: string; name: string }[]
}) {
  const listStyle = useListStyle()
  const lc = getListClasses(listStyle)
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [unitFilter, setUnitFilter] = useState('All')

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const filtered = unitFilter === 'All' ? deployments : deployments.filter(d => d.unit?.name === unitFilter)

  const getDeploymentsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return filtered.filter(d => d.start_date <= dateStr && d.end_date >= dateStr)
  }

  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors">‹</button>
          <span className="text-sm font-semibold w-40 text-center">{monthLabel}</span>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors">›</button>
        </div>
        <UnitFilterPills
          units={units.map(u => u.name)}
          selected={unitFilter}
          onSelect={setUnitFilter}
          unitTypeMap={Object.fromEntries(units.map(u => [u.name, getUnitTypeName(u.name)]))}
        />
      </div>

      {/* Grid */}
      <div className={lc.container}>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-700">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) }).map((_, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-gray-800 last:border-b-0">
            {Array.from({ length: 7 }).map((_, dayOfWeek) => {
              const dayNum = weekIdx * 7 + dayOfWeek - firstDay + 1
              const isValid = dayNum >= 1 && dayNum <= daysInMonth
              const today = new Date()
              const isToday = isValid && dayNum === today.getDate() && month === today.getMonth() && year === today.getFullYear()
              const deps = isValid ? getDeploymentsForDay(dayNum) : []
              return (
                <div key={dayOfWeek} className={`min-h-[80px] p-1 border-r border-gray-800 last:border-r-0 ${!isValid ? 'bg-gray-950/40' : ''}`}>
                  {isValid && (
                    <>
                      <div className={`text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-red-600 text-white' : 'text-gray-500'
                      }`}>{dayNum}</div>
                      <div className="space-y-0.5">
                        {deps.slice(0, 4).map(dep => {
                          const typeName = (dep.unit?.unit_type as any)?.name || ''
                          const colorCls = UNIT_TYPE_COLORS[typeName] || 'bg-gray-700 text-gray-300 border-gray-600'
                          return (
                            <div key={dep.id}
                              className={`text-[10px] px-1 py-0.5 rounded border truncate leading-tight ${colorCls}`}
                              title={`${dep.employee?.name} • ${dep.employee?.role} • ${dep.unit?.name}`}
                            >
                              <span className="font-medium">{dep.employee?.name?.split(' ').slice(-1)[0]}</span>
                              <span className="opacity-75 ml-1">{dep.employee?.role}</span>
                            </div>
                          )
                        })}
                        {deps.length > 4 && (
                          <div className="text-[10px] text-gray-500">+{deps.length - 4} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(UNIT_TYPE_COLORS).map(([type, cls]) => (
          <div key={type} className={`text-[11px] px-2 py-0.5 rounded border ${cls}`}>{type}</div>
        ))}
      </div>
    </div>
  )
}

type Request = {
  id: string
  employee_id: string
  request_type: 'time_off' | 'want_to_work'
  start_date: string
  end_date: string
  notes: string | null
  status: 'pending' | 'approved' | 'denied'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  employee?: { name: string; role: string }
}

function statusBadge(status: string) {
  if (status === 'approved') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-900 text-green-300">✅ Approved</span>
  if (status === 'denied') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-900 text-red-300">❌ Denied</span>
  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-900 text-yellow-300">⏳ Pending</span>
}

function typeBadge(type: string) {
  if (type === 'time_off') return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-900 text-blue-300">🏖️ Time Off</span>
  return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-900 text-purple-300">💪 Want to Work</span>
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dayCount(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

export default function SchedulePage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const isAdmin = usePermission('schedule.manage')
  const roleLoading = usePermissionLoading()

  const [activeTab, setActiveTab] = useState<'requests' | 'unit_calendar'>('requests')
  const [requests, setRequests] = useState<Request[]>([])
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [calendarUnits, setCalendarUnits] = useState<{ id: string; name: string }[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isOfflineData, setIsOfflineData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [adminFilter, setAdminFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending')
  const [success, setSuccess] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; title: string; message: string; confirmLabel?: string; icon?: string; confirmColor?: string } | null>(null)

  // Form
  const [type, setType] = useState<'time_off' | 'want_to_work'>('time_off')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')

  const load = async () => {
    if (roleLoading || assignment.loading) return
    try {
      let query = supabase
        .from('schedule_requests')
        .select('*, employee:employees(name, role)')
        .order('created_at', { ascending: false })

      if (!isAdmin && assignment.employee?.id) {
        query = query.eq('employee_id', assignment.employee.id)
      }

      const { data, error } = await query
      if (error) throw error
      setRequests((data || []) as Request[])
    } catch {
      setIsOfflineData(true)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [roleLoading, assignment.loading, isAdmin])

  const handleSubmit = async () => {
    if (!startDate || !endDate) { toast.warning('Please select start and end dates.'); return }
    if (endDate < startDate) { toast.warning('End date must be on or after start date.'); return }
    if (!assignment.employee?.id) { toast.warning('No employee record found.'); return }
    if (!getIsOnline()) { toast.warning('Schedule requests require an internet connection. Please reconnect and try again.'); return }
    setSaving(true)
    const { error } = await supabase.from('schedule_requests').insert({
      employee_id: assignment.employee.id,
      request_type: type,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
      status: 'pending',
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    setType('time_off')
    setStartDate('')
    setEndDate('')
    setNotes('')
    setSuccess('✅ Request submitted!')
    setTimeout(() => setSuccess(''), 3000)
    setSaving(false)
    load()
  }

  const handleReview = async (id: string, status: 'approved' | 'denied') => {
    setReviewingId(id)
    await supabase.from('schedule_requests').update({
      status,
      reviewed_by: assignment.employee?.name || 'Admin',
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status, reviewed_by: assignment.employee?.name || 'Admin' } : r))
    setReviewingId(null)
  }

  const handleDelete = (id: string) => {
    setConfirmAction({
      action: async () => {
        await supabase.from('schedule_requests').delete().eq('id', id)
        setRequests(prev => prev.filter(r => r.id !== id))
      },
      title: 'Delete Request',
      message: 'Delete this request?',
      icon: '🗑️',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    })
  }

  const loadCalendar = useCallback(async () => {
    if (calendarLoading) return
    setCalendarLoading(true)
    try {
      const [{ data: deps }, { data: unitData }] = await Promise.all([
        supabase
          .from('deployment_records')
          .select('id, employee_id, unit_id, start_date, end_date, employee:employees(name, role), unit:units(name, unit_type:unit_types(name))')
          .not('start_date', 'is', null)
          .not('end_date', 'is', null)
          .order('start_date'),
        supabase.from('units').select('id, name').eq('active', true).order('name'),
      ])
      setDeployments((deps || []) as unknown as DeploymentRecord[])
      setCalendarUnits((unitData || []) as { id: string; name: string }[])
    } catch {
      setDeployments([])
      setCalendarUnits([])
    }
    setCalendarLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'unit_calendar' && deployments.length === 0) {
      loadCalendar()
    }
  }, [activeTab]) // eslint-disable-line

  const filteredRequests = isAdmin
    ? requests.filter(r => adminFilter === 'all' || r.status === adminFilter)
    : requests

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="bg-gray-950 text-white mt-8 md:mt-0 pb-8">
      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Header */}
        {isOfflineData && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-3 py-2 text-amber-300 text-xs flex items-center gap-2">
            📶 Schedule data requires a connection. Reconnect to view requests.
          </div>
        )}
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-xl font-bold">📅 Schedule</h1>
            {isAdmin && (
              <Link to="/schedule/generate"
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
                ⚡ Generate Schedule
              </Link>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isAdmin ? 'Review and manage crew availability requests.' : 'Request time off or flag dates you want to work.'}
          </p>
          <Link to="/schedule/calendar" className="inline-flex items-center gap-1.5 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            📅 View Coverage Calendar →
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 p-1 rounded-xl border border-gray-800">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'requests' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            📝 Schedule Requests
            {pendingCount > 0 && isAdmin && <span className="ml-1.5 px-1.5 py-0.5 bg-red-600 text-white text-xs rounded-full">{pendingCount}</span>}
          </button>
          <button
            onClick={() => setActiveTab('unit_calendar')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'unit_calendar' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}>
            📆 Unit Calendar
          </button>
        </div>

        {/* Unit Calendar Tab */}
        {activeTab === 'unit_calendar' && (
          <div className="space-y-4">
            {calendarLoading ? (
              <div className="text-center py-12 text-gray-500">Loading calendar...</div>
            ) : (
              <CalendarGrid deployments={deployments} units={calendarUnits} />
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (<>

        {/* Submit form — everyone */}
        <div className="theme-card rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">New Request</h2>

          {/* Type toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('time_off')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                type === 'time_off' ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🏖️ Time Off Request
            </button>
            <button
              onClick={() => setType('want_to_work')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                type === 'want_to_work' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              💪 Want to Work
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" value={startDate} onChange={e => {
                setStartDate(e.target.value)
                if (!endDate || e.target.value > endDate) setEndDate(e.target.value)
              }} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date *</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {startDate && endDate && (
            <p className="text-xs text-gray-500">
              {dayCount(startDate, endDate)} day{dayCount(startDate, endDate) !== 1 ? 's' : ''} selected
            </p>
          )}

          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={`${inputCls} h-16 resize-none`}
              placeholder={type === 'time_off' ? 'Reason, travel plans, etc.' : 'Available for any assignment, prefer RAMBO 1, etc.'}
            />
          </div>

          {success && <p className="text-green-400 text-sm">{success}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors"
          >
            {saving ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>

        {/* Admin: filter + all requests */}
        {isAdmin && (
          <div className="flex gap-1.5 flex-wrap">
            {(['pending', 'all', 'approved', 'denied'] as const).map(f => (
              <button key={f} onClick={() => setAdminFilter(f)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  adminFilter === f ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}>
                {f === 'pending' && pendingCount > 0 ? `⏳ Pending (${pendingCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Requests list */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
            {isAdmin ? 'All Requests' : 'My Requests'}
            <span className="ml-2 text-gray-600 font-normal normal-case">({filteredRequests.length})</span>
          </h2>

          {loading ? (
            <LoadingSkeleton rows={5} header />
          ) : filteredRequests.length === 0 ? (
            <div className="theme-card rounded-xl p-8 text-center border">
              <p className="text-gray-500 text-sm">No requests{adminFilter !== 'all' ? ` with status "${adminFilter}"` : ''}.</p>
            </div>
          ) : (
            filteredRequests.map(r => (
              <div key={r.id} className="theme-card rounded-xl border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    {isAdmin && (
                      <p className="text-sm font-semibold text-white">
                        {(r.employee as any)?.name || 'Unknown'} <span className="text-gray-500 font-normal text-xs">· {(r.employee as any)?.role}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {typeBadge(r.request_type)}
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-sm text-gray-300">
                      {formatDate(r.start_date)}
                      {r.start_date !== r.end_date && <> → {formatDate(r.end_date)}</>}
                      <span className="text-gray-500 ml-2 text-xs">({dayCount(r.start_date, r.end_date)} day{dayCount(r.start_date, r.end_date) !== 1 ? 's' : ''})</span>
                    </p>
                    {r.notes && <p className="text-xs text-gray-400 italic">"{r.notes}"</p>}
                    {r.reviewed_by && (
                      <p className="text-xs text-gray-600">
                        Reviewed by {r.reviewed_by} · {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : ''}
                      </p>
                    )}
                    <p className="text-xs text-gray-700">Submitted {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>

                  {/* Admin approve/deny OR employee delete pending */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {isAdmin && r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleReview(r.id, 'approved')}
                          disabled={reviewingId === r.id}
                          className="px-3 py-1.5 bg-green-800 hover:bg-green-700 text-green-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => handleReview(r.id, 'denied')}
                          disabled={reviewingId === r.id}
                          className="px-3 py-1.5 bg-red-900 hover:bg-red-800 text-red-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                          ❌ Deny
                        </button>
                      </>
                    )}
                    {isAdmin && r.status !== 'pending' && (
                      <button
                        onClick={() => handleReview(r.id, r.status === 'approved' ? 'denied' : 'approved')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs rounded-lg transition-colors"
                      >
                        Reverse
                      </button>
                    )}
                    {(!isAdmin || isAdmin) && r.status === 'pending' && (
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-red-900 text-gray-500 hover:text-red-300 text-xs rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        </>)}
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
