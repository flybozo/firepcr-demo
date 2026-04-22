-- Phase 6 Wave 1: RBAC Foundation
-- Creates roles, employee_roles, employee_permission_overrides tables
-- Seeds built-in roles, migrates existing employees, creates get_my_permissions() RPC

-- ============================================================
-- 1. Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES employees(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, role_id)
);

CREATE TABLE IF NOT EXISTS employee_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  reason text,
  granted_by uuid REFERENCES employees(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, permission)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_employee_overrides_employee ON employee_permission_overrides(employee_id);

-- RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Permissive policies (tighten in Wave 4)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'roles_select' AND tablename = 'roles') THEN
    CREATE POLICY roles_select ON roles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'roles_manage' AND tablename = 'roles') THEN
    CREATE POLICY roles_manage ON roles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'employee_roles_select' AND tablename = 'employee_roles') THEN
    CREATE POLICY employee_roles_select ON employee_roles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'employee_roles_manage' AND tablename = 'employee_roles') THEN
    CREATE POLICY employee_roles_manage ON employee_roles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'overrides_select' AND tablename = 'employee_permission_overrides') THEN
    CREATE POLICY overrides_select ON employee_permission_overrides FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'overrides_manage' AND tablename = 'employee_permission_overrides') THEN
    CREATE POLICY overrides_manage ON employee_permission_overrides FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 2. Seed built-in roles
-- ============================================================

INSERT INTO roles (name, display_name, description, permissions, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full access to everything', ARRAY['*'], true),
  ('ops_manager', 'Operations Manager', 'Day-to-day operations management', ARRAY['incidents.*','units.*','roster.view','roster.manage','schedule.*','cs.*','inventory.*','supply_runs.*','ics214.*','admin.push','admin.documents','encounters.view','mar.view','payroll.view_all','expenses.view','expenses.manage'], true),
  ('medical_director', 'Medical Director', 'Clinical oversight and signing authority', ARRAY['encounters.*','mar.*','cs.view','cs.audit','roster.view','admin.analytics','payroll.view_own','ics214.view'], true),
  ('charge_medic', 'Charge Medic', 'Unit-level clinical lead', ARRAY['encounters.*','mar.*','cs.count','cs.transfer','cs.view','inventory.*','supply_runs.*','ics214.*','roster.view','payroll.view_own','schedule.view_own'], true),
  ('field_medic', 'Field Medic', 'Standard field provider', ARRAY['encounters.view','encounters.create','encounters.edit','mar.view','mar.create','cs.view','cs.count','inventory.view','supply_runs.view','supply_runs.create','ics214.view','ics214.create','payroll.view_own','schedule.view_own','roster.view'], true),
  ('rems_lead', 'REMS Lead', 'Rope rescue operations lead', ARRAY['encounters.*','mar.*','cs.count','cs.transfer','cs.view','inventory.*','supply_runs.*','ics214.*','units.crew','roster.view','payroll.view_own','schedule.view_own'], true),
  ('finance', 'Finance', 'Financial and billing access', ARRAY['payroll.*','billing.*','expenses.*','admin.analytics','roster.view'], true),
  ('read_only', 'Read Only', 'View-only access for observers', ARRAY['encounters.view','mar.view','cs.view','inventory.view','supply_runs.view','ics214.view','incidents.view','roster.view','schedule.view_own','payroll.view_own'], true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. Migrate existing employees to roles
-- ============================================================

INSERT INTO employee_roles (employee_id, role_id)
SELECT e.id, r.id
FROM employees e
JOIN roles r ON r.name = CASE
  WHEN e.is_medical_director = true THEN 'super_admin'
  WHEN e.app_role = 'admin' THEN 'ops_manager'
  ELSE 'field_medic'
END
WHERE e.status = 'Active' AND e.auth_user_id IS NOT NULL
ON CONFLICT (employee_id, role_id) DO NOTHING;

-- ============================================================
-- 4. get_my_permissions() RPC
-- ============================================================

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
  ) sub(perm);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
