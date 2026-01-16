-- Add TTS provider column to books table
-- Default to 'openai' (Regular - cheaper) instead of 'elevenlabs' (Premium)
ALTER TABLE books ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'openai';

-- Update existing books to use openai by default (or keep elevenlabs if they had audio generated)
-- Books with existing audio chunks using elevenlabs will stay with elevenlabs
UPDATE books 
SET tts_provider = 'openai' 
WHERE tts_provider IS NULL;
