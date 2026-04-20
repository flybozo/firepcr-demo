export function formatTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return isoStr
  }
}

export function formatDateTime(isoStr: string) {
  try {
    return new Date(isoStr).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return isoStr
  }
}
