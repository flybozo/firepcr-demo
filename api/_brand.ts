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
  companyName: 'Ridgeline EMS',
  companyLegal: 'Ridgeline Medical Group',
  appName: 'FirePCR',
  appBrand: 'FirePCR',
  domain: 'ridgelineems.com',
  supportEmail: 'assistant@ridgelineems.com',
  notificationsEmail: 'FirePCR <notifications@ridgelineems.com>',
  appUrl: 'https://firepcr-demo.vercel.app',
  assistantName: 'AI Assistant',
  assistantEmoji: '🏴‍☠️',
  assistantContext: 'You are the AI assistant for Ridgeline EMS (RAM), a wildfire medical company that provides emergency medical services, ambulance services, and technical rope rescue under contract with state and federal agencies.',
  schedulerContext: 'You are a scheduling assistant for Ridgeline EMS (RAM). RAM deploys medical teams to wildfire incidents across the western US. Teams consist of EMTs, Paramedics, RNs, NPs, and MDs working 14-day rotations.',
  vapidContact: 'mailto:notifications@ridgelineems.com',
  consentEntity: 'Ridgeline Medical Group dba Ridgeline EMS',
  hipaaEntity: 'Ridgeline Medical Group',
} as const
