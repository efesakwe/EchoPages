# Starting the Server

## Quick Start

1. **Make sure `.env.local` has values (not empty):**
   ```bash
   # Check your .env.local file - all variables should have values after the = sign
   cat .env.local
   ```

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   Go to: `http://localhost:5000`

## What You Should See

When you run `npm run dev`, you should see:
```
▲ Next.js 14.x.x
- Local:        http://localhost:5000

✓ Ready in X seconds
```

Then open `http://localhost:5000` in your browser.

## If You See Errors

**"Missing environment variables"** → Check `.env.local` has all values filled in (no empty values)

**"Port 5000 already in use"** → Kill the process:
```bash
kill -9 $(lsof -ti:5000)
```

**"Failed to connect to Supabase"** → Double-check your Supabase URL and keys in `.env.local`

## Next Steps After Server Starts

1. The app will redirect you to `/login`
2. Make sure your email is in the `allowlist_emails` table in Supabase
3. Sign up or sign in
4. Upload your first PDF!
