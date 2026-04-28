import { createClient } from '@/lib/supabase/client'

const VAPID_PUBLIC_KEY = 'BPrDNBJIJgdrIlNKLTWQzuiMhgKos6BpFGHzgBwpOR-2jO0-5hFfd6EWFxATagUg09Labm0wPho6S8-vHillyyE'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

/** Detailed result from a subscribe attempt so the UI can show a useful message. */
export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason:
      | 'unsupported'         // missing serviceWorker / PushManager / Notification APIs
      | 'not-standalone-ios'  // iOS/iPadOS PWA not opened from home screen — push won't work
      | 'permission-denied'   // user (or OS / MDM / Focus) blocked the prompt
      | 'permission-default'  // prompt was dismissed without choosing
      | 'no-service-worker'   // SW didn't reach 'ready' state
      | 'subscribe-failed'    // pushManager.subscribe() threw
      | 'save-failed'         // server-side persistence failed
    ; message: string
    }

function isIOSDevice(): boolean {
  const ua = navigator.userAgent || ''
  // iPadOS 13+ reports as Mac in UA but exposes touch points; standard iOS still says iPhone/iPad.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && (navigator as any).maxTouchPoints > 1)
}

function isStandalonePWA(): boolean {
  // iOS Safari uses navigator.standalone; modern browsers expose display-mode media query.
  const iosStandalone = (navigator as any).standalone === true
  const displayStandalone = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches
  return Boolean(iosStandalone || displayStandalone)
}

export async function subscribeToPushDetailed(employeeId: string): Promise<PushSubscribeResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported',
      message: 'This browser doesn\u2019t support web push. Try the latest Safari or Chrome.' }
  }

  // iOS/iPadOS hard rule: web push only works in a home-screen PWA, not a Safari tab.
  if (isIOSDevice() && !isStandalonePWA()) {
    return { ok: false, reason: 'not-standalone-ios',
      message: 'On iPhone/iPad, push only works when the app is opened from the home screen. Tap Share → Add to Home Screen, then open the app from that icon and try again.' }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'denied') {
      return { ok: false, reason: 'permission-denied',
        message: 'Notifications are blocked. On iOS: Settings → Notifications → (this app) → Allow Notifications. On other browsers, clear the site\u2019s notification permission and try again.' }
    }
    if (permission !== 'granted') {
      return { ok: false, reason: 'permission-default',
        message: 'You dismissed the permission prompt. Tap Enable again and choose Allow.' }
    }

    let reg: ServiceWorkerRegistration
    try {
      reg = await navigator.serviceWorker.ready
    } catch (e) {
      console.error('[Push] serviceWorker.ready failed', e)
      return { ok: false, reason: 'no-service-worker',
        message: 'Service worker isn\u2019t ready. Force-quit the app, reopen from the home screen, and try once more.' }
    }

    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any,
        })
      } catch (e: any) {
        console.error('[Push] pushManager.subscribe threw', e)
        const detail = e?.name === 'NotAllowedError'
          ? 'OS-level permission was denied. Check Settings \u2192 Notifications and any active Focus/Screen Time restrictions.'
          : `${e?.name || 'Error'}: ${e?.message || 'unknown error'}`
        return { ok: false, reason: 'subscribe-failed',
          message: `Couldn\u2019t register for push. ${detail}` }
      }
    }

    const subJSON = subscription.toJSON()
    const supabase = createClient()
    const { error } = await supabase.from('push_subscriptions').upsert({
      employee_id: employeeId,
      endpoint: subJSON.endpoint!,
      p256dh: subJSON.keys!.p256dh!,
      auth: subJSON.keys!.auth!,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    if (error) {
      console.error('[Push] persistence failed', error)
      return { ok: false, reason: 'save-failed',
        message: `Subscribed locally, but couldn\u2019t save to server: ${error.message}` }
    }

    return { ok: true }
  } catch (err: any) {
    console.error('[Push] Subscription failed:', err)
    return { ok: false, reason: 'subscribe-failed',
      message: `Unexpected error: ${err?.message || err}` }
  }
}

/** @deprecated Prefer subscribeToPushDetailed for actionable error messages. */
export async function subscribeToPush(employeeId: string): Promise<boolean> {
  const r = await subscribeToPushDetailed(employeeId)
  return r.ok
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
