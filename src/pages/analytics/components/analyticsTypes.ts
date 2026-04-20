export type DateRange = '7d' | '30d' | '90d' | 'all'

export const C = {
  red:    '#dc2626',
  blue:   '#2563eb',
  green:  '#16a34a',
  amber:  '#d97706',
  violet: '#7c3aed',
  gray:   '#6b7280',
  teal:   '#0d9488',
  pink:   '#db2777',
}

export const ACUITY_COLORS: Record<string, string> = {
  'Immediate': C.red,
  'Delayed':   C.amber,
  'Minor':     C.green,
  'Expectant': C.gray,
}

export const PIE_COLORS = [C.red, C.blue, C.green, C.amber, C.violet, C.teal, C.pink, C.gray]

export function getDateFilter(range: DateRange): string | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

export function mapAcuity(raw: string | null): string {
  if (!raw) return 'Expectant'
  const v = raw.toLowerCase()
  if (v.includes('critical') || v.includes('red') || v.includes('immediate')) return 'Immediate'
  if (v.includes('yellow') || v.includes('delayed') || v.includes('emergent')) return 'Delayed'
  if (v.includes('green') || v.includes('minor') || v.includes('non-acute') || v.includes('routine')) return 'Minor'
  return 'Expectant'
}
