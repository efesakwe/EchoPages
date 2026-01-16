// Diagnose chapter text vs audio chunks
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get chapter ID from command line or use default
const chapterId = process.argv[2] || '050a0639-c07b-47ca-b064-44f9d21d9020';

async function diagnose() {
  console.log('\n🔍 DIAGNOSING CHAPTER:', chapterId);
  console.log('='.repeat(60));

  // 1. Get chapter text
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, title, text_content, book_id')
    .eq('id', chapterId)
    .single();

  if (chapterError || !chapter) {
    console.error('❌ Chapter not found:', chapterError?.message);
    return;
  }

  console.log(`\n📖 Chapter: "${chapter.title}"`);
  console.log(`   Text length: ${chapter.text_content.length} characters`);
  console.log(`   Word count: ~${chapter.text_content.split(/\s+/).length} words`);
  
  // Show first and last 200 chars
  console.log(`\n📝 Text preview:`);
  console.log(`   START: "${chapter.text_content.substring(0, 200)}..."`);
  console.log(`   END: "...${chapter.text_content.substring(chapter.text_content.length - 200)}"`);

  // 2. Get audio chunks
  const { data: chunks, error: chunksError } = await supabase
    .from('audio_chunks')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('idx', { ascending: true });

  if (chunksError) {
    console.error('❌ Error fetching chunks:', chunksError.message);
    return;
  }

  console.log(`\n🎵 Audio Chunks: ${chunks?.length || 0} total`);

  if (!chunks || chunks.length === 0) {
    console.log('   No chunks generated yet.');
    return;
  }

  // Analyze chunks
  const byStatus = {
    done: chunks.filter(c => c.status === 'done'),
    error: chunks.filter(c => c.status === 'error'),
    pending: chunks.filter(c => c.status === 'pending'),
    processing: chunks.filter(c => c.status === 'processing'),
  };

  console.log(`   ✅ Done: ${byStatus.done.length}`);
  console.log(`   ❌ Error: ${byStatus.error.length}`);
  console.log(`   ⏳ Pending: ${byStatus.pending.length}`);
  console.log(`   🔄 Processing: ${byStatus.processing.length}`);

  // Calculate total text in chunks
  const totalChunkText = chunks.reduce((sum, c) => sum + (c.text?.length || 0), 0);
  const coverage = (totalChunkText / chapter.text_content.length) * 100;

  console.log(`\n📊 TEXT COVERAGE:`);
  console.log(`   Original chapter: ${chapter.text_content.length} chars`);
  console.log(`   Total in chunks:  ${totalChunkText} chars`);
  console.log(`   Coverage: ${coverage.toFixed(1)}%`);

  if (coverage < 95) {
    console.log(`   ⚠️ WARNING: Only ${coverage.toFixed(1)}% coverage - text is being cut off!`);
  } else {
    console.log(`   ✅ Good coverage`);
  }

  // Show first and last chunks
  if (chunks.length > 0) {
    console.log(`\n📦 First chunk (idx 0):`);
    console.log(`   Text: "${chunks[0].text?.substring(0, 150)}..."`);
    console.log(`   Voice: ${chunks[0].voice}`);
    console.log(`   Status: ${chunks[0].status}`);
    console.log(`   Has audio: ${chunks[0].audio_url ? 'Yes' : 'No'}`);

    const lastChunk = chunks[chunks.length - 1];
    console.log(`\n📦 Last chunk (idx ${lastChunk.idx}):`);
    console.log(`   Text: "...${lastChunk.text?.substring(lastChunk.text.length - 150)}"`);
    console.log(`   Voice: ${lastChunk.voice}`);
    console.log(`   Status: ${lastChunk.status}`);
    console.log(`   Has audio: ${lastChunk.audio_url ? 'Yes' : 'No'}`);
  }

  // Show error chunks
  if (byStatus.error.length > 0) {
    console.log(`\n❌ ERRORED CHUNKS:`);
    byStatus.error.forEach(c => {
      console.log(`   Chunk ${c.idx}: voice="${c.voice}", error="${c.error_message || 'unknown'}"`);
      console.log(`      Text: "${c.text?.substring(0, 100)}..."`);
    });
  }

  // Check if chapter text ends properly
  const lastChunkEndText = chunks[chunks.length - 1]?.text?.trim() || '';
  const chapterEndText = chapter.text_content.trim().substring(chapter.text_content.length - 200);
  
  // Check if last chunk text appears at end of chapter
  if (chapterEndText.includes(lastChunkEndText.substring(lastChunkEndText.length - 50))) {
    console.log(`\n✅ Last chunk appears to contain end of chapter`);
  } else {
    console.log(`\n⚠️ Last chunk might NOT be the actual end of the chapter!`);
    console.log(`   Last chunk ends with: "...${lastChunkEndText.substring(lastChunkEndText.length - 100)}"`);
    console.log(`   Chapter ends with: "...${chapterEndText}"`);
  }
}

diagnose().catch(console.error);
