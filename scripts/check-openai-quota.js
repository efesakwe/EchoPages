#!/usr/bin/env node

/**
 * Check OpenAI API usage and rate limits
 * Run: node scripts/check-openai-quota.js
 */

const path = require('path')
const fs = require('fs')

// Try multiple possible .env locations
const envPaths = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(__dirname, '..', '.env.local'),
]

let envLoaded = false
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath })
    envLoaded = true
    console.log(`📁 Loaded .env from: ${envPath}`)
    break
  }
}

if (!envLoaded) {
  // Try loading from default locations
  require('dotenv').config()
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables')
  console.error('Make sure .env.local exists with OPENAI_API_KEY set')
  process.exit(1)
}

async function checkOpenAIUsage() {
  try {
    console.log('📊 Checking OpenAI API usage and rate limits...\n')

    // Check current usage (if available via billing API)
    const usageResponse = await fetch('https://api.openai.com/v1/usage', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (usageResponse.ok) {
      const usageData = await usageResponse.json()
      console.log('📈 Usage Information:')
      console.log(JSON.stringify(usageData, null, 2))
    } else {
      console.log('⚠️  Usage API not available (may require organization scope)')
    }

    // Test a simple API call to check rate limits
    console.log('\n🔍 Testing API access and checking response headers...\n')
    
    const testResponse = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (testResponse.ok) {
      console.log('✅ API connection successful\n')
      
      // Check rate limit headers
      const rateLimitHeaders = {
        'x-ratelimit-limit-requests': testResponse.headers.get('x-ratelimit-limit-requests'),
        'x-ratelimit-limit-tokens': testResponse.headers.get('x-ratelimit-limit-tokens'),
        'x-ratelimit-remaining-requests': testResponse.headers.get('x-ratelimit-remaining-requests'),
        'x-ratelimit-remaining-tokens': testResponse.headers.get('x-ratelimit-remaining-tokens'),
        'x-ratelimit-reset-requests': testResponse.headers.get('x-ratelimit-reset-requests'),
        'x-ratelimit-reset-tokens': testResponse.headers.get('x-ratelimit-reset-tokens'),
      }

      console.log('📊 Rate Limit Information:')
      console.log('─'.repeat(50))
      
      if (rateLimitHeaders['x-ratelimit-limit-requests']) {
        const limit = rateLimitHeaders['x-ratelimit-limit-requests']
        const remaining = rateLimitHeaders['x-ratelimit-remaining-requests']
        const reset = rateLimitHeaders['x-ratelimit-reset-requests']
        
        console.log(`Requests per minute:`)
        console.log(`  Limit: ${limit}`)
        console.log(`  Remaining: ${remaining || 'N/A'}`)
        console.log(`  Reset in: ${reset ? `${reset}s` : 'N/A'}`)
        console.log()
      }

      if (rateLimitHeaders['x-ratelimit-limit-tokens']) {
        const limit = rateLimitHeaders['x-ratelimit-limit-tokens']
        const remaining = rateLimitHeaders['x-ratelimit-remaining-tokens']
        const reset = rateLimitHeaders['x-ratelimit-reset-tokens']
        
        console.log(`Tokens per minute:`)
        console.log(`  Limit: ${limit ? parseInt(limit).toLocaleString() : 'N/A'}`)
        console.log(`  Remaining: ${remaining ? parseInt(remaining).toLocaleString() : 'N/A'}`)
        console.log(`  Reset in: ${reset ? `${reset}s` : 'N/A'}`)
        console.log()
      }

      // Show all response headers for debugging
      console.log('📋 All Rate Limit Headers:')
      for (const [key, value] of Object.entries(rateLimitHeaders)) {
        if (value) {
          console.log(`  ${key}: ${value}`)
        }
      }

      // Tier 2 typical limits
      console.log('\n📚 OpenAI Tier 2 (Default Tier) Typical Limits:')
      console.log('─'.repeat(50))
      console.log('  • RPM (Requests per minute): 3,500')
      console.log('  • TPM (Tokens per minute): 90,000 for TTS/gpt-4o-mini')
      console.log('  • Daily spend limit: Based on your payment method')
      console.log('\n💡 For faster audio generation, you can safely use:')
      console.log('  • WORKER_CONCURRENCY=5 (5 chapters simultaneously)')
      console.log('  • TTS_BATCH_SIZE=8 (8 chunks per batch)')
      console.log('\n   This uses ~40-80 requests/minute (well below 3,500 RPM limit)')

    } else {
      const errorText = await testResponse.text()
      console.error('❌ API test failed:')
      console.error(`   Status: ${testResponse.status}`)
      console.error(`   Response: ${errorText.substring(0, 200)}`)
    }

  } catch (error) {
    console.error('❌ Error checking OpenAI quota:', error.message)
    process.exit(1)
  }
}

// Check billing/subscription info
async function checkBillingInfo() {
  try {
    console.log('\n💰 Checking billing/subscription information...\n')
    
    const billingResponse = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (billingResponse.ok) {
      const billingData = await billingResponse.json()
      console.log('📊 Subscription Details:')
      console.log(`  Access until: ${new Date(billingData.access_until * 1000).toLocaleString()}`)
      console.log(`  Hard limit: $${billingData.hard_limit_usd?.toFixed(2) || 'N/A'}`)
      console.log(`  Soft limit: $${billingData.soft_limit_usd?.toFixed(2) || 'N/A'}`)
      console.log(`  System hard limit: $${billingData.system_hard_limit_usd?.toFixed(2) || 'N/A'}`)
      console.log(`  Organization: ${billingData.organization_id || 'N/A'}`)
    } else {
      const errorText = await billingResponse.text()
      console.log('⚠️  Billing API returned:', billingResponse.status, errorText.substring(0, 100))
    }
  } catch (error) {
    console.log('⚠️  Could not fetch billing info:', error.message)
  }
}

// Main execution
async function main() {
  await checkOpenAIUsage()
  await checkBillingInfo()
  
  console.log('\n✅ Check complete!\n')
}

main()
