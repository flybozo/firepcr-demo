CREATE TABLE IF NOT EXISTS public.unit_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_meters double precision,
  heading double precision,
  speed_mps double precision,
  source text DEFAULT 'auto' CHECK (source IN ('auto', 'manual', 'checkin')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unit_loc_unit ON public.unit_location_pings(unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unit_loc_incident ON public.unit_location_pings(incident_id, created_at DESC);

-- RPC: latest ping per unit for a given incident
CREATE OR REPLACE FUNCTION get_unit_locations(p_incident_id uuid)
RETURNS TABLE(
  unit_id uuid,
  unit_name text,
  unit_type text,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  heading double precision,
  last_seen timestamptz,
  reporter_name text
) AS $$
  SELECT DISTINCT ON (ulp.unit_id)
    ulp.unit_id,
    u.name AS unit_name,
    ut.name AS unit_type,
    ulp.latitude,
    ulp.longitude,
    ulp.accuracy_meters,
    ulp.heading,
    ulp.created_at AS last_seen,
    e.name AS reporter_name
  FROM public.unit_location_pings ulp
  JOIN public.units u ON u.id = ulp.unit_id
  JOIN public.unit_types ut ON ut.id = u.unit_type_id
  LEFT JOIN public.employees e ON e.id = ulp.employee_id
  WHERE ulp.incident_id = p_incident_id
  ORDER BY ulp.unit_id, ulp.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RPC: all incidents with their latest location data (for global map)
CREATE OR REPLACE FUNCTION get_all_incident_locations()
RETURNS TABLE(
  incident_id uuid,
  incident_name text,
  unit_id uuid,
  unit_name text,
  unit_type text,
  latitude double precision,
  longitude double precision,
  last_seen timestamptz
) AS $$
  SELECT DISTINCT ON (ulp.incident_id, ulp.unit_id)
    i.id AS incident_id,
    i.name AS incident_name,
    ulp.unit_id,
    u.name AS unit_name,
    ut.name AS unit_type,
    ulp.latitude,
    ulp.longitude,
    ulp.created_at AS last_seen
  FROM public.unit_location_pings ulp
  JOIN public.incidents i ON i.id = ulp.incident_id
  JOIN public.units u ON u.id = ulp.unit_id
  JOIN public.unit_types ut ON ut.id = u.unit_type_id
  WHERE ulp.created_at > now() - interval '48 hours'
  ORDER BY ulp.incident_id, ulp.unit_id, ulp.created_at DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE public.unit_location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees can read location pings" ON public.unit_location_pings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can insert location pings" ON public.unit_location_pings FOR INSERT TO authenticated WITH CHECK (true);
