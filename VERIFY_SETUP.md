# Verify Your Setup

Use this guide to check that everything is configured correctly.

## ✅ 1. Database Tables Check

Go to **Supabase Dashboard → Table Editor** and verify you see these tables:

- [ ] `allowlist_emails`
- [ ] `books`
- [ ] `chapters`
- [ ] `audio_chunks`
- [ ] `playback_state`

**Quick SQL Test** (run in SQL Editor):
```sql
-- This should return 5 rows (one for each table)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('allowlist_emails', 'books', 'chapters', 'audio_chunks', 'playback_state');
```

## ✅ 2. Storage Bucket Check

Go to **Supabase Dashboard → Storage**:

- [ ] You see a bucket named **`books`** (exact name, lowercase)
- [ ] The bucket shows as **Private** (not Public)
- [ ] Click on the `books` bucket → **Policies** tab
- [ ] You should see 4 policies:
  - "Users can upload to books bucket"
  - "Users can read books bucket"
  - "Users can update books bucket"
  - "Service role can manage books bucket"

## ✅ 3. Allowlist Check

In **Supabase Dashboard → Table Editor → allowlist_emails**:

- [ ] Add at least one email:
```sql
INSERT INTO allowlist_emails (email) VALUES ('your-email@example.com');
```

- [ ] Verify it was added:
```sql
SELECT * FROM allowlist_emails;
```

## ✅ 4. Environment Variables Check

Create/verify `.env.local` file in the project root:

- [ ] File exists at `/Users/rosie/Documents/Echo Pages/.env.local`
- [ ] Contains all required variables (see below)

**Quick check** - Run in terminal:
```bash
cd "/Users/rosie/Documents/Echo Pages"
cat .env.local | grep -E "^[A-Z]" | cut -d'=' -f1
```

Should show:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- ELEVENLABS_API_KEY
- REDIS_HOST
- REDIS_PORT
- NEXT_PUBLIC_APP_URL

## ✅ 5. Quick Connection Test

Run this to test your Supabase connection:

```bash
cd "/Users/rosie/Documents/Echo Pages"
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
supabase.from('allowlist_emails').select('count').then(r => console.log('✅ Supabase connection works!') || console.error(r.error) || process.exit(r.error ? 1 : 0));
"
```

(You'll need dotenv installed: `npm install dotenv`)

## ✅ 6. Visual Checklist Summary

**Supabase Dashboard:**
- ✅ Database: All 5 tables exist
- ✅ Storage: `books` bucket exists (private)
- ✅ Storage Policies: 4 policies configured
- ✅ Auth: Ready (default Supabase auth)

**Local Files:**
- ✅ `.env.local` exists with all keys filled in
- ✅ `package.json` exists
- ✅ All source files in `src/` directory

**Next Steps After Verification:**
1. Install dependencies: `npm install`
2. Start Redis
3. Start dev server: `npm run dev`
4. Start worker: `npm run worker` (in separate terminal)
5. Test the app!

---

**Common Issues:**

❌ **"Bucket not found"** → Make sure bucket name is exactly `books` (lowercase)
❌ **"Permission denied"** → Check RLS policies are created
❌ **"Email not on allowlist"** → Add your email to `allowlist_emails` table
❌ **"Connection failed"** → Verify `.env.local` has correct Supabase URL and keys
