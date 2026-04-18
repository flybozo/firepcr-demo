import { useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'

const APP_VERSION = '1.7.3'

export default function VersionNotifier() {
  useEffect(() => {
    const lastNotified = localStorage.getItem('firepcr-version-notified')
    if (lastNotified === APP_VERSION) return // Already notified for this version

    // Send notification via API
    authFetch('/api/version-notify', {
      method: 'POST',
      body: JSON.stringify({ version: APP_VERSION }),
    }).then(res => {
      if (res.ok) localStorage.setItem('firepcr-version-notified', APP_VERSION)
    }).catch(() => {})
  }, [])

  return null
}

export { APP_VERSION }
