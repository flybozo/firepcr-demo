import { Link } from 'react-router-dom'
import { StatCard } from '@/components/shared/StatCard'
import type { ReorderRow } from '@/types/incident'

export function ReorderStatCard({
  activeIncidentId,
  reorderRows,
  reorderCount,
  effectiveUnitFilter,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  reorderRows: ReorderRow[]
  reorderCount: number | null
  effectiveUnitFilter: string
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  const filteredReorder = effectiveUnitFilter === 'All' ? reorderRows : reorderRows.filter(r => r.unit_name === effectiveUnitFilter)

  return (
    <StatCard
      title="🔄 Reorder Needed"
      count={reorderCount ?? '…'}
      viewAllHref={`/inventory/reorder?activeIncidentId=${activeIncidentId}`}
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
      expandedChildren={
        filteredReorder.length > 0 ? (
          <>
            <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
              <span className="flex-1 min-w-0">Item</span>
              <span className="w-20 shrink-0">Unit</span>
              <span className="w-14 shrink-0 text-right">Qty</span>
              <span className="w-14 shrink-0 text-right">Par</span>
            </div>
            {filteredReorder.map(r => (
              <Link key={r.id} to={`/inventory/${r.id}`} className="flex items-center px-4 py-1.5 text-xs hover:bg-gray-800/50 transition-colors cursor-pointer">
                <span className="flex-1 min-w-0 truncate pr-1 text-white hover:text-blue-400 transition-colors">{r.item_name}</span>
                <span className="w-20 shrink-0 text-gray-400">{r.unit_name}</span>
                <span className={`w-14 shrink-0 text-right font-medium ${r.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}`}>{r.quantity}</span>
                <span className="w-14 shrink-0 text-right text-gray-500">{r.par_qty}</span>
              </Link>
            ))}
          </>
        ) : undefined
      }
    >
      {filteredReorder.length > 0 ? (
        <>
          <div className="flex items-center px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 theme-card-footer">
            <span className="flex-1 min-w-0">Item</span>
            <span className="w-14 shrink-0 text-right">Qty</span>
            <span className="w-14 shrink-0 text-right">Par</span>
          </div>
          {filteredReorder.slice(0, 5).map(r => (
            <Link key={r.id} to={`/inventory/${r.id}`} className="flex items-center px-4 py-1.5 text-xs hover:bg-gray-800/50 transition-colors cursor-pointer">
              <span className="flex-1 min-w-0 truncate pr-1 text-white hover:text-blue-400 transition-colors">{r.item_name}</span>
              <span className={`w-14 shrink-0 text-right font-medium ${r.quantity === 0 ? 'text-red-400' : 'text-yellow-400'}`}>{r.quantity}</span>
              <span className="w-14 shrink-0 text-right text-gray-500">{r.par_qty}</span>
            </Link>
          ))}
        </>
      ) : (
        <div className="px-4 py-3 text-sm text-gray-400">
          {reorderCount != null ? (
            reorderCount === 0
              ? <p className="text-green-400 text-xs">All items at or above par. ✓</p>
              : <p className="text-xs">{reorderCount} item{reorderCount !== 1 ? 's' : ''} at or below par. Expand to see details.</p>
          ) : (
            <p className="text-gray-600 text-xs">Calculating...</p>
          )}
        </div>
      )}
    </StatCard>
  )
}
