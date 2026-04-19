/**
 * EmptyState — consistent empty/no-data display.
 * Use when a list or section has no items to show.
 */
import { Link } from 'react-router-dom'

type Props = {
  /** Large emoji/icon */
  icon?: string
  /** Main message */
  message: string
  /** Subtitle / hint text */
  subtitle?: string
  /** Optional CTA link */
  actionHref?: string
  /** CTA link text */
  actionLabel?: string
  /** Padding class override */
  className?: string
}

export default function EmptyState({
  icon,
  message,
  subtitle,
  actionHref,
  actionLabel,
  className = 'py-12',
}: Props) {
  return (
    <div className={`text-center text-gray-500 ${className}`}>
      {icon && <p className="text-4xl mb-4">{icon}</p>}
      <p>{message}</p>
      {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
      {actionHref && actionLabel && (
        <Link to={actionHref} className="text-red-400 underline text-sm mt-2 block">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
