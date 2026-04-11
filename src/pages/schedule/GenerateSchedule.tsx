

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/lib/useRole'
import { useUserAssignment } from '@/lib/useUserAssignment'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

type ScheduleEntry = {
  unit_id: string
  unit_name: string
  employee_id: string
  employee_name: string
  role: string
  experience_level: number
  start_date: string
  end_date: string
}

type InServiceUnit = {
  id: string
  name: string
  unit_type: { name: string } | null
}

type Employee = {
  id: string
  name: string
  role: string
}

const inputCls = 'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 border border-gray-700'
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-gray-400 mb-1'

function expStars(level: number) {
  return '⭐'.repeat(Math.max(1, Math.min(3, level)))
}

const UNIT_TYPE_BG: Record<string, string> = {
  'Ambulance': 'bg-red-900/40 border-red-800',
  'Med Unit':  'bg-blue-900/40 border-blue-800',
  'REMS':      'bg-green-900/40 border-green-800',
  'Warehouse': 'bg-purple-900/40 border-purple-800',
}

export default function GenerateSchedulePage() {
  const supabase = createClient()
  const { isAdmin, loading: roleLoading } = useRole()
  const assignment = useUserAssignment()
  const navigate = useNavigate()

  const [units, setUnits] = useState<InServiceUnit[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [error, setError] = useState('')
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    // Default to next 2 weeks
    const today = new Date()
    const twoWeeks = new Date(today)
    twoWeeks.setDate(today.getDate() + 14)
    setStartDate(today.toISOString().split('T')[0])
    setEndDate(twoWeeks.toISOString().split('T')[0])

    const load = async () => {
      const [{ data: unitData }, { data: empData }] = await Promise.all([
        supabase
          .from('units')
          .select('id, name, unit_type:unit_types(name)')
          .eq('active', true)
          .eq('unit_status', 'in_service')
          .order('name'),
        supabase
          .from('employees')
          .select('id, name, role')
          .eq('status', 'Active')
          .order('name'),
      ])
      setUnits((unitData || []) as unknown as InServiceUnit[])
      setAllEmployees((empData || []) as unknown as Employee[])
    }
    load()
  }, [])

  if (!roleLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-gray-400 text-sm">Schedule generation is restricted to admins.</p>
          <Link to="/schedule" className="mt-4 inline-block text-red-400 hover:text-red-300 text-sm">← Back to Schedule</Link>
        </div>
      </div>
    )
  }

  const toggleUnit = (id: string) => {
    setSelectedUnits(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerate = async () => {
    if (!startDate || !endDate) { setError('Please select start and end dates.'); return }
    if (selectedUnits.size === 0) { setError('Please select at least one unit.'); return }
    setError('')
    setGenerating(true)
    setSchedule([])
    setApproved(false)

    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          unit_ids: Array.from(selectedUnits),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Failed to generate schedule')
      } else {
        setSchedule(data.schedule || [])
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
    }
    setGenerating(false)
  }

  const swapEmployee = (entryIndex: number, newEmployeeId: string) => {
    const emp = allEmployees.find(e => e.id === newEmployeeId)
    if (!emp) return
    setSchedule(prev => prev.map((entry, i) =>
      i === entryIndex
        ? { ...entry, employee_id: emp.id, employee_name: emp.name, role: emp.role }
        : entry
    ))
  }

  const handleApprove = async () => {
    if (!schedule.length) return
    setApproving(true)

    try {
      // Save to generated_schedules
      const { data: genSchedule, error: gsErr } = await supabase
        .from('generated_schedules')
        .insert({
          created_by: assignment.employee?.name || 'Admin',
          start_date: startDate,
          end_date: endDate,
          status: 'approved',
          schedule_data: schedule,
          approved_at: new Date().toISOString(),
          approved_by: assignment.employee?.name || 'Admin',
        })
        .select('id')
        .single()

      if (gsErr) throw new Error(gsErr.message)

      // Write deployment_records
      const deployments = schedule.map(entry => ({
        employee_id: entry.employee_id,
        unit_id: entry.unit_id,
        start_date: entry.start_date,
        end_date: entry.end_date,
        generated_schedule_id: genSchedule?.id || null,
      }))

      const { error: drErr } = await supabase.from('deployment_records').insert(deployments)
      if (drErr) throw new Error(drErr.message)

      setApproved(true)
    } catch (e: any) {
      setError(e.message || 'Failed to approve schedule')
    }
    setApproving(false)
  }

  // Group schedule by unit for display
  const scheduleByUnit = schedule.reduce((acc, entry) => {
    if (!acc[entry.unit_id]) acc[entry.unit_id] = { unit_name: entry.unit_name, entries: [] }
    acc[entry.unit_id].entries.push(entry)
    return acc
  }, {} as Record<string, { unit_name: string; entries: ScheduleEntry[] }>)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20 mt-8 md:mt-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">⚡ Generate Schedule</h1>
            <p className="text-xs text-gray-500 mt-1">AI-powered crew scheduling for selected units and date range.</p>
          </div>
          <Link to="/schedule" className="text-gray-500 hover:text-white text-sm transition-colors">← Schedule</Link>
        </div>

        {/* Config panel */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Schedule Parameters</h2>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>End Date *</label>
              <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Unit selector */}
          <div>
            <label className={labelCls}>Units (in-service only) *</label>
            {units.length === 0 ? (
              <p className="text-gray-600 text-sm">No in-service units found.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                {units.map(unit => {
                  const typeName = (unit.unit_type as any)?.name || ''
                  const bgCls = UNIT_TYPE_BG[typeName] || 'bg-gray-800 border-gray-700'
                  const checked = selectedUnits.has(unit.id)
                  return (
                    <label key={unit.id}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        checked ? bgCls : 'bg-gray-800 border-gray-700 opacity-60 hover:opacity-100'
                      }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUnit(unit.id)}
                        className="accent-red-500"
                      />
                      <span className="text-sm font-medium truncate">{unit.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{typeName}</span>
                    </label>
                  )
                })}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={() => setSelectedUnits(new Set(units.map(u => u.id)))}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Select All</button>
              <span className="text-gray-700">·</span>
              <button onClick={() => setSelectedUnits(new Set())}
                className="text-xs text-gray-500 hover:text-gray-400 transition-colors">Clear</button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={generating || selectedUnits.size === 0}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="animate-spin">⚙</span>
                Generating with AI...
              </>
            ) : (
              '⚡ Generate Schedule'
            )}
          </button>
        </div>

        {/* Generated schedule */}
        {schedule.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
                Generated Schedule
                <span className="ml-2 text-gray-600 font-normal normal-case">({schedule.length} assignments)</span>
              </h2>
              {approved ? (
                <span className="px-3 py-1.5 bg-green-800 text-green-200 rounded-lg text-sm font-semibold">
                  ✅ Approved & Saved
                </span>
              ) : (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="px-4 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {approving ? 'Saving...' : '✅ Approve Schedule'}
                </button>
              )}
            </div>

            {Object.entries(scheduleByUnit).map(([unitId, { unit_name, entries }]) => {
              const unitObj = units.find(u => u.id === unitId)
              const typeName = (unitObj?.unit_type as any)?.name || ''
              const bgCls = UNIT_TYPE_BG[typeName] || 'bg-gray-800 border-gray-700'
              return (
                <div key={unitId} className={`rounded-xl border overflow-hidden ${bgCls}`}>
                  <div className="px-4 py-2.5 border-b border-white/10">
                    <h3 className="font-semibold text-sm">{unit_name}</h3>
                    <p className="text-xs text-gray-400">{typeName} · {entries.length} crew member{entries.length !== 1 ? 's' : ''}</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-white/10">
                        <th className="px-4 py-2 text-left">Employee</th>
                        <th className="px-4 py-2 text-left">Role</th>
                        <th className="px-4 py-2 text-left hidden md:table-cell">Dates</th>
                        <th className="px-4 py-2 text-left">Exp.</th>
                        {!approved && <th className="px-4 py-2 text-left">Swap</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, i) => {
                        const globalIdx = schedule.indexOf(entry)
                        return (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2.5 font-medium">{entry.employee_name}</td>
                            <td className="px-4 py-2.5 text-gray-400">{entry.role}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs hidden md:table-cell">
                              {entry.start_date} → {entry.end_date}
                            </td>
                            <td className="px-4 py-2.5 text-sm">{expStars(entry.experience_level)}</td>
                            {!approved && (
                              <td className="px-4 py-2.5">
                                <select
                                  value={entry.employee_id}
                                  onChange={e => swapEmployee(globalIdx, e.target.value)}
                                  className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-600 focus:outline-none focus:border-red-500 max-w-[160px]"
                                >
                                  {allEmployees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                      {emp.name} ({emp.role})
                                    </option>
                                  ))}
                                </select>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}

            {!approved && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="w-full py-3 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
              >
                {approving ? 'Saving to deployment records...' : '✅ Approve & Save to Deployment Records'}
              </button>
            )}

            {approved && (
              <div className="bg-green-900/40 border border-green-800 rounded-xl p-4 text-center">
                <p className="text-green-300 font-semibold">✅ Schedule approved and saved!</p>
                <p className="text-gray-400 text-sm mt-1">Deployment records created. View in the Unit Calendar.</p>
                <div className="flex justify-center gap-3 mt-3">
                  <Link to="/schedule" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    View Unit Calendar →
                  </Link>
                  <button onClick={() => { setSchedule([]); setApproved(false) }}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    Generate Another
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
