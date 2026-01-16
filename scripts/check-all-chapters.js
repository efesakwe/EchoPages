// Check all chapters for a book
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
  console.log('\n📚 CHECKING ALL CHAPTERS\n');

  // Get all books
  const { data: books } = await supabase
    .from('books')
    .select('id, title');

  for (const book of books || []) {
    console.log(`\n📖 Book: "${book.title}"`);
    console.log('='.repeat(50));

    // Get chapters
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, idx, title, text_content')
      .eq('book_id', book.id)
      .order('idx');

    if (!chapters || chapters.length === 0) {
      console.log('   No chapters');
      continue;
    }

    for (const chapter of chapters) {
      // Get audio chunks for this chapter
      const { data: chunks } = await supabase
        .from('audio_chunks')
        .select('id, idx, status, text, audio_url, voice, error_message')
        .eq('chapter_id', chapter.id)
        .order('idx');

      const chapterTextLen = chapter.text_content?.length || 0;
      const totalChunkText = (chunks || []).reduce((sum, c) => sum + (c.text?.length || 0), 0);
      const coverage = chapterTextLen > 0 ? (totalChunkText / chapterTextLen * 100).toFixed(1) : 0;

      const done = (chunks || []).filter(c => c.status === 'done').length;
      const errors = (chunks || []).filter(c => c.status === 'error').length;
      const pending = (chunks || []).filter(c => c.status === 'pending' || c.status === 'processing').length;
      const total = (chunks || []).length;

      let status = '⏳ No audio';
      if (total > 0) {
        if (done === total) {
          status = `✅ Complete (${done} chunks)`;
        } else if (errors > 0) {
          status = `❌ ${errors} errors (${done}/${total} done)`;
        } else if (pending > 0) {
          status = `⏳ ${pending} pending`;
        }
      }

      // Check for missing end text
      let endCheck = '';
      if (chunks && chunks.length > 0 && chapter.text_content) {
        const lastChunkText = chunks[chunks.length - 1]?.text || '';
        const chapterEnd = chapter.text_content.substring(chapter.text_content.length - 100).trim();
        const lastChunkEnd = lastChunkText.substring(lastChunkText.length - 50).trim();
        
        if (!chapterEnd.includes(lastChunkEnd) && lastChunkEnd.length > 10) {
          endCheck = ' ⚠️ Might be cut off!';
        }
      }

      console.log(`   ${chapter.idx + 1}. "${chapter.title}" - ${status} (${coverage}% coverage)${endCheck}`);
      
      // Show error details
      if (errors > 0) {
        const errorChunks = (chunks || []).filter(c => c.status === 'error');
        errorChunks.forEach(c => {
          console.log(`      ❌ Chunk ${c.idx}: voice="${c.voice}" - ${c.error_message || 'unknown error'}`);
        });
      }
    }
  }
}

checkAll().catch(console.error);
