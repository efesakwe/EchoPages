-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Allowlist emails table
CREATE TABLE IF NOT EXISTS allowlist_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  title TEXT NOT NULL,
  text_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(book_id, idx)
);

-- Audio chunks table
CREATE TABLE IF NOT EXISTS audio_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  voice TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  text TEXT NOT NULL,
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  duration_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chapter_id, idx)
);

-- Playback state table
CREATE TABLE IF NOT EXISTS playback_state (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  chunk_idx INTEGER NOT NULL,
  seconds_in_chunk NUMERIC(10, 2) NOT NULL DEFAULT 0,
  playback_rate NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id, chapter_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_audio_chunks_chapter ON audio_chunks(chapter_id);
CREATE INDEX IF NOT EXISTS idx_audio_chunks_status ON audio_chunks(status);
CREATE INDEX IF NOT EXISTS idx_playback_state_user_book ON playback_state(user_id, book_id);

-- Row Level Security (RLS) policies
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowlist_emails ENABLE ROW LEVEL SECURITY;

-- Books policies: users can only see their own books or books they have access to
CREATE POLICY "Users can view their own books" ON books
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own books" ON books
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Chapters policies: users can view chapters of books they own
CREATE POLICY "Users can view chapters of their books" ON chapters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create chapters for their books" ON chapters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.owner_id = auth.uid()
    )
  );

-- Audio chunks policies: users can view chunks of their chapters
CREATE POLICY "Users can view audio chunks of their chapters" ON audio_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chapters
      JOIN books ON books.id = chapters.book_id
      WHERE chapters.id = audio_chunks.chapter_id AND books.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage audio chunks" ON audio_chunks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Playback state policies: users can manage their own playback state
CREATE POLICY "Users can manage their own playback state" ON playback_state
  FOR ALL USING (auth.uid() = user_id);

-- Allowlist policies: users can check if they're on the allowlist (read-only)
CREATE POLICY "Anyone can check allowlist" ON allowlist_emails
  FOR SELECT USING (true);
