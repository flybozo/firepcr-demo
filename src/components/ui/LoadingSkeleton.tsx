/**
 * LoadingSkeleton — placeholder for loading states.
 * Replace "Loading..." text with animated skeletons.
 */

type Props = {
  /** Number of skeleton rows (default: 3) */
  rows?: number
  /** Whether to show a header skeleton */
  header?: boolean
  /** Full-page centered spinner variant */
  fullPage?: boolean
  /** Panel-level centered spinner (no min-h-screen) */
  panel?: boolean
  /** Custom message text */
  message?: string
}

export default function LoadingSkeleton({ rows = 3, header = false, fullPage = false, panel = false, message }: Props) {
  if (panel) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #dc2626)', borderTopColor: 'transparent' }} />
        {message && <p className="text-xs" style={{ color: 'var(--color-text-muted, #6b7280)' }}>{message}</p>}
      </div>
    )
  }

  if (fullPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ backgroundColor: 'var(--color-page-bg, #030712)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary, #dc2626)', borderTopColor: 'transparent' }} />
        {message && <p className="text-sm" style={{ color: 'var(--color-text-muted, #6b7280)' }}>{message}</p>}
      </div>
    )
  }

  return (
    <div className="animate-pulse space-y-3 p-4">
      {header && (
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 rounded w-48" style={{ backgroundColor: 'var(--color-card-bg, #111827)' }} />
          <div className="h-8 rounded w-20" style={{ backgroundColor: 'var(--color-card-bg, #111827)' }} />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 rounded flex-1" style={{ backgroundColor: 'var(--color-card-bg, #111827)' }} />
          <div className="h-4 rounded w-24" style={{ backgroundColor: 'var(--color-card-bg, #111827)' }} />
          <div className="h-4 rounded w-16" style={{ backgroundColor: 'var(--color-card-bg, #111827)' }} />
        </div>
      ))}
    </div>
  )
}
