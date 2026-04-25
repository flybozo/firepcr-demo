/**
 * BrandConfig — all tenant-specific constants in one place.
 * Import `brand` from `./branding.config` (per-deployment file).
 * Never hardcode company names, domains, NEMSIS IDs, or emails in source.
 */
export type BrandConfig = {
  // ── Company Identity ────────────────────────────────────────────────────
  /** DBA / trade name: "Remote Area Medicine" */
  companyName: string
  /** Legal entity name: "Mossbrae Medical Group P.C." */
  companyLegal: string
  /** Short app title shown in headers: "RAM Field Ops" */
  appName: string
  /** Marketing / white-label app name: "FirePCR" */
  appBrand: string
  /** Primary email domain: "wildfiremedical.com" */
  domain: string
  /** System/support email: "codsworth@wildfiremedical.com" */
  supportEmail: string
  /** Notification sender: "FirePCR <notifications@wildfiremedical.com>" */
  notificationsEmail: string
  /** Public app URL: "https://app.wildfiremedical.com" */
  appUrl: string

  // ── Logo & Assets ───────────────────────────────────────────────────────
  /** Path or URL to primary logo image */
  logoUrl: string
  /** Path or URL to favicon */
  faviconUrl: string

  // ── NEMSIS / EMS Identifiers ────────────────────────────────────────────
  /** CEMSIS agency number: "S65-52014" */
  nemsisAgencyId: string
  /** CEMSIS state agency ID (often same as agencyId) */
  nemsisStateAgencyId: string
  /** ANSI state code: "06" (California) */
  nemsisStateCode: string
  /** LEMSA name: "Sierra Sacramento Valley" */
  nemsisLemsa: string
  /** Software name reported in NEMSIS header */
  nemsisSoftware: string
  /** Software creator (legal entity) reported in NEMSIS header */
  nemsisSoftwareCreator: string

  // ── Unit Naming Conventions ─────────────────────────────────────────────
  unitPrefixes: {
    ambulance: string   // "RAMBO"
    medUnit: string     // "MSU"
    rems: string        // "REMS"
    warehouse: string   // "The Beast"
    truck?: string      // "Truck"
  }

  // ── AI Assistant ────────────────────────────────────────────────────────
  /** AI assistant display name: "Codsworth" */
  assistantName: string
  /** Assistant emoji: "🏴‍☠️" */
  assistantEmoji: string
  /** System prompt context for in-app AI chat */
  assistantContext: string

  // ── Legal / Consent Forms ───────────────────────────────────────────────
  /** Entity name used in consent form body text */
  consentEntity: string
  /** HIPAA covered entity name */
  hipaaEntity: string

  // ── Scheduling / Ops ────────────────────────────────────────────────────
  /** Description for AI scheduler prompt context */
  schedulerContext: string

  // ── Push Notifications ──────────────────────────────────────────────────
  /** mailto: URI for VAPID contact */
  vapidContact: string
}
