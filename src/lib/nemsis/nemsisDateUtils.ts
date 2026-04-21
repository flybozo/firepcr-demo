export function fmtDatetime(val: unknown): string | null {
  if (val == null) return null
  if (val instanceof Date) {
    return val.toISOString().replace('Z', '+00:00')
  }
  const s = String(val).trim()
  if (!s || s === 'None' || s === 'null') return null
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)) {
    return s.replace('Z', '+00:00')
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00+00:00`
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return `${s.replace(' ', 'T')}+00:00`
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}(:\d{2})?$/.test(s)) {
    return s.replace(' ', 'T')
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().replace('Z', '+00:00')
  }
  return null
}

export function fmtDate(val: unknown): string | null {
  if (val == null) return null
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  if (!s || s === 'None' || s === 'null') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}
