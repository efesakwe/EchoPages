# Supabase Storage Bucket Setup

Follow these steps to set up the storage bucket for Echo Pages:

## Step 1: Create the Storage Bucket

1. Go to your Supabase project dashboard
2. Click on **Storage** in the left sidebar
3. Click the **"New bucket"** button (or **"Create bucket"**)
4. Configure the bucket:
   - **Name**: `books` (must be exactly this name)
   - **Public bucket**: **OFF** (unchecked) - This makes it private
   - **File size limit**: You can leave default or set to something like 100MB
   - **Allowed MIME types**: Leave empty (allows all types) OR specify:
     - `application/pdf` for PDFs
     - `audio/mpeg` for MP3 audio files
5. Click **"Create bucket"**

## Step 2: Set Up Storage RLS Policies

After creating the bucket, you need to add Row Level Security policies so users can:
- Upload PDFs and audio files
- Read their own files

Go to the **SQL Editor** in Supabase and run these SQL commands:

```sql
-- Allow authenticated users to upload files to the books bucket
CREATE POLICY "Users can upload to books bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'books');

-- Allow users to read files from the books bucket (they uploaded)
CREATE POLICY "Users can read books bucket"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'books');

-- Allow users to update their own files (for audio chunk updates)
CREATE POLICY "Users can update books bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'books');

-- Allow service role to manage all files (for background worker)
CREATE POLICY "Service role can manage books bucket"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'books');
```

## Step 3: Verify the Setup

1. Go back to **Storage** → **books** bucket
2. You should see the bucket is **Private**
3. You can test by trying to upload a file (though the app will handle this automatically)

## Troubleshooting

**If you get permission errors:**
- Make sure the bucket name is exactly `books` (lowercase)
- Verify the RLS policies were created successfully (check the Policies tab)
- Make sure your service role key is correctly set in `.env.local`

**Note:** The storage bucket will store:
- PDFs in the `pdfs/` folder
- Audio chunks in the `audio/` folder
