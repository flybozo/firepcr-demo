import type { DateRange } from './analyticsTypes'

export function DatePills({ range, setRange }: { range: DateRange; setRange: (r: DateRange) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {(['7d', '30d', '90d', 'all'] as DateRange[]).map(r => (
        <button
          key={r}
          onClick={() => setRange(r)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            range === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {r === 'all' ? 'All Time' : `Last ${r.replace('d', 'd')}`}
        </button>
      ))}
    </div>
  )
}
