# FirePCR — Handoff: 2026-04-20 Late Afternoon Session
**Session:** 1:53 PM – 3:41 PM PDT  
**Commits:** 16 commits since `5a14dd7`  
**Latest commit:** `7f5c3d2`

---

## 1. Current State

| | |
|---|---|
| **Prod URL** | https://firepcr-demo.vercel.app |
| **Demo URL** | https://demo.firepcr.com |
| **Repo** | https://github.com/flybozo/firepcr-demo |
| **Prod Supabase** | `kfkpvazkikpuwatthtow` / pw: `93RV8nx4J^VGR!6V` |
| **Demo Supabase** | `jlqpycxguovxnqtkjhzs` / pw: `EplVimePP35Zi9MY` |
| **Latest commit** | `7f5c3d2 feat: encounter ownership, note author delete, DEA/NPI provider-only` |
| **Demo sync** | ⚠️ **NOT synced** — demo is behind by all 16 commits from this session |

---

## 2. What Was Done (16 commits since `5a14dd7`)

### External Dashboard Chat

**`ec493a2` — feat: external chat avatars, unread badge, auto-add medical directors**
- Employee headshots (32px avatar) appear next to their messages in external chat panel
- 🔥 fire emoji used as avatar for external senders (fire agency liaisons)
- Unread message count badge added to the "Chat" tab pill on the external dashboard
- Medical directors are now auto-added as members of external channels when an access code is created (so they can see/respond to fire liaison messages immediately)

**`a849363` — fix: external chat double name, add avatar upload for external users**
- Removed the duplicate orange pill badge that was showing the sender name twice in external chat
- Added avatar upload for external users: clicking the 🔥 fire emoji opens a file picker; uploaded headshot is stored in the `chat-files` bucket and saved to `incident_access_codes.avatar_url`

**`baa6626` (partial) — feat: external avatars in internal Team Chat**
- External user avatars (from `incident_access_codes.avatar_url`) are now looked up and shown in the internal Team Chat when external senders appear in the channel

**`baa6626` (partial) — feat: photo sharing in external chat**
- 📷 button in external chat composer allows fire liaisons to send photos
- 5MB max file size enforced client-side
- Images render inline in the chat with a lightbox tap-to-expand
- Stored in `chat-files` bucket (public read)

---

### Agency Analytics

**`b379ccc` — feat: patients by agency bar chart with agency logos**
- Removed "County Fire" from the agency list (wasn't a real distinct agency in the data)
- Renamed "State/Local Fire" → "Local" for clarity
- New `AgencyBarChart` component (`src/components/charts/AgencyBarChart.tsx`):
  - Recharts `BarChart` with agency logo images rendered on top of each bar
  - Reusable: accepts `data`, `height`, optional `title`
- Integrated in three places:
  1. Analytics > ClinicalTab (`src/pages/analytics/components/ClinicalTab.tsx`)
  2. External Dashboard > OverviewTab (`FireAdminDashboard.tsx`)
  3. Internal Dashboard > OverviewTab (admin `FireDashboard.tsx` / `admin/FireDashboard.tsx`)

---

### Chat System Improvements

**`f9c3b1c` — fix: chat unread badges (sidebar + external dashboard)**
- Rewrote `useChatUnread` hook with a **shared global store** using `useSyncExternalStore`
- All components subscribing to unread counts now share one in-memory store — badges sync instantly across Sidebar, BottomTabBar, and external dashboard without redundant polling
- Added `get_unread_counts(p_employee_id)` Postgres RPC that returns all unread counts in a single query (replaces N+1 per-channel fetches)

**`b62b096` (partial) — fix: message delete persistence**
- Added `deletedIdsRef` to `useChatMessages` — tracks soft-deleted message IDs
- Prevents polling from "resurrecting" messages that were just deleted (race condition where polling fetched before the delete propagated)

**`baa6626` (partial) — feat: own avatar on own messages in Team Chat**
- Your own headshot now appears next to your own messages in the internal Team Chat (was blank before)

**`baa6626` (partial) — feat: channel archive system**
- New `archived_at` column on `chat_channels`
- New API endpoint: `api/chat/archive.ts` (POST to archive, DELETE to unarchive)
- UI: swipe right on a channel (mobile) or right-click (desktop) → Archive option
- Archived channels hidden from default list; accessible via a toggle
- Auto-archive: when an access code is deactivated, its external channel is automatically archived

**`8d42f0a` — feat: styled chat section headers, drag/drop reorder, collapse, fix message delete**
- Color-coded section headers in the channel list:
  - 🔵 Company | 🔴 Incidents | 🟢 Units | 🟣 DMs | 🟠 External
- Collapsible sections: click section header to collapse/expand; state persisted in `localStorage`
- Drag-and-drop section reorder: powered by `@dnd-kit`; new order persisted in `localStorage`
- Each section header shows aggregate unread count badge for all channels in that section

---

### Bug Fixes

**`36e0888` — fix: crash on Patient Log tab when encounter has no comp claim**
- `PatientLogTab.tsx`: added null check `claim?.supervisor_name` — was throwing on encounters with no comp claim attached

**`1fdf7db` — fix: add is_owner to requireEmployee select (TS2339)**
- `api/_auth.ts` `requireEmployee()` was missing `is_owner` in its Supabase select, causing TypeScript error TS2339 wherever `employee.is_owner` was referenced

**`e9e41e9` — fix: mobile PDF downloads + unit filter scoped to incident history**
- Mobile browsers block `window.open()` called from async context (popup blocker false-positive)
- Fix: create an `<a download>` element, programmatically `.click()` it — bypasses the popup blocker
- Unit filter on the Incident Dashboard now shows **all units ever assigned** to the incident (not just units that have encounters) — prevents missing units in the filter pills

**`b62b096` (partial) — fix: avatar upload moved to public bucket**
- Employee headshot upload was targeting the private `documents` bucket
- Moved to `chat-files` (public read) so avatars render without signed URL expiry issues

**`b62b096` (partial) — fix: access code delete FK constraints**
- `incident_access_log.access_code_id` → `ON DELETE CASCADE` (log rows deleted with the code)
- `chat_messages.access_code_id` → `ON DELETE SET NULL` (messages preserved, just detached from code)
- Migration: `supabase/migrations/20260420_fix_access_code_fk_cascade.sql`

**`6a36f11` — fix: medical director infinite loading loop on /admin**
- Medical directors have `encounters.*` + `admin.analytics` permissions
- `useRole()` was only checking `admin.settings` and `admin.*` for "is admin" — medical directors fell through to field-user code, which then redirected back, causing an infinite loop
- Fix: `useRole()` now checks `*`, `admin.settings`, `admin.*`, `admin.analytics`, `encounters.*` — any of these grants admin app access
- Also added `useChatUnread` hook fallback for unauthenticated contexts

**`38e9321` / `f565b27` — fix: avatar upload public bucket + Vercel redeploy**
- Two small follow-up commits fixing avatar upload to consistently use the `chat-files` public bucket
- `f565b27` is a forced Vercel redeploy (empty commit) after the bucket fix

---

### Encounter & Roster

**`7f5c3d2` — feat: encounter ownership, note author delete, DEA/NPI provider-only**
- **Encounter ownership restrictions:** Only the creator of an encounter can delete (draft), mark complete, or sign & lock it. Non-creators see a "pending review" indicator. Editing is still allowed for collaborative charting.
- **Progress note delete restricted to author:** Removed the admin bypass — only the note's author can delete their own unsigned progress notes
- **DEA field provider-only:** The DEA number field in the Provider section is now shown only for MD, DO, PA, and NP roles
- **NPI number field added:** New `npi_number` field in `EmployeeDetail.tsx` for providers; stored in `employees.npi_number`

---

## 3. DB Migrations Applied to Prod

All 6 migrations have been applied to prod Supabase (`kfkpvazkikpuwatthtow`).  
**Demo Supabase (`jlqpycxguovxnqtkjhzs`) is NOT synced — needs all 6 run there too.**

| Migration File | What It Does |
|---|---|
| `supabase/migrations/20260420_rbac_foundation.sql` | Phase 6 Wave 1: Creates `roles`, `employee_roles`, `employee_permission_overrides` tables. Seeds 8 built-in roles. Migrates existing employees. Creates `get_my_permissions()` RPC. |
| `supabase/migrations/20260420_add_is_owner_flag.sql` | Adds `is_owner boolean` to `employees`. Sets `is_owner = true` for `admin@ridgelineems.com`. |
| `supabase/migrations/20260420_external_chat.sql` | Adds `external` channel type. Adds `access_code_id` to `chat_channels` and `chat_messages`. Makes `chat_messages.sender_id` nullable. Adds `external_sender_name` column. Index on `chat_channels.access_code_id`. |
| `supabase/migrations/20260420_unread_counts_rpc.sql` | Creates `get_unread_counts(p_employee_id uuid)` RPC — single-query unread counts for all channels a user is a member of. |
| `supabase/migrations/20260420_access_code_avatar.sql` | Adds `avatar_url text` to `incident_access_codes` for external user headshots. |
| `supabase/migrations/20260420_fix_access_code_fk_cascade.sql` | Fixes FK constraints: `incident_access_log → access_code` CASCADE, `chat_messages → access_code` SET NULL. Adds public read policy for external avatar images. |
| `migrations/add_archived_at_to_chat_channels.sql` | Adds `archived_at timestamptz` to `chat_channels` for the channel archive system. *(In `migrations/` not `supabase/migrations/` — apply manually.)* |

---

## 4. Pending / Next Steps

### 🔥 Urgent
- **Fort Irwin Sources Sought** — closes **April 27** (7 days!). Need to finalize and submit.
- **ODF IRA 2026-2029** — deadline **May 31**.

### Demo Sync (Do This Soon)
Demo is behind by the entire afternoon session. See sync pattern in Section 6.

### Phase 6 Wave 4 Cleanup
- Remove legacy `app_role` column from `employees` (replaced by RBAC roles)
- Remove `is_medical_director` boolean from `employees` (replaced by `medical_director` role)
- Tighten RLS policies (currently permissive `USING (true)` — lock down to authenticated employees)

### Feature Backlog
- **Persistent notification bell** — in-app notification history / bell icon
- **Comp claims detail page** — dedicated view/edit page for workers' comp claims
- **Payroll system** — blocked on bookkeeper info (need to know what they need)
- **Hetzner prod + self-hosted Supabase** — ~$4K/yr savings vs Supabase HIPAA plan; high priority for HIPAA compliance

---

## 5. Demo Sync Pattern

```bash
# 1. Pull latest on demo repo
cd /tmp/firepcr-demo && git pull

# 2. Rsync source files (exclude git, node_modules, dist, vercel artifacts, and demo-specific configs)
rsync -av --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.vercel' \
  --exclude='src/lib/branding.config.ts' \
  --exclude='api/_brand.ts' \
  /tmp/firepcr-demo/ /tmp/firepcr-demo/

# Demo uses branding.demo.ts — NEVER overwrite branding.config.ts or api/_brand.ts during sync.

# 3. Build + verify
cd /tmp/firepcr-demo && npm run build

# 4. Push to demo Vercel
cd /tmp/firepcr-demo && git add -A && git commit -m "sync: late afternoon 2026-04-20" && git push

# 5. ALSO run DB migrations on demo Supabase (jlqpycxguovxnqtkjhzs)
# Run all 6 migrations that were applied to prod this session:
#   - 20260420_rbac_foundation.sql
#   - 20260420_add_is_owner_flag.sql
#   - 20260420_external_chat.sql
#   - 20260420_unread_counts_rpc.sql
#   - 20260420_access_code_avatar.sql
#   - 20260420_fix_access_code_fk_cascade.sql
#   - migrations/add_archived_at_to_chat_channels.sql (manual apply)
```

---

## 6. Key Files Changed (29 files, +1220/-172 lines)

### New Files
| File | Purpose |
|---|---|
| `api/chat/archive.ts` | Channel archive/unarchive endpoint (POST = archive, DELETE = unarchive) |
| `api/incident-access/avatar.ts` | External user avatar upload (multipart → chat-files bucket → saves URL to access code) |
| `src/components/charts/AgencyBarChart.tsx` | Reusable agency bar chart with agency logo images on top of bars (Recharts) |
| `supabase/migrations/20260420_unread_counts_rpc.sql` | `get_unread_counts()` RPC |
| `supabase/migrations/20260420_access_code_avatar.sql` | `avatar_url` on access codes |
| `supabase/migrations/20260420_fix_access_code_fk_cascade.sql` | FK cascade fixes |
| `migrations/add_archived_at_to_chat_channels.sql` | `archived_at` column on channels |

### Significantly Modified Files
| File | What Changed |
|---|---|
| `src/hooks/useChatUnread.ts` | Full rewrite: shared global store via `useSyncExternalStore`, `get_unread_counts` RPC, section aggregate badges |
| `src/hooks/useChatMessages.ts` | Added `deletedIdsRef` for delete persistence, photo message support |
| `src/components/chat/ChannelListPanel.tsx` | Color-coded headers, collapsible sections, drag-and-drop reorder (dnd-kit), section unread badges |
| `src/components/chat/ChannelItem.tsx` | Archive gesture (swipe-right mobile, right-click desktop) |
| `src/components/chat/MessageBubble.tsx` | Own avatar, external avatar lookup, photo inline + lightbox, delete persistence |
| `src/pages/encounters/EncounterDetail.tsx` | Encounter ownership restrictions (delete/complete/sign gated to creator) |
| `src/components/encounters/sections/ProgressNotesSection.tsx` | Delete restricted to note author only |
| `src/pages/roster/EmployeeDetail.tsx` | NPI number field, DEA provider-only visibility |
| `src/pages/analytics/components/ClinicalTab.tsx` | AgencyBarChart integration |
| `src/pages/fire-admin/FireAdminDashboard.tsx` | Photo sharing, external avatar upload, AgencyBarChart in OverviewTab |
| `src/pages/admin/FireDashboard.tsx` | AgencyBarChart in internal dashboard OverviewTab |
| `src/pages/chat/Chat.tsx` | Archive support, section collapse/reorder |
| `src/lib/useRole.ts` | Expanded checks: `*`, `admin.settings`, `admin.*`, `admin.analytics`, `encounters.*` |
| `api/_auth.ts` | Added `is_owner` to `requireEmployee` select |
| `api/incident-access/index.ts` | Auto-add medical directors to external channels on code creation |
| `api/incident-access/chat.ts` | Photo message support, avatar URL in responses |
| `src/types/chat.ts` | Extended external sender type with `avatar_url` |
| `src/components/AgencyLogo.tsx` | Updated agency list (removed County Fire, renamed Local) |
