export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

type Listener = (toasts: ToastMessage[]) => void

let _toasts: ToastMessage[] = []
const _listeners = new Set<Listener>()

function _notify() {
  _listeners.forEach(l => l([..._toasts]))
}

function _add(message: string, variant: ToastVariant, duration = 4000) {
  const id = crypto.randomUUID()
  _toasts = [..._toasts, { id, message, variant, duration }]
  _notify()
  setTimeout(() => _remove(id), duration)
}

function _remove(id: string) {
  _toasts = _toasts.filter(t => t.id !== id)
  _notify()
}

export function subscribe(listener: Listener) {
  _listeners.add(listener)
  listener([..._toasts])
  return () => { _listeners.delete(listener) }
}

export const toast = {
  success: (message: string, duration?: number) => _add(message, 'success', duration),
  error:   (message: string, duration?: number) => _add(message, 'error', duration),
  warning: (message: string, duration?: number) => _add(message, 'warning', duration),
  info:    (message: string, duration?: number) => _add(message, 'info', duration),
  dismiss: _remove,
}
