import { useEffect } from 'react'

const APP_VERSION = '1.2.2'

export default function VersionNotifier() {
  useEffect(() => {
    const lastNotified = localStorage.getItem('firepcr-version-notified')
    if (lastNotified === APP_VERSION) return // Already notified for this version

    // Send notification via API
    fetch('/api/version-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: APP_VERSION }),
    }).then(res => {
      if (res.ok) localStorage.setItem('firepcr-version-notified', APP_VERSION)
    }).catch(() => {})
  }, [])

  return null
}

export { APP_VERSION }
