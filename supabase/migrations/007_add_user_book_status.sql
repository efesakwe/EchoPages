-- User book status (favorites, finished) - personal to each user
CREATE TABLE IF NOT EXISTS user_book_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  is_finished BOOLEAN DEFAULT false,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- RLS for user_book_status
ALTER TABLE user_book_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own book status"
  ON user_book_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own book status"
  ON user_book_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book status"
  ON user_book_status FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own book status"
  ON user_book_status FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_book_status_user ON user_book_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_book_status_favorites ON user_book_status(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_user_book_status_finished ON user_book_status(user_id, is_finished) WHERE is_finished = true;

-- Add category column to books if not exists
ALTER TABLE books ADD COLUMN IF NOT EXISTS category TEXT;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
