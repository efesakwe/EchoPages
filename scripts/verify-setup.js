#!/usr/bin/env node

/**
 * Quick verification script for Echo Pages setup
 * Run: node scripts/verify-setup.js
 */

// Try to load dotenv if available, otherwise just use process.env
try {
  require('dotenv').config({ path: '.env.local' })
} catch (e) {
  // dotenv not installed, that's okay - will check if vars are in environment
}

// Try to load Supabase client, but gracefully handle if not installed
let createClient
try {
  const supabase = require('@supabase/supabase-js')
  createClient = supabase.createClient
} catch (e) {
  createClient = null
  console.warn('⚠️  @supabase/supabase-js not installed. Install dependencies with: npm install')
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkmark(passed) {
  return passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`
}

async function verifySetup() {
  log('\n🔍 Verifying Echo Pages Setup...\n', 'blue')

  let allPassed = true

  // Check environment variables
  log('1. Checking Environment Variables...', 'blue')
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
    'REDIS_HOST',
    'NEXT_PUBLIC_APP_URL',
  ]

  const missingVars = requiredEnvVars.filter(v => !process.env[v])
  
  if (missingVars.length === 0) {
    log(`   ${checkmark(true)} All required environment variables are set`)
  } else {
    log(`   ${checkmark(false)} Missing: ${missingVars.join(', ')}`, 'red')
    allPassed = false
  }

  // Check Supabase connection
  log('\n2. Checking Supabase Connection...', 'blue')
  if (!createClient) {
    log(`   ${colors.yellow}⚠  Skipping (install dependencies first: npm install)${colors.reset}`)
  } else {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        log(`   ${checkmark(false)} Supabase URL or key missing`, 'red')
        allPassed = false
      } else {
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Test connection with allowlist table
        const { data, error } = await supabase
          .from('allowlist_emails')
          .select('count')
          .limit(1)

        if (error) {
          log(`   ${checkmark(false)} Connection failed: ${error.message}`, 'red')
          allPassed = false
        } else {
          log(`   ${checkmark(true)} Successfully connected to Supabase`)
        }
      }
    } catch (error) {
      log(`   ${checkmark(false)} Error: ${error.message}`, 'red')
      allPassed = false
    }
  }

  // Check database tables
  log('\n3. Checking Database Tables...', 'blue')
  if (!createClient) {
    log(`   ${colors.yellow}⚠  Skipping (install dependencies first: npm install)${colors.reset}`)
  } else {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceKey) {
        log(`   ${checkmark(false)} Supabase URL or service role key missing`, 'red')
        allPassed = false
      } else {
        const supabase = createClient(supabaseUrl, serviceKey)

        const tables = ['allowlist_emails', 'books', 'chapters', 'audio_chunks', 'playback_state']
        const tableChecks = await Promise.all(
          tables.map(async (table) => {
            const { error } = await supabase.from(table).select('*').limit(0)
            return { table, exists: !error }
          })
        )

        tableChecks.forEach(({ table, exists }) => {
          if (exists) {
            log(`   ${checkmark(true)} Table '${table}' exists`)
          } else {
            log(`   ${checkmark(false)} Table '${table}' not found`, 'red')
            allPassed = false
          }
        })
      }
    } catch (error) {
      log(`   ${checkmark(false)} Error checking tables: ${error.message}`, 'red')
      allPassed = false
    }
  }

  // Check storage bucket (this requires service role)
  log('\n4. Checking Storage Bucket...', 'blue')
  if (!createClient) {
    log(`   ${colors.yellow}⚠  Skipping (install dependencies first: npm install)${colors.reset}`)
  } else {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceKey) {
        log(`   ${checkmark(false)} Supabase URL or service role key missing`, 'red')
        allPassed = false
      } else {
        const supabase = createClient(supabaseUrl, serviceKey)

        const { data: buckets, error } = await supabase.storage.listBuckets()

        if (error) {
          log(`   ${checkmark(false)} Error accessing storage: ${error.message}`, 'red')
          allPassed = false
        } else {
          const booksBucket = buckets?.find(b => b.name === 'books')
          if (booksBucket) {
            log(`   ${checkmark(true)} Storage bucket 'books' exists`)
            if (booksBucket.public) {
              log(`   ${colors.yellow}⚠  Warning: Bucket is public (should be private)${colors.reset}`)
            } else {
              log(`   ${checkmark(true)} Bucket is private`)
            }
          } else {
            log(`   ${checkmark(false)} Storage bucket 'books' not found`, 'red')
            allPassed = false
          }
        }
      }
    } catch (error) {
      log(`   ${checkmark(false)} Error checking storage: ${error.message}`, 'red')
      allPassed = false
    }
  }

  // Check allowlist has at least one email
  log('\n5. Checking Allowlist...', 'blue')
  if (!createClient) {
    log(`   ${colors.yellow}⚠  Skipping (install dependencies first: npm install)${colors.reset}`)
  } else {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !serviceKey) {
        log(`   ${checkmark(false)} Supabase URL or service role key missing`, 'red')
        allPassed = false
      } else {
        const supabase = createClient(supabaseUrl, serviceKey)

        const { data, error } = await supabase
          .from('allowlist_emails')
          .select('email')

        if (error) {
          log(`   ${checkmark(false)} Error checking allowlist: ${error.message}`, 'red')
          allPassed = false
        } else if (data && data.length > 0) {
          log(`   ${checkmark(true)} Allowlist has ${data.length} email(s)`)
          log(`      ${data.slice(0, 3).map(e => e.email).join(', ')}${data.length > 3 ? '...' : ''}`)
        } else {
          log(`   ${colors.yellow}⚠  Warning: Allowlist is empty (add emails to allowlist_emails table)${colors.reset}`)
        }
      }
    } catch (error) {
      log(`   ${checkmark(false)} Error: ${error.message}`, 'red')
      allPassed = false
    }
  }

  // Final summary
  log('\n' + '='.repeat(50), 'blue')
  if (!createClient) {
    log('\n⚠️  Dependencies not installed yet.\n', 'yellow')
    log('Please run: npm install')
    log('Then run this script again for full verification.\n')
  } else if (allPassed) {
    log('\n✅ All checks passed! You\'re ready to go!\n', 'green')
    log('Next steps:')
    log('  1. Start Redis (docker run -d -p 6379:6379 redis:alpine)')
    log('  2. npm run dev (in one terminal)')
    log('  3. npm run worker (in another terminal)')
  } else {
    log('\n❌ Some checks failed. Please fix the issues above.\n', 'red')
    process.exit(1)
  }
  log('')
}

verifySetup().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}\n`, 'red')
  process.exit(1)
})
