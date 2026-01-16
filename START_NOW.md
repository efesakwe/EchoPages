# Ready to Start! 🚀

## Start the Dev Server

Run this command in your terminal:

```bash
npm run dev
```

## What You Should See

When it starts successfully, you'll see:

```
▲ Next.js 14.x.x
- Local:        http://localhost:5001

✓ Ready in X seconds
```

## Then Open in Browser

Go to: **`http://localhost:5001`**

## What Happens Next

1. You'll be redirected to `/login` page
2. Sign up with an email that's in your `allowlist_emails` table
3. Start uploading PDFs!

## If You See Errors

**"Cannot find module"** → The dependencies are already installed, so this shouldn't happen. If it does, run `npm install` again.

**"Environment variable missing"** → Make sure all values in `.env.local` are filled in (no empty strings after the `=`)

**"Port already in use"** → Try: `next dev -p 5002`

## Quick Checklist

✅ `.env.local` file exists with all values filled in
✅ Dependencies installed (`node_modules` exists)
✅ You're ready to go!

**Just run: `npm run dev`** 🎉
