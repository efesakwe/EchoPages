# Troubleshooting - Nothing Showing on Localhost

## Quick Diagnosis

If you see nothing on `http://localhost:5000`, check these:

### ✅ Step 1: Install Dependencies
```bash
npm install
```

**If you get permission errors**, try:
```bash
sudo npm install
```

### ✅ Step 2: Create `.env.local` File

You **must** create `.env.local` with your keys before the app can start:

```bash
# Create the file
touch .env.local

# Then edit it and add (replace with your actual values):
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
REDIS_HOST=localhost
REDIS_PORT=6379
NEXT_PUBLIC_APP_URL=http://localhost:5001
```

**Get your Supabase keys from:**
- Supabase Dashboard → Project Settings → API

### ✅ Step 3: Check What's Running on Port 5000

```bash
# See what's using port 5000
lsof -ti:5000

# Kill any old processes if needed
kill -9 $(lsof -ti:5000)
```

### ✅ Step 4: Start the Dev Server

```bash
npm run dev
```

You should see:
```
   ▲ Next.js 14.x.x
   - Local:        http://localhost:5000
   - Ready in X seconds
```

### ✅ Step 5: Check for Errors

**Common errors:**

1. **"Cannot find module"** → Run `npm install`
2. **"Environment variable missing"** → Create `.env.local` with all required variables
3. **"Port 5000 already in use"** → Kill the process or use a different port
4. **"Failed to connect to Supabase"** → Check your Supabase URL and keys in `.env.local`

### ✅ Step 6: Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab** for JavaScript errors
- **Network tab** for failed requests

## Still Not Working?

1. **Check terminal output** - Look for error messages when running `npm run dev`
2. **Verify environment variables**:
   ```bash
   cat .env.local
   ```
3. **Try a different port**:
   ```bash
   next dev -p 5001
   ```

## Quick Test

Run this to verify setup:
```bash
npm run verify
```

This will check:
- Environment variables are set
- Dependencies are installed
- Supabase connection works
