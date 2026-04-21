-- Add avatar_url to access codes so external users can upload a headshot
ALTER TABLE incident_access_codes ADD COLUMN IF NOT EXISTS avatar_url text;
