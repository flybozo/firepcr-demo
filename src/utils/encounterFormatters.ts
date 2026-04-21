export function acuityColor(acuity: string | null): string {
  if (!acuity) return 'bg-gray-700 text-gray-400'
  if (acuity.startsWith('Green') || acuity.startsWith('Lower')) return 'bg-green-900 text-green-300'
  if (acuity.startsWith('Yellow') || acuity.startsWith('Emergent')) return 'bg-yellow-900 text-yellow-300'
  if (acuity.startsWith('Red') || acuity.startsWith('Critical')) return 'bg-red-900 text-red-300'
  if (acuity.startsWith('Black') || acuity.startsWith('Dead')) return 'bg-gray-700 text-gray-300'
  return 'bg-blue-900 text-blue-300'
}

export function acuityLabel(acuity: string | null): string {
  if (!acuity) return '—'
  if (acuity.startsWith('Red') || acuity.startsWith('Critical')) return 'Immediate'
  if (acuity.startsWith('Yellow') || acuity.startsWith('Emergent')) return 'Delayed'
  if (acuity.startsWith('Green') || acuity.startsWith('Lower')) return 'Minor'
  if (acuity.startsWith('Black') || acuity.startsWith('Dead')) return 'Expectant'
  return 'Routine'
}

export function statusColor(status: string | null): string {
  if (status === 'Signed') return 'bg-green-900 text-green-300 border-green-700'
  if (status === 'Complete') return 'bg-blue-900 text-blue-300 border-blue-700'
  return 'bg-gray-800 text-gray-400 border-gray-700'
}

export { formatDateTime, formatTime } from './dateFormatters'

export function dash(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}
