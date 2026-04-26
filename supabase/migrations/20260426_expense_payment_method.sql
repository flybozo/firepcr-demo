-- Track whether expense was company card or out-of-pocket (reimbursable)
ALTER TABLE incident_expenses
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'company_card';

COMMENT ON COLUMN incident_expenses.payment_method IS 'company_card or out_of_pocket';
