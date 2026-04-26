-- Link supply runs to patient encounters
ALTER TABLE supply_runs
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES patient_encounters(id);

CREATE INDEX IF NOT EXISTS idx_supply_runs_encounter_id ON supply_runs(encounter_id)
  WHERE encounter_id IS NOT NULL;
