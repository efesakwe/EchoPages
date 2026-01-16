require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

async function addEmailToAllowlist() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const email = 'plottwistreadings@gmail.com'

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase environment variables!')
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
    process.exit(1)
  }

  console.log('🔗 Connecting to Supabase...')
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  console.log(`📧 Adding email to allowlist: ${email}`)

  try {
    // Check if email already exists
    const { data: existing } = await supabase
      .from('allowlist_emails')
      .select('email')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      console.log(`✅ Email ${email} is already on the allowlist!`)
      return
    }

    // Insert the email
    const { data, error } = await supabase
      .from('allowlist_emails')
      .insert([{ email: email.toLowerCase() }])
      .select()

    if (error) {
      if (error.code === '23505') {
        console.log(`✅ Email ${email} is already on the allowlist!`)
      } else {
        throw error
      }
    } else {
      console.log(`✅ Successfully added ${email} to the allowlist!`)
      console.log('   You can now sign up/login with this email.')
    }
  } catch (error) {
    console.error('❌ Error adding email to allowlist:', error.message)
    process.exit(1)
  }
}

addEmailToAllowlist()
