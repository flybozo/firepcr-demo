-- Add patient_agency to patient_encounters
ALTER TABLE public.patient_encounters
  ADD COLUMN IF NOT EXISTS patient_agency text;

-- incident_access_codes already has expires_at from security audit migration
-- Ensure DELETE RLS is covered by admin policy (already covered via service client in API)
