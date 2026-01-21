# Railway Environment Variables Setup

## Recommended Settings for Tier 2 OpenAI

Add these environment variables to your **Railway worker service**:

### Performance Optimization Variables

```bash
WORKER_CONCURRENCY=10
TTS_BATCH_SIZE=12
```

## How to Add to Railway

### Option 1: Railway Dashboard (Recommended)

1. **Go to your Railway project**: https://railway.app/dashboard
2. **Select your worker service** (the one running `npm run worker`)
3. **Click on "Variables" tab** (or go to Settings → Variables)
4. **Click "+ New Variable"**
5. **Add each variable:**

   **Variable 1:**
   - **Name**: `WORKER_CONCURRENCY`
   - **Value**: `10`
   - **Click "Add"**

   **Variable 2:**
   - **Name**: `TTS_BATCH_SIZE`
   - **Value**: `12`
   - **Click "Add"**

6. **Redeploy** your worker service (Railway should auto-redeploy when you add variables, or click "Redeploy" button)

### Option 2: Railway CLI

```bash
# Install Railway CLI if you haven't
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Add variables
railway variables set WORKER_CONCURRENCY=10
railway variables set TTS_BATCH_SIZE=12
```

### Option 3: railway.json (if using)

Add to your `railway.json` file:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run worker",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "variables": {
    "WORKER_CONCURRENCY": "10",
    "TTS_BATCH_SIZE": "12"
  }
}
```

## Verify Settings

After deployment, check your Railway logs. You should see:

```
[PERFORMANCE] Worker concurrency: 10 chapters simultaneously
[PERFORMANCE] Chunk batch size: 12 chunks per batch
[PERFORMANCE] Set WORKER_CONCURRENCY and TTS_BATCH_SIZE env vars to adjust speed
```

## All Required Environment Variables

Make sure you have these in Railway (not just the performance ones):

### Required for Worker
```bash
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=...
GOOGLE_CLOUD_API_KEY=... (optional)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
REDIS_URL=redis://... (Railway provides this automatically for Redis service)
```

### Performance Settings (Add These)
```bash
WORKER_CONCURRENCY=10
TTS_BATCH_SIZE=12
```

## Adjusting Settings

### If you want faster (but monitor for rate limits):
```bash
WORKER_CONCURRENCY=15
TTS_BATCH_SIZE=15
```

### If you see rate limit errors (429), reduce to:
```bash
WORKER_CONCURRENCY=5
TTS_BATCH_SIZE=8
```

### Most conservative (safe default):
```bash
WORKER_CONCURRENCY=3
TTS_BATCH_SIZE=5
```

## Important Notes

1. **Only add these to the WORKER service**, not your Next.js app
2. **Railway will auto-redeploy** when you add new variables
3. **Check logs** after deployment to verify the settings are loaded
4. **Start conservative** (10/12) and increase if you see no issues

## Quick Copy-Paste

If you want to start with the recommended Tier 2 settings, just add these two:

```
WORKER_CONCURRENCY=10
TTS_BATCH_SIZE=12
```

That's it! 🚀
