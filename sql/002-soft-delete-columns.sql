-- ═══════════════════════════════════════════════════════════════════
-- RAM Field Ops — Soft Delete + Audit Columns
-- Run in Supabase SQL Editor AFTER 001-rls-and-indexes.sql
-- Safe to re-run (uses IF NOT EXISTS / exception handling)
-- ═══════════════════════════════════════════════════════════════════

-- patient_encounters: soft delete + audit
DO $$ BEGIN
  ALTER TABLE public.patient_encounters ADD COLUMN deleted_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.patient_encounters ADD COLUMN deleted_by text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.patient_encounters ADD COLUMN updated_by text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- progress_notes: soft delete
DO $$ BEGIN
  ALTER TABLE public.progress_notes ADD COLUMN deleted_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.progress_notes ADD COLUMN deleted_by text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_patient_encounters_deleted_at
  ON patient_encounters(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_progress_notes_deleted_at
  ON progress_notes(deleted_at)
  WHERE deleted_at IS NULL;
