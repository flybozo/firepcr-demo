# FirePCR — Current Status
**App:** https://ram-field-ops.vercel.app  
**Demo:** https://demo.firepcr.com  
**Repo:** github.com/flybozo/ram-field-ops  
**Local:** `/tmp/ram-field-ops` (prod) | `/tmp/firepcr-demo` (demo)  
**DB (prod):** kfkpvazkikpuwatthtow | `postgresql://postgres:93RV8nx4J^VGR!6V@db.kfkpvazkikpuwatthtow.supabase.co:5432/postgres`  
**DB (demo):** jlqpycxguovxnqtkjhzs | `postgresql://postgres:EplVimePP35Zi9MY@db.jlqpycxguovxnqtkjhzs.supabase.co:5432/postgres`  
**Last updated:** 2026-04-21 3:16 PM PT  
**Architecture doc:** v1.19.0 (updated 2026-04-21)

---

## Demo Sync Status
✅ **Demo synced as of 2026-04-21 ~3pm** — all today's features included, DB migrations applied.

---

## Refactoring Phases — ALL COMPLETE ✅
- [x] Phase 1–6: Branding, service layer, shared UI, component decomposition, multi-role, RBAC

---

## Feature Pipeline

- [x] **Feature 1: Live Unit GPS Map** — DONE ✅ (2026-04-20, v1.18.0)
- [x] **Feature 2: Activity Timeline Feed** — DONE ✅
- [x] **Feature 4: CSV Export of Patient Log** — DONE ✅
- [x] **In-App Notification Inbox** — DONE ✅ (2026-04-21, v1.19.0)
  - Bell badge (sidebar + BottomTabBar), per-item dismiss, clear all, persists across reloads
  - `notification_reads` table with `dismissed` boolean column
  - `useUnreadNotificationCount` hook — instant refresh via custom event
- [x] **24hr Medical Ops Report PDF** — DONE ✅ (2026-04-21, v1.19.0)
  - Client-side jsPDF, external fire admin dashboard Overview tab
  - Sections: patient summary, chief complaints, agency breakdown, consumables
- [x] **Employee Self-Service Onboarding** — DONE ✅ (`/onboard` route)
  - Full multi-step form, creates auth + employee row, sends welcome email
  - Linked from login page
- [x] **Admin Provisioning Endpoint** — DONE ✅ (`POST /api/admin/provision-user`)

- [ ] **Feature 3: End-of-Incident Medical Summary PDF** — NOT STARTED
  - Auto-generated at incident closeout
  - Sections: patient count, treatments, medications, CS usage, crew list
  - Goes in the incident package for the fire agency
  - No `api/summary` endpoint, no PDF builder yet

- [ ] **Feature 5: Daily Ops Summary** — NEEDS WORK (partially built?)
  - On-demand shift-level summary — encounters per unit, meds given, supply usage, CS counts
  - Check current state before starting

- [ ] **Admin "Add Employee" UI** — NOT STARTED
  - Add employee directly from Roster page (admin fills basics → account created)
  - Self-service `/onboard` exists for employee-initiated flow
  - Admin flow: modal/form on Roster page → calls `provision-user` endpoint
  - Boss decision: Supabase is sole source of truth — NO Google Sheets, NO AppScript

---

## External Fire Admin Dashboard — Current Tabs
1. **Overview** — metrics, unit cards, 📄 24hr Report button
2. **Timeline** — activity feed
3. **Patient Log** — table + CSV export + comp claim PDF links
4. **ICS 214s** — list + PDF links
5. **Supply** — supply run log
6. **Chat** — external liaison chat with photo sharing, avatar uploads
7. **Live Map** — unit locations + NIFC perimeters (polling every 30s)

---

## Other Known Pending Items
- [ ] **Hetzner production migration** — deferred to fall/winter 2026. Recommendation: get Supabase Pro BAA for HIPAA compliance this fire season instead.
- [ ] **Filter UX overhaul** — boss wants to think about it before building (filter drawer vs active chips vs view presets)
- [ ] www.firepcr.com blue flame logo deployed ✅ — no RAM references remain

## Decisions Made (don't re-litigate)
- **Google Sheets / AppScript / AppSheet:** FULLY ABANDONED. Supabase + app UI is the only source of truth going forward. Do not suggest sheets-based workflows.
- **Employee management:** All through the app. Self-service via `/onboard`, admin provisioning via Roster UI (to be built).
- **Pay rates:** Paramedics + RNs = $800/day (set 2026-04-21)

---

## How to Start a FirePCR Session
1. Read this file (`data/firepcr-status.md`)
2. Read `/tmp/ram-field-ops/ARCHITECTURE.md` for deep technical detail
3. That's it — don't hunt for dated handoff files

## How to End a FirePCR Session
1. Overwrite this file with updated status
2. Update `/tmp/ram-field-ops/ARCHITECTURE.md` version + new sections, commit + push
3. Dated handoff files are optional for history only
