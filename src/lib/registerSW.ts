export function registerServiceWorker() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope)
        // Check for updates every time the page loads
        reg.update()
      })
      .catch(err => console.error('[SW] Registration failed:', err))
  })
}
