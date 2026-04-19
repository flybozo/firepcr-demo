/**
 * ConfirmDialog — theme-aware replacement for window.confirm().
 * Renders a modal overlay with a message, cancel, and confirm buttons.
 */
type Props = {
  /** Whether to show the dialog */
  open: boolean
  /** Title text */
  title: string
  /** Body message (supports JSX) */
  message: React.ReactNode
  /** Confirm button label (default: "Confirm") */
  confirmLabel?: string
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string
  /** Confirm button color (default: bg-red-600) */
  confirmColor?: string
  /** Icon/emoji shown next to title */
  icon?: string
  /** Whether confirm action is in progress */
  loading?: boolean
  /** Called when user confirms */
  onConfirm: () => void
  /** Called when user cancels */
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'bg-red-600 hover:bg-red-700',
  icon = '⚠️',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {icon && <span className="text-2xl shrink-0">{icon}</span>}
          <div>
            <h3 className="font-bold text-white">{title}</h3>
            <div className="text-gray-300 text-sm mt-1">{message}</div>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 ${confirmColor} disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
