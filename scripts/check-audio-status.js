// Check audio generation status
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
  console.log('\n🔍 Checking Audio Generation Status...\n');

  // Get all audio chunks with their status
  const { data: chunks, error } = await supabase
    .from('audio_chunks')
    .select('id, chapter_id, idx, status, provider, audio_url')
    .order('chapter_id')
    .order('idx');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!chunks || chunks.length === 0) {
    console.log('ℹ️  No audio chunks found');
    return;
  }

  // Group by status
  const byStatus = {
    done: chunks.filter(c => c.status === 'done'),
    processing: chunks.filter(c => c.status === 'processing'),
    pending: chunks.filter(c => c.status === 'pending'),
    error: chunks.filter(c => c.status === 'error'),
  };

  // Group by provider
  const byProvider = {
    openai: chunks.filter(c => c.provider === 'openai'),
    elevenlabs: chunks.filter(c => c.provider === 'elevenlabs' || !c.provider),
  };

  console.log('📊 Audio Chunks Status:');
  console.log(`   ✅ Done: ${byStatus.done.length}`);
  console.log(`   ⏳ Processing: ${byStatus.processing.length}`);
  console.log(`   📋 Pending: ${byStatus.pending.length}`);
  console.log(`   ❌ Error: ${byStatus.error.length}`);
  console.log('');

  console.log('🔊 By TTS Provider:');
  console.log(`   💰 OpenAI TTS: ${byProvider.openai.length} chunks`);
  console.log(`   ✨ ElevenLabs: ${byProvider.elevenlabs.length} chunks`);
  console.log('');

  // Show recent chunks
  const recentDone = byStatus.done.slice(-5);
  if (recentDone.length > 0) {
    console.log('✅ Most Recent Completed Chunks:');
    recentDone.forEach(c => {
      const provider = c.provider || 'elevenlabs (legacy)';
      console.log(`   Chunk ${c.idx} - Provider: ${provider}`);
    });
  }

  if (byStatus.processing.length > 0) {
    console.log('\n⏳ Currently Processing:');
    byStatus.processing.forEach(c => {
      console.log(`   Chapter ${c.chapter_id}, Chunk ${c.idx}`);
    });
  }

  if (byStatus.error.length > 0) {
    console.log('\n❌ Errors:');
    byStatus.error.slice(-3).forEach(c => {
      console.log(`   Chunk ${c.idx}`);
    });
  }
}

checkStatus().catch(console.error);
