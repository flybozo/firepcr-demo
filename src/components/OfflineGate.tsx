import { useEffect, useState } from "react"
import { getIsOnline, onConnectionChange } from "@/lib/syncManager"

type Props = {
  children: React.ReactNode
  page?: boolean
  message?: string
}

export default function OfflineGate({ children, page = false, message }: Props) {
  const [offline, setOffline] = useState(!getIsOnline())
  useEffect(() => {
    const unsub = onConnectionChange((online) => setOffline(!online))
    // Also poll navigator.onLine since iOS events are unreliable
    const interval = setInterval(() => {
      const nowOnline = typeof navigator !== 'undefined' && navigator.onLine
      setOffline(!nowOnline)
    }, 3000)
    return () => { unsub(); clearInterval(interval) }
  }, [])

  if (!offline) return <>{children}</>

  const text = message || "This feature requires an internet connection."

  if (page) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">📶</div>
          <h2 className="text-xl font-bold text-white mb-2">You're Offline</h2>
          <p className="text-gray-400 text-sm">{text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 text-center">
      <span className="text-gray-400 text-sm">📶 {text}</span>
    </div>
  )
}
