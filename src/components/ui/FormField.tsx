/**
 * FormField — consistent form label + input wrapper.
 * Handles the repeated label/input/error pattern seen across all forms.
 */

type Props = {
  /** Field label text */
  label: string
  /** Whether the field is required (shows * indicator) */
  required?: boolean
  /** Error message */
  error?: string
  /** Hint text below the input */
  hint?: string
  /** Children (the actual input element) */
  children: React.ReactNode
  /** Additional wrapper className */
  className?: string
}

export default function FormField({ label, required, error, hint, children, className = '' }: Props) {
  return (
    <div className={className}>
      <label className="text-xs text-gray-400 block mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

/** Standard input class — use this for consistency */
export const inputCls =
  'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600'

/** Standard select class */
export const selectCls =
  'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500'

/** Standard textarea class */
export const textareaCls =
  'w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 resize-none'
