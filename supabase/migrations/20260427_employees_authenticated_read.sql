-- Re-add authenticated read access to employees table.
-- Required because PostgREST FK joins (employee:employees(...)) go through
-- the base table's RLS, not through employees_sync view.
-- Without this, field users see null/"unknown" for other employees in
-- crew assignments, MAR, supply runs, etc.
--
-- PII protection is handled by:
-- 1. FK join clauses only selecting safe columns (id, name, role, headshot_url)
-- 2. Direct queries using employees_sync view (which excludes sensitive columns)
CREATE POLICY "employees_select_authenticated" ON public.employees FOR SELECT
  TO authenticated
  USING (true);
