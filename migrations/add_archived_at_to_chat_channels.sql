-- Add archived_at column to chat_channels
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
