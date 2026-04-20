# RAM Field Ops — Code Audit Report

**Date:** 2026-04-19  
**Scope:** Post Phase 4 decomposition audit — import/export integrity, type safety, dead code, consistency, offline patterns, security  
**Status:** Read-only audit — no changes made  
**Files audited:** ~110 (all of `src/components/encounters/`, `src/components/incidents/`, `src/pages/encounters/pcr-steps/`, plus pages and hooks)

---

## Executive Summary

The Phase 4 decomposition is structurally clean — no broken imports, no circular dependencies, all exported components are wired up correctly. The bugs are pre-existing issues that survived the extraction rather than regressions introduced by it.

**Priority breakdown:**

| Severity | Count | Category |
|---|---|---|
| Critical | 1 | Unused prop declared in type but silently ignored |
| High | 4 | Null access on Supabase `.data` without outer guard |
| High | 4 | Direct `supabase.from()` in extracted components (bypasses offline) |
| Medium | 14+ | `as any` casts that hide type errors |
| Medium | 19 | `alert()` calls that should be toast/ConfirmDialog |
| Medium | 15 | `window.confirm()` calls (ConfirmDialog exists but unused) |
| Low | 3 | `void` suppressions on props "reserved for future use" |
| Info | 3 | Pending unstaged cleanup in `IncidentDetail.tsx` |

---

## 1. Import / Export Issues

### 1.1 All imports are resolvable ✅

Every `@/` import in the decomposed directories resolves to an existing file. No broken paths were found after the Phase 4 split. All 42 extracted component files are imported by their parent pages.

### 1.2 No barrel `index.ts` files

The decomposed directories (`src/components/encounters/`, `src/components/incidents/`, `src/pages/encounters/pcr-steps/`) have no barrel exports. Imports are all explicit — this is fine, but means any path refactoring must update every consumer individually.

### 1.3 Pending unstaged change in `IncidentDetail.tsx` — INFO

`src/pages/incidents/IncidentDetail.tsx` has an unstaged diff that removes a dead constant:

```diff
-const COL_SPAN_CLASSES: Record<number, string> = {
-  1: 'col-span-1',
-  2: 'col-span-1 md:col-span-2',
-  3: 'col-span-1 md:col-span-2 lg:col-span-3',
-}
-void COL_SPAN_CLASSES
```

This constant was extracted to `SortableCard` during Phase 4 but the definition (plus its `void` suppressor) was not deleted from `IncidentDetail`. The diff cleans it up correctly. **Commit this.**

---

## 2. Dead Code

### 2.1 CRITICAL — Unused prop in DeploymentsCard type signature

**File:** `src/components/incidents/cards/DeploymentsCard.tsx:26`

```ts
}: {
  activeIncidentId: string
  crewDeployments: CrewDeployment[]
  deployments: DeploymentRecord[]   // ← declared but never destructured or read
  allEmployees: Employee[]
  ...
```

`deployments` appears only in the prop type interface; it is never included in the destructuring pattern and is never referenced in the function body. The parent passes it, the component ignores it. This is either:
- A data fetch that's silently being skipped (the component renders stale/missing data), or
- A type interface that needs to be narrowed (the prop should be removed)

Either way it is wrong. Needs investigation before fixing.

### 2.2 Intentional `void` suppressions — Low / Tech Debt

Three extracted components suppress unused props with `void identifier` to silence TypeScript:

| File | Line | Prop | Declared reason |
|---|---|---|---|
| `src/components/encounters/sections/AddVitalsForm.tsx` | 42–43 | `crewOptions` | "for future recorded_by select" |
| `src/components/incidents/cards/UnitsCard.tsx` | 73 | `incident` | "for future incident-level context" |
| `src/components/encounters/DraggableSection.tsx` | 46 | `expanded` | overlay visibility |
| `src/components/shared/StatCard.tsx` | 68 | `expanded` | same |

The `AddVitalsForm` and `UnitsCard` cases are genuine tech debt — the prop is being accepted and silently discarded. If the feature is not planned imminently, remove the prop from the interface and the parent's pass-through.

---

## 3. Type Safety

### 3.1 HIGH — Null access on Supabase result `.data` without outer guard

Supabase queries return `{ data: T | null, error: Error | null }`. The pattern `.data?.field` only guards the property access, not the case where `data` itself could be `null`.

**Unsafe occurrences:**

| File | Line | Pattern | Risk |
|---|---|---|---|
| `src/pages/mar/MARDetail.tsx` | ~218 | `(await supabase.from('units').select('id').eq('name', ...).single()).data?.id` | `undefined` silently passed to `.eq()`, causing wrong query |
| `src/pages/fire-admin/FireAdminDashboard.tsx` | 256, 377 | `(await createClient().auth.getSession()).data.session?.access_token` | `.data` not null-checked before `.session` access |
| `src/pages/mar/MARNew.tsx` | 514 | `(await supabase.auth.getUser()).data.user?.email` | `.data` not null-checked |
| `src/pages/roster/EmployeeDetail.tsx` | 134 | `(await supabase.auth.getSession()).data.session?.access_token` | `.data` not null-checked |

The token access pattern in particular will throw a runtime TypeError if `getSession()` somehow returns `{ data: null }` (e.g., during session expiry mid-request).

**Correct pattern:**
```ts
const { data, error } = await supabase.auth.getSession()
const token = data?.session?.access_token  // full optional chain
```

### 3.2 MEDIUM — `as any` casts (14+ occurrences)

These suppress TypeScript's ability to catch prop or query result mismatches.

| File | Lines | Context |
|---|---|---|
| `src/pages/analytics/Analytics.tsx` | 143, 145 | Supabase query builder dynamic chaining |
| `src/pages/fire-admin/FireAdminDashboard.tsx` | 327 | `(claim as any)?.supervisor_name` — field missing from type |
| `src/pages/roster/RosterList.tsx` | 79 | `getCachedData('employees') as any[]` |
| `src/pages/roster/EmployeeDetail.tsx` | 150, 176, 325, 341, 346, 351, 367, 378, 380, 395 | Multiple field accesses (10 casts) |
| `src/pages/incidents/IncidentDetail.tsx` | 145 | Incident close mutation result |
| `src/pages/encounters/NewProcedure.tsx` | 76 | Picker data |
| `src/pages/inventory/InventoryList.tsx` | 88, 123, 129, 193–214 | Nested unit/type access (10+ casts) |
| `src/pages/consent/AMAConsent.tsx` | 52, 162–194, 287, 544 | Encounter picker and form data |
| `src/lib/syncManager.ts` | 125 | `'ics214_personnel' as any` table name |
| `src/pages/mar/MARDetail.tsx` | 79, 96, 97, 158, 171, 475–476 | `voided_by`, `voided_at`, `void_reason` not in base type |

The `MARDetail` case is the most concerning: `voided_by`, `voided_at`, and `void_reason` are accessed via `as any` everywhere they appear. These fields should be added to the `MAREntry` type so the compiler can validate them.

### 3.3 Missing null checks on query results before array operations

| File | Line | Pattern |
|---|---|---|
| `src/pages/inventory/InventoryList.tsx` | ~102 | `unitResult.data` accessed then `.sort()` without null check |
| `src/pages/mar/MARNew.tsx` | ~282 | `empResult.data.map()` without null guard |

---

## 4. Consistency Issues

### 4.1 MEDIUM — `alert()` usage (22 occurrences)

`ConfirmDialog` and toast infrastructure exist. Native `alert()` blocks the UI thread, looks inconsistent, and can't be dismissed gracefully on mobile.

**In extracted Phase 4 components (highest priority — these are new):**

| File | Line | Context |
|---|---|---|
| `src/components/incidents/cards/DeploymentsCard.tsx` | 73 | `alert('Failed to add deployment: ' + error.message)` |
| `src/components/incidents/cards/ExpensesCard.tsx` | 47 | `alert('Please attach a receipt...')` |
| `src/components/incidents/cards/IncidentInfoCard.tsx` | 40 | `alert('Upload failed: ' + error.message)` |

**In pages (pre-existing, lower priority):**

| File | Approx. lines | Context |
|---|---|---|
| `src/pages/incidents/IncidentDetail.tsx` | 146, 180 | Close incident error + success |
| `src/pages/incidents/NewIncident.tsx` | 124 | Offline save notification |
| `src/pages/units/UnitDetail.tsx` | 345, 362 | Upload errors |
| `src/pages/formulary/Formulary.tsx` | 139, 154, 155 | Import feedback |
| `src/pages/encounters/NewProcedure.tsx` | 284 | Offline save feedback |
| `src/pages/encounters/NewPCREncounter.tsx` | 238, 375 | Validation + error |
| `src/pages/roster/PayRates.tsx` | 63 | Error feedback |
| `src/pages/supply-runs/NewSupplyRun.tsx` | 259, 293 | Validation + error |
| `src/pages/supply-runs/SupplyRunDetail.tsx` | 299, 335, 353, 394, 434 | Multiple |
| `src/pages/admin/FireDashboard.tsx` | 78 | Error |
| `src/pages/admin/Announcements.tsx` | 130, 149 | Create feedback |
| `src/pages/mar/MARNew.tsx` | 472, 477, 487, 617 | Validation |
| `src/hooks/useEncounterData.ts` | 194, 206, 246 | Save errors |
| `src/hooks/useChatMessages.ts` | 181 | File size validation |
| `src/pages/encounters/pcr-steps/Step1PatientScene.tsx` | 71 | Location error |
| `src/pages/roster/EmployeeDetail.tsx` | 140 | Status update error |

### 4.2 MEDIUM — `window.confirm()` usage (15 occurrences)

`ConfirmDialog` exists (`src/components/ThemeProvider.tsx`) but the migration is incomplete. `window.confirm()` is synchronous and cannot be styled or localized.

| File | Approx. line | Context |
|---|---|---|
| `src/pages/formulary/Formulary.tsx` | 152, 194 | Import confirm + delete confirm |
| `src/pages/documents/DocumentsList.tsx` | 76 | Delete confirm |
| `src/pages/dashboard/MyUnit.tsx` | 184, 203 | Check-in / check-out |
| `src/pages/units/UnitDetail.tsx` | 301 | Archive/release |
| `src/pages/units/UnitsList.tsx` | 148 | Archive/release |
| `src/pages/supply-runs/SupplyRunDetail.tsx` | 361 | Delete item |
| `src/pages/admin/FireDashboard.tsx` | 94 | Delete access code |
| `src/pages/admin/Announcements.tsx` | 161 | Delete announcement |
| `src/pages/roster/PayRates.tsx` | 74 | Bulk defaults confirm |
| `src/pages/roster/EmployeeDetail.tsx` | 124–126 | Status change confirm |
| `src/pages/schedule/Schedule.tsx` | 254 | Delete request |
| `src/components/incidents/cards/ExpensesCard.tsx` | 141 | Delete expense |
| `src/components/incidents/cards/UnitsCard.tsx` | 60, 67 | Demobilize + reassign |
| `src/components/incidents/cards/DeploymentsCard.tsx` | 103 | Delete deployment |

The incident card occurrences (`ExpensesCard`, `UnitsCard`, `DeploymentsCard`) were introduced in Phase 4 and should use `ConfirmDialog` from the start.

### 4.3 Inconsistent error handling

Three patterns coexist with no clear rule for when to use each:

| Pattern | Example | Notes |
|---|---|---|
| `alert(error.message)` | Most mutation errors | Blocks UI, inconsistent |
| `console.error(...)` | Most async load failures | Silent to user |
| `catch {}` (empty) | Offline cache loads, best-effort operations | Intentional for offline fallback |
| `throw new Error(...)` | `NewSupplyRun.tsx`, `Chat.tsx` | Propagates to parent |

The empty-catch pattern is appropriate for offline fallback paths (e.g., `loadList()` failures when offline) but some empty catches appear around non-optional operations. Each should have a comment if intentional.

### 4.4 `console.log` / `console.error` — INFO

37 occurrences. Most appear intentional (sync manager progress, service worker, PDF generation errors). Not a bug but worth a lint rule (`no-console` with allowlist) to prevent future debug logs shipping to production.

---

## 5. Offline / Sync Pattern Violations

The app's offline-first pattern requires:
- Reads: `loadList()` / `loadSingle()` (checks cache → falls back to live)
- Writes: `queueOfflineWrite()` (queues if offline, executes if online)
- Never call `supabase.from()` directly in components

### 5.1 HIGH — Direct `supabase.from()` mutations in extracted Phase 4 components

These were introduced during decomposition and bypass the offline queue entirely. If the user loses connectivity mid-operation, these writes are silently lost.

| File | Lines | Operation |
|---|---|---|
| `src/components/incidents/cards/DeploymentsCard.tsx` | 64, 86 | `deployment_records` insert + `unit_assignments` insert |
| `src/components/incidents/cards/UnitsCard.tsx` | 48, 53 | `incident_units` insert + `units` update |
| `src/components/incidents/cards/ExpensesCard.tsx` | 59 | `incident_expenses` insert |
| `src/components/encounters/sections/ProgressNotesSection.tsx` | 201 | `progress_notes` update |

These are the highest-priority fixes: they are in the newly extracted Phase 4 code and the lack of offline queuing could cause data loss in the field.

### 5.2 Direct supabase reads in components — Lower priority

| File | Line | Operation |
|---|---|---|
| `src/components/ThemeProvider.tsx` | ~827 | `organizations` select (read-only, low risk) |

### 5.3 Endemic direct calls in pages — Pre-existing

60+ direct `supabase.from()` calls exist across pages (`Analytics`, `MARDetail`, `NewIncident`, `Formulary`, `DocumentsList`, `Schedule`, `Announcements`, etc.). These predate Phase 4 and are a separate cleanup effort. The service layer in `src/lib/services/` already covers encounters, incidents, employees, MAR, supply runs, ICS214, admin, and CS — pages should be migrated to use it.

---

## 6. Security

### 6.1 No hardcoded secrets ✅

`src/lib/supabase/client.ts` uses `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`. No service role key found in client-accessible code. No `.env` files committed.

### 6.2 Auth coverage is complete ✅

- `AuthGuard` wraps the full app, redirects unauthenticated users to `/login`
- `RouteGuard` enforces role-based access (`admin` vs field roles)
- `FieldGuard` scopes field users to their assigned unit's resources
- All routes in `App.tsx` are protected; login and onboarding are correctly public

### 6.3 MEDIUM — Token access without full null safety (3 occurrences)

As noted in §3.1, the pattern `(await supabase.auth.getSession()).data.session?.access_token` does not guard against `data` being `null`. Should be:

```ts
const { data } = await supabase.auth.getSession()
const token = data?.session?.access_token
```

Affected files: `EmployeeDetail.tsx:134`, `FireAdminDashboard.tsx:256/377`, `MARNew.tsx:514`.

### 6.4 RLS confidence — INFO

RLS cannot be audited from client code. Queries generally filter by `incident_id`, `unit_id`, or `organization_id` which aligns with expected RLS policies. No anomalies observed in query scoping patterns.

---

## Recommended Fix Order

1. **Commit the pending `IncidentDetail.tsx` cleanup** (already correct, just unstaged)

2. **`DeploymentsCard.tsx:26` — unused `deployments` prop** — determine if data is needed by the component; either use it or remove from the interface

3. **Null-safety on auth token access** — 3 files, one-line fix each (`?.data?.session`)

4. **Null-safety on `MARDetail.tsx` unit ID query** — silent undefined being passed to `.eq()`

5. **Offline pattern in Phase 4 extracted components** — `DeploymentsCard`, `UnitsCard`, `ExpensesCard`, `ProgressNotesSection` should go through service layer + `queueOfflineWrite()`

6. **`window.confirm()` → `ConfirmDialog`** — start with the Phase 4 incident cards (3 files) then work through pages

7. **`alert()` → toast** — same priority order: Phase 4 components first, then pages

8. **`as any` reduction** — add `voided_by`/`voided_at`/`void_reason` to `MAREntry` type; use typed query steps instead of cast in Analytics

9. **Enforce lint rules** — add `no-alert`, `no-console` (with allowlist), `@typescript-eslint/no-explicit-any` to ESLint config to prevent regression
