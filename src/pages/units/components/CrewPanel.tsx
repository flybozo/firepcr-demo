import type { IncidentUnit, Employee } from './types'

type Props = {
  activeIU: IncidentUnit
  isAdmin: boolean
  allEmployees: Employee[]
  addingTo: string | null
  selectedEmployee: string
  saving: boolean
  onAddStart: () => void
  onAddCancel: () => void
  onEmployeeSelect: (id: string) => void
  onAddCrew: () => void
  onRemoveCrew: (assignmentId: string) => void
}

export default function CrewPanel({
  activeIU, isAdmin, allEmployees, addingTo, selectedEmployee, saving,
  onAddStart, onAddCancel, onEmployeeSelect, onAddCrew, onRemoveCrew,
}: Props) {
  const activeCrew = activeIU.unit_assignments.filter((ua: any) => !ua.released_at)

  return (
    <div className="theme-card rounded-xl border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Crew</h2>
        {isAdmin && activeCrew.length < 4 ? (
          <button onClick={onAddStart} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
            + Add ({activeCrew.length}/4)
          </button>
        ) : isAdmin ? (
          <span className="text-xs text-gray-600">4/4 full</span>
        ) : null}
      </div>

      <div className="divide-y divide-gray-800">
        {activeCrew.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-600">No crew assigned</p>
        ) : (
          activeCrew.map((ua: any) => (
            <div key={ua.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-gray-700 flex items-center justify-center">
                  {ua.employee?.headshot_url ? (
                    <img src={ua.employee.headshot_url} alt={ua.employee?.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xs font-bold">{(ua.employee?.name || '?').charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{ua.employee?.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{ua.employee?.role || ''}</p>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => onRemoveCrew(ua.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {isAdmin && addingTo === activeIU.id && (
        <div className="px-4 py-3 border-t border-gray-700 space-y-2">
          <select value={selectedEmployee} onChange={e => onEmployeeSelect(e.target.value)}
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
            <option value="">Select crew member...</option>
            {allEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={onAddCrew} disabled={saving || !selectedEmployee}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition-colors">
              Add
            </button>
            <button onClick={onAddCancel} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
