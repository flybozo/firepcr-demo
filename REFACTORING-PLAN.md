# FirePCR — Refactoring Plan

**Created:** 2026-04-18  
**Target:** Week of 2026-04-19 through 2026-04-25  
**Goal:** Transform the app from a monolithic single-tenant prototype into a modular, multi-tenant-ready codebase.

---

## Current State (Audit)

| Metric | Value |
|--------|-------|
| Page components | 81 |
| Lib/utility files | 29 |
| API routes | 35 |
| Direct `supabase.from()` calls in pages | **242** |
| Files with hardcoded brand references | **38** |
| Largest component (IncidentDetail.tsx) | **2,808 lines** |
| Total page component LOC | 39,234 |
| Sync script sed replacements | 19 |
| Themes | 23 |

### Pain Points
1. **No branding abstraction** — company name, NEMSIS IDs, unit names, domains, logos are hardcoded in 38 files. White-labeling requires a sed script with 19+ replacements.
2. **No service layer** — 242 direct Supabase calls scattered across page components. Business logic, data fetching, and UI are tangled together.
3. **God components** — IncidentDetail.tsx is 2,808 lines. EncounterDetail is 2,491. These are unmaintainable.
4. **No shared UI primitives** — each page re-implements stat cards, data tables, filter pills, empty states, form fields.
5. **Flat page structure** — all pages in `src/pages/` by domain but with no services, types, or logic colocation.
6. **Binary role system** — admin/field with `useRole()` checks inline everywhere. No granular permissions.

---

## Phase 1: Branding Layer (Day 1)

**Goal:** Zero hardcoded brand references in source code.

### Create `src/lib/branding.ts`

```typescript
export type BrandConfig = {
  // Company
  companyName: string          // "Ridgeline EMS"
  companyLegal: string         // "Ridgeline Medical Group"
  appName: string              // "FirePCR"
  domain: string               // "ridgelineems.com"
  supportEmail: string         // "assistant@ridgelineems.com"
  
  // Logo
  logoUrl: string              // Supabase storage URL or local path
  faviconUrl: string
  
  // NEMSIS
  nemsisAgencyId: string       // "S00-00000"
  nemsisStateId: string        // "06" (California)
  nemsisLemsa: string          // "Sierra Sacramento Valley"
  nemsisSoftware: string       // "FirePCR Field Operations v1.0"
  
  // Unit naming conventions
  unitPrefixes: {
    ambulance: string          // "Medic"
    medUnit: string            // "Aid"
    rems: string               // "Rescue"
    warehouse: string          // "Command 1"
  }
  
  // AI assistant
  assistantName: string        // "AI Assistant"
  assistantEmoji: string       // "🏴‍☠️"
  
  // Legal
  consentCompanyName: string   // For consent forms / PDFs
  hipaaEntity: string
}
```

### Create `src/lib/branding.config.ts` (per-deployment)

```typescript
import type { BrandConfig } from './branding'

export const brand: BrandConfig = {
  companyName: 'Ridgeline EMS',
  companyLegal: 'Ridgeline Medical Group',
  appName: 'FirePCR',
  // ... etc
}
```

### Migration Steps
1. Create the types and config files
2. `grep -rn` all 38 files with hardcoded refs
3. Replace each with `brand.xxx` import
4. Delete the sed-based sync script — demo just swaps `branding.config.ts`
5. Verify both prod and demo deploy clean

### Deliverable
- `branding.ts` (types) + `branding.config.ts` (RAM config) + `branding.demo.ts` (Ridgeline EMS config)
- All 38 files updated
- Sync script reduced to file-copy only (no sed)

---

## Phase 2: Service Layer (Days 2–3)

**Goal:** Zero direct Supabase calls in page components.

### Structure

```
src/lib/services/
  incidents.ts        — CRUD + financial aggregations
  encounters.ts       — patient encounters + vitals + procedures
  inventory.ts        — formulary, unit inventory, restocking
  cs.ts               — controlled substances (transactions, counts, audit)
  employees.ts        — roster, credentials, onboarding
  chat.ts             — channels, messages, unread counts
  deployments.ts      — unit assignments, deployment records, payroll
  supplyRuns.ts       — supply run CRUD + item management
  ics214.ts           — ICS 214 log operations
  compClaims.ts       — comp claims + OSHA 301
  notifications.ts    — push subscribe/unsubscribe, admin send
  auth.ts             — login, session, PIN verification
```

### Pattern

```typescript
// src/lib/services/incidents.ts
import { createClient } from '@/lib/supabase/client'

export async function getActiveIncidents() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('incidents')
    .select('id, name, status, start_date, location')
    .eq('status', 'Active')
    .order('start_date', { ascending: false })
  if (error) throw error
  return data
}

export async function getIncidentFinancials(incidentId: string) {
  // ... all the revenue/payroll/expense aggregation logic
  // currently duplicated in IncidentDetail + Financial page
}
```

### Migration Steps
1. Create service files, starting with the most-called tables
2. Move queries out of pages one domain at a time
3. Pages call service functions, handle loading/error UI only
4. Shared business logic (calcDays, fmtCurrency, rate cascades) moves to `src/lib/utils/`
5. Target: 0 `supabase.from()` calls in `src/pages/`

### Priority Order (by call count)
1. `incidents` + `incident_units` — used everywhere
2. `patient_encounters` — most complex queries
3. `employees` + `unit_assignments` — roster + deployments
4. `dispense_admin_log` — MAR
5. `unit_inventory` + `formulary_templates` — inventory
6. `cs_transactions` + `cs_daily_counts` — controlled substances
7. Everything else

---

## Phase 3: Shared UI Components (Day 4)

**Goal:** Consistent UI primitives, half the code in page components.

### Create `src/components/ui/`

| Component | Replaces | Used In |
|-----------|----------|---------|
| `DataTable` | Ad-hoc `<table>` implementations | ~30 pages |
| `StatCard` | 4+ different stat card implementations | Analytics, Financial, dashboards |
| `FilterPills` | Inline filter button groups | Encounters, MAR, Supply Runs, Roster |
| `EmptyState` | Various "no data" placeholders | Every list page |
| `PageHeader` | Inconsistent page titles/actions | Every page |
| `FormField` | Raw `<input>` + `<label>` combos | Every form |
| `SelectField` | Raw `<select>` with styling | Every form |
| `DateRangePicker` | Inline date range buttons | Analytics, lists |
| `Badge` / `Pill` | Inline colored spans | Acuity, status, roles |
| `ConfirmDialog` | `window.confirm()` calls | Delete/demob actions |
| `LoadingSkeleton` | Various pulse animations | Every page |

### Migration Steps
1. Build each component with props matching existing patterns
2. Migrate page by page, starting with the simplest list pages
3. `ConfirmDialog` replaces all `window.confirm()` (currently ~15 uses) — better UX, theme-aware

---

## Phase 4: Component Decomposition (Day 5)

**Goal:** No component over 500 lines.

### IncidentDetail.tsx (2,808 → ~400 + 8 sub-components)

```
src/pages/incidents/
  IncidentDetail.tsx             — layout shell, card grid, state
  components/
    IncidentInfoCard.tsx         — header info + contacts + contract
    UnitsCard.tsx                — unit list + assign/demob
    EncountersCard.tsx           — recent encounters table
    DeploymentsCard.tsx          — crew deployment table + add form
    RevenueCard.tsx              — P&L breakdown
    ExpensesCard.tsx             — expense list + add form
    SupplyRunsCard.tsx           — recent supply runs
    BillingSummaryCard.tsx       — billing/reorder
```

### EncounterDetail.tsx (2,491 → ~300 + sections)
### NewPCREncounter.tsx (1,860 → ~250 + form sections)
### Chat.tsx (1,188 → ~200 + ChannelList, MessageThread, MessageInput)

### Pattern
Each sub-component receives props from parent (incident data, callbacks). Parent manages state + data fetching (via service layer). Children are pure UI.

---

## Phase 5: Feature Modules (Week 2, stretch)

**Goal:** Self-contained feature directories.

```
src/features/
  controlled-substances/
    pages/
    components/
    services/
    types.ts
  encounters/
    pages/
    components/  
    services/
    types.ts
  incidents/
    ...
```

This is the final structural move — only worth doing after Phases 1–4 are stable. Enables deleting entire features for non-medical clients.

---

## Phase 6: Permissions System (Week 2, stretch)

**Goal:** Granular role-based access beyond admin/field.

```typescript
type Permission = 
  | 'incidents.view' | 'incidents.manage'
  | 'encounters.view' | 'encounters.create' | 'encounters.sign'
  | 'cs.view' | 'cs.count' | 'cs.transfer' | 'cs.audit'
  | 'financial.view'
  | 'roster.view' | 'roster.manage'
  | 'chat.admin'

type Role = {
  name: string
  permissions: Permission[]
}

// Hook
const can = usePermission('financial.view')
```

Roles stored in DB, assigned per employee. Current admin/field maps to predefined permission sets for backward compatibility.

---

## Execution Order & Dependencies

```
Phase 1 (Branding)          ← No dependencies, start here
    ↓
Phase 2 (Service Layer)     ← Enables Phase 4
    ↓
Phase 3 (Shared UI)         ← Independent, can parallel with Phase 2
    ↓
Phase 4 (Decomposition)     ← Requires Phase 2 + 3
    ↓
Phase 5 (Feature Modules)   ← Requires Phase 4
    ↓
Phase 6 (Permissions)       ← Requires Phase 2
```

**Week 1 target:** Phases 1–4 (branding + service layer + UI components + decomposition)  
**Week 2 stretch:** Phases 5–6 (feature modules + permissions)

---

## Risk Mitigation

- **Regressions:** Each phase gets its own branch, tested before merge. No big-bang refactors.
- **Demo sync:** Phase 1 eliminates the fragile sed script, so demo stays in sync automatically.
- **Offline:** Service layer must preserve the offline-first pattern (cache-then-fetch). Services return cached data first, then update.
- **Deploy cadence:** Ship each phase independently. App should work at every intermediate state.

---

## Success Metrics

| Before | After |
|--------|-------|
| 242 direct Supabase calls in pages | 0 |
| 38 files with hardcoded branding | 0 (1 config file) |
| 2,808-line god component | No component > 500 lines |
| 19 sed replacements for demo | 1 config file swap |
| 4+ stat card implementations | 1 shared component |
| `window.confirm()` everywhere | Theme-aware ConfirmDialog |
| Binary admin/field | Granular permissions (Phase 6) |
