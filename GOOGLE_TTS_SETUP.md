# Google Cloud TTS Setup Guide

Google Cloud Text-to-Speech is the **cheapest** TTS option at ~$4 per 1 million characters (vs $15 for OpenAI TTS).

## Quick Setup (5 minutes)

### Step 1: Create a Google Cloud Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. If prompted, accept the terms of service

### Step 2: Create a Project
1. Click the project dropdown at the top of the page
2. Click "New Project"
3. Name it something like "echo-pages-tts"
4. Click "Create"

### Step 3: Enable the Text-to-Speech API
1. Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library)
2. Search for "Cloud Text-to-Speech API"
3. Click on it, then click "Enable"

### Step 4: Get an API Key
1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "+ Create Credentials" at the top
3. Select "API Key"
4. Copy the API key that appears
5. (Optional but recommended) Click "Edit API Key" to restrict it to only "Cloud Text-to-Speech API"

### Step 5: Add to Your .env.local
Add this line to your `.env.local` file:

```
GOOGLE_CLOUD_API_KEY=your_api_key_here
```

That's it! 🎉

## Cost Comparison

| Provider | Cost per 1M chars | Cost per avg chapter (~50K chars) |
|----------|------------------|-----------------------------------|
| Google Cloud TTS (Neural2) | ~$4 | ~$0.20 |
| OpenAI TTS | ~$15 | ~$0.75 |
| ElevenLabs | ~$300 | ~$15 |

## Free Tier

Google Cloud offers a **free tier** for Text-to-Speech:
- **1 million characters per month** for Neural2 voices (the ones we use)
- This is roughly **20 average book chapters for free** every month!

## Troubleshooting

### "API key not valid" error
- Make sure you copied the entire API key
- Check that the Text-to-Speech API is enabled for your project
- If you restricted the API key, make sure "Cloud Text-to-Speech API" is in the allowed list

### "Billing not enabled" error
- You may need to enable billing even for the free tier
- Go to [Billing](https://console.cloud.google.com/billing)
- Link a payment method (you won't be charged if you stay in free tier)

### Alternative: Service Account (for production)
For more secure deployments, use a service account:
1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a new service account
3. Download the JSON key file
4. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/key.json` in your environment

## Voice Options

Google Neural2 voices available:
- **Female**: Aria, Luna, Clara, Olivia (American), Emma, Sophie (British)
- **Male**: James, Noah, Ethan, Liam (American), Oliver, Henry (British)
- **Studio Quality**: Studio Female, Studio Male (highest quality, slightly slower)
