-- ═══════════════════════════════════════════════════════════════════
-- RAM Field Ops — RLS Policies + Database Indexes
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)
-- ═══════════════════════════════════════════════════════════════════

-- ─── Helper: get the employee record for the current auth user ───
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_employee_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT app_role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT app_role = 'admin' FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1),
    false
  )
$$;

-- ─── Enable RLS on all sensitive tables ──────────────────────────
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispense_admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comp_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;

-- ─── employees ───────────────────────────────────────────────────
-- Everyone can read basic roster info; only admins see full records; users can update own record
CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (true);
-- ^^ The sync view (employees_sync) handles column filtering. RLS ensures row access.
-- For now, all authenticated users can see the roster. Column-level restriction via views.

CREATE POLICY "employees_update_self" ON public.employees FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "employees_update_admin" ON public.employees FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "employees_insert_admin" ON public.employees FOR INSERT
  WITH CHECK (public.is_admin());

-- ─── patient_encounters ──────────────────────────────────────────
-- Admins: full access. Field users: read encounters from their current incident.
CREATE POLICY "pe_select_admin" ON public.patient_encounters FOR SELECT
  USING (public.is_admin());

CREATE POLICY "pe_select_field" ON public.patient_encounters FOR SELECT
  USING (
    incident_id IN (
      SELECT iu.incident_id
      FROM public.unit_assignments ua
      JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
      WHERE ua.employee_id = public.current_employee_id()
        AND ua.released_at IS NULL
        AND iu.released_at IS NULL
    )
  );

CREATE POLICY "pe_insert" ON public.patient_encounters FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR incident_id IN (
      SELECT iu.incident_id
      FROM public.unit_assignments ua
      JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
      WHERE ua.employee_id = public.current_employee_id()
        AND ua.released_at IS NULL
    )
  );

CREATE POLICY "pe_update" ON public.patient_encounters FOR UPDATE
  USING (
    public.is_admin()
    OR created_by = auth.uid()::text
    OR incident_id IN (
      SELECT iu.incident_id
      FROM public.unit_assignments ua
      JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
      WHERE ua.employee_id = public.current_employee_id()
        AND ua.released_at IS NULL
    )
  );

-- ─── dispense_admin_log (MAR / medication administration) ────────
CREATE POLICY "dal_select_admin" ON public.dispense_admin_log FOR SELECT
  USING (public.is_admin());

CREATE POLICY "dal_select_field" ON public.dispense_admin_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unit_assignments ua
      JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
      JOIN public.units u ON u.id = iu.unit_id
      WHERE ua.employee_id = public.current_employee_id()
        AND ua.released_at IS NULL
        AND u.name = dispense_admin_log.med_unit
    )
  );

CREATE POLICY "dal_insert" ON public.dispense_admin_log FOR INSERT
  WITH CHECK (true); -- any authenticated user can log a dispense on their unit

CREATE POLICY "dal_update" ON public.dispense_admin_log FOR UPDATE
  USING (public.is_admin());

-- ─── cs_transactions (controlled substances) ─────────────────────
CREATE POLICY "cs_select_admin" ON public.cs_transactions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "cs_select_field" ON public.cs_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unit_assignments ua
      JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
      JOIN public.units u ON u.id = iu.unit_id
      WHERE ua.employee_id = public.current_employee_id()
        AND ua.released_at IS NULL
        AND (u.name = cs_transactions.from_unit OR u.name = cs_transactions.to_unit)
    )
  );

CREATE POLICY "cs_insert" ON public.cs_transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "cs_update_admin" ON public.cs_transactions FOR UPDATE
  USING (public.is_admin());

-- ─── progress_notes ──────────────────────────────────────────────
CREATE POLICY "pn_select" ON public.progress_notes FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.patient_encounters pe
      WHERE pe.id = progress_notes.encounter_id
        AND pe.incident_id IN (
          SELECT iu.incident_id
          FROM public.unit_assignments ua
          JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
          WHERE ua.employee_id = public.current_employee_id()
            AND ua.released_at IS NULL
        )
    )
  );

CREATE POLICY "pn_insert" ON public.progress_notes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "pn_update" ON public.progress_notes FOR UPDATE
  USING (public.is_admin() OR created_by = auth.uid()::text);

-- ─── employee_chats ──────────────────────────────────────────────
CREATE POLICY "ec_select" ON public.employee_chats FOR SELECT
  USING (
    employee_id = public.current_employee_id()
    OR public.is_admin()
  );

CREATE POLICY "ec_insert" ON public.employee_chats FOR INSERT
  WITH CHECK (true); -- server-side inserts via service key bypass RLS anyway

-- ─── employee_credentials ────────────────────────────────────────
CREATE POLICY "ecred_select" ON public.employee_credentials FOR SELECT
  USING (
    employee_id = public.current_employee_id()
    OR public.is_admin()
  );

CREATE POLICY "ecred_insert_admin" ON public.employee_credentials FOR INSERT
  WITH CHECK (public.is_admin());

-- ─── unit_assignments ────────────────────────────────────────────
CREATE POLICY "ua_select" ON public.unit_assignments FOR SELECT
  USING (true); -- everyone needs to see who's on which unit

CREATE POLICY "ua_modify_admin" ON public.unit_assignments FOR ALL
  USING (public.is_admin());

-- ─── encounter_vitals ────────────────────────────────────────────
CREATE POLICY "ev_select" ON public.encounter_vitals FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.patient_encounters pe
      WHERE pe.id = encounter_vitals.encounter_id
        AND pe.incident_id IN (
          SELECT iu.incident_id
          FROM public.unit_assignments ua
          JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
          WHERE ua.employee_id = public.current_employee_id()
            AND ua.released_at IS NULL
        )
    )
  );

CREATE POLICY "ev_insert" ON public.encounter_vitals FOR INSERT
  WITH CHECK (true);

-- ─── encounter_procedures ────────────────────────────────────────
CREATE POLICY "ep_select" ON public.encounter_procedures FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.patient_encounters pe
      WHERE pe.id = encounter_procedures.encounter_id
        AND pe.incident_id IN (
          SELECT iu.incident_id
          FROM public.unit_assignments ua
          JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
          WHERE ua.employee_id = public.current_employee_id()
            AND ua.released_at IS NULL
        )
    )
  );

CREATE POLICY "ep_insert" ON public.encounter_procedures FOR INSERT
  WITH CHECK (true);

-- ─── comp_claims ─────────────────────────────────────────────────
CREATE POLICY "cc_select_admin" ON public.comp_claims FOR SELECT
  USING (public.is_admin());

CREATE POLICY "cc_modify_admin" ON public.comp_claims FOR ALL
  USING (public.is_admin());

-- ─── consent_forms ───────────────────────────────────────────────
CREATE POLICY "cf_select" ON public.consent_forms FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.patient_encounters pe
      WHERE pe.id = consent_forms.encounter_id
        AND pe.incident_id IN (
          SELECT iu.incident_id
          FROM public.unit_assignments ua
          JOIN public.incident_units iu ON iu.id = ua.incident_unit_id
          WHERE ua.employee_id = public.current_employee_id()
            AND ua.released_at IS NULL
        )
    )
  );

CREATE POLICY "cf_insert" ON public.consent_forms FOR INSERT
  WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════
-- PERFORMANCE INDEXES (from efficiency audit QW-1)
-- ═══════════════════════════════════════════════════════════════════

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_unit_assignments_employee_id ON unit_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_unit_assignments_incident_unit_id ON unit_assignments(incident_unit_id);
CREATE INDEX IF NOT EXISTS idx_incident_units_incident_id ON incident_units(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_units_unit_id ON incident_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_patient_encounters_incident_id ON patient_encounters(incident_id);
CREATE INDEX IF NOT EXISTS idx_dispense_admin_log_med_unit ON dispense_admin_log(med_unit);
CREATE INDEX IF NOT EXISTS idx_unit_inventory_unit_id ON unit_inventory(unit_id);
CREATE INDEX IF NOT EXISTS idx_cs_transactions_from_unit ON cs_transactions(from_unit);
CREATE INDEX IF NOT EXISTS idx_cs_transactions_to_unit ON cs_transactions(to_unit);
CREATE INDEX IF NOT EXISTS idx_progress_notes_encounter_id ON progress_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_procedures_encounter_id ON encounter_procedures(encounter_id);
CREATE INDEX IF NOT EXISTS idx_employee_credentials_employee_id ON employee_credentials(employee_id);

-- Date/time filter indexes
CREATE INDEX IF NOT EXISTS idx_patient_encounters_date ON patient_encounters(date);
CREATE INDEX IF NOT EXISTS idx_dispense_admin_log_date ON dispense_admin_log(date);
CREATE INDEX IF NOT EXISTS idx_cs_transactions_created_at ON cs_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_ics214_headers_created_at ON ics214_headers(created_at);

-- Composite indexes for common patterns
CREATE INDEX IF NOT EXISTS idx_unit_assignments_active
  ON unit_assignments(employee_id, released_at)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incident_units_active
  ON incident_units(incident_id, released_at)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_encounters_unit_date
  ON patient_encounters(unit, date DESC);

-- Auth and status lookups
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- Employee chat lookup
CREATE INDEX IF NOT EXISTS idx_employee_chats_employee_id ON employee_chats(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_chats_created_at ON employee_chats(created_at);


-- ═══════════════════════════════════════════════════════════════════
-- NOTE: Run this SQL in Supabase Dashboard → SQL Editor → New query
-- Test on staging first. RLS policies use helper functions above.
-- Service-role key (used by API routes) BYPASSES RLS — this is correct.
-- Only client-side anon-key queries are restricted by these policies.
-- ═══════════════════════════════════════════════════════════════════
