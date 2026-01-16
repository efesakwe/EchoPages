# Starting the Audio Generation Worker

The audio generation worker processes audio chunks in the background. **You need to run it separately** from the main Next.js server.

## Quick Start

1. **Make sure Redis is running** (required for the worker):
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   
   # If not running, start Redis:
   # On macOS with Homebrew:
   brew services start redis
   
   # Or run directly:
   redis-server
   ```

2. **Start the worker** in a separate terminal:
   ```bash
   npm run worker
   ```

   You should see:
   ```
   Audio generation worker started
   ```

3. **Keep it running** - The worker needs to stay running to process audio generation jobs.

## Running Both Server and Worker

You need **two terminal windows**:

**Terminal 1 - Next.js Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker
```

## Troubleshooting

### Worker not processing jobs?
- Make sure Redis is running: `redis-cli ping`
- Check that the worker is running: Look for "Audio generation worker started" message
- Check the worker terminal for error messages

### Jobs stuck in queue?
- Restart the worker: Stop it (Ctrl+C) and start again with `npm run worker`
- Check Redis connection: Make sure Redis is accessible

### Slow generation?
- The worker now processes chunks in parallel batches (3 at a time)
- Each chunk takes ~5-10 seconds to generate (depends on text length)
- A chapter with 20 chunks will take ~2-3 minutes total

## What the Worker Does

1. Receives audio generation jobs from the queue
2. Splits chapter text into chunks (if not already done)
3. Generates audio for each chunk using ElevenLabs
4. Uploads audio files to Supabase Storage
5. Updates chunk status in the database

The worker processes chunks in **parallel batches of 3** to speed up generation while avoiding rate limits.
