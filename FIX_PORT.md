# Fix Port 5000 Already in Use

## Quick Fix

Run this command to kill whatever is using port 5000:

```bash
kill -9 $(lsof -ti:5000)
```

Then try starting the server again:

```bash
npm run dev
```

## Alternative: Use a Different Port

If you prefer to use a different port (e.g., 5001), you can:

1. **Option 1**: Start on a different port:
   ```bash
   next dev -p 5001
   ```

2. **Option 2**: Update package.json to use a different port permanently

## Find What's Using Port 5000

To see what process is using port 5000:

```bash
lsof -ti:5000
```

Or see more details:

```bash
lsof -i:5000
```
