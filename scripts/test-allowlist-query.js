require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function testAllowlistQuery() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing Supabase environment variables!')
    process.exit(1)
  }

  console.log('🔗 Testing allowlist query with ANON key (same as client-side)...')
  const supabase = createClient(supabaseUrl, anonKey)

  const testEmail = 'plottwistreadings@gmail.com'

  try {
    console.log(`📧 Querying allowlist for: ${testEmail}`)
    
    const { data, error } = await supabase
      .from('allowlist_emails')
      .select('email')
      .eq('email', testEmail.toLowerCase())
      .maybeSingle()

    if (error) {
      console.error('❌ Error querying allowlist:', error.message)
      console.error('   Code:', error.code)
      console.error('   Details:', error.details)
      console.error('   Hint:', error.hint)
      
      if (error.message.includes('policy') || error.message.includes('permission')) {
        console.error('\n⚠️  RLS Policy Issue Detected!')
        console.error('   The allowlist_emails table might not have a policy allowing anonymous reads.')
        console.error('   Run this in Supabase SQL Editor:')
        console.error('   DROP POLICY IF EXISTS "Anyone can check allowlist" ON allowlist_emails;')
        console.error('   CREATE POLICY "Anyone can check allowlist" ON allowlist_emails FOR SELECT USING (true);')
      }
      process.exit(1)
    }

    if (data) {
      console.log('✅ Email found in allowlist!')
      console.log('   Email:', data.email)
    } else {
      console.log('❌ Email NOT found in allowlist')
      console.log('   This means the query is working but email is not matching')
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

testAllowlistQuery()
