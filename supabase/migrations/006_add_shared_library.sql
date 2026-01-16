-- Add shared library feature
-- Books that are complete (all chapters have audio) can be shared with all users

-- Add columns to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS audio_complete BOOLEAN DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS total_chapters INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS completed_chapters INTEGER DEFAULT 0;

-- Create index for faster public book searches
CREATE INDEX IF NOT EXISTS idx_books_public ON books(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_books_title_author ON books(title, author) WHERE is_public = true;

-- Allow all authenticated users to read public books
CREATE POLICY "Users can view public books"
  ON books FOR SELECT
  USING (is_public = true);

-- Allow all authenticated users to read chapters of public books
CREATE POLICY "Users can view chapters of public books"
  ON chapters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM books 
      WHERE books.id = chapters.book_id 
      AND books.is_public = true
    )
  );

-- Allow all authenticated users to read audio chunks of public books
CREATE POLICY "Users can view audio chunks of public books"
  ON audio_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chapters 
      JOIN books ON books.id = chapters.book_id
      WHERE chapters.id = audio_chunks.chapter_id 
      AND books.is_public = true
    )
  );

-- Create a table to track which users have "added" public books to their library
CREATE TABLE IF NOT EXISTS user_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_played_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, book_id)
);

-- RLS for user_library
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their library"
  ON user_library FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their library"
  ON user_library FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their library"
  ON user_library FOR DELETE
  USING (auth.uid() = user_id);
