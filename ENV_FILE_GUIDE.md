# How to Fill Out .env.local File

## Complete Example of .env.local

Here's what your `.env.local` file should look like with **all values filled in**:

```bash
# Supabase (get these from: Supabase Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (get from: https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ElevenLabs (get from: https://elevenlabs.io/app/settings/api-keys)
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Redis (keep these as-is for local development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# App URL (use port 5001 - not 5000)
NEXT_PUBLIC_APP_URL=http://localhost:5001
```

## Lines 12-15 Explained

Lines 12-15 should look like this:

```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### What to Put There:

1. **`REDIS_HOST=localhost`** ✅ **Keep this as-is** (for local development)

2. **`REDIS_PORT=6379`** ✅ **Keep this as-is** (standard Redis port)

3. **`REDIS_PASSWORD=`** ✅ **Leave empty** (for local Redis without password)

4. **`NEXT_PUBLIC_APP_URL=http://localhost:5001`** ✅ **Use port 5001** (not 5000)

## Where to Get the Values

### Supabase Keys (Lines 2-4)
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

### OpenAI Key (Line 7)
1. Go to: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-`)

### ElevenLabs Key (Line 10)
1. Go to: https://elevenlabs.io/app/settings/api-keys
2. Click **"Generate New API Key"**
3. Copy the key

## Important Notes

- ✅ **No spaces** around the `=` sign
- ✅ **No quotes** needed around values
- ✅ **No empty values** (except `REDIS_PASSWORD` which can be empty)
- ✅ Make sure **ALL** keys have actual values (not just empty strings)

## Example of What NOT to Do

❌ Wrong:
```bash
REDIS_HOST = localhost     # No spaces around =
REDIS_PORT=                # Missing value
REDIS_PASSWORD=" "         # Don't use quotes
NEXT_PUBLIC_APP_URL=http://localhost:5000  # Wrong port (use 5001)
```

✅ Correct:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
NEXT_PUBLIC_APP_URL=http://localhost:5001
```
