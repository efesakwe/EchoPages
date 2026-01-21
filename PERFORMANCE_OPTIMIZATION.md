# Audio Generation Performance Optimization

The audio generation system can be optimized for faster processing by adjusting two key settings:

## Environment Variables

Add these to your `.env.local` file (or Railway/Vercel environment variables):

### 1. `WORKER_CONCURRENCY`
Controls how many chapters are processed simultaneously.

- **Default**: `3` chapters at once
- **Recommended**: `3-5` for most cases
- **Higher values** (5-10): Faster generation, but uses more API quota and may hit rate limits
- **Lower values** (1-2): Slower but safer, uses less API quota

```bash
WORKER_CONCURRENCY=5  # Process 5 chapters simultaneously
```

### 2. `TTS_BATCH_SIZE`
Controls how many audio chunks are processed in parallel within each chapter.

- **Default**: `5` chunks at once
- **Recommended**: `5-10` for most TTS providers
- **Higher values** (10-20): Faster per chapter, but may hit rate limits
- **Lower values** (3-5): Slower but safer for strict rate limits

```bash
TTS_BATCH_SIZE=8  # Process 8 chunks in parallel per batch
```

## Performance Impact

With default settings:
- **Before**: 1 chapter at a time, 3 chunks per batch
- **After**: 3 chapters at once, 5 chunks per batch
- **Expected speedup**: ~3-5x faster for multiple chapters

## Rate Limit Considerations

### OpenAI TTS
- **Rate limit**: Varies by tier (typically 50-200 requests/minute)
- **Safe settings**: `WORKER_CONCURRENCY=3`, `TTS_BATCH_SIZE=5`
- **Aggressive settings**: `WORKER_CONCURRENCY=5`, `TTS_BATCH_SIZE=10`

### ElevenLabs
- **Rate limit**: Varies by plan (typically 500-5000 requests/month)
- **Safe settings**: `WORKER_CONCURRENCY=2`, `TTS_BATCH_SIZE=3`
- **Aggressive settings**: `WORKER_CONCURRENCY=5`, `TTS_BATCH_SIZE=5`

### Google Cloud TTS
- **Rate limit**: ~100 requests/minute (Neural2 voices)
- **Safe settings**: `WORKER_CONCURRENCY=3`, `TTS_BATCH_SIZE=5`
- **Aggressive settings**: `WORKER_CONCURRENCY=5`, `TTS_BATCH_SIZE=8`

## Monitoring

The worker logs show current settings on startup:
```
[PERFORMANCE] Worker concurrency: 3 chapters simultaneously
[PERFORMANCE] Chunk batch size: 5 chunks per batch
[PERFORMANCE] Set WORKER_CONCURRENCY and TTS_BATCH_SIZE env vars to adjust speed
```

## Recommended Settings by Use Case

### Fast Generation (Multiple Books)
```bash
WORKER_CONCURRENCY=5
TTS_BATCH_SIZE=8
```

### Balanced (Recommended)
```bash
WORKER_CONCURRENCY=3
TTS_BATCH_SIZE=5
```

### Conservative (Single Book, Strict Rate Limits)
```bash
WORKER_CONCURRENCY=1
TTS_BATCH_SIZE=3
```

## Troubleshooting

If you see rate limit errors, reduce both values:
```bash
WORKER_CONCURRENCY=2
TTS_BATCH_SIZE=3
```

If generation is too slow and you have API quota available, increase both values gradually until you find the sweet spot for your API limits.
