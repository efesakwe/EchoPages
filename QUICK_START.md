# Quick Start Guide

Once you've completed the Supabase setup, run these commands:

## 1. Install Dependencies
```bash
npm install
```

## 2. Set Up Environment
```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your actual keys
```

## 3. Start Redis
```bash
# Option 1: Docker (recommended)
docker run -d -p 6379:6379 redis:alpine

# Option 2: Homebrew (macOS)
brew install redis
brew services start redis

# Verify it's running:
redis-cli ping
# Should return: PONG
```

## 4. Start the App

**Terminal 1 - Development Server:**
```bash
npm run dev
```

**Terminal 2 - Background Worker:**
```bash
npm run worker
```

## 5. Open in Browser
Go to: `http://localhost:5001`

## That's it! 🎉

- Sign up with an allowlisted email
- Upload a PDF
- Extract chapters
- Generate audio
- Start listening!

---

**Note:** The worker processes audio generation jobs in the background. You'll see progress updates in real-time in the UI.
