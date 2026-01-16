#!/usr/bin/env node

/**
 * Diagnostic script to test upload setup
 * Checks environment variables, authentication, and storage bucket
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Checking Upload Setup...\n')

// Check environment variables
console.log('1️⃣  Environment Variables:')
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓ SET' : '✗ MISSING'}`)
console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? '✓ SET' : '✗ MISSING'}`)
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✓ SET' : '✗ MISSING'}`)

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.log('\n❌ Missing required environment variables!')
  console.log('   Please check your .env.local file in the project root.')
  process.exit(1)
}

console.log('\n✅ All environment variables are set\n')

// Test Supabase connection
const supabaseAnon = createClient(supabaseUrl, anonKey)
const supabaseService = createClient(supabaseUrl, serviceKey)

async function checkStorageBucket() {
  console.log('2️⃣  Storage Bucket:')
  
  try {
    // List buckets
    const { data: buckets, error: listError } = await supabaseService.storage.listBuckets()
    
    if (listError) {
      console.log(`   ✗ Error listing buckets: ${listError.message}`)
      return false
    }
    
    const booksBucket = buckets?.find(b => b.id === 'books')
    
    if (!booksBucket) {
      console.log('   ✗ Bucket "books" not found')
      console.log('   → Go to Supabase Dashboard → Storage → Create bucket named "books"')
      return false
    }
    
    console.log(`   ✓ Bucket "books" exists (${booksBucket.public ? 'Public' : 'Private'})`)
    return true
  } catch (error) {
    console.log(`   ✗ Error checking bucket: ${error.message}`)
    return false
  }
}

async function checkStoragePolicies() {
  console.log('\n3️⃣  Storage Policies:')
  
  try {
    // Try to list objects (this will fail if no policies allow it)
    const { data, error } = await supabaseAnon.storage.from('books').list('pdfs', { limit: 1 })
    
    // Even if empty, no error means policies exist
    if (error) {
      console.log(`   ⚠️  Could not access bucket (might need policies): ${error.message}`)
      console.log('   → Check STORAGE_SETUP.md for RLS policy setup instructions')
      return false
    }
    
    console.log('   ✓ Storage policies appear to be configured')
    return true
  } catch (error) {
    console.log(`   ⚠️  Error checking policies: ${error.message}`)
    return false
  }
}

async function checkAuthentication() {
  console.log('\n4️⃣  Authentication:')
  
  try {
    // Get current session
    const { data: { session }, error } = await supabaseAnon.auth.getSession()
    
    if (error) {
      console.log(`   ✗ Auth error: ${error.message}`)
      return false
    }
    
    if (!session) {
      console.log('   ⚠️  No active session (user needs to log in)')
      console.log('   → This is OK - users must log in to upload')
      return true
    }
    
    console.log(`   ✓ User authenticated: ${session.user.email || session.user.id}`)
    return true
  } catch (error) {
    console.log(`   ✗ Error checking auth: ${error.message}`)
    return false
  }
}

async function runDiagnostics() {
  const bucketOk = await checkStorageBucket()
  const policiesOk = await checkStoragePolicies()
  const authOk = await checkAuthentication()
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary:')
  console.log(`   Environment Variables: ✅`)
  console.log(`   Storage Bucket: ${bucketOk ? '✅' : '❌'}`)
  console.log(`   Storage Policies: ${policiesOk ? '✅' : '⚠️'}`)
  console.log(`   Authentication: ${authOk ? '✅' : '⚠️'}`)
  
  if (!bucketOk) {
    console.log('\n❌ CRITICAL: Storage bucket "books" is missing!')
    console.log('   Follow instructions in STORAGE_SETUP.md')
    process.exit(1)
  }
  
  if (!policiesOk) {
    console.log('\n⚠️  WARNING: Storage policies may need configuration')
    console.log('   Check STORAGE_SETUP.md for RLS policy setup')
  }
  
  console.log('\n✅ Setup looks good! Try uploading a book now.')
}

runDiagnostics().catch(error => {
  console.error('\n❌ Diagnostic failed:', error)
  process.exit(1)
})
