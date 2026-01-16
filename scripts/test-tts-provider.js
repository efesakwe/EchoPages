// Test script to verify TTS provider settings
// Run with: node scripts/test-tts-provider.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProvider() {
  console.log('\n🔍 Testing TTS Provider Configuration...\n');

  // 1. Check if tts_provider column exists
  const { data: books, error } = await supabase
    .from('books')
    .select('id, title, tts_provider, narrator_voice')
    .limit(5);

  if (error) {
    if (error.message.includes('tts_provider')) {
      console.error('❌ ERROR: tts_provider column does NOT exist!');
      console.log('\n📋 You need to run this SQL in Supabase:');
      console.log('----------------------------------------');
      console.log('ALTER TABLE books ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT \'openai\';');
      console.log('UPDATE books SET tts_provider = \'openai\' WHERE tts_provider IS NULL;');
      console.log('----------------------------------------\n');
      return;
    }
    console.error('❌ Database error:', error.message);
    return;
  }

  console.log('✅ tts_provider column EXISTS!\n');

  if (!books || books.length === 0) {
    console.log('ℹ️  No books found in database');
    return;
  }

  console.log('📚 Books and their TTS providers:\n');
  books.forEach((book, i) => {
    const provider = book.tts_provider || 'NOT SET (will default to openai)';
    const providerLabel = book.tts_provider === 'elevenlabs' 
      ? '✨ Premium (ElevenLabs)' 
      : '💰 Regular (OpenAI TTS)';
    
    console.log(`${i + 1}. "${book.title}"`);
    console.log(`   Provider: ${providerLabel}`);
    console.log(`   Voice: ${book.narrator_voice || 'default'}`);
    console.log('');
  });

  // Summary
  const openaiCount = books.filter(b => b.tts_provider === 'openai' || !b.tts_provider).length;
  const elevenLabsCount = books.filter(b => b.tts_provider === 'elevenlabs').length;

  console.log('📊 Summary:');
  console.log(`   💰 OpenAI TTS: ${openaiCount} books`);
  console.log(`   ✨ ElevenLabs: ${elevenLabsCount} books`);
  console.log('');

  if (openaiCount > 0) {
    console.log('✅ OpenAI TTS will be used for books without tts_provider set or set to "openai"');
  }
}

testProvider().catch(console.error);
