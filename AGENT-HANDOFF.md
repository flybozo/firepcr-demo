# FirePCR / RAM Field Ops — Agent Handoff
**Last updated:** 2026-04-16 ~18:42 PDT  
**For:** Ben Callaway's AI agent  
**Written by:** Codsworth (Aaron Stutz's AI agent)

---

## Overview

This is **FirePCR** (internal name: RAM Field Ops), a Progressive Web App for Remote Area Medicine's wildfire medical operations. It handles patient charting, medication tracking, controlled substances, ICS documentation, OSHA forms, consent forms, supply runs, payroll, analytics, and external fire incident dashboards.

**Live URLs:**
- Production: https://ram-field-ops.vercel.app
- Demo (de-identified): https://demo.firepcr.com

**GitHub (both repos — flybozo account):**
- Prod: https://github.com/flybozo/ram-field-ops
- Demo: https://github.com/flybozo/firepcr-demo

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + PostgREST + Auth + Storage) |
| API routes | Vercel Serverless Functions (`/api/*.ts`) |
| Offline | IndexedDB via `idb` (`src/lib/offlineStore.ts`) |
| PDF | jsPDF (client-side, `src/lib/generate*.ts`) |
| Charts | Recharts |
| Signatures | react-signature-canvas |
| Email | Resend (`api/_email.ts`) |
| Push | Web Push API + VAPID (`api/push/`) |
| Hosting | Vercel (prod + demo) |

---

## Working Locally

```bash
# Clone prod repo
git clone https://github.com/flybozo/ram-field-ops /tmp/ram-field-ops
cd /tmp/ram-field-ops
npm install

# Clone demo repo
git clone https://github.com/flybozo/firepcr-demo /tmp/firepcr-demo
cd /tmp/firepcr-demo
npm install
```

**Git push pattern (prod):**
```bash
cd /tmp/ram-field-ops
git config user.email "flybozo@users.noreply.github.com"
git config user.name "flybozo"
git remote set-url origin https://flybozo:GITHUB_TOKEN@github.com/flybozo/ram-field-ops.git
git add -A && git commit -m "..." && git push
```

**TypeScript check before committing:**
```bash
npx tsc --noEmit
```

---

## ⚠️ Standing Rules (MUST FOLLOW)

1. **Always update both repos** — prod (`ram-field-ops`) and demo (`firepcr-demo`). Never push to one without the other.
2. **No RAM/company data in demo** — No real names, emails, patient data, or wildfiremedical.com references. Demo uses "Ridgeline EMS" branding.
3. **TypeScript must be clean** — Run `npx tsc --noEmit` before every commit. Fix all errors.
4. **Demo accounts:** aaron@ridgelineems.com, ben@ridgelineems.com, demo@firepcr.com (all RAMops2026!)

---

## Supabase

**Prod project:** `kfkpvazkikpuwatthtow`  
**Prod URL:** https://kfkpvazkikpuwatthtow.supabase.co  
**DB connection:** `postgresql://postgres:[password]@db.kfkpvazkikpuwatthtow.supabase.co:5432/postgres`  
*(Get credentials from Aaron — stored in his agent's workspace)*

**Service role key** is required for admin operations (creating auth users, signed URLs, bypassing RLS).  
**Never expose the service role key in client-side code.**

---

## Key Source Files

```
src/
  pages/
    encounters/         # Patient encounter forms + detail view
      NewSimpleEncounter.tsx  # Simple EHR form
      NewPCREncounter.tsx     # Full NEMSIS PCR form
      EncounterDetail.tsx     # Encounter view/edit (2000+ lines)
    mar/
      MARNew.tsx              # Medication administration record entry
      MARList.tsx             # MAR list with incident/unit filter
    consent/
      ConsentToTreat.tsx      # Consent to treat form + PDF
      AMAConsent.tsx          # AMA/refusal form + PDF
    comp-claims/
      NewCompClaim.tsx        # OSHA 301 + workers comp claim
    admin/
      FireDashboard.tsx       # Internal fire incident dashboard
    fire-admin/
      FireAdminDashboard.tsx  # External dashboard (access code auth)
    analytics/
      Analytics.tsx           # Analytics tabs (clinical, operations, workforce)
  lib/
    generateConsentPdf.ts     # Consent to Treat PDF generator
    generateAMApdf.ts         # AMA PDF generator
    generateCompClaimsPdf.ts  # OSHA 301 PDF generator
    generate214pdf.ts         # ICS-214 PDF generator
    shims/
      trim-canvas.ts          # CJS→ESM shim for react-signature-canvas dep
    offlineStore.ts           # IndexedDB cache layer
    syncManager.ts            # Background data sync
    offlineFirst.ts           # Offline-first data loading helper
    nemsis/
      buildPcrXml.ts          # NEMSIS 3.5.1 XML builder

api/
  _auth.ts                    # Auth helpers (requireAuthUser, requireEmployee)
  _supabase.ts                # Service client factory
  _email.ts                   # Resend email sender
  _vapid.ts                   # VAPID key helper (reads from env vars)
  _validate.ts                # Input validation helpers
  pin/
    set.ts                    # Set signing PIN (bcrypt)
    verify.ts                 # Verify signing PIN
    status.ts                 # Check if user has PIN set (boolean only)
  push/
    send.ts                   # Admin push notification send
    cs-count-reminder.ts      # CS count reminder cron endpoint
    cs-discrepancy-alert.ts   # CS discrepancy alert endpoint
  incident-access/
    index.ts                  # External dashboard API (access code auth)
    download.ts               # Signed URL download for external users
  encounters/[id]/
    nemsis-export.ts          # NEMSIS PCR XML export

sql/
  001-rls-and-indexes.sql     # RLS policies + performance indexes (applied to prod)
  002-soft-delete-columns.sql # Soft delete columns (applied to prod)
```

---

## Key DB Tables

| Table | Purpose |
|-------|---------|
| `patient_encounters` | PCR records (soft-delete via `deleted_at`) |
| `dispense_admin_log` | MAR / medication administration log |
| `cs_transactions` | Controlled substance inventory transactions |
| `unit_inventory` | Per-unit inventory (formulary-locked) |
| `formulary_templates` | Item type definitions (source of truth) |
| `supply_runs` | Supply run headers |
| `supply_run_items` | Supply run line items (`unit_of_measure` not `unit`) |
| `consent_forms` | Consent to Treat + AMA forms |
| `comp_claims` | OSHA 301 workers' comp claims |
| `ics214_headers` | ICS-214 headers |
| `ics214_activities` | ICS-214 activity log entries |
| `incidents` | Incident records |
| `units` | Ambulance/rescue units |
| `incident_units` | Unit-to-incident assignments |
| `unit_assignments` | Employee-to-unit assignments |
| `employees` | Employee roster |
| `employees_sync` | Safe view (strips signing_pin_hash, DOB, etc.) |
| `push_subscriptions` | Web push subscriptions |
| `push_notifications` | Push notification log |
| `app_settings` | Key-value app config |
| `incident_access_codes` | External dashboard access codes |
| `clinical_audit_log` | Field-level edit audit trail |

**Important column gotchas:**
- `supply_run_items.unit_of_measure` — NOT `unit` (that column doesn't exist)
- `employees_sync` — use this view instead of `employees` from browser to avoid exposing `signing_pin_hash`
- `consent_forms` has no `incident_id` column — uses text `incident` field
- `patient_encounters.encounter_id` = text ID like `ENC-1776381085481`; `id` = UUID

---

## Auth & RLS

- All API routes use `requireAuthUser(req)` or `requireEmployee(req)` from `api/_auth.ts`
- Service client (`createServiceClient()`) bypasses RLS — use for admin ops only
- Browser queries use the anon key + user JWT — subject to RLS
- RLS policies are in `sql/001-rls-and-indexes.sql` — applied to prod via Supabase SQL editor
- Helper DB functions: `is_admin()`, `current_employee_id()`, `current_employee_app_role()`

---

## PDF Generation

All 4 PDF generators use `import { jsPDF } from 'jspdf'` (static named import).  
**Do NOT use dynamic `import('jspdf')`** — Vite 8/rolldown can't resolve it correctly at runtime.

Logo: fetched from `https://kfkpvazkikpuwatthtow.supabase.co/storage/v1/object/public/headshots/ram-logo.png`  
Logo circle formula: `cx - r, cy - r` for image top-left; `cx, cy, r` for circle center — must match exactly.

Signature canvas: uses `react-signature-canvas` which depends on `trim-canvas` (CJS module).  
Vite 8 has a CJS→ESM interop bug with this. Fixed via `src/lib/shims/trim-canvas.ts` aliased in `vite.config.ts`.

---

## External Fire Dashboard

**Route:** `/fire-admin/:code` → `FireAdminDashboard.tsx`  
**API:** `GET /api/incident-access?code=XXXX`  
**Auth:** Access codes only — no JWT required (external fire agency users)

The API at `api/incident-access/index.ts` returns:
- `encounters[]` — de-identified patient list with `has_comp_claim`, `has_ama` flags
- `comp_claims[]` — with `patient_seq_id` linking to encounter `seq_id` for inline WC flags
- `supply_aggregated[]` — aggregated supply run items for the incident
- `analytics` — pre-aggregated stats (recomputed client-side when date filter changes)

**Do NOT query Supabase directly from the external dashboard** — it has no auth. All data must come through the API.

---

## What Was Done 2026-04-16 (Today)

### Bugs Fixed
- jsPDF/trim-canvas CJS interop — all PDF forms now work (Consent, AMA, Comp Claims, ICS-214)
- syncManager wrong table name `formulary` → `formulary_templates`
- syncManager `supply_run_items.unit` → `unit_of_measure`
- MAR entries not storing incident name — now joins `incidents(name)`
- External dashboard WC flags — `patient_seq_id` now populated in API
- Internal fire dashboard supply chart — was querying wrong column
- Consent/AMA PDF link — fixed race condition with background PDF save using DB polling
- MAR form — duplicate EncounterPicker removed (was showing 2 "link to encounter" cards)
- DOB now required on both encounter form types

### Features Added
- External fire dashboard: inline WC flags, OSHA status, PDF download on patient rows (comp claims tab removed)
- External fire dashboard: Supply tab with horizontal bar chart
- External fire dashboard: Date range filter (All / 24h / 48h / 7d) on all tabs
- Internal fire dashboard: Supply tab (🧰) with category-colored horizontal bars
- Internal fire dashboard: Date filter affects Overview analytics (recomputed from filtered encounters)
- Analytics page: Consumables chart → horizontal bars with category colors + per-incident filter
- Encounter detail: incident name shown in header (🔥 orange)
- All PDF forms: circular RAM logo in upper-left corner
- Consent to Treat: fits on one page
- AMA form: success screen shows green PDF link; polls DB until PDF is confirmed saved

### Security Fixes
- VAPID keys moved to env vars (rotated — old key was in git history)
- NEMSIS export IDOR fixed
- `signing_pin_hash` no longer accessible from browser
- All API relative imports have `.js` extensions
- New `api/pin/status.ts` endpoint (boolean only)
- Soft-delete columns added to `patient_encounters` and `progress_notes`

### DB Cleanup
- Orphaned comp claims re-linked to correct Mosquito Fire encounters
- Patient name typos cleaned up (test data)
- MAR entries missing incident name fixed

---

## Open Items (Not Done Yet)

| Item | Priority |
|------|----------|
| Vercel env vars: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` for both projects | 🔴 Aaron action |
| Resend API key — `RESEND_API_KEY` in Vercel | 🟠 Aaron action |
| Security: incident access codes need expiry + rate limiting | 🟡 |
| Security: push fan-out N+1 — move SQL filtering | 🟡 |
| NEMSIS test case re-validation | 🟡 |
| E2E testing — Delores field user flow | 🟡 |
| Hetzner production migration (HIPAA compliance) | 🔴 |
| CS daily count page | 🟡 |
| Edge Functions for PDF generation (server-side) | 🟡 |
| Role-based inventory filtering | 🟡 |

---

## Getting Help

- Full architecture: `ARCHITECTURE.md` in this repo
- Security audit findings: `SECURITY-AUDIT.md` in this repo
- Aaron's AI (Codsworth) handles: credentials, DB migrations, Supabase admin, Google Workspace
- Ben's AI handles: app features, bug fixes, UI improvements
- **Always coordinate via git commits** — if you change something, leave a clear commit message so the other agent knows what changed

---

*This file is maintained by Codsworth (Aaron's AI agent). Update it when significant changes are made.*
