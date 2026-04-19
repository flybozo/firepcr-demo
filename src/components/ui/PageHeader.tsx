/**
 * PageHeader — consistent page title, subtitle, and optional action buttons.
 */
type Props = {
  /** Page title */
  title: string
  /** Subtitle / count text */
  subtitle?: string
  /** Action buttons (rendered on the right) */
  actions?: React.ReactNode
  /** Back link (rendered above title) */
  backHref?: string
  /** Back link text */
  backLabel?: string
  /** Additional className */
  className?: string
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel = '← Back',
  className = '',
}: Props) {
  return (
    <div className={`pt-2 ${className}`}>
      {backHref && (
        <a href={backHref} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          {backLabel}
        </a>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-gray-500 text-xs">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
