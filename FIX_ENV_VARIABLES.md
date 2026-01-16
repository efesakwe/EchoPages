# Fix: Supabase Environment Variables Error

## The Problem

The error says:
```
Error: Your project's URL and Key are required to create a Supabase client!
```

This means your `.env.local` file isn't being read correctly, OR the values are empty.

## Quick Fix

### Step 1: Check Your .env.local File

Make sure your `.env.local` file has **actual values** (not empty):

```bash
# ✅ CORRECT - Has values
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ WRONG - Empty values
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Step 2: Common Issues to Check

1. **No spaces around `=` sign**
   - ✅ Correct: `NEXT_PUBLIC_SUPABASE_URL=https://...`
   - ❌ Wrong: `NEXT_PUBLIC_SUPABASE_URL = https://...`

2. **No quotes needed**
   - ✅ Correct: `NEXT_PUBLIC_SUPABASE_URL=https://...`
   - ❌ Wrong: `NEXT_PUBLIC_SUPABASE_URL="https://..."`

3. **No empty values** - All variables must have values after `=`
   - ✅ Correct: `NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co`
   - ❌ Wrong: `NEXT_PUBLIC_SUPABASE_URL=`

4. **File must be named `.env.local`** (not `.env` or `env.local`)

### Step 3: Verify Your Values

Make sure these three lines have actual values:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...
```

### Step 4: Restart the Server

After fixing `.env.local`:
1. **Stop the server** (Ctrl+C in terminal)
2. **Start it again**: `npm run dev`
3. The environment variables will be reloaded

## Where to Get Supabase Keys

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

## Still Not Working?

1. **Double-check** there are no trailing spaces
2. **Make sure** file is saved
3. **Restart** the dev server completely (stop and start again)
