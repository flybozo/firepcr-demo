let updateNotified = false

export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope)

        // Check for updates on every page load
        reg.update()

        // Listen for new service worker installation
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing
          if (!newSW) return

          newSW.addEventListener('statechange', () => {
            // New SW installed and waiting — old one still active
            if (newSW.state === 'installed' && navigator.serviceWorker.controller && !updateNotified) {
              updateNotified = true
              console.log('[SW] New version available — prompting reload')
              // Dispatch custom event that UI components can listen for
              window.dispatchEvent(new CustomEvent('sw-update-available'))
            }
          })
        })

        // Also check periodically (every 30 minutes) for updates
        setInterval(() => reg.update(), 30 * 60 * 1000)
      })
      .catch(err => console.error('[SW] Registration failed:', err))
  })

  // When a new SW takes control, reload the page to use new assets
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateNotified) {
      window.location.reload()
    } else {
      // SW used skipWaiting() — new version activated without waiting.
      // Show the banner so user knows to reload for fresh assets.
      updateNotified = true
      console.log('[SW] New version activated via skipWaiting — prompting reload')
      window.dispatchEvent(new CustomEvent('sw-update-available'))
    }
  })

  // Handle navigation messages from SW (push notification click)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE' && event.data?.url) {
      window.location.href = event.data.url
    }
  })
}
