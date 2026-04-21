import { StatCard } from '@/components/shared/StatCard'

export function BillingSummaryStatCard({
  activeIncidentId,
  billingTotal,
  isAdmin,
  dragHandleProps,
  cycleSpan,
  span,
}: {
  activeIncidentId: string
  billingTotal: number | null
  isAdmin: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  cycleSpan?: () => void
  span?: number
}) {
  if (!isAdmin) return null

  return (
    <StatCard
      title="💰 Billing Summary"
      count={billingTotal != null
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(billingTotal)
        : '…'}
      viewAllHref={`/billing?activeIncidentId=${activeIncidentId}`}
      dragHandleProps={dragHandleProps}
      cycleSpan={cycleSpan}
      span={span}
    >
      <div className="px-4 py-3 text-sm text-gray-400">
        {billingTotal != null ? (
          <p>Total billed cost across supply runs and medications.</p>
        ) : (
          <p className="text-gray-600 text-xs">Calculating...</p>
        )}
      </div>
    </StatCard>
  )
}
