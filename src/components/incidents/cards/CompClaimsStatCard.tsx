import { Link } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import type { CompClaimRow } from '@/types/incident'

export function CompClaimsStatCard({
  activeIncidentId,
  compRows,
  compCount,
  effectiveUnitFilter,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  compRows: CompClaimRow[]
  compCount: number
  effectiveUnitFilter: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const filteredComps = effectiveUnitFilter === 'All' ? compRows : compRows.filter(c => c.unit === effectiveUnitFilter)

  return (
    <StatCard
      title="⚠️ Comp Claims"
      count={compCount}
      viewAllHref={`/comp-claims?activeIncidentId=${activeIncidentId}`}
      newHref={`/comp-claims/new?activeIncidentId=${activeIncidentId}`}
      newLabel="+ New Claim"
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
      expandedChildren={
        filteredComps.length > 0 ? (
          <>
            <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
              <span className="w-24 shrink-0">Date</span>
              <span className="flex-1 min-w-0">Patient</span>
              <span className="w-20 shrink-0">Unit</span>
              <span className="w-20 shrink-0">Injury</span>
              <span className="w-10 shrink-0 text-right">PDF</span>
            </div>
            {filteredComps.map(c => (
              <Link key={c.id} to={`/comp-claims?activeIncidentId=${activeIncidentId}`}
                className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm">
                <span className="w-24 shrink-0 text-gray-400 text-xs">{c.date_of_injury || '—'}</span>
                <span className="flex-1 min-w-0 truncate pr-1 text-xs text-white">{c.patient_name || '—'}</span>
                <span className="w-20 shrink-0 text-xs text-gray-400">{c.unit || '—'}</span>
                <span className="w-20 shrink-0 text-xs text-gray-400 truncate">{c.injury_type || '—'}</span>
                <span className="w-10 shrink-0 text-right text-xs">{c.pdf_url ? '📄' : '⚠️'}</span>
              </Link>
            ))}
          </>
        ) : undefined
      }
    >
      {filteredComps.length > 0 ? (
        <>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
            <span className="w-24 shrink-0">Date</span>
            <span className="flex-1 min-w-0">Patient</span>
            <span className="w-10 shrink-0 text-right">PDF</span>
          </div>
          {filteredComps.slice(0, 5).map(c => (
            <Link key={c.id} to={`/comp-claims?activeIncidentId=${activeIncidentId}`}
              className="flex items-center px-4 py-2 hover:bg-gray-800/50 transition-colors text-sm">
              <span className="w-24 shrink-0 text-gray-400 text-xs">{c.date_of_injury || '—'}</span>
              <span className="flex-1 min-w-0 truncate pr-1 text-xs text-white">{c.patient_name || '—'}</span>
              <span className="w-10 shrink-0 text-right text-xs">{c.pdf_url ? '📄' : '⚠️'}</span>
            </Link>
          ))}
        </>
      ) : (
        <p className="text-center text-gray-600 text-sm py-4">No claims filed</p>
      )}
    </StatCard>
  )
}
