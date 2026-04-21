/**
 * branding.demo.ts — Ridgeline EMS demo deployment config.
 * Copy to branding.config.ts (replacing RAM config) when building the demo.
 */
import type { BrandConfig } from './branding.js'

export const brand: BrandConfig = {
  // ── Company Identity ────────────────────────────────────────────────────
  companyName: 'Ridgeline EMS',
  companyLegal: 'Ridgeline Emergency Medical Services LLC',
  appName: 'Ridgeline Field Ops',
  appBrand: 'FirePCR',
  domain: 'firepcr.com',
  supportEmail: 'support@firepcr.com',
  notificationsEmail: 'FirePCR <notifications@firepcr.com>',
  appUrl: 'https://demo.firepcr.com',

  // ── Logo & Assets ───────────────────────────────────────────────────────
  logoUrl: '/logo-flame.svg',
  faviconUrl: '/favicon.ico',

  // ── NEMSIS / EMS Identifiers ────────────────────────────────────────────
  nemsisAgencyId: 'DEMO-00001',
  nemsisStateAgencyId: 'DEMO-00001',
  nemsisStateCode: '06',
  nemsisLemsa: 'Sierra Sacramento Valley',
  nemsisSoftware: 'FirePCR Field Operations v1.0',
  nemsisSoftwareCreator: 'Ridgeline Emergency Medical Services LLC',

  // ── Unit Naming Conventions ─────────────────────────────────────────────
  unitPrefixes: {
    ambulance: 'Unit',
    medUnit: 'Med',
    rems: 'Rescue',
    warehouse: 'Cache',
  },

  // ── AI Assistant ────────────────────────────────────────────────────────
  assistantName: 'Scout',
  assistantEmoji: '🔥',
  assistantContext:
    'You are Scout, an AI assistant for Ridgeline EMS, a wildfire medical services company.',

  // ── Legal / Consent Forms ───────────────────────────────────────────────
  consentEntity: 'Ridgeline EMS',
  hipaaEntity: 'Ridgeline Emergency Medical Services LLC',

  // ── Scheduling / Ops ────────────────────────────────────────────────────
  schedulerContext:
    'You are a medical team scheduler for Ridgeline EMS, a company providing wildfire medical services.',

  // ── Push Notifications ──────────────────────────────────────────────────
  vapidContact: 'mailto:support@firepcr.com',
}
