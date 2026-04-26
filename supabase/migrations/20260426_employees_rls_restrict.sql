-- ═══════════════════════════════════════════════════════════════════
-- Restrict employees table RLS — 2026-04-26
--
-- Problem: Two open-access policies exposed all employee rows and
-- columns (PII, daily_rate, signing_pin_hash, admin_notes) to
-- unauthenticated anon users:
--   - "employees_select"    USING (true)
--   - "auth_all_employees"  USING (true)  ← was overriding new policies
--
-- Additionally, employees_sync view ran as definer (postgres), bypassing
-- RLS entirely and exposing all rows to anon via the view.
--
-- Fix:
--   - Drop both open policies
--   - Admins: full read access to all rows
--   - Field users: read only their own row via employees table
--     (roster lookups use employees_sync instead)
--   - Anon/unauthenticated: no access to either
--   - employees_sync: security_invoker=true so RLS applies to callers
-- ═══════════════════════════════════════════════════════════════════

-- ─── Drop all open-access policies on employees ───────────────────
-- Both used USING (true), granting full read to anon
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "auth_all_employees" ON public.employees;

-- ─── Scoped read policies ─────────────────────────────────────────
-- Admins can read all employee rows (full table)
CREATE POLICY "employees_select_admin" ON public.employees FOR SELECT
  USING (public.is_admin());

-- Field users: read only their own row (profile page, PIN setup, theme, etc.)
-- Roster/name lookups for field users use employees_sync instead
CREATE POLICY "employees_select_self" ON public.employees FOR SELECT
  USING (auth_user_id = auth.uid());

-- ─── employees_sync view security ─────────────────────────────────
-- Grant authenticated users SELECT on the safe sync view
GRANT SELECT ON public.employees_sync TO authenticated;

-- Force the view to evaluate RLS as the calling user (not the definer).
-- Without this, the view runs as postgres/service role and bypasses RLS,
-- exposing all rows to anon.
ALTER VIEW public.employees_sync SET (security_invoker = true);
