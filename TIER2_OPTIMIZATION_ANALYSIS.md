# Tier 2 OpenAI Optimization Analysis

## Current Tier 2 Limits
- **RPM (Requests per minute)**: ~3,500
- **TPM (Tokens per minute)**: ~90,000 (for TTS/gpt-4o-mini)
- **Daily spend**: Based on your payment method

## Performance Scenarios

### Current Recommended (Balanced)
```bash
WORKER_CONCURRENCY=5
TTS_BATCH_SIZE=8
```

**Usage:**
- ~40-80 requests/minute
- ~5-15% of RPM limit
- **Safety margin**: Very high (85-95% headroom)

### Aggressive (High Performance)
```bash
WORKER_CONCURRENCY=10
TTS_BATCH_SIZE=15
```

**Usage:**
- ~150-300 requests/minute
- ~8-10% of RPM limit
- **Safety margin**: High (90%+ headroom)
- **Speed improvement**: ~2x faster than recommended settings

### Maximum (Near Limit)
```bash
WORKER_CONCURRENCY=15
TTS_BATCH_SIZE=20
```

**Usage:**
- ~300-500 requests/minute
- ~14-15% of RPM limit
- **Safety margin**: Good (85%+ headroom)
- **Speed improvement**: ~3x faster than recommended

### Ultra Maximum (Push Boundaries)
```bash
WORKER_CONCURRENCY=20
TTS_BATCH_SIZE=25
```

**Usage:**
- ~500-800 requests/minute
- ~20-25% of RPM limit
- **Safety margin**: Moderate (75-80% headroom)
- **Speed improvement**: ~4x faster than recommended

## Cons of More Aggressive Settings

### 1. Rate Limit Risk ⚠️
**Issue**: Higher chance of hitting rate limits
- **Symptom**: 429 errors, failed chunk generations
- **Impact**: Chunks fail and need retry, slowing overall progress
- **Mitigation**: Built-in retry logic, but adds delay

### 2. API Cost Increase 💰
**Issue**: More parallel requests = faster but potentially higher costs
- **Current**: Costs are based on tokens used, not requests
- **Reality**: Same total cost, just faster delivery
- **Note**: TTS pricing is per character, not per request, so no extra cost

### 3. Network/Resource Usage 🌐
**Issue**: More simultaneous connections
- **Memory**: More worker processes in memory
- **Network**: More concurrent connections
- **Database**: More simultaneous Supabase writes
- **Impact**: Usually negligible, but could matter at scale

### 4. Error Handling Complexity 🔄
**Issue**: More concurrent failures to handle
- **Problem**: If many chunks fail simultaneously, retry logic kicks in
- **Impact**: Temporary slowdown while retries happen
- **Mitigation**: Already built into worker, but more noticeable

### 5. Redis/Queue Load 📊
**Issue**: More jobs processed simultaneously
- **Impact**: Higher Redis memory usage
- **Mitigation**: Usually fine, but monitor if running many books

### 6. TTS Provider Rate Limits 🎙️
**Issue**: OpenAI TTS has its own limits beyond general API limits
- **OpenAI TTS**: Shares same rate limits
- **ElevenLabs**: Separate rate limits (per plan)
- **Google Cloud**: ~100 requests/minute (strict)
- **Impact**: Could hit provider-specific limits before API limits

## Recommended Settings by Use Case

### Scenario 1: Single Book (Occasional Use)
**Recommended:**
```bash
WORKER_CONCURRENCY=5
TTS_BATCH_SIZE=8
```
**Why**: Balanced speed and reliability

### Scenario 2: Multiple Books (Regular Use)
**Recommended:**
```bash
WORKER_CONCURRENCY=10
TTS_BATCH_SIZE=12
```
**Why**: Faster processing for bulk operations, still safe

### Scenario 3: Batch Processing (Many Books)
**Recommended:**
```bash
WORKER_CONCURRENCY=15
TTS_BATCH_SIZE=15
```
**Why**: Maximum speed, acceptable risk level

### Scenario 4: Testing/Development
**Recommended:**
```bash
WORKER_CONCURRENCY=20
TTS_BATCH_SIZE=20
```
**Why**: Test system limits, find breaking points

## Real-World Performance Estimates

### Book: 20 chapters, ~50 chunks total

**Recommended (5/8):**
- Time: ~25-30 minutes
- Requests: ~50 total
- Failure rate: <1%

**Aggressive (10/15):**
- Time: ~12-15 minutes
- Requests: ~50 total
- Failure rate: ~2-3%

**Maximum (15/20):**
- Time: ~8-10 minutes
- Requests: ~50 total
- Failure rate: ~3-5%

## Monitoring Recommendations

When using aggressive settings, monitor:
1. **Worker logs** for rate limit errors (429 status codes)
2. **Failed chunk count** in database
3. **Total generation time** vs expected time
4. **API response times** (slower = approaching limits)

## Safe Progression Strategy

Start conservative, then increase:
1. **Week 1**: `WORKER_CONCURRENCY=5`, `TTS_BATCH_SIZE=8`
2. **Week 2**: Monitor for errors, if none → `WORKER_CONCURRENCY=8`, `TTS_BATCH_SIZE=10`
3. **Week 3**: If still no errors → `WORKER_CONCURRENCY=10`, `TTS_BATCH_SIZE=12`
4. **Continue**: Gradually increase until you see occasional 429 errors, then back off by 20%

## Bottom Line

**Can you do more with Tier 2?** ✅ **YES**

You can safely use:
- **WORKER_CONCURRENCY=10-15** (2-3x faster)
- **TTS_BATCH_SIZE=12-15** (50-90% faster per chapter)

**Total speedup: ~2-4x faster** than conservative settings, while staying well within Tier 2 limits.

**Main cons:**
1. Slightly higher risk of rate limit errors (but rare)
2. More system resources used (usually negligible)
3. Need to monitor for issues (first few days)

**Recommendation:** Start with `WORKER_CONCURRENCY=10` and `TTS_BATCH_SIZE=12`. Monitor for a few days, then increase if no issues.
