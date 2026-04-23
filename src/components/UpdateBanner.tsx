import { useEffect, useState } from 'react'

/**
 * Shows a banner when a new service worker is available.
 * User taps "Update" → tells waiting SW to skipWaiting → page reloads.
 */
export default function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false)

  useEffect(() => {
    const handler = () => setShowUpdate(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!showUpdate) return null

  const handleUpdate = () => {
    // Tell any waiting service worker to activate, then reload
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      // Reload regardless — new SW may have already activated via skipWaiting()
      window.location.reload()
    }).catch(() => window.location.reload())
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-blue-600 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <span className="text-sm flex-1">A new version is available.</span>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors shrink-0"
        >
          Update
        </button>
        <button
          onClick={() => setShowUpdate(false)}
          className="text-blue-200 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
