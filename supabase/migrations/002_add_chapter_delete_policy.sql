-- Add DELETE policy for chapters
CREATE POLICY "Users can delete chapters of their books" ON chapters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.owner_id = auth.uid()
    )
  );
