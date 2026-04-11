

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { useRole } from '@/lib/useRole'
import { Link } from 'react-router-dom'

type CalEvent = {
  id: string
  employee_id: string
  employee_name: string
  employee_role: string
  type: 'time_off' | 'want_to_work' | 'deployment'
  start: string  // YYYY-MM-DD
  end: string
  label: string
  status?: string
  color: string
  textColor: string
}

const COLORS = [
  ['#1e40af', '#bfdbfe'], // blue
  ['#6d28d9', '#ddd6fe'], // purple
  ['#065f46', '#a7f3d0'], // green
  ['#92400e', '#fde68a'], // amber
  ['#9f1239', '#fecdd3'], // rose
  ['#0e7490', '#a5f3fc'], // cyan
  ['#3f6212', '#d9f99d'], // lime
  ['#7c3aed', '#ede9fe'], // violet
]

function employeeColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % COLORS.length
  return COLORS[hash]
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const s = new Date(start + 'T12:00:00')
  const e = new Date(end + 'T12:00:00')
  const d = new Date(s)
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function ScheduleCalendarPage() {
  const supabase = createClient()
  const assignment = useUserAssignment()
  const { isAdmin, loading: roleLoading } = useRole()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-indexed
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [employees, setEmployees] = useState<{id: string; name: string}[]>([])

  useEffect(() => {
    if (roleLoading || assignment.loading) return
    const load = async () => {
      const collected: CalEvent[] = []

      // Load approved schedule requests
      let srQuery = supabase.from('schedule_requests')
        .select('*, employee:employees(name, role)')
        .eq('status', 'approved')

      if (!isAdmin && assignment.employee?.id) {
        srQuery = srQuery.eq('employee_id', assignment.employee.id)
      }
      const { data: srData } = await srQuery

      for (const r of srData || []) {
        const emp = (r as any).employee
        const [bg, text] = r.request_type === 'time_off' ? ['#7f1d1d', '#fca5a5'] : ['#14532d', '#86efac']
        collected.push({
          id: r.id,
          employee_id: r.employee_id,
          employee_name: emp?.name || 'Unknown',
          employee_role: emp?.role || '',
          type: r.request_type,
          start: r.start_date,
          end: r.end_date,
          label: r.request_type === 'time_off' ? '🏖️ Off' : '💪 Available',
          status: r.status,
          color: bg,
          textColor: text,
        })
      }

      // Load pending schedule requests (shown differently)
      let pendingQuery = supabase.from('schedule_requests')
        .select('*, employee:employees(name, role)')
        .eq('status', 'pending')

      if (!isAdmin && assignment.employee?.id) {
        pendingQuery = pendingQuery.eq('employee_id', assignment.employee.id)
      }
      const { data: pendingData } = await pendingQuery
      for (const r of pendingData || []) {
        const emp = (r as any).employee
        collected.push({
          id: r.id + '-pending',
          employee_id: r.employee_id,
          employee_name: emp?.name || 'Unknown',
          employee_role: emp?.role || '',
          type: r.request_type,
          start: r.start_date,
          end: r.end_date,
          label: r.request_type === 'time_off' ? '⏳ Off (pending)' : '⏳ Available (pending)',
          status: 'pending',
          color: '#374151',
          textColor: '#9ca3af',
        })
      }

      // Load deployments (admin sees all, field sees own)
      let drQuery = supabase.from('deployment_records')
        .select('id, employee_id, travel_date, check_in_date, check_out_date, status, incident_id, employee:employees(name, role), incident:incidents(name)')
        .not('check_out_date', 'is', null)

      if (!isAdmin && assignment.employee?.id) {
        drQuery = drQuery.eq('employee_id', assignment.employee.id)
      }
      const { data: drData } = await drQuery

      for (const d of drData || []) {
        const emp = (d as any).employee
        const inc = (d as any).incident
        if (!emp || !d.travel_date) continue
        const [bg, text] = employeeColor(emp.name)
        const start = d.travel_date
        const end = d.check_out_date || d.check_in_date || d.travel_date
        collected.push({
          id: 'dep-' + d.id,
          employee_id: d.employee_id,
          employee_name: emp.name,
          employee_role: emp.role || '',
          type: 'deployment',
          start,
          end,
          label: `🔥 ${inc?.name || 'Deployment'}`,
          color: bg,
          textColor: text,
        })
      }

      setEvents(collected)

      // Build employee list for filter
      const empMap = new Map<string, string>()
      for (const e of collected) empMap.set(e.employee_id, e.employee_name)
      setEmployees(Array.from(empMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)))

      setLoading(false)
    }
    load()
  }, [roleLoading, assignment.loading, isAdmin, year, month])

  // Calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay() // 0=Sun
  const totalDays = lastDay.getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(startPad).fill(null)
  for (let d = 1; d <= totalDays; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { weeks.push([...week, ...Array(7 - week.length).fill(null)]) }

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  // Events keyed by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    const filtered = filterEmployee === 'all' ? events : events.filter(e => e.employee_id === filterEmployee)
    for (const ev of filtered) {
      for (const date of datesInRange(ev.start, ev.end)) {
        if (!map.has(date)) map.set(date, [])
        map.get(date)!.push(ev)
      }
    }
    return map
  }, [events, filterEmployee])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const selectedEvents = selectedDay ? (eventsByDate.get(selectedDay) || []) : []
  const todayStr = isoDate(today)

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <div className="min-h-screen bg-gray-950 text-white mt-8 md:mt-0 pb-20">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📅 Coverage Calendar</h1>
            <p className="text-xs text-gray-500 mt-0.5">Deployments, availability, and time-off at a glance</p>
          </div>
          <Link to="/schedule" className="text-xs text-gray-400 hover:text-white transition-colors">
            ← Schedule Requests
          </Link>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
            <button onClick={prevMonth} className="text-gray-400 hover:text-white transition-colors px-1">‹</button>
            <span className="text-sm font-semibold w-36 text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="text-gray-400 hover:text-white transition-colors px-1">›</button>
          </div>

          {/* Today button */}
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(todayStr) }}
            className="text-xs px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-300 transition-colors border border-gray-700">
            Today
          </button>

          {/* Employee filter — admin only */}
          {isAdmin && employees.length > 0 && (
            <select
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              className="text-xs bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-gray-300 focus:outline-none"
            >
              <option value="all">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}

          {/* Legend */}
          <div className="flex gap-3 ml-auto flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-red-900 inline-block" />Time Off</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-green-900 inline-block" />Available</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-blue-800 inline-block" />Deployed</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-3 h-3 rounded-sm bg-gray-700 inline-block" />Pending</span>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-800">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Weeks */}
          {loading ? (
            <div className="py-20 text-center text-gray-600 text-sm">Loading...</div>
          ) : (
            weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-800/50 last:border-b-0">
                {week.map((day, di) => {
                  const dateStr = day ? `${monthStr}-${String(day).padStart(2, '0')}` : null
                  const dayEvents = dateStr ? (eventsByDate.get(dateStr) || []) : []
                  const isToday = dateStr === todayStr
                  const isSelected = dateStr === selectedDay
                  const isPast = dateStr ? dateStr < todayStr : false

                  return (
                    <div
                      key={di}
                      onClick={() => dateStr && setSelectedDay(isSelected ? null : dateStr)}
                      className={`min-h-[80px] p-1.5 border-r border-gray-800/50 last:border-r-0 cursor-pointer transition-colors relative ${
                        !day ? 'bg-gray-950/50' : isPast ? 'hover:bg-gray-800/30' : 'hover:bg-gray-800/50'
                      } ${isSelected ? 'bg-gray-800/70 ring-1 ring-inset ring-red-500' : ''}`}
                    >
                      {day && (
                        <>
                          <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-red-600 text-white' : isPast ? 'text-gray-600' : 'text-gray-300'
                          }`}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map((ev, i) => (
                              <div
                                key={i}
                                className="text-[10px] px-1 py-0.5 rounded truncate font-medium"
                                style={{ backgroundColor: ev.color, color: ev.textColor }}
                              >
                                {ev.label}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-[10px] text-gray-500 px-1">+{dayEvents.length - 3} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Selected day detail panel */}
        {selectedDay && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              <button onClick={() => setSelectedDay(null)} className="text-gray-600 hover:text-gray-300 text-sm">✕</button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-600">No events on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: ev.color + '33', borderLeft: `3px solid ${ev.textColor}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: ev.textColor }}>{ev.employee_name}</p>
                      <p className="text-xs text-gray-400">{ev.employee_role} · {ev.label}</p>
                      {ev.start !== ev.end && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(ev.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                          {new Date(ev.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    {ev.status && (
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold shrink-0 ${
                        ev.status === 'approved' ? 'bg-green-900 text-green-300'
                        : ev.status === 'pending' ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-red-900 text-red-300'
                      }`}>{ev.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
