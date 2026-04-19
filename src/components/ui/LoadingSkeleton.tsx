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
  /** Custom message text */
  message?: string
}

export default function LoadingSkeleton({ rows = 3, header = false, fullPage = false, message }: Props) {
  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin mb-4" />
        {message && <p className="text-sm">{message}</p>}
      </div>
    )
  }

  return (
    <div className="animate-pulse space-y-3 p-4">
      {header && (
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-800 rounded w-48" />
          <div className="h-8 bg-gray-800 rounded w-20" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-4 bg-gray-800 rounded flex-1" />
          <div className="h-4 bg-gray-800 rounded w-24" />
          <div className="h-4 bg-gray-800 rounded w-16" />
        </div>
      ))}
    </div>
  )
}
