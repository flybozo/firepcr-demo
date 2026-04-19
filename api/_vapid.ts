import webpush from 'web-push'
import { brand } from '../src/lib/branding.config.js'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.warn('⚠️ VAPID keys not set — push notifications will fail')
}

let configured = false

export function ensureVapid() {
  if (!configured && VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(brand.vapidContact, VAPID_PUBLIC, VAPID_PRIVATE)
    configured = true
  }
}
