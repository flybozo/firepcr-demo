/**
 * branding.config.ts — RAM / Remote Area Medicine deployment config.
 * Swap this file (and logo assets) to white-label for another tenant.
 */
import type { BrandConfig } from './branding.js'

export const brand: BrandConfig = {
  // ── Company Identity ────────────────────────────────────────────────────
  companyName: 'Remote Area Medicine',
  companyLegal: 'Mossbrae Medical Group P.C.',
  appName: 'RAM Field Ops',
  appBrand: 'FirePCR',
  domain: 'wildfiremedical.com',
  supportEmail: 'codsworth@wildfiremedical.com',
  notificationsEmail: 'FirePCR <notifications@wildfiremedical.com>',
  appUrl: 'https://app.wildfiremedical.com',

  // ── Logo & Assets ───────────────────────────────────────────────────────
  logoUrl: '/logo-flame.svg',
  faviconUrl: '/favicon.ico',

  // ── NEMSIS / EMS Identifiers ────────────────────────────────────────────
  nemsisAgencyId: 'S65-52014',
  nemsisStateAgencyId: 'S65-52014',
  nemsisStateCode: '06',
  nemsisLemsa: 'Sierra Sacramento Valley',
  nemsisSoftware: 'RAM Field Operations v1.0',
  nemsisSoftwareCreator: 'Mossbrae Medical Group PC',

  // ── Unit Naming Conventions ─────────────────────────────────────────────
  unitPrefixes: {
    ambulance: 'RAMBO',
    medUnit: 'MSU',
    rems: 'REMS',
    warehouse: 'The Beast',
  },

  // ── AI Assistant ────────────────────────────────────────────────────────
  assistantName: 'Codsworth',
  assistantEmoji: '🏴‍☠️',
  assistantContext:
    'You are Codsworth, an AI assistant for Remote Area Medicine (RAM), a wildfire medical services company.',

  // ── Legal / Consent Forms ───────────────────────────────────────────────
  consentEntity: 'Remote Area Medicine',
  hipaaEntity: 'Mossbrae Medical Group P.C.',

  // ── Scheduling / Ops ────────────────────────────────────────────────────
  schedulerContext:
    'You are a medical team scheduler for Remote Area Medicine (RAM), a company providing wildfire medical services.',

  // ── Push Notifications ──────────────────────────────────────────────────
  vapidContact: 'mailto:codsworth@wildfiremedical.com',
}
