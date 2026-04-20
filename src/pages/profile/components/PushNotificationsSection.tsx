import { useEffect, useState } from 'react'

interface Props {
  employeeId: string | undefined
  onError: (msg: string) => void
}

export function PushNotificationsSection({ employeeId, onError }: Props) {
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    import('@/lib/pushNotifications').then(async ({ isPushSubscribed }) => {
      setPushEnabled(await isPushSubscribed())
    }).catch(() => {})
  }, [])

  return (
    <div className="theme-card rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Push Notifications</h2>
          <p className="text-xs text-gray-500 mt-0.5">Receive alerts for CS counts, admin announcements, and more</p>
        </div>
        <button
          onClick={async () => {
            setPushLoading(true)
            try {
              if (pushEnabled) {
                const { unsubscribeFromPush } = await import('@/lib/pushNotifications')
                await unsubscribeFromPush()
                setPushEnabled(false)
              } else {
                const { subscribeToPush } = await import('@/lib/pushNotifications')
                const ok = await subscribeToPush(employeeId)
                setPushEnabled(ok)
                if (!ok) onError('Push notifications blocked. Check browser permissions.')
              }
            } catch { onError('Failed to update push settings') }
            setPushLoading(false)
          }}
          disabled={pushLoading}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            pushEnabled
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          {pushLoading ? '...' : pushEnabled ? '🔔 Enabled' : '🔕 Enable'}
        </button>
      </div>
    </div>
  )
}
