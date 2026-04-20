/**
 * _brand.ts — API-safe brand constants.
 * 
 * Vercel serverless functions can't reliably import from src/lib/ due to
 * path resolution and TypeScript compilation differences. This file
 * duplicates the brand values needed by API routes.
 * 
 * Keep in sync with src/lib/branding.config.ts.
 */
export const brand = {
  companyName: 'Remote Area Medicine',
  companyLegal: 'Mossbrae Medical Group P.C.',
  appName: 'RAM Field Ops',
  appBrand: 'FirePCR',
  domain: 'wildfiremedical.com',
  supportEmail: 'codsworth@wildfiremedical.com',
  notificationsEmail: 'FirePCR <notifications@wildfiremedical.com>',
  appUrl: 'https://ram-field-ops.vercel.app',
  assistantName: 'Codsworth',
  assistantEmoji: '🏴‍☠️',
  assistantContext: 'You are Codsworth, an AI assistant for Remote Area Medicine (RAM), a wildfire medical company that provides emergency medical services, ambulance services, and technical rope rescue under contract with state and federal agencies.',
  schedulerContext: 'You are a scheduling assistant for Remote Area Medicine (RAM). RAM deploys medical teams to wildfire incidents across the western US. Teams consist of EMTs, Paramedics, RNs, NPs, and MDs working 14-day rotations.',
  vapidContact: 'mailto:codsworth@wildfiremedical.com',
  consentEntity: 'Mossbrae Medical Group P.C. dba Remote Area Medicine',
  hipaaEntity: 'Mossbrae Medical Group P.C.',
} as const
