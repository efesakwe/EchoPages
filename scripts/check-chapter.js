// Check if chapter exists
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const chapterId = '050a0639-c07b-47ca-b064-44f9d21d9020';

async function check() {
  console.log('Checking chapter:', chapterId);
  
  // Direct query
  const { data: chapter, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .single();
    
  if (error) {
    console.log('Error:', error.message);
  }
  
  if (chapter) {
    console.log('Chapter found:', chapter.title);
    console.log('Book ID:', chapter.book_id);
  } else {
    console.log('Chapter NOT found');
    
    // List all chapters
    const { data: allChapters } = await supabase
      .from('chapters')
      .select('id, title, book_id')
      .limit(10);
    
    console.log('\nExisting chapters:');
    allChapters?.forEach(c => console.log(`  ${c.id} - ${c.title}`));
  }
}

check();
