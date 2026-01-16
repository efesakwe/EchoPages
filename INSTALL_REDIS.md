# Installing Redis

Redis is required for the audio generation worker to process jobs in the background.

## Install Redis on macOS

Run these commands in your terminal:

```bash
# Install Redis using Homebrew
brew install redis

# Start Redis as a service (runs automatically on boot)
brew services start redis

# Or run Redis manually (stops when you close terminal)
redis-server
```

## Verify Redis is Running

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

## Alternative: Run Redis in Docker

If you have Docker installed, you can run Redis in a container:

```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

## After Installing Redis

1. **Start Redis:**
   ```bash
   brew services start redis
   ```

2. **Start the worker** (in a separate terminal):
   ```bash
   npm run worker
   ```

3. **Keep both running:**
   - Terminal 1: `npm run dev` (Next.js server)
   - Terminal 2: `npm run worker` (audio generation worker)

## Troubleshooting

### Permission Errors
If you get permission errors with Homebrew:
```bash
sudo chown -R $(whoami) /opt/homebrew/Cellar
```

### Redis Already Running
If Redis is already running, you'll see:
```
Error: Service `redis` already started
```

That's fine - Redis is already running!

### Check Redis Status
```bash
brew services list
# Should show redis as "started"
```
