# Setup Checklist

Follow these steps to get Echo Pages running:

## ✅ Steps You Need to Complete (Supabase & Environment)

### 1. Supabase Setup
- [ ] Create a new Supabase project
- [ ] Run the migration: Copy contents of `supabase/migrations/001_initial_schema.sql` and run in Supabase SQL Editor
- [ ] Create storage bucket named `books` (make it private)
- [ ] Add storage RLS policies (see README)
- [ ] Add your email(s) to `allowlist_emails` table:
  ```sql
  INSERT INTO allowlist_emails (email) VALUES ('your-email@example.com');
  ```

### 2. Environment Variables
- [ ] Copy `.env.example` to `.env.local`
- [ ] Fill in all required values:
  - `NEXT_PUBLIC_SUPABASE_URL` - From Supabase project settings
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - From Supabase project settings
  - `SUPABASE_SERVICE_ROLE_KEY` - From Supabase project settings (⚠️ Keep secret!)
  - `OPENAI_API_KEY` - Your OpenAI API key
  - `ELEVENLABS_API_KEY` - Your ElevenLabs API key
  - `REDIS_HOST` - Usually `localhost`
  - `REDIS_PORT` - Usually `6379`
  - `NEXT_PUBLIC_APP_URL` - `http://localhost:5000` for dev

## ✅ Steps I'll Help With Next

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Redis
```bash
# Using Docker (easiest):
docker run -d -p 6379:6379 redis:alpine

# Or using Homebrew (macOS):
brew install redis
brew services start redis

# Verify Redis is running:
redis-cli ping
# Should return: PONG
```

### 5. Start Development Server
```bash
npm run dev
```

### 6. Start Background Worker (in separate terminal)
```bash
npm run worker
```

## Quick Test

Once everything is running:
1. Go to `http://localhost:5000`
2. Sign up with an allowlisted email
3. Upload a PDF book
4. Extract chapters
5. Generate audio (will queue - worker processes in background)

## Troubleshooting

- **Redis connection error**: Make sure Redis is running (`redis-cli ping`)
- **Supabase auth error**: Check your Supabase keys in `.env.local`
- **Worker not processing jobs**: Check worker terminal for errors, verify Redis connection
- **Storage upload fails**: Verify `books` bucket exists and RLS policies are set
