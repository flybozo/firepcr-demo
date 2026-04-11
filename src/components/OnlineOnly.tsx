import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'

// Wraps content that requires an internet connection.
// When offline, shows a greyed-out overlay with a message.

export default function OnlineOnly({ children, label }: { children: ReactNode; label?: string }) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return <>{children}</>

  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-gray-900/90 backdrop-blur px-4 py-2 rounded-xl text-center">
          <p className="text-xs text-gray-400">📶 {label || 'Available when online'}</p>
        </div>
      </div>
    </div>
  )
}
