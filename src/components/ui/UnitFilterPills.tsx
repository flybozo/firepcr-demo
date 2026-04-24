import { sortUnitNames, unitFilterButtonClass } from '@/lib/unitColors'

interface UnitFilterPillsProps {
  units: string[]
  selected: string
  onSelect: (unit: string) => void
  unitTypeMap?: Record<string, string>
  includeAll?: boolean
  className?: string
}

export default function UnitFilterPills({
  units,
  selected,
  onSelect,
  unitTypeMap = {},
  includeAll = true,
  className,
}: UnitFilterPillsProps) {
  const getType = (name: string) => unitTypeMap[name] || ''
  const sorted = sortUnitNames(units.filter(u => u !== 'All'), getType)
  const opts = includeAll ? ['All', ...sorted] : sorted

  return (
    <>
      <div className={`hidden md:flex gap-1.5 overflow-x-auto pb-1${className ? ' ' + className : ''}`}>
        {opts.map(u => (
          <button
            key={u}
            onClick={() => onSelect(u)}
            className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              unitFilterButtonClass(u === 'All' ? 'All' : getType(u), selected === u)
            }`}
          >
            {u}
          </button>
        ))}
      </div>
      <select
        value={selected}
        onChange={e => onSelect(e.target.value)}
        className={`md:hidden w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500${className ? ' ' + className : ''}`}
      >
        {opts.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </>
  )
}
