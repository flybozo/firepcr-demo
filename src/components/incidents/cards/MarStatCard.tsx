import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import type { MARRow } from '@/types/incident'
import { fmtDateCompact, fmtTimeCompact24 } from '@/utils/dateFormatters'

export function MarStatCard({
  activeIncidentId,
  marEntries,
  marCount,
  isAdmin,
  unitFilter,
  assignment,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  marEntries: MARRow[]
  marCount: number
  isAdmin: boolean
  unitFilter: string
  assignment: { unit?: { name?: string | null } | null }
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const filtered = marEntries.filter(e => {
    if (isAdmin) return unitFilter === 'All' || e.med_unit === unitFilter
    return e.med_unit === assignment.unit?.name
  })

  return (
    <StatCard
      title="💊 Medication Administration"
      count={marCount}
      viewAllHref={`/mar?activeIncidentId=${activeIncidentId}`}
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
    >
      {filtered.length > 0 ? (
        <>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer gap-2">
            <span className="w-14 shrink-0">Date</span>
            <span className="w-12 shrink-0">Time</span>
            <span className="flex-1 min-w-0">Med</span>
            <span className="w-20 shrink-0 text-right">Unit</span>
          </div>
          {(expanded ? filtered : filtered.slice(0, 5)).map(entry => (
            <Link
              key={entry.id}
              to={`/mar/${entry.id}`}
              className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm gap-2"
            >
              <span className="w-14 shrink-0 text-gray-400 text-xs">{fmtDateCompact(entry.date)}</span>
              <span className="w-12 shrink-0 text-gray-400 text-xs">{fmtTimeCompact24((entry as any).time)}</span>
              <span className="flex-1 min-w-0 truncate pr-1">{entry.item_name || '—'}</span>
              <span className="w-20 shrink-0 text-right text-xs text-gray-400 truncate">{entry.med_unit || '—'}</span>
            </Link>
          ))}
          {!expanded && filtered.length > 5 && (
            <button onClick={() => setExpanded(true)}
              className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
              Show {filtered.length - 5} more
            </button>
          )}
          {expanded && filtered.length > 5 && (
            <button onClick={() => setExpanded(false)}
              className="w-full py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
              Show less
            </button>
          )}
        </>
      ) : (
        <p className="text-center text-gray-600 text-sm py-4">No MAR entries</p>
      )}
    </StatCard>
  )
}
