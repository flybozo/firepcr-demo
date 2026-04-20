export function calcDays(travelDate: string, checkOutDate: string | null): number {
  const start = new Date(travelDate)
  const end = checkOutDate ? new Date(checkOutDate) : new Date()
  const startMs = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endMs = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.floor((endMs - startMs) / 86400000) + 1)
}

export function formatDeployDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit',
  })
}

export function acuityPillClass(acuity: string | null): string {
  if (!acuity) return 'bg-gray-800 text-gray-400'
  const a = acuity.toLowerCase()
  if (a.includes('red') || a.includes('immediate') || a.includes('critical')) return 'bg-red-900/60 text-red-300 border border-red-700/40'
  if (a.includes('yellow') || a.includes('delayed') || a.includes('emergent')) return 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40'
  if (a.includes('green') || a.includes('minor') || a.includes('routine') || a.includes('lower')) return 'bg-green-900/60 text-green-300 border border-green-700/40'
  if (a.includes('black') || a.includes('dead') || a.includes('expectant')) return 'bg-gray-900 text-gray-500 border border-gray-700'
  return 'bg-gray-800 text-gray-400'
}

export function patientInitials(first: string | null, last: string | null): string {
  const f = first?.trim()?.[0]?.toUpperCase() || ''
  const l = last?.trim()?.[0]?.toUpperCase() || ''
  return f || l ? `${f}${l}` : '—'
}

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
