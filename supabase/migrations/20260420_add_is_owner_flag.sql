-- Add is_owner flag to employees table
-- Used for org-level privileges like viewing all DM conversations
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;

-- Set the current owner (update this for your deployment)
-- This can also be set via the admin UI or API
UPDATE employees SET is_owner = true WHERE wf_email = 'aaron@wildfiremedical.com';
