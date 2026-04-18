-- Security audit items — 2026-04-16

-- 1. Track who made inline edits on encounters
ALTER TABLE patient_encounters ADD COLUMN IF NOT EXISTS updated_by text DEFAULT NULL;

-- 2. Clinical audit log for field-level edit tracking
CREATE TABLE IF NOT EXISTS public.clinical_audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text NOT NULL,
    record_id text NOT NULL,
    action text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    performed_by text,
    performed_by_employee_id text,
    performed_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_log_record ON public.clinical_audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON public.clinical_audit_log (performed_at DESC);

ALTER TABLE public.clinical_audit_log ENABLE ROW LEVEL SECURITY;
