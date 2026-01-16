# Create Supabase Storage Bucket

The error "Bucket not found" means the `books` storage bucket doesn't exist in your Supabase project.

## Steps to Create the Bucket

1. **Go to your Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to Storage**
   - Click on "Storage" in the left sidebar
   - You should see a list of buckets (or an empty list if none exist)

3. **Create New Bucket**
   - Click the "New bucket" button
   - **Bucket name:** `books` (must be exactly this name)
   - **Public bucket:** ✅ **Check this box** (make it public so audio files can be accessed)
   - Click "Create bucket"

4. **Set Up RLS Policies (if needed)**
   - Go to Storage → `books` bucket → Policies
   - Make sure there are policies that allow:
     - **SELECT** (read) for authenticated users or public
     - **INSERT** (upload) for authenticated users

## Quick SQL to Create Bucket (Alternative)

If you prefer SQL, you can run this in the Supabase SQL Editor:

```sql
-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('books', 'books', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'books');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'books');
```

## Verify the Bucket

After creating the bucket:
1. Refresh your browser
2. Try playing the audio again
3. The error should be gone

## If You Still Get Errors

- Make sure the bucket name is exactly `books` (lowercase, no spaces)
- Make sure it's set to **Public**
- Check that the file path in the URL matches: `audio/{chapterId}/{chunkIdx}.mp3`
