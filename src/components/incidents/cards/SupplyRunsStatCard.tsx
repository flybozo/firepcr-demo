import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import type { SupplyRunRow } from '@/types/incident'

export function SupplyRunsStatCard({
  activeIncidentId,
  supplyRuns,
  supplyCount,
  effectiveUnitFilter,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  supplyRuns: SupplyRunRow[]
  supplyCount: number
  effectiveUnitFilter: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const filtered = supplyRuns.filter(sr =>
    effectiveUnitFilter === 'All' || (sr.incident_unit as any)?.unit?.name === effectiveUnitFilter
  )

  return (
    <StatCard
      title="Supply Runs"
      count={supplyCount}
      viewAllHref={`/supply-runs?activeIncidentId=${activeIncidentId}`}
      newHref={`/supply-runs/new?activeIncidentId=${activeIncidentId}`}
      newLabel="+ New Run"
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
    >
      {filtered.length > 0 ? (
        <>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
            <span className="w-24 shrink-0">Date</span>
            <span className="flex-1 min-w-0">Unit</span>
            <span className="w-16 shrink-0 text-right">Items</span>
          </div>
          {(expanded ? filtered : filtered.slice(0, 5)).map(sr => (
            <Link
              key={sr.id}
              to={`/supply-runs/${sr.id}`}
              className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm"
            >
              <span className="w-24 shrink-0 text-gray-400 text-xs">{sr.run_date || '—'}</span>
              <span className="flex-1 min-w-0 truncate pr-1 text-xs">
                {(sr.incident_unit as unknown as { unit?: { name?: string } } | null)?.unit?.name || '—'}
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-gray-400">{sr.item_count ?? 0}</span>
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
        <p className="text-center text-gray-600 text-sm py-4">No supply runs</p>
      )}
    </StatCard>
  )
}
