export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

/** Compact date for list/card views: MM/DD/YY */
export function fmtDateCompact(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  // Handle YYYY-MM-DD (DB format) directly to avoid timezone shift
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length === 3) {
    const [y, m, d] = parts
    return `${m}/${d}/${y.slice(2)}`
  }
  // Fallback for other ISO formats
  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return '—'
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const yy = String(dt.getFullYear()).slice(2)
  return `${mm}/${dd}/${yy}`
}

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString()
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function formatDateSeparator(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' })
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  if (days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
