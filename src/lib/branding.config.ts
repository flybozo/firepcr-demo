/**
 * branding.config.ts — RAM / Ridgeline EMS deployment config.
 * Swap this file (and logo assets) to white-label for another tenant.
 */
import type { BrandConfig } from './branding.js'

export const brand: BrandConfig = {
  // ── Company Identity ────────────────────────────────────────────────────
  companyName: 'Ridgeline EMS',
  companyLegal: 'Ridgeline Medical Group',
  appName: 'FirePCR',
  appBrand: 'FirePCR',
  domain: 'ridgelineems.com',
  supportEmail: 'assistant@ridgelineems.com',
  notificationsEmail: 'FirePCR <notifications@ridgelineems.com>',
  appUrl: 'https://app.ridgelineems.com',

  // ── Logo & Assets ───────────────────────────────────────────────────────
  logoUrl: '/logo-flame.svg',
  faviconUrl: '/favicon.ico',

  // ── NEMSIS / EMS Identifiers ────────────────────────────────────────────
  nemsisAgencyId: 'S00-00000',
  nemsisStateAgencyId: 'S00-00000',
  nemsisStateCode: '06',
  nemsisLemsa: 'Sierra Sacramento Valley',
  nemsisSoftware: 'FirePCR Field Operations v1.0',
  nemsisSoftwareCreator: 'Ridgeline Medical Group',

  // ── Unit Naming Conventions ─────────────────────────────────────────────
  unitPrefixes: {
    ambulance: 'Medic',
    medUnit: 'Aid',
    rems: 'Rescue',
    warehouse: 'Command 1',
  },

  // ── AI Assistant ────────────────────────────────────────────────────────
  assistantName: 'AI Assistant',
  assistantEmoji: '🏴‍☠️',
  assistantContext:
    'You are the AI assistant for Ridgeline EMS (RAM), a wildfire medical services company.',

  // ── Legal / Consent Forms ───────────────────────────────────────────────
  consentEntity: 'Ridgeline EMS',
  hipaaEntity: 'Ridgeline Medical Group',

  // ── Scheduling / Ops ────────────────────────────────────────────────────
  schedulerContext:
    'You are a medical team scheduler for Ridgeline EMS (RAM), a company providing wildfire medical services.',

  // ── Push Notifications ──────────────────────────────────────────────────
  vapidContact: 'mailto:notifications@ridgelineems.com',
}
