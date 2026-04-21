-- Add deleted_at column to chat_channels for soft-delete support
-- Required by the DM delete feature (channels.ts deleteChannel sets this)
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
