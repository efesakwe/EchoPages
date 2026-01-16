# Fix: Connection Refused Error

## What This Means

"ERR_CONNECTION_REFUSED" means your browser can't connect to the server because:
1. The server isn't running
2. You're trying to access the wrong port
3. The server failed to start

## Quick Fix

### Step 1: Check if Server is Running

In your terminal, you should see something like:
```
▲ Next.js 14.x.x
- Local:        http://localhost:5001

✓ Ready in X seconds
```

If you don't see this, the server isn't running.

### Step 2: Start the Server

Make sure you're in the project directory and run:
```bash
cd "/Users/rosie/Documents/Echo Pages"
npm run dev
```

### Step 3: Use the Correct URL

Make sure you're accessing:
- ✅ `http://localhost:5001` (port 5001 - current default)
- ❌ NOT `http://localhost:5000` (port 5000 is used by macOS Control Center)

### Step 4: Check for Errors

Look at your terminal output when running `npm run dev`. If you see errors:
- **"Missing environment variables"** → Make sure `.env.local` has all values filled in
- **"Port already in use"** → The port might be taken, try: `next dev -p 5002`
- **"Cannot find module"** → Run `npm install` again

## Still Not Working?

1. **Check terminal output** - Look for error messages
2. **Verify the URL** - Make sure it's `http://localhost:5001` (not 5000)
3. **Check browser console** - Press F12 and look for errors
