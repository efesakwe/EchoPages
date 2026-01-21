-- Verification and Setup Script for user_book_status table
-- Run this in your Supabase SQL Editor to ensure the table and policies are set up correctly

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_book_status'
) AS table_exists;

-- 2. Create table if it doesn't exist
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

-- 3. Enable RLS
ALTER TABLE user_book_status ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own book status" ON user_book_status;
DROP POLICY IF EXISTS "Users can insert their own book status" ON user_book_status;
DROP POLICY IF EXISTS "Users can update their own book status" ON user_book_status;
DROP POLICY IF EXISTS "Users can delete their own book status" ON user_book_status;

-- 5. Create RLS policies
CREATE POLICY "Users can view their own book status"
  ON user_book_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own book status"
  ON user_book_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own book status"
  ON user_book_status FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own book status"
  ON user_book_status FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_book_status_user ON user_book_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_book_status_favorites ON user_book_status(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_user_book_status_finished ON user_book_status(user_id, is_finished) WHERE is_finished = true;

-- 7. Verify the setup
SELECT 
  'user_book_status' AS table_name,
  COUNT(*) AS row_count
FROM user_book_status;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'user_book_status';

-- 8. Test query (replace with your actual user ID)
-- SELECT * FROM user_book_status WHERE user_id = 'YOUR_USER_ID_HERE';
