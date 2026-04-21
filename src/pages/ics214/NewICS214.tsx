import { brand } from '@/lib/branding.config'
import { LoadingSkeleton } from '@/components/ui'
import { Link } from 'react-router-dom'
import { useICS214Form } from './useICS214Form'

export default function NewICS214Page() {
  const {
    assignment, units, incidents, crew, allEmployees,
    setCrew, unitId, unitName,
    incidentId, incidentName,
    opDate, setOpDate, shift, setShift, opStart, setOpStart, opEnd, setOpEnd,
    leaderName, setLeaderName, leaderPosition, setLeaderPosition,
    notes, setNotes, initialActivity, setInitialActivity,
    submitting, error, isAdminOverride, isAdmin,
    handleUnitChange, handleIncidentChange, handleSubmit, roleToICSPosition,
  } = useICS214Form()

  if (assignment.loading) {
    return <LoadingSkeleton fullPage />
  }

  return (
    <div className="bg-gray-950 text-white pb-8">
      <div className="max-w-lg mx-auto p-4 md:p-6">

        <div className="flex items-center gap-3 mb-6 pt-2">
          <Link to="/ics214" className="text-gray-500 hover:text-white text-sm">← ICS 214 Logs</Link>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 text-sm">New ICS 214</span>
        </div>

        <h1 className="text-xl font-bold mb-6">Start New ICS 214</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Unit */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Unit <span className="text-red-500">*</span>
            </label>
            {unitId && !isAdmin ? (
              <div className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 flex items-center justify-between">
                <span>{unitName}</span>
                <button type="button" onClick={() => { handleUnitChange('') }}
                  className="text-xs text-gray-500 hover:text-gray-300 ml-2">× change</button>
              </div>
            ) : (
              <select
                value={unitId}
                onChange={e => handleUnitChange(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select unit...</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Incident */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Incident <span className="text-red-500">*</span>
            </label>
            {incidentId && !isAdmin ? (
              <div className="w-full bg-gray-800/50 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 flex items-center justify-between">
                <span>{incidentName}</span>
                <button type="button" onClick={() => handleIncidentChange('')}
                  className="text-xs text-gray-500 hover:text-gray-300 ml-2">× change</button>
              </div>
            ) : (
              <select
                value={incidentId}
                onChange={e => handleIncidentChange(e.target.value)}
                required
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select incident...</option>
                {incidents.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            )}
          </div>

          {isAdmin && isAdminOverride && (
            <div className="bg-amber-950/60 border border-amber-700 rounded-lg px-3 py-2 text-amber-400 text-xs">
              ⚠️ Admin override — for backdated 214s. Unit and incident auto-suggested but can be changed freely.
            </div>
          )}

          {/* Op Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Operational Period Date
            </label>
            <input
              type="date"
              value={opDate}
              onChange={e => setOpDate(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Shift toggle + times */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Shift
            </label>
            <div className="flex gap-2 mb-3">
              {(['day', 'night'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShift(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    shift === s
                      ? s === 'day' ? 'bg-yellow-600 text-white' : 'bg-indigo-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s === 'day' ? '☀️ Day' : '🌙 Night'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                <input
                  type="time"
                  value={opStart}
                  onChange={e => setOpStart(e.target.value)}
                  className="w-full min-w-0 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs text-gray-500 mb-1">End Time</label>
                <input
                  type="time"
                  value={opEnd}
                  onChange={e => setOpEnd(e.target.value)}
                  className="w-full min-w-0 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Assigned Personnel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Assigned Personnel (Section 6)
              </label>
              {unitId && (
                <span className="text-xs text-gray-500">
                  {crew.length > 0 ? `${crew.length} from roster` : 'None assigned to unit'}
                </span>
              )}
            </div>
            {crew.length > 0 && (
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 divide-y divide-gray-700/50 mb-2">
                {crew.map((emp, i) => (
                  <div key={emp.id} className="flex items-center px-3 py-2 text-sm gap-3">
                    <span className="flex-1 text-white">{emp.name}</span>
                    <span className="text-gray-500 text-xs w-28 truncate">{emp.role || '—'}</span>
                    <span className="text-gray-600 text-xs w-32 truncate">{brand.companyName}</span>
                    <button type="button" onClick={() => setCrew(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition-colors">✕</button>
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const crewIds = new Set(crew.map(c => c.id))
              const available = allEmployees.filter((e: any) => !crewIds.has(e.id))
              return (
                <div className="flex gap-2 items-center">
                  <select
                    id="extraPersonSelect"
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:ring-1 focus:ring-red-500"
                    defaultValue=""
                  >
                    <option value="">Add person from roster...</option>
                    {available.map((e: any) => (
                      <option key={e.id} value={e.id} data-name={e.name} data-role={e.role}>
                        {e.name} — {e.role}
                      </option>
                    ))}
                  </select>
                  <button type="button"
                    onClick={() => {
                      const sel = document.getElementById('extraPersonSelect') as HTMLSelectElement
                      const opt = sel?.selectedOptions[0]
                      if (!opt?.value) return
                      setCrew(prev => [...prev, { id: opt.value, name: opt.getAttribute('data-name') || '', role: opt.getAttribute('data-role') || '' }])
                      sel.value = ''
                    }}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap">
                    + Add
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Unit Leader */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Unit Leader Name
            </label>
            {crew.length > 0 ? (
              <select
                value={leaderName}
                onChange={e => {
                  setLeaderName(e.target.value)
                  const emp = crew.find(c => c.name === e.target.value)
                  if (emp?.role) setLeaderPosition(roleToICSPosition(emp.role))
                }}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select leader...</option>
                {crew.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} — {emp.role}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={leaderName}
                onChange={e => setLeaderName(e.target.value)}
                placeholder="Leader name"
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            )}
          </div>

          {/* ICS Position */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Leader ICS Position
            </label>
            <input
              type="text"
              value={leaderPosition}
              onChange={e => setLeaderPosition(e.target.value)}
              placeholder="e.g. EMS Supervisor, Medical Unit Leader"
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Initial Activity */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Initial Activity <span className="text-red-500">*</span>
            </label>
            <textarea
              value={initialActivity}
              onChange={e => setInitialActivity(e.target.value)}
              required
              rows={3}
              placeholder="Arrived on scene. Established operations. Briefed crew on assignments."
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
            {submitting ? 'Creating ICS 214...' : 'Start ICS 214 Log'}
          </button>
          <div className="h-20 md:hidden" />
        </form>

      </div>
    </div>
  )
}
