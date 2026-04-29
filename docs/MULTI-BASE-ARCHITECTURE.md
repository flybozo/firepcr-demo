# Multi-Base Architecture — Planning Doc

**Created:** 2026-04-25
**Status:** Planning — implement when expansion is imminent
**Author:** AI Assistant / Dr. A. Mitchell

---

## Problem

RAM currently operates as a single base of operations (NorCal wildfire). As the company expands into other states and contracts, we need a way to manage separate bases with their own units, employees, incidents, and inventory — without spinning up separate app deployments.

## Current State

- Flat data model: units, employees, incidents, inventory all in one pool
- Filtering by unit assignment, but no concept of "base" or "operation"
- Hardcoded unit names in several places (CS count dropdown, etc.)
- Single admin view sees everything

## Proposed Solution: `bases` Entity

### Data Model

```sql
CREATE TABLE bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,              -- "NorCal Wildfire Ops"
  location text,                   -- "Mt. Shasta, CA"
  state text,                      -- "CA", "OR", "MT"
  contract_type text,              -- "USDA", "CAL FIRE", "State OES"
  status text DEFAULT 'Active',    -- Active, Standby, Demobilized
  created_at timestamptz DEFAULT now()
);

-- FK additions to existing tables (all nullable for backward compat)
ALTER TABLE units ADD COLUMN base_id uuid REFERENCES bases(id);
ALTER TABLE employees ADD COLUMN base_id uuid REFERENCES bases(id);
ALTER TABLE incidents ADD COLUMN base_id uuid REFERENCES bases(id);
```

### Key Concepts

- **Base = contract/geographic operation**, NOT a legal entity
  - Ridgeline Medical Group / RAM is the single employer regardless of base
  - A base is: "We have N trucks, M people, and a warehouse at this location working this contract"
  - Bases can be seasonal — spin up for fire season, demobilize after
- **Employee home base** — where they're normally assigned (nullable for floaters)
  - Temporary incident assignments can cross bases (incident's base wins for billing)
- **Units belong to a base** — Medic 1 might be NorCal, Medic 5 might be Oregon
- **Incidents scoped to a base** — a fire in Oregon goes under the Oregon base
- **Inventory inherits base through unit** — already per-unit, so natural scoping
- **CS inventory** — already per-unit, works across bases without changes

### What This Buys Us

| Capability | How |
|---|---|
| Base manager dashboard | Filter all views by `base_id` |
| Super-admin cross-base view | No filter, see everything |
| Per-base payroll/billing | Expenses and deployments roll up by base for contract billing |
| Per-base reimbursement rules | Different contracts = different billing (USDA reimbursable vs. VIPR daily rate) |
| Employee mobility | Home base for default, but can deploy to any incident on any base |
| Separate unit pools | Each base manages its own fleet |
| Scalable onboarding | New base = new row in `bases`, assign units + employees |

### What Doesn't Change

- Single app, single URL, single auth system
- Roles/permissions model stays the same (add "Base Manager" scoped role)
- Existing data defaults to a "RAM NorCal" base
- No separate deployments or databases

---

## Implementation Phases

### Phase 1 — Data Model (pre-expansion, ~1 day)
- [ ] Create `bases` table
- [ ] Add `base_id` FK to units, employees, incidents (nullable)
- [ ] Create "RAM NorCal" as default base
- [ ] Backfill existing records with default base_id
- [ ] Admin UI: base CRUD page
- [ ] Remove hardcoded unit name arrays (CS count, etc.) — pull from DB
- **No UI filtering yet** — just the data model ready to go

### Phase 2 — Base Context (when first new contract signed, ~3 days)
- [ ] Base context selector in top nav / sidebar (like Slack workspace switcher)
- [ ] All list views filter by selected base
- [ ] Dashboard scoped to base
- [ ] "Base Manager" role — admin within their base only
- [ ] Employee assignment: home base + current deployment base
- [ ] Incident creation defaults to user's base
- [ ] Supply runs scoped to base through unit

### Phase 3 — Multi-State Compliance (~1 week)
- [ ] Per-base formulary templates (different states = different drug protocols)
- [ ] Per-base CS policies (separate DEA registrations per state)
- [ ] Per-base NEMSIS/state reporting config (CA CEMSIS vs. OR state system)
- [ ] Per-base contract billing rules and reimbursement flags
- [ ] Per-base document templates (state-specific consent forms, protocols)
- [ ] Per-base emergency contacts and dispatch info

### Phase 4 — Advanced (as needed)
- [ ] Cross-base mutual aid tracking (base A lends a unit to base B)
- [ ] Base-level analytics and financial dashboards
- [ ] Per-base branding/theming (if white-labeling for partners)
- [ ] Base-level notification preferences
- [ ] Regional manager role (manages multiple bases)

---

## Migration Strategy

When Phase 1 begins:

1. Create `bases` table
2. Insert default base: `RAM NorCal` (CA, USDA/CAL FIRE)
3. Add nullable `base_id` columns
4. Backfill all existing units/employees/incidents with default base
5. Make `base_id` NOT NULL after backfill (with default)
6. Update all hardcoded unit arrays to query from DB
7. Test everything works identically with single base

**Zero breaking changes** — existing functionality is preserved, just tagged with a base.

---

## Example: Expanding to Oregon

1. Admin creates base: "Oregon Coast EMS" (OR, state contract)
2. Purchases/transfers vehicles → creates new units (Medic 5, Aid 3) assigned to Oregon base
3. Hires/transfers employees → assigns to Oregon base
4. Sets up Oregon-specific formulary (different state drug protocols)
5. New incidents in Oregon auto-scope to Oregon base
6. Oregon base manager sees only their operation
7. Aaron/Rodney see both bases in super-admin view
8. Billing: Oregon expenses roll up separately for that contract

---

## Questions to Resolve Before Implementation

- **Warehouse**: One central warehouse, or per-base warehouses? (Probably per-base for CS)
- **Employee credentialing**: Per-state license requirements will differ — do we track per-base or per-employee?
  - *Recommendation:* Per-employee, but the base's state drives which certs are required
- **Fleet ownership**: Star Medical Rentals owns all vehicles — bases just have custody. Track assignment history?
- **Financial reporting**: Does each base need its own P&L, or just expense roll-ups?
