# RAM Field Ops — Architecture Document

**App:** https://ram-field-ops.vercel.app (staging)  
**Repo:** https://github.com/flybozo/ram-field-ops  
**Last updated:** 2026-04-18 15:45 PDT  
**Current version:** v1.9.1

---

## 1. Overview

RAM Field Ops (branded **FirePCR**) is a Progressive Web App for Remote Area Medicine's wildfire medical operations. It runs on phones, tablets, and desktops in austere field environments — often with no cell service. Everything is designed for **offline-first** reliability.

**What it does:**
- Patient encounter charting (PCR — Patient Care Reports)
- Medication administration records (MAR) with controlled substance tracking
- Supply run logging and inventory management
- ICS 214 operational activity logs
- NEMSIS 3.5.1 XML export for state EMS reporting
- Crew assignment, payroll tracking, and scheduling
- OSHA 301 / Workers' Comp claim generation
- Consent to Treat / AMA forms with finger signatures + PDF generation
- Push notifications (admin compose, CS count reminders, discrepancy alerts)
- Transactional email via Resend
- Analytics and incident dashboards
- Fire admin dashboard (external access via access codes)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript 6 |
| **Build** | Vite (migrated from Next.js April 2026) |
| **Styling** | Tailwind CSS v4 |
| **Backend/DB** | Supabase (PostgreSQL + PostgREST + Auth + Storage) |
| **API Routes** | Vercel Serverless Functions (`/api/*.ts`) |
| **Offline Storage** | IndexedDB via `idb` library |
| **Service Worker** | Custom (`public/sw.js` v11) — caches shell + JS/CSS chunks, push notifications |
| **NEMSIS Export** | Custom TypeScript XML builder (`src/lib/nemsis/`) |
| **Email** | Resend (`api/_email.ts`) — transactional email delivery |
| **Push Notifications** | Web Push API + VAPID keys (`api/push/`) |
| **Hosting** | Vercel (staging) — Hetzner target for production |
| **Auth** | Supabase Auth (email/password) |
| **Drag & Drop** | `@dnd-kit/core` + `@dnd-kit/sortable` |
| **Charts** | Recharts (lazy-loaded) |
| **PDF Generation** | jsPDF + html2canvas (client-side) |
| **Signatures** | react-signature-canvas (finger/stylus signing) |

---

## 3. Project Structure

```
ram-field-ops/
├── api/                          # Vercel serverless functions
│   ├── _auth.ts                  # Auth middleware (JWT verification)
│   ├── _supabase.ts              # Server-side Supabase client
│   ├── _validate.ts              # Input validation utility
│   ├── _rateLimit.ts             # Rate limiting
│   ├── _email.ts                 # Resend email client + branded HTML builder
│   ├── encounters/[id]/
│   │   └── nemsis-export.ts      # NEMSIS XML generation endpoint
│   ├── push/
│   │   ├── send.ts               # Admin push notification send
│   │   ├── cs-count-reminder.ts  # Cron: CS count overdue reminders
│   │   └── cs-discrepancy-alert.ts # Auto: CS count discrepancy alerts
│   ├── pin/set.ts, verify.ts     # PIN authentication
│   ├── incident-access/          # Fire admin dashboard (external access)
│   │   ├── index.ts              # Access code auth + dashboard data
│   │   └── download.ts           # Signed URL generation for PDFs
│   ├── chat/                     # Team chat API
│   │   ├── channels.ts           # List/create channels (admin sees all)
│   │   ├── ensure-channels.ts    # Lazy-create channels on chat open
│   │   ├── messages.ts           # Send/get messages + push notifications
│   │   ├── read.ts               # Mark channel as read
│   │   ├── members.ts            # List/add channel members
│   │   └── upload.ts             # File upload metadata
│   ├── employee-chat.ts          # Employee ↔ AI chat relay
│   └── health.ts                 # Health check
├── public/
│   └── sw.js                     # Service worker v11 (cache + push + update)
├── src/
│   ├── App.tsx                   # Route definitions (70+ lazy-loaded routes)
│   ├── components/               # Shared UI components
│   │   ├── AuthGuard.tsx         # Auth gate
│   │   ├── FieldGuard.tsx        # Field-user route guard
│   │   ├── InactivityLock.tsx    # 30-min inactivity auto-lock
│   │   ├── PinSignature.tsx      # PIN-based document signing
│   │   ├── Sidebar.tsx           # Main nav (draggable, role-aware, badge counts)
│   │   ├── BottomTabBar.tsx      # Mobile bottom nav (badge counts)
│   │   ├── ChatBubble.tsx        # AI assistant bubble (draggable)
│   │   ├── UpdateBanner.tsx      # New version detection + reload prompt
│   │   └── SplitShell.tsx        # Desktop split-pane layout
│   ├── contexts/
│   │   └── UserContext.tsx        # Single user identity fetch (shared)
│   ├── lib/
│   │   ├── supabase/client.ts    # Supabase client (offline-aware fetch)
│   │   ├── offlineStore.ts       # IndexedDB schema + CRUD (18 stores)
│   │   ├── syncManager.ts        # Background sync engine (4-phase preload)
│   │   ├── pushNotifications.ts  # Client-side push subscribe/unsubscribe
│   │   ├── useRole.ts            # Role hook (admin vs field)
│   │   ├── useUnsignedPCRCount.ts # Badge: unsigned charts + notes + MAR
│   │   └── useChatUnread.ts      # Badge: unread chat message counts (Realtime)
│   │   ├── generateConsentPdf.ts # Consent to Treat PDF builder
│   │   ├── generateAMApdf.ts     # AMA/Refusal PDF builder
│   │   └── nemsis/
│   │       ├── buildPcrXml.ts    # NEMSIS 3.5.1 XML builder
│   │       └── codeMaps.ts       # NEMSIS code translations
│   └── pages/                    # Route pages (lazy-loaded)
│       ├── encounters/           # PCR charting (SOAP narrative)
│       ├── mar/                  # Medication admin records (void + reversal)
│       ├── supply-runs/          # Supply logistics (inventory-locked dropdown)
│       ├── inventory/            # Unit inventory (formulary-locked display)
│       ├── cs/                   # Controlled substances (count, transfer, receive, audit)
│       ├── consent/              # Consent to Treat + AMA forms
│       ├── ics214/               # ICS 214 ops logs
│       ├── incidents/            # Incident management
│       ├── analytics/            # Charts & metrics
│       ├── chat/                 # Team chat (channels + messaging)
│       ├── admin/                # Admin dashboard + push notifications
│       ├── unsigned-items/       # Unified unsigned items view
│       ├── fire-admin/           # External fire admin dashboard
│       └── ...
├── supabase/migrations/          # SQL migration files
└── ARCHITECTURE.md               # This file
```

---

## 4. Inventory Model

### Source of Truth: Formulary Templates

The `formulary_templates` table defines what items can exist, organized by `unit_type` (Ambulance, Med Unit, REMS, Warehouse). Templates dictate:
- Item names and categories (OTC, Supply, Rx, CS, DE, RE)
- Default par levels
- Unit of measure, NDC, barcode/UPC, ALS flag

### Inventory Display

Unit inventory is **locked to the formulary template** for that unit's type:
- Every template item appears in the inventory view
- Only quantities are independent per unit
- Items not in the template are ignored
- CS items show **one row per lot number** (multiple lots of same drug)
- Non-CS items show one row per template item

### Inventory Flows

| Action | Source | Categories | Details |
|--------|--------|-----------|---------|
| **Supply runs** (subtract) | Current inventory (qty > 0) | OTC, Supply only | Dropdown locked to in-stock items |
| **Inventory add** (restock) | Formulary template | All except CS | Dropdown locked to template |
| **CS receive** | Manual entry | CS only | Goes to warehouse_inventory first |
| **CS transfer** | Unit-to-unit | CS only | Audited, witnessed, signed |
| **MAR** (med admin) | Formulary template | CS, Rx | Subtracts from unit_inventory |
| **MAR void** | Reversal | CS, Rx | Returns qty to unit_inventory + logs CS transaction |

### CS Audit Trail

All controlled substance movements are logged in `cs_transactions`:
- Administration, Transfer, Receive, Return, Void/Reversal, Audit (discrepancy)
- Each entry: drug, lot number, from/to unit, quantity, who, witness, timestamp
- Discrepancies trigger **immediate push + email alerts to all admins**

---

## 5. Database Schema (50+ tables)

### Core Clinical Tables

| Table | Purpose |
|-------|---------|
| `patient_encounters` | Patient Care Reports (soft-delete, updated_by tracking) |
| `encounter_vitals` | Serial vital signs per encounter |
| `progress_notes` | Clinical notes (SOAP, soft-delete) |
| `encounter_procedures` | Procedures performed |
| `dispense_admin_log` | MAR — medication administration (void flow with PIN) |
| `patient_photos` | Clinical photos |
| `consent_forms` | Consent to Treat + AMA (PDF, signatures) |
| `comp_claims` | OSHA 301 / workers' comp |
| `clinical_audit_log` | Field-level edit audit trail |

### Inventory Tables

| Table | Purpose |
|-------|---------|
| `formulary_templates` | Master item list per unit type (source of truth) |
| `unit_types` | Ambulance, Med Unit, REMS, Warehouse |
| `unit_inventory` | Live stock per unit — ALL categories including CS |
| `warehouse_inventory` | Warehouse stock (CS receiving) |
| `supply_run_items` | Items dispensed on supply runs |

### Controlled Substances

| Table | Purpose |
|-------|---------|
| `cs_transactions` | Complete audit trail of all CS movements |
| `cs_daily_counts` | Daily count records with signatures |
| `cs_receipts` | CS receiving documentation |

### Notifications

| Table | Purpose |
|-------|---------|
| `push_subscriptions` | Web Push subscriptions per employee |
| `push_notifications` | Notification send log (push + email) |
| `app_settings` | Feature flags (CS reminder config, etc.) |

### Operations

| Table | Purpose |
|-------|---------|
| `incidents` | Fire incidents |
| `units` | Vehicles/teams (linked to unit_types) |
| `incident_units` | Unit-to-incident assignments |
| `unit_assignments` | Crew-to-unit assignments |
| `supply_runs` | Supply run headers |
| `ics214_headers/activities/personnel` | ICS 214 logs |

### HR / Admin

| Table | Purpose |
|-------|---------|
| `employees` | Master roster (app_role: admin/field) |
| `employees_sync` | PII-stripped view for client sync |
| `employee_credentials` | Credential documents |
| `employee_chats` | Employee ↔ AI chat |
| `chat_channels` | Team chat channels (company/incident/unit/direct) |
| `chat_members` | Channel membership + last_read_at |
| `chat_messages` | Team chat messages (text/image/file/system) |
| `organizations` | Multi-org support (branding) |

---

## 6. Role System

| Role | app_role | Access |
|------|----------|--------|
| **Admin** | `admin` | Full access — all units, incidents, employees, settings, push notifications |
| **Field** | `field` | Scoped to assigned unit + incident only |

Field users see only their unit's encounters, inventory, supply runs, and their own unsigned items.

---

## 7. Notification System

### Push Notifications
- **Web Push API** with VAPID keys
- Employees subscribe via Profile page toggle
- Service worker handles `push` events + notification clicks
- Admin compose page: target by role and/or unit

### Email (Resend)
- Shared `_email.ts` utility with branded HTML template
- Multi-tenant ready (per-org sending domain in future)
- Requires `RESEND_API_KEY` env var

### Automated Alerts

| Trigger | Push | Email | Recipients |
|---------|------|-------|------------|
| **CS discrepancy found** | ✅ Auto | ✅ Auto | All admins |
| **CS count overdue** | ✅ Auto | ✅ Auto | Crew on overdue units |
| **Admin compose** | ✅ Always | ☑️ Opt-in | Targeted by role/unit |

### CS Reminder Settings (Admin configurable)
- Enable/disable
- Overdue threshold: 12/24/36/48 hours
- Reminder frequency: 8h/12h/24h
- Stored in `app_settings` table

---

## 8. Offline Architecture

### Data Flow
1. **Render from cache** — pages show IndexedDB data instantly on mount
2. **Fetch from network** — Supabase queries update cache in background
3. **Offline writes** — queued in `pending_sync`, replayed when reconnected
4. **Idempotency** — `client_request_id` UUID prevents duplicates on retry

### Service Worker (v11)
- Caches app shell + all Vite JS/CSS chunks
- **Push notification handler** — shows notifications even when app is closed
- **Update detection** — blue banner prompts user to reload for new version
- Checks for updates every 30 minutes

---

## 9. Security

- **PIN signatures** — 4-digit PIN, bcrypt hashed, rate-limited 5/min
- **Inactivity lock** — 30-min timeout, password to unlock
- **Soft deletes** — clinical records never hard-deleted
- **Audit log** — `clinical_audit_log` tracks every encounter field edit
- **Private storage** — documents, signatures, credentials, patient-photos buckets
- **RLS** — all tables have row-level security policies
- **Input validation** — server-side on all API endpoints

---

## 10. Consent Forms

Two types, both with finger signature + PDF generation:

| Type | Purpose | Sections |
|------|---------|----------|
| **Consent to Treat** | Patient consent for emergency treatment | Treatment scope, risks, alternatives, meds, photos, HIPAA, transport, **AI disclosure** |
| **AMA / Refusal** | Against medical advice documentation | Capacity assessment, risks explained, provider attestation |

Both generate branded PDFs (jsPDF, client-side) uploaded to Supabase storage.

---

## 11. NEMSIS 3.5.1 Pipeline

- Real-time field validation via `useNEMSISWarnings` hook
- Mark Complete blocks on critical NEMSIS errors
- Server-side XML generation via `/api/encounters/[id]/nemsis-export`
- Agency: S65-52014, LEMSA: SSV, State: California (06)

---

## 12. Deployment

### Current (Staging)
- **Vercel** — auto-deploys from `main` branch
- Build: `tsc -b && vite build` (~1 second)
- **NOT HIPAA compliant** — no BAA

### Target (Production)
- **Hetzner CX32** — self-hosted Supabase, HIPAA compliant

### Environment Variables
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (API routes)
RESEND_API_KEY (email delivery)
CRON_SECRET (CS reminder endpoint auth)
```

---

## 13. Incident Dashboard Architecture

### Internal Dashboard (`/incidents/:id` — IncidentDetail.tsx)
- **Full-width layout** — no SplitShell wrapper (removed in v1.6.8)
- **Fixed header**: Incident Info card with 2×4 field grid + 4-column contacts (Med Unit Leader, Logs, Comp Claims, Finance) + contract upload bar
- **Default fire**: ⭐ star button saves `default_incident_id` to localStorage; IncidentsList auto-redirects to it
- **3-column draggable card grid** (lg+, 2-col md, 1-col mobile) using `@dnd-kit/sortable`
  - Cards: Units, Encounters, Supply Runs, Reorder, Meds Admin, ICS 214, Billing Summary, Expenses, Comp Claims, Deployments (3/3), Incident Revenue (3/3)
  - Card spans cycle 1/3 → 2/3 → 3/3 on click; persisted to localStorage + user_preferences
  - Card order saved to `user_preferences.dashboard_card_order` in Supabase
  - All cards stretch to fill row height via `flex flex-col flex-1`
  - Expand button (⤢) captures `getBoundingClientRect()` and animates overlay FROM card position
  - Mobile: forced `col-span-1`, span cycle hidden
- **Admin-only cards**: incident-info, deployments, incident revenue, billing summary
- **Field user view**: filtered to assigned unit, admin cards hidden

### External Dashboard (`/fire-admin/:code` — FireAdminDashboard.tsx)
- Public-facing, accessed via incident access codes (no auth required)
- Tabs: Overview (stat cards + charts), Patient Log (grouped by unit), ICS 214s (grouped by unit), Supply
- Date filter (All/24h/48h/7d) affects all tabs including supply
- De-identified patient data only (no PHI)
- PDF downloads via signed Supabase URLs through `/api/incident-access/download`

### Internal "Incident Data" Preview (`Admin > External Dashboard`)
- Uses same `IncidentDashboard` component as admin page
- **Mirrors external dashboard exactly** (as of v1.8.4) — same tabs, charts, columns, layout
- Admins see what med unit leaders see without visiting the external URL
- Access Log tab (internal only) shows who accessed with what code

### Headshots & Unit Photos
- Employee headshots: shown on roster list (32px), employee detail header (56px), unit detail crew (32px), deployments card (28px)
- Unit photos: shown on units list (32px), incident dashboard units card (36px)
- All via `headshot_url` / `photo_url` columns in employees/units tables

## 14. Team Chat Architecture

### Overview
Two separate chat systems coexist:
1. **AI Chat (ChatBubble)** — floating bubble, employee ↔ Codsworth/Haiku via `employee_chats` table
2. **Team Chat** — full channel-based messaging between employees via `chat_channels/members/messages`

### Channel Types
| Type | Auto-created | Members | Purpose |
|------|-------------|---------|--------|
| `company` | First admin opens chat | All employees | Company-wide announcements |
| `incident` | Employee opens chat while assigned to fire | All crew on that incident | Fire-specific coordination |
| `unit` | Employee opens chat while assigned to unit | All crew on that unit | Unit-level comms |
| `direct` | User starts a DM | 2 participants (deduped) | 1:1 messaging |

### Admin Visibility
- Admin users are **auto-joined to ALL channels** (including DMs) on chat open
- Both `ensure-channels.ts` and `channels.ts` handle this
- Admins get `role: 'admin'` on auto-joined channels

### DM Name Resolution
- DM channel `name` stored in DB is from creator's perspective
- Both API routes resolve display name per-viewer: query `chat_members` → `employees`, show the OTHER participant's name

### Message Delivery
- **Sender sees own message immediately** — API response appended to state
- **Other users see messages via 3-second polling** — unconditional `setInterval`
- **Supabase Realtime subscription** exists as bonus layer (fires faster when working)
- `fetchAndMergeNew()` helper fetches last 5 messages, deduplicates against existing IDs

### File Upload
- **Direct client → Supabase Storage** (bypasses Vercel API)
- Client uploads to `chat-files` bucket via Supabase JS `storage.upload()`
- Then sends a message with `file_url` pointing to the public URL
- Storage bucket: `chat-files` (public read, authenticated upload)
- Max file size: 10MB (client-side check)

### Push Notifications
- Sent on every new message via `sendPushNotifications()` in `messages.ts`
- Filters out sender's subscriptions (DB query + client-side double-filter)
- Service worker suppresses chat notifications when app is in foreground
- Auto-cleans expired subscriptions (410 Gone)

### Unread Badges
- `useChatUnread` hook: Supabase Realtime `INSERT` on `chat_messages`
- Badges: Sidebar "Team Chat" (red), BottomTabBar "More" tab (red), "💬 Chat" sheet item (red)
- Unsigned encounter badges remain orange for visual distinction

### Security
- All 6 API routes require JWT auth via `requireEmployee()`
- RLS on all 3 chat tables (channel membership scoped)
- Rate limiting: 30 messages/min, 10 uploads/min per employee
- Input validation: content max 4000 chars, UUIDs validated

### Database
```sql
chat_channels (id, type, name, description, incident_id, unit_id, created_by, created_at, updated_at)
chat_members (id, channel_id, employee_id, role, joined_at, last_read_at)
chat_messages (id, channel_id, sender_id, content, message_type, file_url, file_name, reply_to, edited_at, deleted_at, created_at)
```
Storage bucket: `chat-files` (public, authenticated upload)

---

## 15. Theme System

- CSS variables applied by `ThemeProvider.tsx`, overridden globally in `globals.css`
- `getContrastText(hex)` computes W3C luminance → black/white for `--color-primary-text`
- Primary buttons force `color: var(--theme-primary-text)` for readability
- Per-theme font scaling via `fontScaleMap` (Terminal 115%, Hippie 105%)
- 21 themes total (dark, light, special)

---

## 16. Key Design Decisions

- **Vite over Next.js** — client-side PWA doesn't need SSR; 1s builds vs 30s
- **Formulary = source of truth** — inventory items locked to templates per unit type
- **Single inventory table** — `unit_inventory` for all categories (eliminated redundant `cs_unit_stock`)
- **PIN signing over PKI** — practical for field environments, familiar to medical staff
- **Soft deletes** — legal retention requirements for clinical records
- **Resend for email** — SaaS-ready, per-domain sending, scales to multi-tenant
- **Web Push over native** — works on Android + iOS (16.4+), no app store needed
- **Polling over pure Realtime for chat** — Supabase Realtime unreliable; 3s polling is simple and guaranteed
- **Direct Supabase Storage upload** — bypasses Vercel's 4.5MB body limit and parsing quirks
- **Auto-contrast text** — computed per-theme via luminance; scales to any palette
- **DnD activation distance** — 8px threshold lets taps pass through to links on touch devices

---

## 17. Refactoring Roadmap (2026-04-19)

See `REFACTORING-PLAN.md` for the full plan. Summary:

### Target Architecture

```
src/
  lib/
    branding.ts              ← Brand config types
    branding.config.ts       ← Per-deployment config (RAM vs demo)
    services/                ← All data access (no supabase in pages)
      incidents.ts
      encounters.ts
      inventory.ts
      cs.ts
      employees.ts
      chat.ts
      deployments.ts
      ...
    utils/                   ← Shared business logic
      calcDays.ts
      fmtCurrency.ts
      rateUtils.ts
  components/
    ui/                      ← Shared primitives
      DataTable.tsx
      StatCard.tsx
      FilterPills.tsx
      FormField.tsx
      ConfirmDialog.tsx
      ...
  pages/                     ← Thin UI shells calling services
    incidents/
      IncidentDetail.tsx     ← Layout + state only (~400 lines)
      components/             ← Card sub-components
        UnitsCard.tsx
        RevenueCard.tsx
        DeploymentsCard.tsx
        ...
```

### Phases
1. **Branding Layer** — zero hardcoded refs, 1 config file swap for white-label
2. **Service Layer** — all 242 supabase calls extracted from pages
3. **Shared UI** — DataTable, StatCard, FilterPills, FormField, ConfirmDialog
4. **Component Decomposition** — no component > 500 lines
5. **Feature Modules** — self-contained feature directories (stretch)
6. **Permissions System** — granular RBAC beyond admin/field (stretch)

### Principles
- Ship each phase independently — app works at every intermediate state
- Preserve offline-first pattern — services return cache then fetch
- No big-bang rewrites — each phase gets its own branch
