
type Props = {
  activeTypes: string[]
  units: string[]
  activeUnit: string
  onTypesChange: (types: string[]) => void
  onUnitChange: (unit: string) => void
  isExternal?: boolean
}

type FilterGroup = { label: string; icon: string; types: string[] }

const TYPE_GROUPS: FilterGroup[] = [
  { label: 'Patients', icon: '🩺', types: ['encounter_new', 'pcr_signed'] },
  { label: 'ICS 214', icon: '📋', types: ['ics214_activity', 'ics214_signed'] },
  { label: 'Meds', icon: '💊', types: ['med_admin'] },
  { label: 'Supply', icon: '📦', types: ['supply_run'] },
  { label: 'Claims', icon: '⚠️', types: ['comp_claim'] },
]

export function TimelineFilters({ activeTypes, units, activeUnit, onTypesChange, onUnitChange, isExternal }: Props) {
  const allActive = activeTypes.length === 0

  const toggleGroup = (types: string[]) => {
    const allSelected = types.every(t => activeTypes.includes(t))
    if (allActive) {
      // Was showing all — now exclude this group (show all except these)
      const all = TYPE_GROUPS.flatMap(g => g.types)
      onTypesChange(all.filter(t => !types.includes(t)))
    } else if (allSelected) {
      // Deselect this group
      const next = activeTypes.filter(t => !types.includes(t))
      onTypesChange(next)
    } else {
      // Add these types to selection
      const next = Array.from(new Set([...activeTypes, ...types]))
      onTypesChange(next)
    }
  }

  const isGroupActive = (types: string[]) => {
    if (allActive) return false
    return types.some(t => activeTypes.includes(t))
  }

  return (
    <div className="space-y-2">
      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onTypesChange([])}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
            allActive
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {TYPE_GROUPS.map(g => (
          <button
            key={g.label}
            onClick={() => toggleGroup(g.types)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              isGroupActive(g.types)
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
            }`}
          >
            {g.icon} {g.label}
          </button>
        ))}
      </div>

      {/* Unit filter pills */}
      {units.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-600 self-center mr-1">Unit:</span>
          {['All', ...units].map(u => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                activeUnit === u
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
