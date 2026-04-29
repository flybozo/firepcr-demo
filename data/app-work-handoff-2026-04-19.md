# FirePCR — Handoff 2026-04-19

## Repos
- **Prod:** `/tmp/firepcr-demo` → https://firepcr-demo.vercel.app (main branch)
- **Demo:** `/tmp/firepcr-demo` → https://demo.firepcr.com (main branch)
- **GitHub:** `flybozo/firepcr-demo` + `flybozo/firepcr-demo`
- **Both repos synced** as of this handoff
- **WARNING:** Always `git pull` before working — stale clones cause dangerous commits.

## DB Connections
| Env | Supabase Project | DB Connection |
|-----|-----------------|---------------|
| Prod | `kfkpvazkikpuwatthtow` | `postgresql://postgres:93RV8nx4J^VGR!6V@db.kfkpvazkikpuwatthtow.supabase.co:5432/postgres` |
| Demo | `jlqpycxguovxnqtkjhzs` | `postgresql://postgres:EplVimePP35Zi9MY@db.jlqpycxguovxnqtkjhzs.supabase.co:5432/postgres` | ✅ confirmed |

**Note:** Direct psql connections from the iMac time out frequently. Use Supabase REST API or the dashboard SQL editor instead.

---

## What Was Done Today (2026-04-19) — 30 commits

### Morning Session (Earlier — Sonnet)

#### Phase 1: Branding Layer ✅ COMPLETE
- `src/lib/branding.ts` — `BrandConfig` type (25+ fields)
- `src/lib/branding.config.ts` — RAM / ridgelineems.com values
- `src/lib/branding.demo.ts` — Ridgeline EMS demo values
- 27 files migrated — zero hardcoded brand references in source
- Commit: 8279a02

#### QR Codes ✅ COMPLETE
- `qrcode` + `@types/qrcode` installed
- `QRCodeCard` component: canvas QR, download PNG, print
- UnitDetail + EmployeeDetail: QR cards for vehicle stickers + badges
- Commit: 344999b

#### Phase 2: Service Layer Foundation ✅
- 8 service files in `src/lib/services/`: incidents, encounters, cs, mar, supplyRuns, ics214, employees, admin
- 19 page files migrated. Supabase calls: 298 → 234 (22% extracted)
- Bug fix: `queryUnitsWithIncidents()` missing joins (commit a9c0fff)

#### Phase 3: Shared UI Component Migrations ✅ COMPLETE
- **37 files updated** across every page in the app
- All inline `Loading...` → `<LoadingSkeleton />` (fullPage/rows/header variants)
- All inline empty states → `<EmptyState icon message actionHref />`
- All inline page headers → `<PageHeader title subtitle actions />`
- `window.confirm()` in UnitDetail → `<ConfirmDialog />` with state management
- **42 pages** importing from `@/components/ui`
- Commit: bf29914

#### MAR Patient Privacy Fix ✅
- MARList + MARSearch: patient names → initials only ("J. S.")
- Commit: 3af6746

#### AMA Consent Fixes ✅
- "← Back to Encounter" link on AMA success screen (was missing)
- PDF save fallback: if background save fails, client regenerates + uploads
- Commit: 459c999

#### Encounter Detail — 2-Column Resizable Grid ✅
- `grid grid-cols-1 md:grid-cols-2 gap-4` layout
- Toggle: hover ◧/◣ button, click to cycle half/full
- Persisted to localStorage + user_preferences
- Commits: 136cc01, b76cd06

#### Encounter Detail — Expand Animation ✅
- FLIP animation: card position → centered overlay
- `cubic-bezier(0.2, 0.9, 0.3, 1)`, 300ms, reversible
- Commit: 1b3d3ce

#### Medical Director Flag + Fire Dashboard Contact Info ✅
- `ALTER TABLE employees ADD COLUMN is_medical_director boolean DEFAULT false`
- Set for all 3 MDs
- API returns `medical_directors[]` and `deployed_units[]`
- Both dashboards: Medical Directors + Deployed Units sections
- Commit: 15d598f

#### Fire Dashboard Unification ✅
- Internal imports shared tab components from external
- 1237 → 670 lines (46% reduction, net -551)
- API: `?incidentId=` (auth) OR `?code=` (external)
- Commit: b6c1b9e

---

### Afternoon Session (12:26 PM – 2:00 PM — Opus)

#### TypeScript 6.0 Import Fix ✅
- Added `.js` extensions to branding imports (TS 6.0 `node16`/`nodenext` requirement)
- Commit: 4909993

#### Forms & Documents Card Merge + PDF Link Fix ✅
- **BUG FIX:** Consent/AMA PDF links broken — switched from client-side `supabase.storage.createSignedUrl()` to server-side `/api/pdf/sign` endpoint (uses service role key). Unified `formPdfUrls` map for both consent forms and comp claims.
- **Merged** Consent/AMA + Comp Claims → single "📋 Forms & Documents" card
- Section order migration: `'ama'`/`'comp'` → `'forms'` (auto-migrates saved preferences)
- Commit: 6132fed

#### Encounter Detail UX Polish ✅
- **Expand button (⤢):** `text-sm` → `text-lg`, 28px hit target, hover background
- **Card header spacing:** `pr-10` on all headers with action buttons
- **Expanded overlay:** `min-h-[60vh]` — cards fill 60% of viewport when expanded
- Commit: 004f85a

#### Progress Notes → Draggable Section ✅
- Moved into DndContext grid as `case 'notes'` — draggable, expandable, reorderable
- **Click-to-reveal:** Rows show date/time + author + signed status. Click to expand full note text.
- Commit: df9fdf8

#### External Dashboard Preview Fix ✅
- **BUG:** "Preview External View" passed incident UUID as `:code` → "Access Denied"
- **Fix:** Dashboard detects UUID, uses authenticated `?incidentId=` API path with JWT
- Download API also supports `?incidentId=` with JWT auth for preview mode
- Header shows "👁️ Admin Preview" badge
- Commits: eeae6a8

#### Contact Cards Redesign ✅
- New shared `src/components/ContactCards.tsx` component
- **Side-by-side 2-column grid:** Medical Directors (red header) | Deployed Units (emerald header)
- **SVG icon contact buttons:** phone (green), text (blue), email (purple)
- Hover tooltip reveals actual number/address, click executes action
- Both dashboards use shared component (-156 lines deduplication)
- Commit: fda4367

#### Unit Photo Upload ✅
- Admin hover + click on unit thumbnail → file picker → upload to `headshots/units/{id}/photo.{ext}`
- Camera overlay icon with spinner during upload
- Saves public URL to `units.photo_url` → propagates everywhere
- **RLS fix:** 4 storage policies on headshots bucket (INSERT/UPDATE/DELETE/SELECT)
- Commit: b0c3de1, e29c244

#### Unit List Spacing ✅
- Photo thumbnail `mr-0` → `mr-3`
- Commit: c269b61

#### Incident Dashboard Unit Actions Dropdown ✅
- Shrunk from 150px/12px to 90px/11px, subtler styling, shorter labels
- Commit: e29c244

#### Supply Tab Date Filtering ✅
- API returns `supply_items[]` with `created_at` from parent supply run
- SupplyTab re-aggregates from raw items when date filter active
- Both bar chart and table filter with 24h/48h/7d/All
- Commit: d3e1f0b

#### Employee Roster Cleanup ✅
- Replaced phone + email text columns with `ContactIcons` component (SVG buttons)
- Removed certs column from list view (still in detail + HR Credentials)
- Grid: `[avatar_1fr_role_contact]` — clean 4-column layout
- Mobile row: avatar → name → role pill → contact icons
- Commits: 7cb28f1, 4ed164b, da9114d

#### API Routes Crash Fix (CRITICAL) ✅
- **BUG:** Branding refactor imported `brand` from `../src/lib/branding.config.js` — Vercel serverless can't resolve `src/` paths → ALL API endpoints crashed (`FUNCTION_INVOCATION_FAILED`)
- **Broken:** Chat, push notifications, emails, employee chat, onboarding, schedule, shift tickets
- **Fix:** Created `api/_brand.ts` — self-contained brand constants with no `src/` dependencies. All 8 API files updated.
- **Keep `api/_brand.ts` in sync with `src/lib/branding.config.ts`**
- Commit: 8429342

#### Swipe-to-Delete Chat ✅
- Swipe left on own messages → red "🗑️ Delete" indicator → release to confirm
- New `DELETE /api/chat/messages?messageId=` endpoint (soft delete, sender-only)
- Commit: 4657728

#### Mobile Menu Restructure ✅
- **Chat → main bottom tab** (with unread badge)
- **CS → under "More"** (less frequent on mobile)
- **External Dashboard, Payroll, Documents → `adminOnly`** (field users were hitting admin-only routes → redirect to profile)
- Added "My Pay" for field users under More
- Commit: 4657728

#### Push Notification Sender Exclusion Fix ✅
- Now also excludes by sender's push subscription **endpoint** (not just employee_id)
- Handles shared device / stale subscription scenarios
- Commit: 4657728

---

## Current Commit History (latest first)
```
4657728 feat: swipe-to-delete chat, mobile menu restructure, push notification fix
da9114d ui: mobile roster row — role pill center, SVG contact icons right
8429342 fix: API routes crash (FUNCTION_INVOCATION_FAILED) — brand import path
4ed164b ui: remove certs column from roster list view — declutter
7cb28f1 ui: roster list uses SVG contact icons instead of raw phone/email
d3e1f0b feat: supply tab now respects date filter on both dashboards
e29c244 fix: headshot bucket RLS for re-upload + compact unit actions dropdown
c269b61 ui: add spacing between unit photo and name in list view
b0c3de1 feat: clickable unit photo upload for admins on unit detail page
fda4367 feat: redesign Medical Directors + Deployed Units as side-by-side contact cards
eeae6a8 fix: Preview External View button now works via authenticated incidentId path
df9fdf8 feat: progress notes card now draggable, expandable, click-to-reveal
004f85a ui: expand button larger + card headers give it room, expanded overlay min-height
4909993 fix: add .js extensions to branding imports for TS 6.0 moduleResolution
6132fed fix+refactor: merge consent/comp cards into Forms & Documents, fix PDF links
29f78f5 docs: update ARCHITECTURE.md with Phase 3 completion
b6c1b9e refactor: unify internal + external fire dashboards (-551 lines)
15d598f feat: medical director flag + contact info on fire dashboards
1b3d3ce feat(encounters): animated expand overlay + fix rounded corners
b76cd06 fix(encounters): cards stretch to fill row height in 2-column grid
136cc01 feat(encounters): 2-column resizable grid layout for encounter detail
459c999 fix(consent): AMA success screen back-to-encounter link + PDF save fallback
3af6746 fix(mar): show patient initials instead of 'Last, F.' for privacy
bf29914 refactor(ui): Phase 3 complete — migrate all pages to shared UI components
0dd7d11 refactor(ui): Phase 3 — shared UI components + page migrations
a9c0fff fix: restore unit_type join and Warehouse filter in queryUnitsWithIncidents
28ae996 refactor(services): migrate employee/profile pages to service layer
e171f31 refactor(services): CS, MAR, supply-runs, ICS214, employees, admin services
1308b0c refactor(services): encounters service layer
5ef9dbd refactor(services): incidents service layer
344999b feat: QR codes for employees and units
8279a02 refactor(branding): Phase 1 complete — centralized branding layer
```

---

## Remaining Refactoring Roadmap

### Phase 4: Component Decomposition (Next Big Task)
Break up the god components — no component > 500 lines:
- `IncidentDetail.tsx` — **2,808 lines** → ~8 sub-components
- `EncounterDetail.tsx` — **~2,500 lines** → chart sections, MAR section, notes section, etc.
- `NewPCREncounter.tsx` — large multi-step form
- `Chat.tsx` — complex real-time UI

### Phase 5: Feature Modules (Stretch — Week 2)
- Colocate pages + services + types per feature domain
- `src/features/controlled-substances/`, `src/features/encounters/`, etc.

### Phase 6: Permissions System (Stretch — Week 2)
- Granular RBAC: `usePermission('financial.view')`
- Replaces binary admin/field checks

---

## Pending Bugs / Investigations

### Chat: Old Messages Not Loading
- Boss reported; could not reproduce from code
- Need browser devtools network response or DB query to diagnose
- Low priority per boss

### Push Notifications — Sender Getting Own Notification
- Added endpoint-based exclusion filter (4657728), but may still occur if:
  - The push subscription is registered under wrong employee_id (e.g., someone logged in as different user on same device without re-subscribing)
  - Multiple subscriptions for same endpoint with different employee_ids
- **To fully verify:** Query `push_subscriptions` table to check for duplicate endpoints or mismatched employee_ids
- May need a cleanup script or a "re-subscribe" button on Profile page

---

## Pending Features (Not Refactoring)
- **Persistent notification system** — bell icon, unread panel, mark-as-read
- **Comp claims detail page** — links currently go to list view
- **Supabase Realtime for chat** — `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;`
- **Field user view review** — boss hasn't walked through field UX yet

## Infrastructure / Compliance
- **Supabase BAA** — HIPAA requirement before real patient data
- **Hetzner production deployment** — self-hosted Supabase for HIPAA compliance
- **NEMSIS submission** — XML pipeline built, need validator credentials

## Other Pending
- **2 unprocessed credential emails** (Apr 5 + Apr 8) — not urgent
- **ElevenLabs receptionist** — boss exploring for Kensho Wellness

---

## ⚠️ IMPORTANT: api/_brand.ts Sync Rule

When updating brand values in `src/lib/branding.config.ts`, you MUST also update `api/_brand.ts`. Vercel serverless functions cannot import from `src/` — the `api/_brand.ts` file is a self-contained copy of brand constants for API routes. Failure to keep them in sync will cause mismatched branding in emails, push notifications, and AI chat.

---

## Key Files
- **Refactoring plan:** `/tmp/firepcr-demo/REFACTORING-PLAN.md`
- **Architecture doc:** `/tmp/firepcr-demo/ARCHITECTURE.md`
- **Branding type:** `src/lib/branding.ts`
- **Branding config (RAM):** `src/lib/branding.config.ts`
- **Branding config (Demo):** `src/lib/branding.demo.ts`
- **API brand constants:** `api/_brand.ts` ⚠️ keep in sync with branding.config.ts
- **Services:** `src/lib/services/*.ts`
- **UI components:** `src/components/ui/*.tsx` (barrel: `src/components/ui/index.ts`)
- **Contact cards:** `src/components/ContactCards.tsx` (shared between dashboards + roster)
- **Bottom tab bar:** `src/components/BottomTabBar.tsx` (mobile nav with role-aware filtering)
- **DB migrations:** `supabase/migrations/`

## Demo Sync Pattern
```bash
cd /tmp/firepcr-demo && git pull
rsync -av --delete \
  --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.vercel' \
  --exclude='src/lib/branding.config.ts' \
  /tmp/firepcr-demo/ /tmp/firepcr-demo/
npm run build && git add -A && git commit -m "sync: <description>" && git push origin main
```
Demo uses `branding.demo.ts` copied to `branding.config.ts` — never overwrite it during sync.
