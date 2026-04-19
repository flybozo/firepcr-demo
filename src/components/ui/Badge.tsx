/**
 * Badge — small colored pill for status, categories, roles, etc.
 */

type Variant = 'red' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange' | 'gray' | 'indigo' | 'pink'

const variantStyles: Record<Variant, string> = {
  red: 'bg-red-900/60 text-red-300',
  green: 'bg-green-900/60 text-green-300',
  yellow: 'bg-yellow-900/60 text-yellow-300',
  blue: 'bg-blue-900/60 text-blue-300',
  purple: 'bg-purple-900/60 text-purple-300',
  orange: 'bg-orange-900/60 text-orange-300',
  gray: 'bg-gray-700 text-gray-300',
  indigo: 'bg-indigo-900/60 text-indigo-300',
  pink: 'bg-pink-900/60 text-pink-300',
}

type Props = {
  /** Badge text */
  children: React.ReactNode
  /** Color variant */
  variant?: Variant
  /** Size: sm (default), xs */
  size?: 'xs' | 'sm'
  /** Optional dot indicator before text */
  dot?: boolean
  /** Dot color class (e.g. 'bg-green-400') */
  dotColor?: string
}

export default function Badge({
  children,
  variant = 'gray',
  size = 'sm',
  dot = false,
  dotColor = 'bg-green-400',
}: Props) {
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  return (
    <span className={`inline-flex items-center gap-1 rounded font-medium ${sizeClass} ${variantStyles[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      {children}
    </span>
  )
}
