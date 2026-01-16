# Fix Environment Variable Format

## The Problem

Next.js detected `.env.local` but can't read the values. This is usually because of formatting issues.

## Critical Formatting Rules

### ✅ CORRECT Format

```bash
NEXT_PUBLIC_SUPABASE_URL=https://mwcajbmrlkiurytvoleu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Y2FqYm1ybGtpdXJ5dHZvbGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4NzY4MDAsImV4cCI6MjA1MDQ1MjgwMH0.xxxxx
```

### ❌ WRONG Format (Common Issues)

```bash
# ❌ Line break in the middle of token
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJpc3MiOiJzdXBhYmFzZSIs...

# ❌ Spaces around =
NEXT_PUBLIC_SUPABASE_URL = https://mwcajbmrlkiurytvoleu.supabase.co

# ❌ Quotes (not needed)
NEXT_PUBLIC_SUPABASE_URL="https://mwcajbmrlkiurytvoleu.supabase.co"

# ❌ Trailing spaces
NEXT_PUBLIC_SUPABASE_URL=https://mwcajbmrlkiurytvoleu.supabase.co 
```

## Step-by-Step Fix

### 1. Open `.env.local` in a Text Editor

**NOT** a word processor - use:
- VS Code
- TextEdit (Plain Text mode)
- nano (in terminal)

### 2. Check Each Line

Make sure:
- ✅ Each variable is on **one single line** (no line breaks)
- ✅ No spaces around the `=` sign
- ✅ No quotes around values
- ✅ No trailing spaces at the end of lines

### 3. Re-format Long JWT Tokens

If your JWT tokens have line breaks, you need to join them into one line:

**Bad:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Y2FqYm1ybGtpdXJ5dHZvbGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4NzY4MDAsImV4cCI6MjA1MDQ1MjgwMH0.
xxxxx
```

**Good:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Y2FqYm1ybGtpdXJ5dHZvbGV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4NzY4MDAsImV4cCI6MjA1MDQ1MjgwMH0.xxxxx
```

### 4. Save and Restart

1. **Save the file**
2. **Stop the server** (Ctrl+C)
3. **Clear cache**: `rm -rf .next`
4. **Start again**: `npm run dev`

## Quick Test

After fixing, the error message will tell you which variable is missing:
- "URL: MISSING" → `NEXT_PUBLIC_SUPABASE_URL` is wrong
- "Key: MISSING" → `NEXT_PUBLIC_SUPABASE_ANON_KEY` is wrong

## Still Not Working?

Try this diagnostic in terminal:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Found (' + process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...)' : '✗ Missing');
console.log('KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Found (' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 30) + '...)' : '✗ Missing');
"
```

If this shows "Missing", your `.env.local` file format is wrong.
