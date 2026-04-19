/**
 * SectionCard — the repeated pattern of a card with a header bar + content area.
 * Used throughout the app for grouped sections (inventory, crew, documents, etc.).
 */

type Props = {
  /** Section title (uppercase tracking in header) */
  title: string
  /** Optional right-side header content (count, link, button) */
  headerRight?: React.ReactNode
  /** Card body content */
  children: React.ReactNode
  /** Whether to pad the body (default: false — most use divide-y lists) */
  padBody?: boolean
  /** Additional wrapper className */
  className?: string
}

export default function SectionCard({ title, headerRight, children, padBody = false, className = '' }: Props) {
  return (
    <div className={`theme-card rounded-xl border overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
        {headerRight}
      </div>
      {padBody ? (
        <div className="p-4">{children}</div>
      ) : (
        children
      )}
    </div>
  )
}
