# 💰 TTS Cost Comparison

## Current Issue
- **ElevenLabs**: ~30,000 credits per chapter
- At typical pricing: **$0.30-0.50 per chapter** 😱

## Cost Comparison

| Provider | Cost per 1M Characters | Cost per Chapter* | Quality |
|----------|------------------------|-------------------|---------|
| **ElevenLabs** | ~$500 | $0.30-0.50 | Premium |
| **OpenAI TTS** | $15 | **$0.015** | High |
| **Google Cloud TTS** | $4 | **$0.004** | High |

*Assuming ~10,000 characters per chapter

## 💡 Recommendation: Use OpenAI TTS

**Savings: 20-30x cheaper than ElevenLabs!**

### Setup

1. **Add to `.env.local`:**
   ```env
   TTS_PROVIDER=openai
   OPENAI_API_KEY=your-key-here
   ```

2. **That's it!** The system will automatically use OpenAI TTS.

### Voice Quality

OpenAI TTS voices:
- **nova** - Warm, expressive female (American)
- **shimmer** - Soft, gentle female (American)
- **onyx** - Deep, authoritative male (American)
- **echo** - Clear male (American)
- **fable** - British narrator (male)
- **alloy** - Neutral, versatile

### Switching Back to ElevenLabs

If you want premium voices for special books:
```env
TTS_PROVIDER=elevenlabs
```

## Cost Calculator

For a typical book (32 chapters, ~320k characters):
- **ElevenLabs**: ~$10-16 per book
- **OpenAI**: ~$0.50 per book ✅
- **Google**: ~$0.13 per book ✅

**You'll save 95%+ on costs!** 🎉
