// Compare chapter text with chunks to find missing content
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const bookTitle = 'If I Were You';

async function compare() {
  // Get book
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('title', bookTitle)
    .single();

  if (!book) {
    console.log('Book not found');
    return;
  }

  // Get chapters with audio
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, idx, title, text_content')
    .eq('book_id', book.id)
    .order('idx');

  for (const chapter of chapters || []) {
    const { data: chunks } = await supabase
      .from('audio_chunks')
      .select('text')
      .eq('chapter_id', chapter.id)
      .order('idx');

    if (!chunks || chunks.length === 0) continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Chapter ${chapter.idx + 1}: "${chapter.title}"`);
    console.log(`${'='.repeat(60)}`);

    // Normalize texts for comparison
    const chapterText = chapter.text_content.replace(/\s+/g, ' ').trim();
    const chunksText = chunks.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();

    console.log(`Chapter length: ${chapterText.length}`);
    console.log(`Chunks total:   ${chunksText.length}`);
    console.log(`Difference:     ${chapterText.length - chunksText.length} chars missing`);

    // Find what's at the end of chapter vs end of chunks
    console.log(`\n📖 Chapter ENDS with:`);
    console.log(`   "${chapterText.substring(chapterText.length - 300)}"`);
    
    console.log(`\n🎵 Chunks END with:`);
    console.log(`   "${chunksText.substring(chunksText.length - 300)}"`);

    // Check if they match
    const chapterEnd100 = chapterText.substring(chapterText.length - 100);
    const chunksEnd100 = chunksText.substring(chunksText.length - 100);
    
    if (chapterEnd100 === chunksEnd100) {
      console.log(`\n✅ Endings match!`);
    } else {
      console.log(`\n❌ Endings DON'T match - text is being cut off`);
      
      // Try to find where the chunks end in the chapter
      const chunksLast50 = chunksText.substring(chunksText.length - 50);
      const indexInChapter = chapterText.indexOf(chunksLast50);
      if (indexInChapter !== -1) {
        const missingText = chapterText.substring(indexInChapter + 50);
        console.log(`\n⚠️ MISSING TEXT (${missingText.length} chars):`);
        console.log(`   "${missingText.substring(0, 500)}${missingText.length > 500 ? '...' : ''}"`);
      }
    }
  }
}

compare().catch(console.error);
