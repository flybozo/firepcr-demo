/**
 * StatCard — a compact metric display card.
 * Renders a big number + label, optionally linked.
 */
import { Link } from 'react-router-dom'

type Props = {
  /** The main metric value */
  value: number | string
  /** Label text below the value */
  label: string
  /** Color class for the value (e.g. 'text-blue-400') */
  color?: string
  /** Optional link target */
  href?: string
  /** Optional icon/emoji before the label */
  icon?: string
}

export default function StatCard({ value, label, color = 'text-white', href, icon }: Props) {
  const inner = (
    <>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1 leading-tight">
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </p>
    </>
  )

  const cls = 'theme-card rounded-xl p-4 border hover:border-gray-600 transition-colors text-center'

  if (href) {
    return <Link to={href} className={cls}>{inner}</Link>
  }
  return <div className={cls}>{inner}</div>
}
