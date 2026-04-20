import { useState, useEffect } from 'react'
import { subscribe, toast as _toast, type ToastMessage } from '@/lib/toast'

const VARIANT = {
  success: { bar: 'border-l-green-500', icon: '✓', color: 'text-green-400' },
  error:   { bar: 'border-l-red-500',   icon: '✕', color: 'text-red-400'   },
  warning: { bar: 'border-l-amber-500', icon: '!', color: 'text-amber-400' },
  info:    { bar: 'border-l-blue-500',  icon: 'i', color: 'text-blue-400'  },
} as const

function ToastItem({ t, onDismiss }: { t: ToastMessage; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const v = VARIANT[t.variant]

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className={`flex items-start gap-3 bg-gray-900 border border-gray-700 border-l-4 ${v.bar} rounded-xl px-4 py-3 shadow-lg min-w-[280px] max-w-sm transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <span className={`shrink-0 mt-0.5 text-sm font-bold ${v.color}`}>{v.icon}</span>
      <p className="flex-1 text-sm text-gray-100 leading-snug">{t.message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-gray-500 hover:text-gray-300 text-xl leading-none mt-[-2px] transition-colors"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => subscribe(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem t={t} onDismiss={() => _toast.dismiss(t.id)} />
        </div>
      ))}
    </div>
  )
}
