-- Add narrator_voice column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS narrator_voice TEXT DEFAULT 'rachel';

-- Add comment explaining the column
COMMENT ON COLUMN books.narrator_voice IS 'The voice ID to use for narration (from voiceOptions.ts)';
