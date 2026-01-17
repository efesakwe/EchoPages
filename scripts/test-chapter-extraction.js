// Test script to debug chapter extraction
// Usage: node scripts/test-chapter-extraction.js <book_id>

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testExtraction() {
  const bookId = process.argv[2]
  
  if (!bookId) {
    console.log('Usage: node scripts/test-chapter-extraction.js <book_id>')
    console.log('\nFetching recent books...')
    
    const { data: books, error } = await supabase
      .from('books')
      .select('id, title, author')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (books) {
      console.log('\nRecent books:')
      books.forEach(b => console.log(`  ${b.id} - ${b.title} by ${b.author}`))
    }
    return
  }
  
  // Get book
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single()
  
  if (bookError || !book) {
    console.error('Book not found:', bookError)
    return
  }
  
  console.log(`\nBook: ${book.title} by ${book.author}`)
  console.log(`PDF URL: ${book.pdf_url}`)
  
  // Get chapters
  const { data: chapters, error: chapError } = await supabase
    .from('chapters')
    .select('id, idx, title, text_content')
    .eq('book_id', bookId)
    .order('idx')
  
  console.log(`\nExisting chapters: ${chapters?.length || 0}`)
  if (chapters && chapters.length > 0) {
    chapters.forEach(ch => {
      const words = ch.text_content?.split(/\s+/).length || 0
      console.log(`  ${ch.idx + 1}. "${ch.title}" (${words} words)`)
    })
  }
  
  // If there's only one chapter called "Full Book", let's analyze the text
  if (chapters && chapters.length === 1 && chapters[0].title === 'Full Book') {
    console.log('\n\n=== ANALYZING TEXT ===')
    const text = chapters[0].text_content
    const lines = text.split('\n')
    
    console.log(`Total lines: ${lines.length}`)
    console.log(`Total chars: ${text.length}`)
    
    // Look for chapter-like patterns
    console.log('\n--- Looking for chapter markers ---')
    
    const patterns = {
      'Prologue/Epilogue': /^(prologue|epilogue)$/i,
      'Chapter + Number': /^chapter\s+\d+/i,
      'Chapter + Word': /^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten)/i,
      'Just Number': /^\d{1,2}$/,
      'Part': /^part\s+/i,
    }
    
    for (const [name, pattern] of Object.entries(patterns)) {
      console.log(`\n${name}:`)
      let count = 0
      for (let i = 0; i < lines.length && count < 10; i++) {
        const line = lines[i].trim()
        if (pattern.test(line)) {
          const prevLine = i > 0 ? lines[i-1].trim() : '(start)'
          const nextLine = i < lines.length - 1 ? lines[i+1].trim().substring(0, 50) : '(end)'
          console.log(`  Line ${i}: "${line}"`)
          console.log(`    prev: "${prevLine.substring(0, 30)}"`)
          console.log(`    next: "${nextLine}"`)
          count++
        }
      }
      if (count === 0) console.log('  (none found)')
    }
    
    // Show first 100 lines
    console.log('\n\n--- First 100 lines of text ---')
    for (let i = 0; i < Math.min(100, lines.length); i++) {
      const line = lines[i]
      if (line.trim()) {
        console.log(`${i}: ${line.substring(0, 80)}`)
      }
    }
  }
}

testExtraction().catch(console.error)
