-- Add soft-delete support to patient_encounters and progress_notes
ALTER TABLE patient_encounters ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE patient_encounters ADD COLUMN IF NOT EXISTS deleted_by text DEFAULT NULL;

ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS deleted_by text DEFAULT NULL;

-- Index for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_patient_encounters_deleted_at ON patient_encounters (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_progress_notes_deleted_at ON progress_notes (deleted_at) WHERE deleted_at IS NULL;
