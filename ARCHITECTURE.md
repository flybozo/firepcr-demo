# RAM Field Ops — Architecture Document

**App:** https://ram-field-ops.vercel.app (staging)  
**Repo:** https://github.com/flybozo/ram-field-ops  
**Last updated:** 2026-04-24 20:24 PDT  
**Current version:** v1.30.0  
**App version:** v1.9.0

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
- Agency logos in patient demographics bar (Cal Fire, USFS, BLM, NPS, ODF, Cal OES, CCC, DOD, BIA, USFWS + emoji fallbacks)
- OSHA 301 / Workers' Comp claim generation
- Consent to Treat / AMA forms with finger signatures + PDF generation
- Push notifications (admin compose, CS count reminders, discrepancy alerts)
- Transactional email via Resend
- Analytics and incident dashboards
- Activity timeline feed (unified event stream from 9 data sources)
- CSV export of de-identified patient log
- Agency logo badges on patient records (Cal Fire, USFS, BLM, NPS, ODF, etc.)
- Fire admin dashboard (external access via access codes)
- External chat (fire agency liaisons ↔ RAM units via access codes)
- Granular RBAC with role-based permissions
- Channel archiving with auto-archive on access code deactivation
- Photo sharing in external chat
- CS audit log with patient initials + click-to-MAR navigation
- External user avatar uploads
- Patients-by-agency analytics with agency logo charts
- Encounter ownership restrictions (creator-only delete/complete/sign)
- GPS unit location map — live pings, NIFC fire perimeters, global + per-incident views, external dashboard integration; Warehouse excluded from map legend
- In-app notification inbox (bell badge, unread count, dismiss per-item, clear all, persists across reloads)
- 24-hour Medical Ops Report PDF (client-side, external fire admin dashboard)
- Employee onboarding flow at `/onboard` (self-service, creates auth + employee row, sends welcome email)
- Admin employee provisioning endpoint (`POST /api/admin/provision-user`)
- PWA home screen icon: blue teardrop flame (`/public/firepcr-logo.png`); login/sidebar use RAM skull logo (`/public/ram-company-logo.png`)

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
| **Service Worker** | Custom (`public/sw.js` v14) — pre-caches ALL JS/CSS chunks via `asset-manifest.json`, push notifications |
| **NEMSIS Export** | Custom TypeScript XML builder (`src/lib/nemsis/`) |
| **Email** | Resend (`api/_email.ts`) — transactional email delivery |
| **Push Notifications** | Web Push API + VAPID keys (`api/push/`) |
| **Hosting** | Vercel (staging) — Hetzner target for production |
| **Auth** | Supabase Auth (email/password) |
| **Drag & Drop** | `@dnd-kit/core` + `@dnd-kit/sortable` |
| **Notifications (UI)** | Custom toast system (`src/lib/toast.ts` + `src/components/ui/Toast.tsx`) |
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
│   ├── _brand.ts                 # API-safe brand constants (⚠️ sync with src/lib/branding.config.ts)
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
│   ├── location/
│   │   └── ping.ts               # POST unit GPS ping (5-min dedup by position)
│   ├── incident-access/          # Fire admin dashboard (external access)
│   │   ├── index.ts              # Access code auth + dashboard data
│   │   ├── locations.ts          # GET unit locations for external dashboard (validates access code)
│   │   └── download.ts           # Signed URL generation for PDFs
│   ├── chat/                     # Team chat API
│   │   ├── channels.ts           # List/create channels (admin sees all)
│   │   ├── ensure-channels.ts    # Lazy-create channels on chat open
│   │   ├── messages.ts           # Send/get/delete messages + push notifications
│   │   ├── read.ts               # Mark channel as read
│   │   ├── members.ts            # List/add channel members
│   │   ├── upload.ts             # File upload metadata
│   │   └── archive.ts            # Channel archive/unarchive endpoint
│   ├── incident-access/          # Fire admin dashboard (external access)
│   │   ├── index.ts              # Access code auth + dashboard data
│   │   ├── chat.ts               # External chat (GET/POST messages)
│   │   ├── download.ts           # Signed URL generation for PDFs
│   │   ├── log.ts                # Access log
│   │   └── avatar.ts             # External user avatar upload → chat-files bucket
│   ├── employee-chat.ts          # Employee ↔ AI chat relay
│   ├── health.ts                 # Health check
│   └── timeline/
│       └── index.ts              # Activity timeline API (authenticated)
├── public/
│   └── sw.js                     # Service worker v14 (pre-cache all chunks + push + update)
├── src/
│   ├── App.tsx                   # Route definitions (70+ lazy-loaded routes)
│   ├── components/               # Shared UI components
│   │   ├── charts/
│   │   │   └── AgencyBarChart.tsx # Reusable agency bar chart with logos on bars (Recharts)
│   │   ├── ui/                   # Shared primitives (barrel: ui/index.ts)
│   │   │   ├── StatCard.tsx      # Metric display (big number + label)
│   │   │   ├── EmptyState.tsx    # No-data display (icon + message + CTA)
│   │   │   ├── ConfirmDialog.tsx # Theme-aware modal (replaces window.confirm)
│   │   │   ├── PageHeader.tsx    # Page title + subtitle + actions
│   │   │   ├── LoadingSkeleton.tsx# Animated loading placeholder
│   │   │   ├── Badge.tsx         # Colored pill for status/categories
│   │   │   ├── FormField.tsx     # Label + input wrapper (inputCls, selectCls)
│   │   │   └── SectionCard.tsx   # Card with header bar + content
│   │   ├── chat/                 # Chat sub-components (Phase 4)
│   │   │   ├── Avatar.tsx        # User avatar with fallback
│   │   │   ├── ChannelItem.tsx   # Channel row (swipe-to-delete for DMs)
│   │   │   ├── ChannelListPanel.tsx # Grouped channel list sidebar
│   │   │   ├── MessageBubble.tsx # Message with swipe-delete, reply, lightbox
│   │   │   ├── MessageComposer.tsx # Input bar, file upload, reply preview
│   │   │   ├── MessageList.tsx   # Scrollable messages with date separators
│   │   │   ├── MessageThread.tsx # Thread view (list + composer)
│   │   │   └── NewDMModal.tsx    # Create DM modal with employee search
│   │   ├── maps/
│   │   │   └── UnitMap.tsx       # Leaflet map (USGS topo tiles, emoji markers, NIFC perimeters, auto-refresh)
│   │   ├── QRCodeCard.tsx        # QR code generator (canvas, download, print)
│   │   ├── ContactCards.tsx      # Medical Directors + Deployed Units (SVG icon contacts)
│   │   ├── AuthGuard.tsx         # Auth gate
│   │   ├── FieldGuard.tsx        # Field-user route guard
│   │   ├── InactivityLock.tsx    # 30-min inactivity auto-lock
│   │   ├── PinSignature.tsx      # PIN-based document signing
│   │   ├── Sidebar.tsx           # Main nav (draggable, role-aware, badge counts)
│   │   ├── BottomTabBar.tsx      # Mobile bottom nav (badge counts)
│   │   ├── ChatBubble.tsx        # AI assistant bubble (draggable)
│   │   ├── UpdateBanner.tsx      # New version detection + reload prompt
│   │   └── SplitShell.tsx        # Desktop split-pane layout
│   │   ├── BadgePopover.tsx       # Shared badge detail popover
│   │   ├── encounters/
│   │   │   └── VitalsSection.tsx  # Shared vitals input section
│   │   └── AgencyLogo.tsx         # Agency logo with PNG/SVG + emoji fallback
│   ├── timeline/              # Activity timeline components
│   │   ├── Timeline.tsx          # Scrollable feed with date dividers + infinite scroll
│   │   ├── TimelineEvent.tsx     # Single event row (icon, unit pill, actor, time)
│   │   ├── TimelineFilters.tsx   # Type + unit filter pills
│   │   └── TimelineTab.tsx       # Full tab with fetch, 60s auto-refresh, filter wiring
│   ├── contexts/
│   │   ├── UserContext.tsx         # Single user identity fetch (shared)
│   │   └── PermissionProvider.tsx  # RBAC permission context (fetches + caches)
│   ├── constants/
│   │   └── nemsis.ts              # 33 NEMSIS option arrays (shared by encounters + PCR)
│   ├── data/
│   │   └── clinicalOptions.ts     # Shared dropdown arrays (complaints, acuity, etc.)
│   ├── types/
│   │   └── chat.ts                # Chat message/channel/sender types (incl. external)
│   ├── pages/
│   │   ├── map/
│   │   │   └── GlobalMap.tsx     # /map route — global live map (admin only, lazy-loaded UnitMap)
│   ├── hooks/
│   │   ├── useLocationPing.ts     # Permission-aware GPS ping hook (permState/sharing/requestPermission)
│   │   ├── usePermission.ts       # RBAC permission checking (single, all, any)
│   │   ├── useChatMessages.ts     # Chat Realtime + polling + dedup + CRUD
│   │   ├── useChatUnread.ts       # Chat unread badge counts (auto-seed + Realtime)
│   │   ├── useBarcodeScan.ts      # Barcode scanner for supply runs
│   │   ├── useSpeechRecognition.ts # Speech-to-text for AI chat
│   │   ├── useDraggablePosition.ts # Draggable position persistence
│   │   └── useNEMSISWarnings.ts   # Real-time NEMSIS field validation
│   ├── pages/
│   │   └── ics214/
│   │       ├── useICS214DataLoad.ts  # Data loading hook (units, incidents, crew)
│   │       └── useICS214Form.ts      # Form state + handlers hook
│   ├── utils/
│   │   └── chatHelpers.ts        # Time formatters, normalizers, channel icons
│   ├── lib/
│   │   ├── branding.ts           # BrandConfig type (25+ fields)
│   │   ├── branding.config.ts    # Per-deployment brand values (RAM)
│   │   ├── branding.demo.ts      # Demo brand values (Ridgeline EMS)
│   │   ├── services/             # Data access layer (no supabase in pages)
│   │   │   ├── incidents.ts      # 30+ incident query/mutation functions
│   │   │   ├── encounters.ts     # 25+ encounter functions
│   │   │   ├── cs.ts             # Controlled substances
│   │   │   ├── mar.ts            # Medication administration
│   │   │   ├── supplyRuns.ts     # Supply run queries
│   │   │   ├── ics214.ts         # ICS 214 log management
│   │   │   ├── employees.ts      # Employee queries/updates
│   │   │   ├── admin.ts          # App settings
│   │   │   └── index.ts          # Barrel export
│   │   ├── supabase/client.ts    # Supabase client (offline-aware fetch)
│   │   ├── offlineStore.ts       # IndexedDB schema + CRUD (18 stores)
│   │   ├── syncManager.ts        # Background sync engine (4-phase preload)
│   │   ├── pushNotifications.ts  # Client-side push subscribe/unsubscribe
│   │   ├── useRole.ts            # Role hook (admin vs field)
│   │   ├── useUnsignedPCRCount.ts # Badge: unsigned charts + notes + MAR
│   │   ├── useChatUnread.ts      # Badge: unread chat message counts (Realtime)
│   │   ├── generateConsentPdf.ts # Consent to Treat PDF builder
│   │   ├── generateAMApdf.ts     # AMA/Refusal PDF builder
│   │   └── nemsis/
│   │       ├── buildPcrXml.ts    # NEMSIS 3.5.1 XML builder (main assembler)
│   │       ├── vitalsBuilder.ts  # buildVitalsBlock() — vital signs XML block
│   │       ├── codeMaps.ts       # NEMSIS code translations
│   │       ├── occupationData.ts # INDUSTRY_MAP + OCCUPATION_MAP (eSituation.15/16)
│   │       ├── nemsisUtils.ts    # mapVal(), gcsNum() — shared lookup utilities
│   │       ├── xmlHelpers.ts     # xmlEsc, nilEl, optEl, valEl — XML element builders
│   │       └── nemsisDateUtils.ts# fmtDatetime, fmtDate — NEMSIS date formatters
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
│   ├── 20260420_rbac_foundation.sql           # RBAC tables + seed + get_my_permissions() RPC
│   ├── 20260420_add_is_owner_flag.sql         # is_owner column on employees
│   ├── 20260420_external_chat.sql             # External channel type, nullable sender, access_code_id
│   ├── 20260420_unread_counts_rpc.sql         # get_unread_counts(p_employee_id) RPC
│   ├── 20260420_access_code_avatar.sql        # avatar_url on incident_access_codes
│   ├── 20260420_fix_access_code_fk_cascade.sql # FK CASCADE/SET NULL for access code delete
│   └── 20260420_unit_location_pings.sql       # unit_location_pings table + get_unit_locations + get_all_incident_locations RPCs
├── migrations/
│   └── add_archived_at_to_chat_channels.sql   # archived_at column on chat_channels
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

### GPS / Location

| Table | Purpose |
|-------|---------|
| `unit_location_pings` | GPS pings per unit (unit_id, incident_id, employee_id, lat, lng, accuracy_meters, heading, speed_mps, source, created_at) |

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
| `employees` | Master roster (app_role, is_medical_director — legacy; use RBAC roles; `npi_number` for providers) |
| `employees_sync` | PII-stripped view for client sync |
| `employee_credentials` | Credential documents |
| `employee_chats` | Employee ↔ AI chat |
| `chat_channels` | Chat channels (company/incident/unit/direct/external); `archived_at` for archiving; `access_code_id` FK |
| `chat_members` | Channel membership + last_read_at |
| `chat_messages` | Chat messages (text/image/file/system; nullable sender for external; `external_sender_name`, `access_code_id`) |
| `incident_access_codes` | External access codes; `avatar_url` for external user headshots |
| `organizations` | Multi-org support (branding) |

**New RPCs (2026-04-20)**

| RPC | Purpose |
|-----|--------|
| `get_my_permissions()` | Returns all effective permissions for the authenticated employee (roles + overrides) |
| `get_unread_counts(p_employee_id)` | Returns per-channel unread counts in a single query (replaces N+1 polling) |
| `get_unit_locations(p_incident_id)` | Latest ping per unit for a given incident (DISTINCT ON unit_id ORDER BY created_at DESC) |
| `get_all_incident_locations()` | Latest ping per unit across all incidents, last 48 hours (for global map) |

### RBAC (Role-Based Access Control)

| Table | Purpose |
|-------|--------|
| `roles` | Permission role definitions (8 built-in + custom) |
| `employee_roles` | Employee ↔ Role assignments (many-to-many) |
| `employee_permission_overrides` | Per-employee grant/revoke overrides |

---

## 6. Role & Permission System

### Legacy (being phased out)
| Role | app_role | Access |
|------|----------|--------|
| **Admin** | `admin` | Full access |
| **Field** | `field` | Scoped to assigned unit + incident only |

### RBAC (Active — Phase 6)

Granular permission-based access control. Roles are named bundles of permissions.

| Role | Key Permissions | Members |
|------|----------------|--------|
| **Super Admin** | `*` (all) | Aaron, Rodney, Rob |
| **Operations Manager** | incidents.*, units.*, roster.manage, schedule.*, cs.* | Zach, Ben, Chaz, Jenn |
| **Medical Director** | encounters.*, mar.*, cs.audit, admin.analytics — **grants admin app access** | (assigned via roles page) |
| **Charge Medic** | encounters.*, mar.*, cs.count/transfer, inventory.*, ics214.* | Unit leaders |
| **Field Medic** | encounters.view/create/edit, mar.view/create, cs.view/count | Standard field crew |
| **REMS Lead** | Same as Charge Medic + units.crew | Rope rescue leads |
| **Finance** | payroll.*, billing.*, expenses.*, admin.analytics | Bookkeepers |
| **Read Only** | *.view permissions only | Observers, auditors |

**Permission format:** `domain.action` (e.g., `encounters.edit`, `cs.transfer`, `admin.push`)
**Wildcards:** `*` (all), `domain.*` (all actions in domain), `*.view` (all view permissions)

**Frontend hook:** `usePermission('cs.audit')` / `useAnyPermission('admin.settings', 'admin.push')`
**Provider:** `PermissionProvider` wraps the app, fetches via `get_my_permissions()` RPC, caches in IndexedDB
**Admin UI:** `/admin/roles` — manage roles, permissions, employee assignments

**`useRole()` admin checks (updated 2026-04-20):** Any of `*`, `admin.settings`, `admin.*`, `admin.analytics`, `encounters.*` grants admin-level app access. Medical Directors hold `admin.analytics` + `encounters.*`, so they receive the admin shell automatically.

**Med unit authorization:** `mar.authorize` permission required for Rx/CS meds on MSU/REMS units. Ambulances (RAMBO) allow autonomous dispensing.

Field users see only their unit's encounters, inventory, supply runs, and their own unsigned items.

---

## 7. External Chat (Fire Admin Dashboard)

Fire agency liaisons can communicate with RAM units via the external dashboard without any app account.

### How It Works
1. Admin generates an **access code** for an incident (e.g., label: "Cal Fire IC")
2. System auto-creates an **external chat channel** (`type: 'external'`) linked to the access code
3. All incident crew are added as channel members
4. External user opens dashboard with code → sees a Chat panel
5. Messages sent as the code label (e.g., "Cal Fire IC"), stored with `external_sender_name`
6. Internal crew sees the channel in their Chat list with a 🔥 badge

### Security
- External users authenticated via access code only (no Supabase auth)
- Rate limited: 1 message per 2 seconds per access code
- Text only — no file uploads for external users
- Channel dies when access code is deactivated/expires
- API: `api/incident-access/chat.ts` (GET/POST)

### Channel Types
| Type | Scope | Created By |
|------|-------|------------|
| `company` | All employees | Auto (first admin) |
| `incident` | Incident crew | Auto (on incident create) |
| `unit` | Unit crew | Auto (on unit assignment) |
| `direct` | 2 employees (DM) | Any employee |
| `external` | Incident crew + external liaison | Auto (on access code gen) |

### Super Admin DM Visibility
Users with `*` or `chat.admin` permission see ALL DMs in their channel list as read-only observers. Channel names show both participants (e.g., "Zach Smith ↔ Delores Meehan").

---

## 8. Notification System

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

## 9. Offline Architecture

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

## 10. Security

- **PIN signatures** — 4-digit PIN, bcrypt hashed, rate-limited 5/min
- **Inactivity lock** — 30-min timeout, password to unlock
- **Soft deletes** — clinical records never hard-deleted
- **Audit log** — `clinical_audit_log` tracks every encounter field edit
- **Private storage** — documents, signatures, credentials, patient-photos buckets
- **RLS** — all tables have row-level security policies
- **Input validation** — server-side on all API endpoints

---

## 11. Consent Forms

Two types, both with finger signature + PDF generation:

| Type | Purpose | Sections |
|------|---------|----------|
| **Consent to Treat** | Patient consent for emergency treatment | Treatment scope, risks, alternatives, meds, photos, HIPAA, transport, **AI disclosure** |
| **AMA / Refusal** | Against medical advice documentation | Capacity assessment, risks explained, provider attestation |

Both generate branded PDFs (jsPDF, client-side) uploaded to Supabase storage.

---

## 12. NEMSIS 3.5.1 Pipeline

- Real-time field validation via `useNEMSISWarnings` hook
- Mark Complete blocks on critical NEMSIS errors
- Server-side XML generation via `/api/encounters/[id]/nemsis-export`
- Agency: S65-52014, LEMSA: SSV, State: California (06)

---

## 13. Deployment

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

## 14. Incident Dashboard Architecture

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
- **Also supports internal preview**: detects UUID in `:code` param → uses authenticated `?incidentId=` API path with JWT
- Tabs: Overview (stat cards + charts), Patient Log (grouped by unit), ICS 214s (grouped by unit), Supply, **Live Map** (UnitMap via access code polling)
- Date filter (All/24h/48h/7d) affects **all tabs** including Supply (re-aggregates from raw items)
- De-identified patient data only (no PHI)
- PDF downloads via signed Supabase URLs through `/api/incident-access/download` (supports both code + JWT auth)
- **ContactCards component** (shared) — side-by-side 2-column grid:
  - Medical Directors (red header) | Deployed Units (emerald header)
  - SVG icon contact buttons: phone (green), text (blue), email (purple)
  - Hover tooltip reveals actual number/address, click executes tel:/sms:/mailto: action
- Tab components exported: `OverviewTab`, `PatientLogTab`, `ICS214Tab`, `SupplyTab`, `STATUS_COLOR`, `C`
- `ContactIcons` exported from `ContactCards.tsx` for reuse in roster list

### Internal Fire Dashboard (`Admin > External Dashboard` — admin/FireDashboard.tsx)
- **Unified with external** (as of v1.10.0) — imports shared tab components from FireAdminDashboard
- Same API endpoint: `?incidentId=` (auth required) instead of `?code=` (external)
- **Preview External View** button uses `/fire-admin/{incidentId}` — the external dashboard detects UUID and switches to authenticated mode
- **Internal-only additions**: AccessCodesPanel (generate/manage codes), AccessLogTab (who accessed with what code)
- 1237 → 670 lines after unification (46% reduction)

### Encounter Ownership (added 2026-04-20)
- Only the **creator** of an encounter can delete (draft), mark complete, or sign & lock it
- Non-creators see a **"pending review" indicator** on those actions
- **Edit remains available** to all authorized users for collaborative charting
- **Progress notes:** Only the note's author can delete their own unsigned notes (admin bypass removed)
- Prevents accidental completion/signing by the wrong provider in multi-provider handoff scenarios

### Encounter Detail (`/encounters/:id` — EncounterDetail.tsx)
- **2-column resizable grid** (md+) with `grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch`
- Narrative + Vitals default to half-width (colSpan: 1, side by side)
- All other sections default to full-width (colSpan: 2)
- Column span toggle: hover to see ◧/◣ button, click to cycle half/full
- Persisted to localStorage (`encounter_card_spans`)
- Cards stretch to fill row height (`h-full` on all card wrappers)
- **Expand animation**: every card has ⤢ button (`text-lg`, 28px hit target with hover bg) on hover → FLIP animation from card position to centered overlay
  - `cubic-bezier(0.2, 0.9, 0.3, 1)`, 300ms, reverse on close
  - Overlay has `min-h-[60vh]` for spacious feel even with short content
- All cards have `overflow-hidden` (fixes rounded corner clipping)
- All card headers have `pr-10` to leave room for the expand button
- Drag-to-reorder via `@dnd-kit/sortable` within the grid
- Section order saved to `user_preferences.encounter_section_order`
- **Sections:** actions, narrative, response, scene, assessment, cardiac, vitals, mar, procedures, photos, transport, provider, forms, notes
- **Forms & Documents card** — merged Consent/AMA + Comp Claims into single card with sub-sections
  - PDF links use server-side `/api/pdf/sign` endpoint (reliable, service role key)
  - Consent to Treat badges blue, AMA badges red, Comp Claim button orange
  - Section migration: old `'ama'`/`'comp'` saved prefs auto-convert to `'forms'`
- **Progress Notes** — now a draggable section in the grid (was standalone below)
  - Click-to-reveal: rows show date/time + author + signed status, click to expand full text
  - Sign/Delete actions inside expanded note body
- Mobile: single-column, no span toggle

### Headshots & Unit Photos
- Employee headshots: shown on roster list (32px), employee detail header (56px), unit detail crew (32px), deployments card (28px), contact cards
- Unit photos: shown on units list (32px), incident dashboard units card (36px), unit detail (80px)
- **Unit photo upload:** Admin hover on thumbnail in UnitDetail → camera overlay → file picker → uploads to `headshots/units/{id}/photo.{ext}` → saves public URL to `units.photo_url`
- Storage bucket: `headshots` (public read, authenticated INSERT/UPDATE/DELETE)
- All via `headshot_url` / `photo_url` columns in employees/units tables

## 15. Team Chat Architecture

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
- **Swipe-to-delete** (own messages only): swipe left → red "🗑️ Delete" indicator → release past threshold to confirm soft-delete via `DELETE /api/chat/messages?messageId=`

### File Upload
- **Direct client → Supabase Storage** (bypasses Vercel API)
- Client uploads to `chat-files` bucket via Supabase JS `storage.upload()`
- Then sends a message with `file_url` pointing to the public URL
- Storage bucket: `chat-files` (public read, authenticated upload)
- Max file size: 10MB (client-side check)

### Push Notifications
- Sent on every new message via `sendPushNotifications()` in `messages.ts`
- Filters out sender's subscriptions by both `employee_id` AND `endpoint` (handles shared device / stale subscription scenarios)
- Service worker suppresses chat notifications when app is in foreground
- Auto-cleans expired subscriptions (410 Gone)

### Unread Badges
- `useChatUnread` hook: Supabase Realtime `INSERT` on `chat_messages`
- Badges: Sidebar "Team Chat" (red), BottomTabBar "Chat" main tab (red)
- Unsigned encounter badges remain orange for visual distinction

### Unread Badge System (updated 2026-04-20)
- `useChatUnread` hook rewritten with **shared global store** (`useSyncExternalStore`)
- Single `get_unread_counts(p_employee_id)` RPC fetches all channel unread counts in one query (replaces N+1)
- All badge consumers (Sidebar, BottomTabBar, section headers) share one store — instant cross-component sync
- Section headers show aggregate unread count for all channels in the section

### Channel List UX (added 2026-04-20)
- **Color-coded section headers:** Company=blue, Incidents=red, Units=green, DMs=purple, External=orange
- **Collapsible sections:** Click header to collapse/expand; persisted in `localStorage`
- **Drag-and-drop section reorder:** Powered by `@dnd-kit`; order persisted in `localStorage`
- **Channel archiving:** `archived_at` on `chat_channels`; archived channels hidden by default
  - Swipe right (mobile) or right-click (desktop) → Archive
  - Auto-archive: when an access code is deactivated, its external channel archives automatically
  - API: `POST /api/chat/archive` (archive), `DELETE /api/chat/archive` (unarchive)

### External Chat Enhancements (added 2026-04-20)
- **Photo sharing:** 📷 button in external chat; 5MB max; inline rendering with lightbox; stored in `chat-files`
- **External user avatar upload:** Click 🔥 → file picker → headshot stored in `chat-files`, URL saved to `incident_access_codes.avatar_url`
- **External avatars in Team Chat:** Internal chat looks up `incident_access_codes.avatar_url` to render external user headshots
- **Medical directors auto-added:** All medical directors auto-joined to new external channels on access code creation
- API: `POST /api/incident-access/avatar`

### Security
- All API routes require JWT auth via `requireEmployee()`
- RLS on all 3 chat tables (channel membership scoped)
- Rate limiting: 30 messages/min, 10 uploads/min per employee
- Input validation: content max 4000 chars, UUIDs validated

### Database
```sql
chat_channels (id, type, name, description, incident_id, unit_id, access_code_id, archived_at, created_by, created_at, updated_at)
chat_members (id, channel_id, employee_id, role, joined_at, last_read_at)
chat_messages (id, channel_id, sender_id, content, message_type, file_url, file_name, reply_to,
               external_sender_name, access_code_id, edited_at, deleted_at, created_at)
incident_access_codes (..., avatar_url)  -- external user headshot
```
Storage bucket: `chat-files` (public read, authenticated upload)

---

## 16. Theme System

- CSS variables applied by `ThemeProvider.tsx`, overridden globally in `globals.css`
- `getContrastText(hex)` computes W3C luminance → black/white for `--color-primary-text`
- Primary buttons force `color: var(--theme-primary-text)` for readability
- Per-theme font scaling via `fontScaleMap` (Terminal 115%, Hippie 105%)
- 21 themes total (dark, light, special)

---

## 17. Key Design Decisions

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

## 18. Refactoring Roadmap (2026-04-19)

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
1. **Branding Layer** ✅ COMPLETE — zero hardcoded refs, 1 config file swap for white-label
2. **Service Layer** ✅ Foundation — 8 service files, 64 calls extracted (22%), remaining 234 are complex multi-step mutations
3. **Shared UI** ✅ COMPLETE — 8 components in `src/components/ui/`, 42 pages importing, 37 files migrated
4. **Component Decomposition** — NEXT — no component > 500 lines (IncidentDetail 2808, EncounterDetail 2491, NewPCREncounter, Chat)
5. **Feature Modules** — self-contained feature directories (stretch)
6. **Permissions System** — granular RBAC beyond admin/field (stretch)

### Additional Refactoring Done
- **Fire Dashboard Unification** — internal + external dashboards now share tab components and API (-551 lines)
- **Encounter Detail Grid** — 2-column resizable layout with FLIP expand animation
- **Medical Director System** — `is_medical_director` flag on employees, surfaced on both dashboards
- **Forms & Documents** — merged Consent/AMA + Comp Claims cards into one, fixed PDF signing
- **Progress Notes** — moved into draggable grid, click-to-reveal rows
- **ContactCards component** — shared SVG icon contact buttons (phone/text/email with hover tooltips)
- **Roster list cleanup** — SVG contact icons, removed certs column, simplified grid
- **Mobile menu restructure** — Chat promoted to main tab, CS moved to More, admin-only items gated
- **Swipe-to-delete chat** — touch gesture + soft-delete API
- **Supply tab date filtering** — API returns raw items with timestamps, client re-aggregates
- **Unit photo upload** — admin click-to-upload on unit thumbnail
- **API brand isolation** — `api/_brand.ts` separate from `src/lib/branding.config.ts` (Vercel can't import from src/)

### Principles
- Ship each phase independently — app works at every intermediate state
- Preserve offline-first pattern — services return cache then fetch
- No big-bang rewrites — each phase gets its own branch

---

## 19. API Brand Architecture

Vercel serverless functions (`api/`) cannot import from `src/lib/` due to compilation isolation. Two separate brand config files exist:

| File | Used by | Purpose |
|------|---------|--------|
| `src/lib/branding.config.ts` | Client-side (Vite) | Full `BrandConfig` with types, imported by all pages/components |
| `api/_brand.ts` | Server-side (Vercel) | Flat object with same values, no `src/` dependencies |

**⚠️ When updating brand values, update BOTH files.** The values must match.

API files import `{ brand }` from `./_brand.js` (or `../_brand.js` for nested routes). This was established after a critical incident where importing from `../src/lib/branding.config.js` crashed all API endpoints.

### Mobile Navigation (BottomTabBar)

**Main tabs:** Incidents, Encounters, Chat, Supply, Roster (admin), More

**More menu items:**
- Units, CS (controlled substances)
- Analytics, External Dashboard, Payroll, Documents — `adminOnly`
- My Pay, Schedule Request — `fieldOnly`
- Profile, Admin (admin, opens nested sheet)

Field users never see admin-only items. Routes are also guarded server-side by `<RouteGuard require="admin" />`.

---

## 20. Refactoring Status (Phase 4: Component Decomposition)

**Goal:** No component exceeds ~500 lines. Break god components into focused sub-components + hooks.

### Completed

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Branding layer (27 files migrated) | ✅ Complete |
| Phase 2 | Service layer (8 service files, 64 calls migrated) | ✅ Complete |
| Phase 3 | Shared UI components (37 files, 42 pages) | ✅ Complete |
| Phase 4 Wave 1 | Chat decomposition + NEMSIS constants | ✅ Complete |
| Phase 4 Wave 2 | NewPCREncounter + EncounterDetail decomposition | ✅ Complete |
| Phase 4 Wave 3 | IncidentDetail decomposition | ✅ Complete |

### Phase 4 Wave 1 Results

**Chat.tsx:** 1,329 → **187 lines** (86% reduction)
- 8 sub-components in `src/components/chat/`
- `useChatMessages` hook encapsulates Realtime subscription + 3s polling + dedup + CRUD
- `chatHelpers.ts` for shared formatters
- `src/types/chat.ts` for shared type definitions

**NEMSIS Constants:** 33 arrays extracted to `src/constants/nemsis.ts`
- Removed ~250 lines from EncounterDetail.tsx
- Removed 9 duplicate arrays from NewPCREncounter.tsx
- Both files import from shared constants

### Phase 4 Complete Results (All Waves — 2026-04-20)

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Chat.tsx | 1,329 | 187 | -86% |
| EncounterDetail.tsx | 2,318 | 325 | -86% |
| NewPCREncounter.tsx | 1,861 | 472 | -75% |
| IncidentDetail.tsx | 2,800 | 572 | -80% |
| MARNew.tsx | 1,065 | 135 | -87% |
| Analytics.tsx | 965 | 59 | -94% |
| NewCompClaim.tsx | 925 | 199 | -78% |
| UnitDetail.tsx | 879 | 124 | -86% |
| ThemeProvider.tsx | 855 | 5 | -99% |
| ICS214Detail.tsx | 789 | 170 | -78% |
| AMAConsent.tsx | 767 | 120 | -84% |
| Profile.tsx | 745 | 198 | -73% |
| **Total** | **16,298** | **2,566** | **-84%** |

### Phase 4 Extracted File Structure
```
src/components/chat/          # 8 files (Avatar, ChannelItem, MessageBubble, etc.)
src/components/encounters/    # 5 shared + 16 section components
  sections/                   # VitalsSection, MARSection, PhotosSection, etc.
src/components/incidents/
  cards/                      # 14 card components (IncidentInfoCard, UnitsCard, etc.)
  SortableCard.tsx
src/components/shared/        # EditField, LocationEditField, StatCard
src/hooks/useEncounterData.ts # 294 lines — all encounter data fetching
src/hooks/useIncidentData.ts  # 596 lines — all incident data fetching
src/pages/encounters/pcr-steps/ # 6 step components + types.ts
src/constants/nemsis.ts       # 33 NEMSIS option arrays
src/utils/incidentFormatters.ts
```

All Phase 4 targets complete as of 2026-04-20. Full details in `docs/AUDIT-DECOMPOSITION.md`.

### Phase 5 Results (2026-04-20)

| Item | Extraction | Result |
|------|-----------|--------|
| NewICS214.tsx | useICS214Form + useICS214DataLoad hooks + createICS214 service | 616 → 300 lines (-51%) |
| buildPcrXml.ts | vitalsBuilder.ts + nemsisUtils.ts + occupationData.ts | 738 → 610 lines (-17%) |
| Sidebar.tsx | BadgePopover component | Phase 5 Tier 2 partial |
| ChatBubble.tsx | useSpeechRecognition + useDraggablePosition | Phase 5 Tier 2 partial |
| SupplyRunDetail.tsx | useBarcodeScan | Phase 5 Tier 2 partial |
| NewSimpleEncounter.tsx | buildEncounterData | Phase 5 Tier 2 partial |

### New Files Added (Phase 5 Tier 2)
```
src/lib/nemsis/
  vitalsBuilder.ts      # buildVitalsBlock() extracted from buildPcrXml
  nemsisUtils.ts        # mapVal(), gcsNum() shared utilities
  occupationData.ts     # INDUSTRY_MAP + OCCUPATION_MAP (eSituation.15/16)
src/pages/ics214/
  useICS214DataLoad.ts  # Data loading hook (units, incidents, crew)
  useICS214Form.ts      # Form state + all handlers
```

### Remaining Refactoring (Phase 6+)
- **Phase 6:** Granular RBAC (`usePermission('financial.view')`)

### New Infrastructure Added (2026-04-20)
- **Toast system:** `src/lib/toast.ts` + `src/components/ui/Toast.tsx` — replaces all `alert()` calls
- **Agency logos:** `src/components/AgencyLogo.tsx` + `public/agency-logos/` — realtime logo in patient demographics bar (13 agencies)
- **ESLint rules:** `no-alert` (error), `no-console` (warn) added to `eslint.config.js`

---

## 21. Employee Multi-Role Support

Employees can hold multiple clinical roles (e.g., RN + Paramedic).

| Column | Type | Purpose |
|--------|------|--------|
| `role` | text | Primary role (used for permissions, filtering) |
| `roles` | text[] | All roles (used for display, multi-role filtering) |

The `RolePills` component in RosterList.tsx renders all roles from the array. Role filter on the roster checks the `roles` array, so dual-role employees appear under both categories.

---

## 22. Payroll Architecture

**Source of truth:** `unit_assignments` table (same as incident dashboard deployments card)

Payroll is derived from crew assignments — assigning an employee to a unit IS the deployment trigger. No separate deployment creation needed.

**Rate priority:**
1. `unit_assignments.daily_rate_override` (per-assignment override)
2. `deployment_records.daily_rate` (enrichment layer, legacy)
3. `employees.daily_rate` (employee default)

**Days calculation:** From `travel_date` or `assigned_at` to `released_at` or today.

**Admin view** (`/payroll`): All employees, filterable by incident + employee search + date range. Grouped by incident with subtotals.

**Field view** (`/payroll/my`): Current user only, filterable by incident + date range. Active assignment highlight card.

The `deployment_records` table still exists as an optional enrichment layer but is not required for payroll calculation.

---

## 23. Chat Privacy Model

### DM Visibility
- **`is_owner` flag** on `employees` table controls org-level DM access
- **Owner:** Sees all DM conversations silently — no `chat_members` row created, invisible to participants. DM names show both parties: "Alice ↔ Bob"
- **Other admins:** See company, incident, and unit channels + only their own DMs
- **Field users:** See assigned channels + their own DMs
- **White-labeled:** No hardcoded emails — set `is_owner = true` on any employee

### DM Delete Flow
- Soft-deletes the `chat_channels` row (`deleted_at` timestamp)
- `ensure-channels` filters `deleted_at IS NULL` so deleted DMs never reappear
- Swipe-to-delete reveals Delete/Cancel buttons (no auto-delete on swipe threshold)

### Admin Channel Auto-Join
- `ensure-channels` auto-joins admins to company/incident/unit channels only
- DM channels are explicitly excluded via `.neq('type', 'direct')`
- Cleanup step removes any legacy admin-role DM memberships

---

## 24. Incident Dashboard Filters

### Unit Filter
- **Desktop:** Color-coded pill buttons (Warehouse=purple, Med Unit=blue, Ambulance=red, REMS=green)
- **Mobile:** Full-width `<select>` dropdown

### Date Filter
- **Desktop:** Amber pill buttons (7 Days, 30 Days, 90 Days)
- **Mobile:** Full-width `<select>` dropdown ("All Dates" default)
- Filters: encounters, MAR entries, supply runs, comp claims
- Counts update to reflect filtered set

### Card Item Cap
- All list cards (Encounters, MAR, Supply Runs) capped at 5 visible items
- "Show X more" / "Show less" expand toggle
- CompClaims and Reorder already had this pattern via StatCard `expandedChildren`

---

## 25. GPS Unit Location Map

Built 2026-04-20. Tracks unit positions on a Leaflet map with NIFC fire perimeters.

### Database

**Table: `unit_location_pings`**
```sql
id            uuid PRIMARY KEY
unit_id       uuid REFERENCES units(id) ON DELETE CASCADE
incident_id   uuid REFERENCES incidents(id) ON DELETE CASCADE
employee_id   uuid REFERENCES employees(id)
latitude      double precision NOT NULL
longitude     double precision NOT NULL
accuracy_meters double precision
heading       double precision
speed_mps     double precision
source        text DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'checkin'))
created_at    timestamptz DEFAULT now()
```
Indexes: `(unit_id, created_at DESC)`, `(incident_id, created_at DESC)`
RLS: authenticated read + insert for all employees.

**RPCs:**
- `get_unit_locations(p_incident_id uuid)` — `DISTINCT ON unit_id` latest ping per unit for one incident. Returns: unit_id, unit_name, unit_type, lat, lng, accuracy_meters, heading, last_seen, reporter_name.
- `get_all_incident_locations()` — `DISTINCT ON (incident_id, unit_id)` latest per unit across all incidents, last 48 hours. Returns: incident_id, incident_name, unit_id, unit_name, unit_type, lat, lng, last_seen.

Both RPCs are `SECURITY DEFINER`.

### API Endpoints

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/location/ping` | JWT (requireEmployee) | Write a GPS ping. 5-min dedup: skips if same unit has a ping within 5 min within 0.001° (~100m). Body: unit_id, incident_id, latitude, longitude, accuracy?, heading?, speed?, source? |
| `GET /api/incident-access/locations?code=` | Access code | Returns latest unit locations for the incident linked to the access code. Validates `active` flag + expiry. Used by external dashboard. |

### `useLocationPing` Hook (`src/hooks/useLocationPing.ts`)

Permission-aware hook that manages the GPS ping lifecycle:

- **`permState`** (`'unknown' | 'prompt' | 'granted' | 'denied'`) — checked silently via `navigator.permissions.query` on mount (no prompt).
- **`sharing`** (boolean) — true when permission is granted and pings are active.
- **`requestPermission()`** — calls `navigator.geolocation.getCurrentPosition(...)`, triggering the iOS/Android permission dialog. On grant: sets `sharing=true` and fires an immediate ping.
- **Auto-ping loop** — when `sharing=true`, fires every 15 minutes (`setInterval`). Uses `enableHighAccuracy: true`, 15s timeout, 60s maximumAge.
- Pings `POST /api/location/ping` with a valid JWT session token.
- Used in `MyUnit.tsx` only. Hook does nothing if `incidentId` or `unitId` is null.

### `UnitMap` Component (`src/components/maps/UnitMap.tsx`)

Reusable Leaflet map. Three modes depending on props:

| Props | Mode | Data source |
|-------|------|------------|
| `incidentId` | Per-incident | `get_unit_locations` RPC (authenticated) |
| `accessCode` | External (access code) | `GET /api/incident-access/locations?code=` |
| neither | Global | `get_all_incident_locations` RPC (authenticated) |

**Features:**
- **Tile layer:** USGS National Map topo tiles (fallback: OSM)
- **NIFC fire perimeters:** Fetched from ArcGIS WFIGS endpoint, module-level cache (15 min TTL). Orange polygons with 15% fill opacity. Shows only ACTIVE fires — historical incidents show map but no perimeter (by design).
- **Auto-refresh:** All modes poll every 30 seconds.
- **`FitBoundsToLocations`** inner component — auto-fits map view when locations load (single location → zoom 13, multiple → fitBounds with 50px padding + maxZoom 15). Default center: Mt. Shasta (41.3098, -122.3108).
- **Emoji markers** (36px circular `divIcon`):
  - 🚑 Ambulance (red `#ef4444`)
  - 🚐 Med Unit (blue `#3b82f6`)
  - 👷 REMS (green `#22c55e`)
  - 🏚️ Warehouse (purple `#a855f7`)
- **Tooltips** (permanent, direction "top"): unit name, "Last ping: Xm ago", full datetime.
- **Popups**: unit name, type, last seen, reporter name.
- **Legend overlay** (bottom-left): unit type color key.
- **NIFC indicator** (bottom-right): shown when perimeter data is loaded.
- **Empty state overlay:** shown when no locations exist.

### Permission Flow (iOS-friendly)

iOS Safari requires a user gesture to trigger the geolocation permission prompt — calling `getCurrentPosition` in a `useEffect` without a tap silently fails.

1. On mount, `useLocationPing` checks permission state via `navigator.permissions.query` (no prompt).
2. `MyUnit.tsx` shows a **location permission banner** if `permState !== 'granted'`:
   - "Enable location sharing for this unit" with a tap-to-enable button.
   - Tapping calls `requestPermission()` → triggers the native permission dialog.
3. If granted: banner dismisses, **pulsing green dot** appears next to "Location" label.
4. If denied: banner shows "Location access denied — enable in device Settings".
5. Pulsing indicator: CSS `animate-pulse` green circle, only visible when `sharing === true`.

### Views

| View | Route | Auth | Notes |
|------|-------|------|-------|
| Global Map | `/map` | Admin only | All incidents, last 48h pings, lazy-loaded UnitMap |
| Per-incident | `IncidentDetail` Map tab | Admin only | Passes `incidentId` to UnitMap |
| External dashboard | `/fire-admin/:code` Live Map tab | Access code | Passes `accessCode` to UnitMap, polls `/api/incident-access/locations` |

### External Dashboard Integration

`FireAdminDashboard.tsx` has a "Live Map" tab. It renders `<UnitMap accessCode={code} height="600px" />`. The UnitMap component handles the access-code polling path internally — the tab component just passes the code through.

The map itself polls `/api/incident-access/locations?code=` every 30 seconds. This means the external view auto-refreshes without any additional logic in the dashboard.

### Known Limitations / Future Work
- NIFC perimeters only show ACTIVE fires (by design — the ArcGIS endpoint only contains current perimeters).
- Ping frequency is 15 min — good enough for incident awareness, not real-time tracking.
- No geofencing or proximity alerts yet.
- `source` field supports `'manual'` and `'checkin'` values but no UI for manual entry yet.

---

## 26. In-App Notification Inbox

Built 2026-04-21.

### Database

**Table: `notification_reads`**
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
employee_id     uuid REFERENCES employees(id) ON DELETE CASCADE
notification_id uuid REFERENCES push_notifications(id) ON DELETE CASCADE
read_at         timestamptz DEFAULT now()
dismissed       boolean NOT NULL DEFAULT false
UNIQUE(employee_id, notification_id)
```
RLS: employees can manage own reads only.

### How It Works
- `push_notifications` stores all sent notifications (unchanged).
- `notification_reads` tracks per-employee read + dismiss state.
- **Dismissed** (`dismissed=true`) notifications are filtered out on load — they stay gone across reloads/sessions.
- On upsert, always use `ignoreDuplicates: false` (default) so existing rows get updated — critical for flipping `dismissed` from false to true.

### `useUnreadNotificationCount` Hook (`src/hooks/useUnreadNotificationCount.ts`)
- Polls every 60s.
- Listens for `notif-badge-refresh` CustomEvent for instant update (fired by inbox after marking reads or dismissing).
- Filters by `target_employee_ids`, `target_roles`, AND `target_units` — matches all targeting modes.
- Counts notifications that have no read record yet.

### `NotificationsInbox` Page (`src/pages/notifications/NotificationsInbox.tsx`)
- Route: `/notifications` (accessible to all authenticated users).
- On load: fetches notifications matching employee/role/unit, fetches reads, filters out dismissed, marks all unread as read, fires `notif-badge-refresh`.
- Per-item × dismiss button: upserts `dismissed=true`, removes from local list optimistically.
- "Clear all" button: upserts all visible notifications as `dismissed=true`.

### Badge Locations
- **Sidebar** (`Sidebar.tsx`): bell icon top-right corner, `9+` cap, full-white when unread.
- **BottomTabBar** (`BottomTabBar.tsx`): "Alerts" tab with red badge, inserted before "More".

---

## 27. Location Sharing — Admin & Global

Built 2026-04-21. Extends Section 25 (GPS Map) to cover admin users.

### Problem
Admin users never visit `MyUnit.tsx`, so `useLocationPing` was never called — their unit never appeared on the map.

### Solution: `GlobalLocationPing` (`src/components/GlobalLocationPing.tsx`)
- Mounts inside `AppLayout` — always active for ALL users regardless of which page they're on.
- Silently checks `navigator.permissions.query({name:'geolocation'})` on mount.
- If permission is already `granted`: starts pinging immediately + every 15 min.
- If permission is `prompt`: waits. When the user grants via the Profile page toggle, the `permissionchange` event fires and pinging starts automatically.
- If permission is `denied`: does nothing.
- Requires active `incidentUnit` assignment — does nothing if not assigned.

### `LocationSharingSection` (`src/pages/profile/components/LocationSharingSection.tsx`)
- Mounted on the Profile page for all users.
- Shows current permission state, last ping time, and a manual "Ping now" button.
- **"Enable Location Sharing" button** triggers `navigator.geolocation.getCurrentPosition(...)` — the only user-gesture path that works on iOS for requesting permission.
- Once granted, `GlobalLocationPing` takes over the background pinging.

---

## 28. 24-Hour Medical Ops Report PDF

Built 2026-04-21. Client-side PDF for external fire agency use.

### Location
`src/lib/generateOpsReportPdf.ts` — pure client-side, uses jsPDF. No server or API call needed.

### Trigger
"📄 24hr Report" button on the **Overview tab** of the external fire admin dashboard (`FireAdminDashboard.tsx`). Lazy-imported on click.

### Sections
1. **Header** — incident name, generated timestamp, 24h window dates
2. **Patient Summary** — total count, acuity breakdown (minor/moderate/serious/critical), dispositions (treated & released, transported, AMA/refusal)
3. **Chief Complaints** — horizontal bar chart (top 12), sorted by frequency
4. **Patients by Agency** — breakdown by Cal Fire/USFS/BLM/etc. (only shown if >1 agency)
5. **Consumables Used** — supply run items from last 24h, grouped by category with quantities

### Data Source
All data comes from `DashboardData` already loaded in the dashboard — no additional API calls. Filtered client-side to `created_at >= now - 24h`.

### Output
Filename: `RAM-24hr-report-[incident-name]-[YYYY-MM-DD].pdf`

---

## 29. Employee Provisioning

Built 2026-04-21.

### Self-Service Path (existing): `/onboard`
Full multi-step form at `src/pages/onboard/Onboard.tsx`. Public route (no auth).
- Collects: name, role, personal email, phone, DOB, address, emergency contact, headshot, credentials
- Backend: `POST /api/onboard` — creates employee row + auth user via `supabase.auth.admin.createUser()`, generates `@wildfiremedical.com` email, sends welcome email with temp password
- Credential uploads: `POST /api/onboard/upload` — uploads to Supabase Storage `credentials/` bucket
- Linked from login page: "New employee? Complete your onboarding form →"

### Admin Path: `POST /api/admin/provision-user`
`api/admin/provision-user.ts` — protected by `x-provision-secret: ram-provision-2026` header.
- Body: `{ email, name, password, employee_id }`
- Uses `supabase.auth.admin.createUser()` (GoTrue admin API) — creates auth user + links to existing employee row.
- **⚠️ NEVER use raw SQL to create auth users.** Raw SQL misses `auth.identities` row — login fails with "database error querying schema".
- Used for one-off provisioning (e.g. beta testers, manually added employees).

### RBAC Roles (relevant)
- `beta_tester` — full clinical access, no payroll/billing/expenses. Assign to external testers.
- `super_admin` — full access (`{*}`).
- See `roles` table for full list.

### Pay Rates (as of 2026-04-21)
- Paramedics: $800/day
- RNs: $800/day
- Other roles: varies per employee row

---

## 30. Offline Architecture — Patterns & Known Issues

**Built 2026-04-22. Major overhaul — 20+ commits.**

### Offline Stack
- **Service Worker (`public/sw.js` v14):** CacheFirst for hashed assets, NetworkFirst+cache for Supabase GETs, SPA fallback for navigation. **Pre-caches ALL JS/CSS chunks** via `asset-manifest.json` generated at build time by Vite plugin.
- **IndexedDB v7 (`offlineStore.ts`):** 14+ stores — encounters, mar_entries, vitals, inventory, supply_runs, supply_run_items, units, incidents, employees, formulary, incident_units, progress_notes, procedures, pending_sync
- **Sync Manager (`syncManager.ts`):** Preloads all critical tables on login (no page visit required). Flushes pending writes on reconnect. Uses `navigator.onLine` directly (not cached flag — iOS event unreliability). `syncInProgress` wrapped in `try/finally`. Permanent errors (23505 unique, 42703 column missing, 23502 NOT NULL, 42501 RLS, 22P02 invalid input) are removed from queue instead of retrying forever. **FK violations (23503) are retried**, not permanent — child rows may sync before parents in offline batch.
- **`useOfflineWrite` hook:** Online → direct Supabase write. Offline or network error → queue to `pending_sync`. Always returns `success: true`.
- **`offlineFirst.ts`:** `loadList()` / `loadSingle()` — cache-first reads with background network refresh.
- **`OfflineGate` component:** Wraps 14+ online-only pages with full-page "You're Offline" message. Polls `navigator.onLine` every 3s (iOS events unreliable). Clears automatically when connection returns.
- **Unsynced data warning (`ConnectionStatus.tsx`):** Amber banner "X unsynced — stay online until complete" with pulsing dot. `visibilitychange` listener triggers emergency flush when user backgrounds app (iOS). `beforeunload` blocks browser close on desktop. Polls every 10s. Flushes on mount if already online.

### Auth Offline Pattern (critical)
- **Always use `getSession()`** for auth checks in components — reads localStorage, no network.
- **Never use `getUser()`** in render-blocking positions — it verifies JWT over network and hangs offline.
- `UserContext` resolves from IndexedDB cache first, fires live refresh only when `navigator.onLine`. 4s safety timeout.
- `PermissionProvider` uses cached permissions; skips `get_my_permissions()` RPC when offline. Seeds empty cache on first offline use.
- `FieldGuard` has 3s timeout escape hatch — never blocks render forever.

### Loading State Pattern (critical)
- **Always call `setLoading(false)` after cache attempt** — never gate it inside `if (cached.length > 0)`.
- Cache-first: load from IndexedDB → `setLoading(false)` → background network refresh.
- Network refresh is guarded: `if (!navigator.onLine) return`

### Supply Run Offline Pattern (new 2026-04-22)
- `NewSupplyRun.tsx` is a single-page create + add-items flow
- Items added inline via barcode scanner (resolves against cached inventory/formulary) or searchable dropdown (cached inventory)
- Single Save writes run + all items together: online → direct Supabase, offline → batch `queueOfflineWrite`
- Duplicate items bump quantity instead of creating new rows
- After save, items also written to IndexedDB cache so they appear in list immediately

### Preload Scope (what's cached on login)
- Phase 1: incidents, units, employees, formulary, incident_units
- Phase 2: patient_encounters (500), dispense_admin_log/MAR (500), encounter_vitals (1000)
- Phase 3: unit_inventory (5000), supply_runs (200), supply_run_items (200)
- Phase 4: progress_notes (500), encounter_procedures (500)
- NOT preloaded (online-only): ICS 214s, payroll, roster details, analytics, schedules

### Inventory Data Model (critical — updated 2026-04-22)
- **`unit_inventory` belongs to the TRUCK, not the fire deployment.** Always query by `unit_id`, never `incident_unit_id` for current stock lookups.
- `incident_unit_id` is a legacy/denormalized field — inventory doesn't follow when a unit is reassigned to a new incident.
- Dispensing history is in `supply_run_items` linked via `supply_runs.incident_id` — that data IS fire-specific and doesn't change when units move.
- All supply run inventory paths (search, barcode, decrement, detail add/delete/edit) use `unit_id`.

### Offline-Aware Pages (updated 2026-04-22)
**Online-only (OfflineGate wrapped):** Team Chat, Live Map, Analytics, Payroll (both), Announcements, AI Requests, Company Profile, Financial, External Dashboard, Coverage Calendar, Generate Schedule, Contacts, HR Credentials, Documents, Schedule.

**Offline with cache + warning banner:** CS Inventory (view + administer, no transfers), Notifications (cached alerts, no new delivery), Supply Runs list, Encounters list, MAR list, Inventory list, Units list.

**Fully offline-capable (create + queue + sync):** New Encounter (Simple + PCR), New MAR, New Supply Run (with inline items + barcode scanner).

### Sync Debugging Notes (2026-04-22)
**Lesson learned:** `navigator.onLine` is the only reliable online check on iOS. Browser `online`/`offline` events are unreliable — they may not fire when WiFi reconnects, when cellular switches, or when the app comes back from background. Never cache an `isOnline` flag from events and use it to gate sync — always read `navigator.onLine` fresh.

**Lesson learned:** Never include `23503` (FK violation) as a permanent sync error. In offline-first apps, child records (e.g. `supply_run_items`) may flush before their parent (`supply_runs`) if timestamps collide. Stable sort (timestamp + auto-increment ID) mitigates but doesn't eliminate the race.

**Lesson learned:** `item_count` was a phantom column — never existed in `supply_runs` DB table but was written by 4 code paths. The sync manager's permanent error handling silently ate the data for weeks. Always validate payloads against the actual DB schema.

**Lesson learned:** MAR inventory queries were still using the old `incident_unit_id` join path even after supply runs were fixed. Audit ALL write paths when changing a data model — MAR had 4 separate code paths (load, submit online, submit offline, void/return, qty edit) plus the MARSection inline edit.

**Lesson learned:** React hooks must be called unconditionally before any early returns. Adding an offline banner's `useState`/`useEffect` after a `if (loading) return (...)` block → hooks called in different order → crash → blank screen. Always place hooks at the top.

**Lesson learned:** `loadList()` from `offlineFirst.ts` returns unfiltered cache data unless a `filter` function is passed as the third arg. The Supabase query may filter server-side (e.g. `.in('category', ['Rx', 'CS'])`), but when offline the cache has everything. Always pass a filter to `loadList()` if the query has server-side filters.

**Lesson learned:** Offline inventory decrement must also update the IndexedDB cache (not just queue a sync write). Otherwise, back-to-back offline MARs read stale quantities from cache and can over-dispense.

---

## 32. Route Error Boundary (v1.24.0)

`RouteErrorBoundary` (`src/components/RouteErrorBoundary.tsx`) wraps all routes in `App.tsx`. Catches unhandled render errors in any lazy-loaded page and shows a user-friendly error screen with:
- Error message
- "Try Again" button (resets error state)
- "Reload App" button (triggers SW update check + hard reload)
- Tip to clear cache if persistent

Previously: any crash in a lazy route → blank white screen with no feedback.

---

## 33. Encounter Sort & Time Display (v1.24.0)

Encounters now sort by `created_at` (full ISO timestamp) instead of `date` (YYYY-MM-DD). This ensures multiple encounters created on the same day appear in correct chronological order, newest first.

- `EncountersList.tsx`: selects `created_at`, sorts by it, displays time next to date in list rows
- `EncounterDetail.tsx`: demographics card shows creation time after date
- `Encounter` type updated with `created_at?: string | null`
- Both cache-first and network paths use `created_at` sort

---

## 34. MAR Offline Reliability (v1.24.0)

### Inventory Decrement
All MAR inventory paths now use `unit_id` (not `incident_unit_id` joins):
- `useMARForm.ts` — `resolveUnitId()` resolves unit name → UUID via cached units (offline-safe)
- `loadUnitInventory()` queries by `unit_id` with Rx/CS filter; offline fallback filters IndexedDB cache by `unit_id` + category
- Online submit decrement: `unit_id` direct query, wrapped in try/catch
- Offline submit decrement: tries `unitInventory` state first, falls back to IndexedDB cache search
- `MARDetail.tsx` void/return and qty edit: `unit_id` direct query (removed `incident_units` join)

### Formulary Filtering
Formulary `loadList()` now passes `rxCsFilter` so offline cache is properly filtered to Rx + CS categories. Previously showed OTC/supplies offline.

### Cache Consistency
After offline decrement, both the IndexedDB inventory cache and local React state are updated immediately, preventing over-dispensing on consecutive offline administrations.

---

## 35. Truck Unit Type (v1.25.0)

New `Truck` unit type for non-medical transport vehicles (Truck 1, 2, 3). Formulary contains only DE (durable equipment) and RE (rescue equipment) — no medications.

- DB: `unit_types` row `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- 58 formulary items (26 DE + 32 RE, copied from REMS templates)
- Emoji: 🚚, Color: stone/gray
- Recognized in: unitColors, UnitMap, UnitsCard, IncidentDetail, Admin dashboard, ICS 214, MAR formulary filter, NewUnit page, branding config

---

## 36. Formulary Template Detail Page (v1.25.0)

New page at `/formulary/:id` — the master record for each inventory item:
- Photo with upload/remove (admin only, stored in Supabase `headshots` bucket)
- Category + ALS badges, unit type
- Supply & Cost: supplier, units/case, cost/case, unit cost (auto-calculated)
- Identifiers: par qty, barcode, UPC, NDC, concentration, route
- Notes section
- **Current Stock section**: all units carrying this item with quantities
- Full edit form (admin only)

### Inventory Detail = Template Detail + Overlay
The inventory detail page (`/inventory/:id`) is NOT a separate page. It resolves the matching formulary template by `item_name` and renders `FormularyDetailInner` with an inventory context card (quantity, lot, expiration, unit) layered on top.

`FormularyDetailInner` accepts:
- `templateId` prop (when called from inventory, URL param isn't the template ID)
- `inventoryCtx` prop (inventory overlay data)
- `backPath` prop (← Inventory vs ← Formulary)

---

## 37. Inventory System — Three-Tier Architecture (v1.26.0)

### Item Catalog (Master)
Single source of truth for all inventory items. 496 unique items with auto-generated SKUs.

```sql
item_catalog (
  id uuid PRIMARY KEY,
  sku text UNIQUE NOT NULL,           -- CS-0001, RX-0042, OTC-0105, etc.
  item_name text UNIQUE NOT NULL,
  category text NOT NULL,             -- CS, Rx, OTC, Supply, DE, RE
  is_als boolean DEFAULT false,
  ndc text, barcode text, upc text,
  concentration text, route text,
  unit_of_measure text, supplier text,
  units_per_case numeric, case_cost numeric, unit_cost numeric,
  image_url text, notes text,
  created_at timestamptz DEFAULT now()
)
```

### Three-Tier Flow
```
item_catalog (496 items)     →  formulary_templates (1215 rows)  →  unit_inventory (1748 rows)
SKU, item_name, category,       catalog_item_id + unit_type_id     catalog_item_id + unit_id
is_als, ndc, image_url...       + default_par_qty                  + quantity, lot, expiry
```

- **`catalog_item_id`** FK on both `formulary_templates` and `unit_inventory` — 100% backfilled
- All app queries join through `catalog_item_id` with `item_name` fallback for pre-migration compat
- SKU displayed in inventory + formulary list views (desktop `lg:` breakpoint)
- `skuOf()` helper normalizes PostgREST array-or-object FK returns
- Old `item_name` / `category` columns preserved for rollback safety
- Migration SQL: `migration_item_catalog.sql` in repo root

### Data Loading Pattern (v1.26.0)
**Online-first, offline-fallback** — no stale cache when connected.
- Online: loading skeleton → live Supabase query → update IndexedDB cache
- Offline: IndexedDB cache + amber banner
- Live fetch fails: fall back to cache with stale flag
- Applied to all 11 list pages + `offlineFirst.ts` utilities
- Formulary + inventory queries paginate with `.range()` (1000 rows per page) to bypass PostgREST default limit

**DB trigger:** `trg_unit_inventory_updated_at` — auto-sets `updated_at = now()` on every UPDATE to `unit_inventory`.

---

## 38. Expiration Dashboard (v1.27.0)

**Route:** `/inventory/expiring`  
**File:** `src/pages/inventory/ExpirationDashboard.tsx`

Proactive inventory management page showing items expiring across all units.

### Features
- Time window filter pills: 7d / 30d / 60d / **90d (default)** / All
- Filter pills for unit and category
- Summary stat cards: Expired (red), <30 days (orange), 30-90 days (yellow)
- Collapsible unit sections with urgency badges
- Color-coded rows: red `bg-red-950/40`, orange `bg-orange-950/25`, yellow `bg-yellow-950/15`
- CS/Rx First toggle to prioritize controlled substances and prescriptions
- Mobile: stacked cards. Desktop: 6-column table (Item, Cat, Lot #, Expiry Date, Days, Qty)
- Uses `COALESCE(expiration_date, cs_expiration_date)` for effective expiry
- Online-only (no IndexedDB caching — this is a back-at-camp admin tool)
- Permission-guarded: requires `inventory` permission

---

## 39. Catalog Inline Editing (v1.27.0)

**File:** `src/pages/catalog/CatalogList.tsx`

Click-to-edit cells on the Item Catalog list view.

### Editable Columns (desktop `lg:` breakpoint)
- **Supplier** (text, left-aligned, truncated)
- **Cost/Case** (number, right-aligned, green currency format)
- **Units/Case** (number, right-aligned)
- **Cost/Unit** (number, right-aligned, green currency format)

### Behavior
- Click cell → inline input. Enter/blur → save to Supabase + toast. Escape → cancel.
- Auto-calc: `unit_cost = case_cost / units_per_case` when both set (4 decimal precision)
- Cost/Unit also directly editable for items sold individually
- Saving state: `opacity-40` on cell during Supabase update
- Row click on item name still navigates to `/catalog/:id` detail view
- Removed "Unit Types" column from list (still in detail view)
- RLS: `item_catalog` has UPDATE policy for authenticated users

---

## 40. Inventory Manager Role & Permission-Based Routing (v1.27.0)

### Role: `inventory_manager`
```
permissions: {inventory.*, inventory.manage, supply_runs.view, supply_runs.create, roster.view}
```

### Problem Solved
Previously, all inventory management routes (catalog, formulary, add inventory, expiration dashboard) were behind `<RouteGuard require="admin">` which checked `app_role === 'admin'`. Non-admin users with inventory responsibilities (e.g. external supply managers) were locked out.

### Architecture Changes

**RouteGuard** (`src/components/RouteGuard.tsx`):
- New `permissions?: string[]` prop
- Both `admin` and `assigned` guard levels now check permissions as an alternative: if user has ANY listed permission, they pass through even without admin `app_role` or unit assignment

**Route Structure** (`src/App.tsx`):
- Inventory routes (`/inventory`, `/catalog`, `/formulary`, `/inventory/add`, `/burnrate`, `/reorder`, `/expiring`) grouped under:
  ```tsx
  <RouteGuard require="assigned" permissions={['inventory.manage', 'inventory.view', 'inventory.*']} />
  ```
- This allows: admins (always), assigned field users (via assignment), AND inventory permission holders (via permissions)

**Sidebar** (`src/components/Sidebar.tsx`):
- `canInventory` check: users with inventory permissions bypass "unassigned field user" nav hiding
- Sub-items `/formulary` and `/inventory/burnrate` visible to inventory permission holders

**Formulary Pages** (`src/pages/formulary/Formulary.tsx`, `FormularyDetail.tsx`):
- Replaced `<FieldGuard redirectFn={() => '/'}>` with permission-based guard
- Checks `inventory.manage`, `inventory.view`, `inventory.*`, or `admin.settings`

**FieldGuard** (`src/components/FieldGuard.tsx`) — unchanged but bypassed for formulary. Still used by InventoryList (redirects field users to their unit's inventory).

---

## 41. Add Employee Form (v1.28.0)

**Route:** `/roster/new`  
**File:** `src/pages/roster/NewEmployee.tsx`  
**Permission:** `roster.manage` (via RouteGuard permissions prop)

### Multi-Step Form
1. **Basic Info:** Name, Role (EMT/Paramedic/RN/NP/PA/MD/DO/Tech), Email, Phone, Emergency Contact (name, phone, relationship)
2. **Employment Settings:** App Role (field/admin), Daily Rate, Experience Level (1-3 stars), REMS Capable, Medical Director (MD/DO only), Admin Notes
3. **Review & Create:** Summary + auto-generated temp password (`[F][L]RAM2026!`)

### On Submit
1. Insert `employees` row (admin RLS)
2. Call `POST /api/admin/provision-user` → creates Supabase auth user with `must_change_password: true`
3. Query `roles` table by name → insert `employee_roles` (medical_director for MD/DO, field_medic for others, + super_admin if admin)
4. Success screen shows credentials card

### Roster Page Integration
- "+ Add Employee" button in PageHeader, gated on `roster.manage`

---

## 42. Admin Notes & Employee Edit Mode (v1.28.0)

**DB:** `employees.admin_notes` (text, nullable)  
**Permission:** `roster.manage`

### Admin Notes (EmployeeDetail.tsx)
- Section visible only to `roster.manage` holders
- View mode: shows notes or "No notes" placeholder
- Edit mode: textarea with Save/Cancel

### Edit Employee Mode (EmployeeDetail.tsx)
- ✏️ Edit Employee button in header (admin only)
- Toggles inline editing across all personal/contact/rate fields
- Save Changes / Cancel buttons
- Uses existing `updateEmployee` service function

### Roster Permission Routing (App.tsx)
- `/roster/new`, `/roster/hr`, `/roster/pay-rates` use `<RouteGuard require="admin" permissions={['roster.manage']} />`
- Allows ops_managers (Zach, Ben, Jenn) to access, not just super_admins

---

## 43. Change Password System (v1.28.0)

### Forced First-Login Change
- `api/admin/provision-user.ts` sets `user_metadata: { must_change_password: true }` on user creation
- `AuthGuard.tsx` checks this flag; if true, redirects to `/change-password` and blocks all other routes
- `/change-password` route is outside AuthGuard (accessible pre-change)

### Force Change Page (`src/pages/auth/ChangePassword.tsx`)
- Login-styled centered card with brand logo
- New Password + Confirm fields, validates 8+ chars + match
- Calls `supabase.auth.updateUser({ password, data: { must_change_password: false } })`
- On success: toast + navigate to `/`

### Voluntary Change (Profile)
- `src/pages/profile/components/ChangePasswordSection.tsx`
- Collapsible "Change Password" section on Profile page
- Same validation, uses `supabase.auth.updateUser`

### Who Is Affected
- Only users created via `/api/admin/provision-user` (Add Employee form)
- Self-onboarded users (`/onboard`) are NOT affected (no flag)
- Existing users are NOT affected (no flag in their metadata)

---

## 31. Planned: Daily Rig Checks (Feature 6)

**Status:** Approved, not yet built. Build next session.

### Purpose
Per-unit daily readiness checklist completed at shift start (optionally end). Customized per unit type: Ambulance, Med Unit, REMS. Surfaces issues to admin, tracks narc counts at shift start, and confirms equipment readiness before units go in service.

### Proposed DB Schema
```sql
-- Checklist template items per unit type
rig_check_templates (
  id uuid PRIMARY KEY,
  unit_type text NOT NULL,         -- 'Ambulance' | 'Med Unit' | 'REMS'
  category text NOT NULL,          -- 'Vehicle' | 'Medical Equipment' | 'Medications' | 'Comms' | 'Specialty Gear'
  label text NOT NULL,             -- e.g. 'O2 Tank Level'
  input_type text NOT NULL,        -- 'pass_fail' | 'number' | 'text' | 'checkbox'
  required boolean DEFAULT true,
  sort_order int NOT NULL
)

-- Completed rig checks
rig_checks (
  id uuid PRIMARY KEY,
  unit_id uuid REFERENCES units(id),
  incident_id uuid REFERENCES incidents(id),
  employee_id uuid REFERENCES employees(id),
  shift text NOT NULL,             -- 'AM' | 'PM' | 'Night'
  shift_date date NOT NULL,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'draft',  -- 'draft' | 'complete'
  has_discrepancy boolean DEFAULT false
)

-- Per-item responses
rig_check_items (
  id uuid PRIMARY KEY,
  rig_check_id uuid REFERENCES rig_checks(id) ON DELETE CASCADE,
  template_item_id uuid REFERENCES rig_check_templates(id),
  value text,                      -- 'pass' | 'fail' | 'na' | numeric string | free text
  note text,
  photo_url text
)
```

### Checklist Areas by Unit Type
| Category | Ambulance | Med Unit | REMS |
|----------|-----------|----------|------|
| Vehicle | Fuel, mileage, lights, tires, fluid levels | Same | Same |
| Medical Equipment | O2 tanks, monitor/defib, suction, AED, airway kit | O2, BLS kit, vitals monitor | Trauma kit, O2, AED |
| Medications/Narcs | Narc count at shift start, sealed/intact | Narc count, ALS meds | BLS meds only |
| Comms | Radio (ch programmed), sat phone | Radio, sat phone | Radio |
| Specialty Gear | — | — | Rope rescue kit, harnesses, helmets, anchors |
| Documentation | PCR/consent forms stocked | Same | — |

### Open Design Questions (resolve before building)
- Who fills it out — assigned crew member only, or any admin?
- Does incomplete rig check block unit from going "in service"?
- Start-of-shift only, or also end-of-shift?
- Discrepancy handling — push alert to admin? Create maintenance ticket?
- Where in app — unit detail page tab, dedicated `/rig-check` route, or prompted at check-in?
- Should narc count here cross-reference the CS inventory table?

## 44. Inventory Waste/Disposal (v1.30.0)

**Table:** `inventory_disposals` — full audit trail for disposed inventory.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | PK |
| unit_id | UUID FK→units | Which unit |
| inventory_item_id | UUID FK→unit_inventory | Which inventory row |
| item_name | TEXT | Denormalized name |
| catalog_item_id | UUID FK→item_catalog | Catalog reference |
| category | TEXT | CS/Rx/OTC/etc. |
| lot_number | TEXT | Lot being disposed |
| expiration_date | DATE | |
| quantity_disposed | NUMERIC | Amount disposed |
| reason | TEXT | Expired/Damaged/Contaminated/Recalled/Other |
| reason_notes | TEXT | Free text (required for "Other") |
| performed_by | TEXT | Employee name |
| witness | TEXT | Required for CS only |
| performer_signature | TEXT | PinSignature hash (CS only) |
| witness_signature | TEXT | PinSignature hash (CS only) |
| disposed_at | TIMESTAMPTZ | When disposal occurred |
| notes | TEXT | Optional |

**UI:** Dispose button on every Expiration Dashboard row → `DisposeModal` component.
- CS items: full dual-signature flow (performer + witness via PinSignature) + `cs_transactions` entry with `transfer_type: 'Waste'`
- Rx/OTC: no signatures required — just performer, quantity, reason
- Decrements `unit_inventory.quantity` on submit
- Zero-qty items filtered out of Expiration Dashboard

## 45. Lot/Expiry Column Consolidation (v1.30.0)

Unified `cs_lot_number`/`cs_expiration_date` → `lot_number`/`expiration_date` across all code.
- 66 DB rows backfilled from cs_ columns to standard columns
- 14 files updated (61 references replaced)
- MAR lot dropdown now shows for CS (required) and Rx (recommended/optional)
- Per-lot inventory upsert: different lot numbers create separate `unit_inventory` rows
- Old cs_ columns retained for rollback safety (drop in future cleanup)

## 46. Catalog → Formulary Propagation Fix (v1.30.0)

**Problem:** `formulary_templates` had 13 duplicate columns copied from `item_catalog` (supplier, costs, NDC, concentration, etc.). Editing the catalog didn't propagate to formulary views.

**Fix:**
- Backfilled 324 rows of data from formulary_templates UP to item_catalog
- Dropped 13 duplicate columns from formulary_templates
- `formulary_templates` is now a thin join table: `id, unit_type_id, catalog_item_id, item_name, default_par_qty, notes, created_at`
- All formulary queries join through `catalog_item:item_catalog(*)` for metadata
- FormularyDetail saves metadata edits to `item_catalog`, template-specific fields (par_qty, notes) to `formulary_templates`
- Photo upload/remove targets `item_catalog.image_url`

**Three-tier architecture is now clean:**
```
item_catalog (WHAT the item IS — canonical master)
  ↓ catalog_item_id
formulary_templates (WHAT each unit type CARRIES — thin join + par qty)
  ↓ catalog_item_id
unit_inventory (WHAT'S PHYSICALLY ON the truck — qty, lot, expiry)
```

## 47. UnitFilterPills Shared Component (v1.30.0)

Extracted unit filter UI from 15 pages into `src/components/ui/UnitFilterPills.tsx`.
- Desktop: horizontal scrollable pill buttons with unit-type color coding
- Mobile: `<select>` dropdown
- Sorted via `sortUnitNames` from `@/lib/unitColors`
- Props: `units`, `selected`, `onSelect`, `unitTypeMap`, `includeAll`, `className`
- Adding a new unit to the DB auto-propagates to all filtered views
- Net reduction: ~75 lines of duplicated code removed

## 48. Sortable Column Headers (v1.30.0)

Shared sorting infrastructure applied to 15 list views.

**Components:**
- `src/hooks/useSortable.ts` — generic hook: `sortKey`, `sortDir`, `toggleSort`, `sortFn`
- `src/components/ui/SortableHeader.tsx` — clickable table header with ↑↓↕ indicators
- `src/components/ui/SortBar.tsx` — horizontal pill strip for card-view pages

**Default sort orders:**
- Alphabetical A→Z: InventoryList, CatalogList, RosterList, UnitsList, CSList, DocumentsList
- Date newest-first: EncountersList, MARList, SupplyRunsList, ICS214List, IncidentsList, PatientSearch, CompClaimsList

All sorting is client-side on already-loaded data — zero offline impact.

## 49. Admin Dashboard Financial Summary (v1.30.0)

- My Unit assignment card: entire gradient card is clickable `<Link>` with hover effect
- Each active incident shows: start date, "Day X" deployment counter
- Financial summary per incident: revenue (green) − costs (yellow) = estimated net
- Uses same calculation logic as Financial page: `deployment_records` fallback, all assignments (including released), `calcDays` utility
- Compact currency format ($12.5k) for dashboard readability

## 50. Mobile Nav — HR Credentials (v1.30.0)

Moved "HR Credentials" from top-level "More" tab to Admin sub-sheet in `BottomTabBar.tsx`. Accessible via More → Admin → HR Credentials on mobile.

## 51. 40/60 Split-Panel Layout (v1.30.0)

Four list pages converted to master-detail split layout:

| Page | Left (40%) | Right (60%) |
|------|-----------|-------------|
| Reorder Report | Compact list grouped by unit | Catalog detail + shortage bars + restock cost |
| Unsigned Items | Charts/MAR tabs with clickable rows | Full EncounterDetail component (embedded) |
| ICS 214 Logs | Compact log list (ID, unit, date, status) | Read-only 214 summary + personnel/activity counts |
| Burn Rate | Items sorted by urgency | Catalog detail + burn analysis (stock bar, depletion) |

**Pattern:**
- Desktop: `md:w-[40%]` left, `md:w-[60%]` right, `md:border-r border-gray-800` divider
- Mobile: list is full-width, detail opens as `fixed inset-0 z-50` overlay with close button
- Selected item: highlight via `lc.rowCls(isSelected)` from shared list style system
- Outer layout: `h-full flex flex-col` with `flex-1 flex min-h-0` split panel

**Unsigned Items special case:** Right panel lazy-loads `EncounterDetail` with `encounterId` + `embedded` props. Embedded mode: tighter padding, no back link, no max-width constraint.

## 52. List/Card Style Preference (v1.30.0)

User-selectable list rendering style, toggled in Profile → Appearance.

**Two styles:**
- **Card:** `theme-card rounded-xl border overflow-hidden` container, rows with `border-b border-gray-800/50 hover:bg-gray-800`
- **List:** No container border/rounding, rows with left + bottom borders: `border-l-2 border-l-transparent border-b border-b-gray-800/30`

**Selected row (list mode):** `border-l-red-500 border-b-red-500/40 bg-red-950/40`

**Infrastructure:**
- `ListStyle` type added to `Theme`: `'card' | 'list'`
- `src/lib/listStyles.ts` — `getListClasses(style)` returns `container`, `header`, `row`, `rowSelected`, `rowCls(boolean)`, `groupHeader`, `divider`
- `src/hooks/useListStyle.ts` — reads from theme context, defaults to `'card'`
- Side-specific Tailwind border classes (`border-l-*`, `border-b-*`) to avoid `border-transparent` overriding bottom border color
- **42 files** import and use the system

**Toggle:** Profile → Appearance section, visual preview tiles, persisted per-user.

## 53. Nav Cleanup (v1.30.0)

- Patient Search → embedded search bar on Encounters list (type to filter, Enter for server-side all-history search)
- MAR Search → same pattern on MAR list
- Daily Checklist moved from CS System → Units submenu
- Removed Patient Search, MAR Search from sidebar + mobile bottom tabs
- Standalone routes `/patient-search` and `/mar/search` preserved for direct URL access

## 54. Billing Report Fix (v1.30.0)

- `supply_runs.date` → `supply_runs.run_date` (column was always `run_date`, query was wrong)
- Removed `total_cost` from `supply_run_items` select (column doesn't exist; computed client-side)
- MAR cost lookup: `formulary_templates` no longer has `case_cost`/`units_per_case` → now queries `item_catalog` by `item_name`
- Added `deleted_at`/`voided_at` filters to exclude soft-deleted records

## 55. Manufacturer SKU (v1.30.0)

New `item_catalog.manufacturer_sku` column (text). Displayed and editable in CatalogDetail alongside existing UPC and Barcode fields.
