# FirePCR — Afternoon Session Handoff (2026-04-20 1:15 PM PT)

## Current State
- **Prod:** `/tmp/firepcr-demo` → https://firepcr-demo.vercel.app ✅ Deployed
- **Demo:** `/tmp/firepcr-demo` → https://demo.firepcr.com ⚠️ NOT synced with afternoon changes
- **GitHub:** `flybozo/firepcr-demo` ✅ Pushed (latest: `16efc49`)
- **Supabase prod:** `kfkpvazkikpuwatthtow` | pw: `93RV8nx4J^VGR!6V`
- **Supabase demo:** `jlqpycxguovxnqtkjhzs` | pw: `EplVimePP35Zi9MY`

---

## What Was Done This Session (11:00 AM – 1:15 PM PT)

### 16 commits, 90 files changed, +3662 / -1531 lines

---

### Phase 5 — Cross-cutting Code Cleanup ✅ COMPLETE

Eliminated widespread code duplication across the codebase:

**Tier 1 — Shared utilities (7 new files):**
| Extraction | From | New File |
|---|---|---|
| `uploadSignature` | 3 files (MARNew, ICS214Detail, AMAConsent) | `src/lib/signatureUtils.ts` |
| EncounterPicker + hook | 4 files (MARNew, NewCompClaim, AMAConsent ×2) | `src/components/EncounterPicker.tsx` + `src/hooks/useEncounterPicker.ts` |
| `inputCls`/`labelCls` | 21+ files | Now import from `src/components/ui/FormField.tsx` |
| Date formatters | 6 scattered functions + 50+ inline calls | `src/utils/dateFormatters.ts` |
| `fmtCurrency` | 3 local copies | Deleted, import from `incidentFormatters.ts` |
| VitalsSection | EncounterEdit + NewSimpleEncounter | `src/components/encounters/VitalsSection.tsx` |
| Clinical options | EncounterEdit + NewSimpleEncounter | `src/data/clinicalOptions.ts` |

**Tier 2 — File decompositions (10+ new files):**
| Component | Extractions |
|---|---|
| Sidebar.tsx | `BadgePopover.tsx` |
| ChatBubble.tsx | `useSpeechRecognition.ts`, `useDraggablePosition.ts` |
| SupplyRunDetail.tsx | `useBarcodeScan.ts` |
| NewSimpleEncounter.tsx | `buildEncounterData.ts` |
| buildPcrXml.ts | `xmlHelpers.ts`, `nemsisDateUtils.ts`, `vitalsBuilder.ts`, `occupationData.ts`, `nemsisUtils.ts` |
| NewICS214.tsx | `useICS214Form.ts`, `useICS214DataLoad.ts`, `ics214` service functions |

**Commits:** `91e16c3`, `5f09698`, `6b68938`

---

### Phase 6 — Granular RBAC ✅ COMPLETE (Waves 1-3)

Replaced the binary `admin`/`field` access control with a full permission-based system.

**Wave 1 — Foundation:**
- DB tables: `roles`, `employee_roles`, `employee_permission_overrides`
- Migration: `supabase/migrations/20260420_rbac_foundation.sql`
- 8 built-in roles seeded (Super Admin, Ops Manager, Medical Director, Charge Medic, Field Medic, REMS Lead, Finance, Read Only)
- 11 active employees auto-migrated to appropriate roles
- `get_my_permissions()` RPC — resolves all permissions via role union + overrides
- `src/hooks/usePermission.ts` — `usePermission()`, `usePermissions()`, `useAnyPermission()`
- `src/contexts/PermissionProvider.tsx` — wraps app, fetches + caches permissions (IndexedDB for offline)
- `src/lib/useRole.ts` updated as backward-compat bridge
- **Commit:** `46b46f3`

**Wave 2 — Migration (28 files):**
- All `isAdmin`/`isField` checks replaced with specific `usePermission('domain.action')` calls
- Sidebar, BottomTabBar, all page-level access checks migrated
- **Commit:** `8854b38`

**Wave 3 — Admin UI:**
- New page: `/admin/roles` → `src/pages/admin/RoleManagement.tsx` (579 lines)
- Role cards with expandable permission grid (15 domains, ~45 permissions)
- Create custom roles, assign/remove employees, domain-level Select All
- Built-in roles protected with 🔒
- **Commit:** `5519009`

**Wave 4 (cleanup) — DEFERRED:**
- Remove `app_role` column from employees table
- Remove `is_medical_director` boolean column
- Tighten RLS policies to use permissions
- Remove `useRole` backward-compat bridge
- Wait until boss has tested the role management system

**Key permission domains:**
```
encounters.view/create/edit/sign/delete
mar.view/create/authorize
cs.view/count/transfer/receive/audit
incidents.view/create/manage
units.view/manage/crew
inventory.view/add
supply_runs.view/create
ics214.view/create
roster.view/manage/credentials/pii
payroll.view_own/view_all/manage
billing.view
expenses.view/manage
schedule.view_own/view_all/manage
admin.settings/push/analytics/documents
chat.admin
```

---

### External Chat Feature ✅ NEW

Fire agency liaisons can now chat with RAM units via the external dashboard.

**DB changes:** `supabase/migrations/20260420_external_chat.sql`
- `chat_channels` type check expanded: added `'external'`
- `chat_channels.access_code_id` column added
- `chat_messages.sender_id` now nullable (external users have no account)
- `chat_messages.external_sender_name` + `access_code_id` columns added

**API:**
- `api/incident-access/index.ts` — POST handler auto-creates external chat channel when generating access code, adds all incident crew as members
- `api/incident-access/chat.ts` — NEW: GET/POST for external chat via access code (rate-limited 1 msg/2 sec)
- `api/chat/messages.ts` — handles null sender_id for external messages
- `api/chat/ensure-channels.ts` — returns external channels for incident

**Frontend:**
- Fire admin dashboard has collapsible Chat panel
- External users chat as their code label (e.g. "Cal Fire IC")
- Internal crew sees 🔥 badge on external channels
- Polls every 3 seconds (external users don't have WebSocket)
- Text only for external users (no file uploads)

**Commit:** `1f04350`

---

### Super Admin DM Visibility ✅

- Super admins (anyone with `*` or `chat.admin` permission) now see ALL DMs in their channel list
- DMs show as read-only with `observer` role — visible but not a participant
- Channel names show both participants (e.g. "Z. Taylor ↔ Delores Meehan")
- Checks `employee_roles` → `roles.permissions` for `*` or `chat.admin`
- **Commit:** `16efc49`

---

### Med Unit Provider Authorization ✅

- New permission: `mar.authorize` — grants ability to authorize Rx/CS on med units
- Added to Super Admin, Medical Director, Ops Manager roles
- **Med units (MSU/REMS):** Rx and CS meds now REQUIRE prescribing provider selection + signature
- **Ambulances (Medic units):** No change — autonomous dispensing continues, provider optional
- Provider section shows ⚠️ amber warning banner when provider is required but not selected
- `useMARForm.ts` exports `requiresProviderAuth`, `isAmbulance`, `isMedUnit`, `isRx`
- **Commit:** `16efc49`

---

### Medical Director Toggle → Badge

- Removed clickable toggle from employee detail pages
- Replaced with static purple "Medical Director" badge
- Role assignment now handled through Roles & Permissions admin page
- **Commit:** `16efc49`

---

### Bug Fixes

| Fix | Commit |
|---|---|
| Chat unread badge: auto-seed on mount (was only tracking Realtime INSERTs) | `f4d3281` |
| Chat delete: admins can delete any message (was sender-only, 403 silent fail) | `9715cda` |
| Chat delete: toast on failure (was silently swallowed) | `9715cda` |
| TS errors: dragRef, Employee type, useBarcodeScan types, loadData ordering | `ba4ce89` |
| TS error: Employee type uses `full_name` (matches queryPhysicians select) | `7cc0e96` |

---

## Pending / Next Steps

### High Priority
1. **Demo sync** — NOT synced with afternoon changes (Phase 5, Phase 6, external chat, bug fixes)
2. **Phase 6 Wave 4 cleanup** — remove `app_role` column, `is_medical_director`, tighten RLS (after testing)
3. **Fort Irwin ambulance contract** — Sources Sought closes Apr 27 (7 days!)
4. **ODF IRA 2026-2029** — deadline May 31

### App — Pending Features
- Persistent notification bell (unread panel, mark-as-read)
- Comp claims detail page
- Field user UX walkthrough (boss hasn't done full field user review)
- Payroll system (blocked on bookkeeper pay schedule info)

### Infrastructure
- **Hetzner production + self-hosted Supabase** — saves ~$4K/yr vs Supabase HIPAA plan
- **NEMSIS submission** — XML pipeline complete, need validator credentials from EMSA
- **Supabase BAA** — if staying on cloud: Pro + HIPAA add-on ~$350/mo

---

## Key Files
- RBAC plan: `docs/PHASE6-RBAC-PLAN.md`
- Decomposition audit: `docs/AUDIT-DECOMPOSITION.md`
- Role management UI: `src/pages/admin/RoleManagement.tsx`
- Permission hooks: `src/hooks/usePermission.ts`
- Permission provider: `src/contexts/PermissionProvider.tsx`
- External chat API: `api/incident-access/chat.ts`
- MAR form hook: `src/pages/mar/useMARForm.ts`
- DB migrations: `supabase/migrations/20260420_*.sql`
- Architecture: `ARCHITECTURE.md`
- This handoff: `data/handoff-2026-04-20-afternoon.md`

## Demo Sync Pattern
```bash
cd /tmp/firepcr-demo && git pull
rsync -av --delete \
  --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='.vercel' \
  --exclude='src/lib/branding.config.ts' \
  /tmp/firepcr-demo/ /tmp/firepcr-demo/
npm run build && git add -A && git commit -m "sync: <description>" && git push origin main
```
Demo uses `branding.demo.ts` — never overwrite during sync.
Also run the DB migrations on demo Supabase (`jlqpycxguovxnqtkjhzs`).
