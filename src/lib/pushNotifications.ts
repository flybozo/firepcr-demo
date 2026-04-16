import { createClient } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY = 'BCW3KyLolVrvyMdd4H9UkG9gcLbuxnS02WEL-8zOXt0yP20LfCklisBo4-HeE4tfx_qtpqVj3vrJm7elLZqm63c'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export async function subscribeToPush(employeeId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.ready
    let subscription = await reg.pushManager.getSubscription()

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
      })
    }

    const subJSON = subscription.toJSON()
    const supabase = createClient()

    // Upsert subscription
    await supabase.from('push_subscriptions').upsert({
      employee_id: employeeId,
      endpoint: subJSON.endpoint!,
      p256dh: subJSON.keys!.p256dh!,
      auth: subJSON.keys!.auth!,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

    return true
  } catch (err) {
    console.error('[Push] Subscription failed:', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const subscription = await reg.pushManager.getSubscription()
  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    const supabase = createClient()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  }
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return !!sub
}
