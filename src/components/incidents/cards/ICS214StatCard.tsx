import { Link } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import type { ICS214Row } from '@/types/incident'

export function ICS214StatCard({
  activeIncidentId,
  ics214Rows,
  effectiveUnitFilter,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  ics214Rows: ICS214Row[]
  effectiveUnitFilter: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const filteredIcs = effectiveUnitFilter === 'All' ? ics214Rows : ics214Rows.filter(r => r.unit_name === effectiveUnitFilter)

  return (
    <StatCard
      title="📋 ICS 214 Logs"
      count={filteredIcs.length}
      viewAllHref={`/ics214?activeIncidentId=${activeIncidentId}`}
      newHref={`/ics214/new?activeIncidentId=${activeIncidentId}`}
      newLabel="+ New 214"
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
    >
      {filteredIcs.length === 0 ? (
        <p className="text-center text-gray-600 text-sm py-4">No 214 logs for this unit/incident</p>
      ) : (
        <>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
            <span className="flex-1 min-w-0">214 ID</span>
            <span className="w-24 shrink-0">Unit</span>
            <span className="w-16 shrink-0 text-right">Status</span>
          </div>
          {filteredIcs.map(row => (
            <Link
              key={row.ics214_id}
              to={`/ics214/${row.ics214_id}`}
              className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
            >
              <span className="flex-1 min-w-0 font-mono text-xs text-gray-300 truncate pr-1">{row.ics214_id}</span>
              <span className="w-24 shrink-0 text-gray-400 text-xs truncate">{row.unit_name}</span>
              <span className={`w-16 shrink-0 text-right text-xs font-semibold ${
                row.status === 'Open' ? 'text-green-400' : 'text-gray-500'
              }`}>{row.status}</span>
            </Link>
          ))}
        </>
      )}
    </StatCard>
  )
}
