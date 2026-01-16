# Port 5000 Info

## Why Port 5000 Isn't Available

Port 5000 on macOS is commonly used by **Control Center** for AirPlay Receiver. This is a system service that you shouldn't kill.

## Solution: Using Port 5001

I've updated the app to use **port 5001** by default instead. This is better because:
- ✅ Doesn't conflict with system services
- ✅ No need to kill processes
- ✅ Works reliably on macOS

## To Start on Port 5001

Just run:
```bash
npm run dev
```

The app will start on `http://localhost:5001`

## Update Your Environment Variable

If you want auth callbacks to work, update your `.env.local`:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:5001
```

## Still Want to Use Port 5000?

If you really need port 5000, you can:
1. Disable AirPlay Receiver in System Settings → General → AirDrop & Handoff
2. Then use: `npm run dev:5000`

But port 5001 is recommended! ✅
