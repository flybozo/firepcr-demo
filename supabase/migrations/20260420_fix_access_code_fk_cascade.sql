-- Fix FK constraints so access codes can be deleted even when they have
-- log entries and chat messages referencing them.

-- access_log: cascade delete (logs are meaningless without the code)
ALTER TABLE incident_access_log DROP CONSTRAINT IF EXISTS incident_access_log_access_code_id_fkey;
ALTER TABLE incident_access_log ADD CONSTRAINT incident_access_log_access_code_id_fkey 
  FOREIGN KEY (access_code_id) REFERENCES incident_access_codes(id) ON DELETE CASCADE;

-- chat_messages: set null (preserve message history, just detach from code)
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_access_code_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_access_code_id_fkey 
  FOREIGN KEY (access_code_id) REFERENCES incident_access_codes(id) ON DELETE SET NULL;

-- Also add public read policy for external avatar images
CREATE POLICY IF NOT EXISTS "Public read external avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents' AND name LIKE 'external-avatars/%');
