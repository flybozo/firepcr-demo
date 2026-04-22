-- External Chat: fire agency liaisons can chat with RAM units on their incident
-- Separate from internal channels — external users identified by access code

-- 1. Add 'external' to chat_channels type check
ALTER TABLE chat_channels DROP CONSTRAINT IF EXISTS chat_channels_type_check;
ALTER TABLE chat_channels ADD CONSTRAINT chat_channels_type_check 
  CHECK (type = ANY (ARRAY['company'::text, 'incident'::text, 'unit'::text, 'direct'::text, 'external'::text]));

-- 2. Link chat channels to access codes
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS access_code_id uuid REFERENCES incident_access_codes(id) ON DELETE SET NULL;

-- 3. External chat messages: nullable sender_id + access code identity
ALTER TABLE chat_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS external_sender_name text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS access_code_id uuid REFERENCES incident_access_codes(id);

-- 4. Index for external channel lookup
CREATE INDEX IF NOT EXISTS idx_chat_channels_access_code ON chat_channels(access_code_id) WHERE access_code_id IS NOT NULL;

-- 5. RLS: external channels readable by members + by access code holders
-- (We'll handle access control in the API layer for external users since they don't have Supabase auth)
