# Phase 6 — Granular Role-Based Access Control (RBAC)

**Date:** 2026-04-20  
**Status:** Planning  
**Depends on:** Phase 5 (cross-cutting cleanup)

---

## 1. Problem

Today's access control is binary: **admin** or **field**. That's it.

```
app_role = 'admin' → sees everything
app_role = 'field' → sees only their unit + incident
```

This works for a small team but breaks down as RAM scales:

| Real-world need | Current solution | Problem |
|---|---|---|
| Charge medic manages MAR + CS for their unit | Must be `admin` | Now sees payroll, billing, all units |
| REMS manager (Zach) oversees rope rescue ops | Must be `admin` | Now has HR credential access |
| Medical director signs off on charts | `is_medical_director` flag | One-off boolean, doesn't generalize |
| Ops manager views schedules + incidents | Must be `admin` | Now sees financial data |
| Field medic views their own pay stubs | `isField` + hardcoded route | Fragile, can't extend |

**The goal:** Give people exactly the access they need — no more, no less — without 50 checkboxes in an admin panel.

---

## 2. Design: Permission-Based Roles

Instead of checking `isAdmin` everywhere, we check **permissions**. Roles are just named bundles of permissions.

### Permission Domains

Organized by feature area, using dot notation:

```typescript
// Clinical
'encounters.view'        // View patient encounters (own unit or all)
'encounters.create'      // Create new encounters
'encounters.edit'        // Edit existing encounters
'encounters.sign'        // Sign/cosign charts
'encounters.delete'      // Soft-delete encounters

// MAR & Controlled Substances
'mar.view'               // View medication admin records
'mar.create'             // Administer medications
'cs.view'                // View CS inventory
'cs.count'               // Perform daily counts
'cs.transfer'            // Transfer CS between units
'cs.receive'             // Receive CS into warehouse
'cs.audit'               // View full CS audit trail

// Inventory & Supply
'inventory.view'         // View unit inventory
'inventory.add'          // Restock inventory
'supply_runs.view'       // View supply run history
'supply_runs.create'     // Create supply runs

// Incidents & Operations
'incidents.view'         // View incidents (own or all)
'incidents.create'       // Create new incidents
'incidents.manage'       // Edit, close out, manage deployments
'ics214.view'            // View ICS 214 logs
'ics214.create'          // Create/edit ICS 214 entries

// People & HR
'roster.view'            // View employee list (basic info)
'roster.manage'          // Edit employee records, onboard
'roster.credentials'     // View/manage credential documents
'roster.pii'             // Access PII (DOB, address, SSN)

// Financial
'payroll.view_own'       // View own pay stubs
'payroll.view_all'       // View all payroll data
'payroll.manage'         // Edit pay rates, approve timesheets
'billing.view'           // View billing/revenue data
'expenses.view'          // View expense reports
'expenses.manage'        // Create/approve expenses

// Units & Fleet
'units.view'             // View unit list
'units.manage'           // Create/edit units, vehicle docs
'units.crew'             // Manage crew assignments

// Scheduling
'schedule.view_own'      // View own schedule
'schedule.view_all'      // View full schedule
'schedule.manage'        // Generate/publish schedules

// Admin & System
'admin.settings'         // App settings, feature flags
'admin.push'             // Send push notifications
'admin.analytics'        // View analytics dashboard
'admin.documents'        // Manage company documents
'chat.admin'             // Manage chat channels, view all DMs
```

### Built-in Roles

Roles are stored in the DB but ship with sensible defaults. Admins can customize.

| Role | Description | Key Permissions |
|---|---|---|
| **Super Admin** | Full access (Aaron, Rodney) | `*` (all permissions) |
| **Operations Manager** | Runs day-to-day ops | incidents.*, units.*, roster.view, roster.manage, schedule.*, cs.*, inventory.*, admin.push |
| **Medical Director** | Clinical oversight + signing authority | encounters.*, mar.*, cs.view, cs.audit, roster.view, admin.analytics |
| **Charge Medic** | Unit-level clinical lead | encounters.*, mar.*, cs.count, cs.transfer, inventory.*, supply_runs.*, ics214.* |
| **Field Medic** | Standard field provider | encounters.view, encounters.create, encounters.edit, mar.view, mar.create, cs.view, cs.count, inventory.view, supply_runs.view, supply_runs.create, ics214.view, ics214.create, payroll.view_own, schedule.view_own |
| **REMS Lead** | Rope rescue operations lead | Same as Charge Medic + units.crew |
| **Finance** | Bookkeeper/billing access | payroll.*, billing.*, expenses.*, admin.analytics |
| **Read Only** | Observers, auditors | *.view (all view permissions, no create/edit/manage) |

### Permission Inheritance

Permissions use a simple wildcard system:
- `encounters.*` → all encounter permissions
- `*` → everything (super admin only)
- No cascading/hierarchy beyond wildcards — keeps it simple and auditable

---

## 3. Database Schema

### New Tables

```sql
-- Permission roles (templates)
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,          -- 'charge_medic', 'ops_manager', etc.
  display_name text NOT NULL,         -- 'Charge Medic'
  description text,
  permissions text[] NOT NULL,        -- ['encounters.*', 'mar.*', 'cs.count']
  is_system boolean DEFAULT false,    -- true = built-in, can't delete
  org_id uuid REFERENCES organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Employee ↔ Role assignments (many-to-many)
CREATE TABLE employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES employees(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, role_id)
);

-- Optional: per-employee permission overrides (add/revoke individual perms)
CREATE TABLE employee_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,  -- true = grant, false = revoke
  reason text,
  granted_by uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, permission)
);

-- Indexes
CREATE INDEX idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX idx_employee_roles_role ON employee_roles(role_id);
CREATE INDEX idx_employee_overrides_employee ON employee_permission_overrides(employee_id);
```

### Migration from `app_role`

```sql
-- Step 1: Seed built-in roles
INSERT INTO roles (name, display_name, permissions, is_system) VALUES
  ('super_admin', 'Super Admin', ARRAY['*'], true),
  ('ops_manager', 'Operations Manager', ARRAY['incidents.*', 'units.*', ...], true),
  ('medical_director', 'Medical Director', ARRAY['encounters.*', 'mar.*', ...], true),
  ('charge_medic', 'Charge Medic', ARRAY['encounters.*', 'mar.*', ...], true),
  ('field_medic', 'Field Medic', ARRAY['encounters.view', 'encounters.create', ...], true),
  ('rems_lead', 'REMS Lead', ARRAY['encounters.*', 'mar.*', 'units.crew', ...], true),
  ('finance', 'Finance', ARRAY['payroll.*', 'billing.*', ...], true),
  ('read_only', 'Read Only', ARRAY['*.view'], true);

-- Step 2: Map existing employees
INSERT INTO employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM employees e
JOIN roles r ON r.name = CASE
  WHEN e.app_role = 'admin' AND e.is_medical_director THEN 'super_admin'
  WHEN e.app_role = 'admin' THEN 'ops_manager'
  ELSE 'field_medic'
END
WHERE e.status = 'Active';

-- Step 3: Keep app_role column for backward compat during transition
-- After all frontend code uses usePermission(), drop it
```

### RPC for Permission Resolution

```sql
-- Single RPC call: resolves all permissions for the current user
CREATE OR REPLACE FUNCTION get_my_permissions()
RETURNS text[] AS $$
  SELECT COALESCE(
    array_agg(DISTINCT perm),
    ARRAY[]::text[]
  )
  FROM (
    -- Permissions from assigned roles
    SELECT unnest(r.permissions) AS perm
    FROM employee_roles er
    JOIN roles r ON r.id = er.role_id
    JOIN employees e ON e.id = er.employee_id
    WHERE e.auth_user_id = auth.uid()
    
    UNION ALL
    
    -- Individual grants
    SELECT epo.permission AS perm
    FROM employee_permission_overrides epo
    JOIN employees e ON e.id = epo.employee_id
    WHERE e.auth_user_id = auth.uid()
    AND epo.granted = true
    
    EXCEPT
    
    -- Individual revocations
    SELECT epo.permission AS perm
    FROM employee_permission_overrides epo
    JOIN employees e ON e.id = epo.employee_id
    WHERE e.auth_user_id = auth.uid()
    AND epo.granted = false
  ) perms;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 4. Frontend Implementation

### Core Hook: `usePermission`

```typescript
// src/hooks/usePermission.ts

import { createContext, useContext } from 'react'

type PermissionContext = {
  permissions: Set<string>
  loading: boolean
}

const PermCtx = createContext<PermissionContext>({ permissions: new Set(), loading: true })

/**
 * Check if the current user has a specific permission.
 * Supports wildcards: 'encounters.*' matches 'encounters.view', etc.
 */
export function usePermission(required: string): boolean {
  const { permissions, loading } = useContext(PermCtx)
  if (loading) return false
  return hasPermission(permissions, required)
}

/**
 * Check multiple permissions at once.
 * Returns true only if ALL are granted.
 */
export function usePermissions(...required: string[]): boolean {
  const { permissions, loading } = useContext(PermCtx)
  if (loading) return false
  return required.every(p => hasPermission(permissions, p))
}

/**
 * Check if ANY of the listed permissions are granted.
 */
export function useAnyPermission(...required: string[]): boolean {
  const { permissions, loading } = useContext(PermCtx)
  if (loading) return false
  return required.some(p => hasPermission(permissions, p))
}

// Wildcard matching
function hasPermission(granted: Set<string>, required: string): boolean {
  if (granted.has('*')) return true                          // super admin
  if (granted.has(required)) return true                     // exact match
  const domain = required.split('.')[0]
  if (granted.has(`${domain}.*`)) return true                // domain wildcard
  // Check granted wildcards like '*.view'
  const action = required.split('.').slice(1).join('.')
  if (granted.has(`*.${action}`)) return true                // action wildcard
  return false
}
```

### Permission Provider

```typescript
// src/contexts/PermissionProvider.tsx
// Wraps the app, fetches permissions once on auth, caches in state

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [permissions, setPermissions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setPermissions(new Set()); setLoading(false); return }
    
    supabase.rpc('get_my_permissions').then(({ data }) => {
      setPermissions(new Set(data || []))
      setLoading(false)
    })
  }, [user?.id])

  return (
    <PermCtx.Provider value={{ permissions, loading }}>
      {children}
    </PermCtx.Provider>
  )
}
```

### Migration Path: `useRole` → `usePermission`

The key insight: **we don't have to replace every `isAdmin` check at once.** We can do it file by file.

```typescript
// BEFORE (current)
const { isAdmin } = useRole()
if (!isAdmin) return null

// AFTER (Phase 6)
const canView = usePermission('billing.view')
if (!canView) return null
```

**Backward compatibility bridge** (keeps things working during migration):

```typescript
// Updated useRole.ts — delegates to permissions internally
export function useRole() {
  const isAdmin = useAnyPermission('admin.settings')  // rough equiv
  const isField = !isAdmin
  return { role: isAdmin ? 'admin' : 'field', loading, isAdmin, isField }
}
```

This means existing `isAdmin` checks keep working while we migrate file by file.

### RouteGuard Update

```typescript
// BEFORE
<Route element={<RouteGuard require="admin" />}>

// AFTER
<Route element={<PermissionGuard require="admin.settings" />}>
<Route element={<PermissionGuard require={['payroll.view_all', 'billing.view']} any />}>
```

---

## 5. Admin UI — Role Management

New admin page: **Settings → Roles & Permissions**

### Role List View
- Table of all roles with employee count per role
- Built-in roles show 🔒 icon (can edit permissions, can't delete)
- Custom roles can be created/deleted
- Click role → edit permissions

### Role Editor
- Grouped checkboxes by domain (Clinical, Financial, Operations, etc.)
- Domain-level "select all" toggle (auto-sets `domain.*`)
- Preview: "This role can: view encounters, create encounters, administer meds..."
- Save validates no orphan permissions (e.g. `encounters.edit` without `encounters.view`)

### Employee Role Assignment
- On employee detail page: multi-select dropdown of roles
- Shows resolved permission list (union of all assigned roles)
- Override section: grant/revoke individual permissions with reason field
- Audit log of role changes

---

## 6. Implementation Order

### Wave 1 — Foundation (no UI changes yet)
1. Create DB tables + seed built-in roles
2. Write `get_my_permissions()` RPC
3. Run migration: map existing `app_role` → roles
4. Build `usePermission` hook + `PermissionProvider`
5. Build backward-compat `useRole` bridge
6. **Verify:** App works identically to before — all existing `isAdmin` checks still pass

### Wave 2 — Gradual migration (file by file)
7. Replace `isAdmin` checks in the **80 files** that use it:
   - Start with financial pages (Payroll, Billing, Expenses) — clearest permission boundaries
   - Then clinical pages (Encounters, MAR, CS)
   - Then operations (Incidents, Units, ICS214)
   - Then admin (Settings, Push, Analytics)
8. Update `RouteGuard` → `PermissionGuard`
9. Update `Sidebar` to show/hide nav items based on permissions
10. Update `BottomTabBar` for mobile

### Wave 3 — Admin UI
11. Build Role Management page
12. Build per-employee role assignment UI
13. Add role change audit logging

### Wave 4 — Cleanup
14. Remove `app_role` column from employees (once fully migrated)
15. Remove `is_medical_director` column (now a role)
16. Remove old `useRole` bridge
17. Update RLS policies to use permissions instead of `is_admin()`

---

## 7. Effort Estimate

| Wave | Effort | Risk |
|---|---|---|
| Wave 1 (foundation) | 2-3 hours | Low — additive, no breaking changes |
| Wave 2 (migration) | 4-6 hours | Medium — lots of files but mechanical |
| Wave 3 (admin UI) | 3-4 hours | Low — new pages, no existing behavior changes |
| Wave 4 (cleanup) | 1-2 hours | Low — removing dead code |
| **Total** | **10-15 hours** | |

Each wave is independently deployable. Wave 1 can ship immediately with zero user-visible changes.

---

## 8. Row-Level Security (RLS) Enhancement

Currently RLS is permissive (`USING (true)`). Phase 6 tightens this:

```sql
-- Example: encounters scoped by permission
CREATE POLICY encounters_select ON patient_encounters FOR SELECT USING (
  -- Super admin / encounters.* → see all
  EXISTS (
    SELECT 1 FROM get_user_permissions(auth.uid()) p
    WHERE p = '*' OR p = 'encounters.*' OR p = 'encounters.view'
  )
  OR
  -- Field users → only their unit's encounters
  (created_by_employee_id IN (
    SELECT e.id FROM employees e WHERE e.auth_user_id = auth.uid()
  ))
);
```

This is the stretch goal within Phase 6 — RLS is a separate migration and should be done carefully after the frontend is fully migrated.

---

## 9. Offline Consideration

Permissions are fetched once on login and cached. For offline:
- Permissions are stored in IndexedDB alongside the user session
- `usePermission` reads from cache when offline
- Permission changes only take effect on next online login
- This matches the existing pattern (employee data is cached for offline use)

---

## 10. Decisions

1. **Per-unit permissions?** ❌ **Not in v1.** Keep it simple — roles grant access to all units matching the permission. Per-unit scoping (e.g. Charge Medic only for *their* unit) deferred to v2 if needed.
2. **Temporal roles?** ❌ **Deferred.** "Charge Medic for this incident only" is useful for mutual aid but adds too much complexity for v1.
3. **Self-service?** ❌ **Not in v1.** Admins assign roles.
