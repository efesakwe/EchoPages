# Add Public Read Policy for Audio Files

Your `books` bucket is private, but the audio player needs to access the files. You have two options:

## Option 1: Add Public Read Policy (Easiest)

Add a policy that allows **public** (unauthenticated) read access to audio files:

1. In the Supabase dashboard, go to **Storage** → **Files** → **Policies**
2. Make sure you're viewing the **"books"** bucket policies
3. Click **"New policy"**
4. Configure:
   - **Policy name:** `Public can read audio files`
   - **Allowed operation:** `SELECT` (read)
   - **Target roles:** `public` (or `anon`)
   - **Policy definition:** 
     ```sql
     bucket_id = 'books' AND (storage.foldername(name))[1] = 'audio'
     ```
     This allows public read access only to files in the `audio/` folder
5. Click **"Review"** then **"Save policy"**

## Option 2: Make the Entire Bucket Public

If you want all files in the bucket to be publicly accessible:

1. Go to **Storage** → **Buckets**
2. Find the **"books"** bucket
3. Click the three dots (⋯) next to it
4. Click **"Edit bucket"**
5. Check **"Public bucket"**
6. Click **"Update bucket"**

## Option 3: Use Signed URLs (More Secure)

If you want to keep the bucket private, we can update the code to use signed URLs instead of public URLs. This requires authentication but provides better security.

**Which option do you prefer?**
- **Option 1** is best if you only want audio files to be public
- **Option 2** is simplest but makes all files public
- **Option 3** is most secure but requires code changes
