import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import OpenAI from 'openai'

const ChapterSchema = z.object({
  idx: z.number(),
  title: z.string(),
  text: z.string(),
})

export type Chapter = z.infer<typeof ChapterSchema>

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey })
}

/**
 * Main: Detect and extract chapters using AI
 */
export async function detectChapters(
  text: string,
  pageTexts?: string[]
): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  console.log(`Total words: ~${text.split(/\s+/).length}`)
  
  const lines = text.split('\n')
  
  // Use AI to analyze the book and find chapter boundaries
  console.log('\n--- Using AI to analyze book structure ---')
  
  try {
    const chapters = await detectChaptersWithAI(text, lines)
    
    if (chapters.length >= 2) {
      console.log(`\n========== SUCCESS ==========`)
      console.log(`Extracted ${chapters.length} chapters`)
      return chapters
    }
  } catch (error) {
    console.error('AI detection failed:', error)
  }
  
  // If AI fails, try simple pattern scan
  console.log('\n--- Fallback: Pattern scanning ---')
  const patternChapters = scanWithFlexiblePatterns(lines)
  
  if (patternChapters.length >= 2) {
    return patternChapters
  }
  
  // Last resort: return full book
  console.log('WARNING: Could not detect chapters')
  return [{
    idx: 0,
    title: 'Full Book',
    text: text,
  }]
}

/**
 * Use AI to detect chapters - PRIMARY METHOD
 */
async function detectChaptersWithAI(text: string, lines: string[]): Promise<Chapter[]> {
  const openai = getOpenAI()
  
  // Sample more of the book for better analysis
  const bookLength = text.length
  const sampleSize = 6000
  
  // Get samples from different parts
  const beginning = text.substring(0, Math.min(sampleSize * 2, bookLength))
  const middle = text.substring(
    Math.floor(bookLength * 0.4),
    Math.floor(bookLength * 0.4) + sampleSize
  )
  const later = text.substring(
    Math.floor(bookLength * 0.7),
    Math.floor(bookLength * 0.7) + sampleSize
  )
  const end = text.substring(Math.max(0, bookLength - sampleSize))
  
  const fullSample = `=== BEGINNING OF BOOK ===
${beginning}

=== MIDDLE OF BOOK ===
${middle}

=== LATER IN BOOK ===
${later}

=== END OF BOOK ===
${end}`

  console.log('Sending book samples to AI for analysis...')
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a book chapter extraction expert. Analyze the book text and identify EVERY chapter/section.

Your task:
1. Find the Table of Contents if present
2. Identify the EXACT format used for chapter headings (e.g., "Chapter 1", "CHAPTER ONE", "1", "Part One", etc.)
3. List ALL chapters/sections in order

Return a JSON object with:
{
  "chapterFormat": "describe the exact format used (e.g., 'CHAPTER followed by number word like ONE, TWO')",
  "chapters": [
    {"title": "exact chapter heading text", "searchText": "text to search for in document"},
    ...
  ]
}

IMPORTANT:
- Include special sections: Foreword, Preface, Prologue, Introduction, Epilogue, Afterword, Acknowledgments
- Include ALL numbered chapters (Chapter 1, Chapter 2, ... Chapter 30+)
- Use the EXACT text as it appears in the book
- The "searchText" should be a SHORT unique string that marks the chapter start (just the heading, not content)
- Look carefully at the beginning for the Table of Contents which lists all chapters`,
      },
      {
        role: 'user',
        content: `Analyze this book and identify ALL chapters:\n\n${fullSample}`,
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const result = JSON.parse(response.choices[0]?.message?.content || '{}')
  
  console.log(`AI detected format: ${result.chapterFormat}`)
  console.log(`AI found ${result.chapters?.length || 0} chapters`)
  
  if (!result.chapters || result.chapters.length < 2) {
    console.log('AI found insufficient chapters')
    return []
  }
  
  // Log all found chapters
  result.chapters.forEach((ch: {title: string}, i: number) => {
    console.log(`  ${i + 1}. "${ch.title}"`)
  })
  
  // Now find each chapter in the actual text
  console.log('\n--- Locating chapters in text ---')
  
  const chapters: Chapter[] = []
  const foundLocations: { lineIdx: number; title: string }[] = []
  
  // Find each chapter marker in the text
  for (const ch of result.chapters) {
    const searchText = (ch.searchText || ch.title).toLowerCase().trim()
    const title = ch.title
    
    // Search for this chapter marker
    let foundAt = -1
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase()
      
      // Skip empty lines and very long lines
      if (line.length === 0 || line.length > 100) continue
      
      // Skip lines that look like TOC entries (have dots/dashes followed by page numbers)
      if (/[.·…_\-]{3,}\s*\d+\s*$/.test(lines[i])) continue
      
      // Check for match
      if (line === searchText || 
          line.startsWith(searchText) || 
          line.includes(searchText)) {
        
        // Make sure we haven't already found this location (avoid TOC)
        const alreadyFound = foundLocations.some(loc => 
          Math.abs(loc.lineIdx - i) < 50
        )
        
        if (!alreadyFound) {
          foundAt = i
          break
        }
      }
    }
    
    if (foundAt >= 0) {
      foundLocations.push({ lineIdx: foundAt, title })
      console.log(`  Found "${title}" at line ${foundAt}`)
    } else {
      console.log(`  WARNING: Could not find "${title}"`)
    }
  }
  
  // Sort by line index
  foundLocations.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Remove any that are too close (probably TOC entries caught by mistake)
  const filteredLocations: typeof foundLocations = []
  for (const loc of foundLocations) {
    const last = filteredLocations[filteredLocations.length - 1]
    if (!last || loc.lineIdx - last.lineIdx > 20) {
      filteredLocations.push(loc)
    }
  }
  
  console.log(`\nLocated ${filteredLocations.length} chapters in text`)
  
  // Extract chapter content
  for (let i = 0; i < filteredLocations.length; i++) {
    const current = filteredLocations[i]
    const next = filteredLocations[i + 1]
    
    const startLine = current.lineIdx + 1 // Start after the heading
    const endLine = next ? next.lineIdx : lines.length
    
    // Get content
    let content = lines.slice(startLine, endLine).join('\n').trim()
    
    // Skip any leading empty lines
    while (content.startsWith('\n')) {
      content = content.substring(1)
    }
    
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    
    if (wordCount > 30) {
      chapters.push({
        idx: chapters.length,
        title: current.title,
        text: content,
      })
      console.log(`  Extracted: "${current.title}" (${wordCount} words)`)
    }
  }
  
  return chapters
}

/**
 * Flexible pattern scanning (fallback)
 */
function scanWithFlexiblePatterns(lines: string[]): Chapter[] {
  console.log('Scanning with flexible patterns...')
  
  const markers: { lineIdx: number; title: string }[] = []
  
  // Very flexible patterns
  const patterns = [
    /^chapter\s+/i,
    /^prologue/i,
    /^epilogue/i,
    /^foreword/i,
    /^preface/i,
    /^introduction/i,
    /^afterword/i,
    /^part\s+/i,
    /^book\s+/i,
    /^section\s+/i,
    /^act\s+/i,
  ]
  
  for (let i = 30; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty, very short, or very long lines
    if (line.length < 3 || line.length > 80) continue
    
    // Skip TOC entries
    if (/[.·…_\-]{3,}\s*\d+\s*$/.test(line)) continue
    
    // Check patterns
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        // Verify it's not too close to previous marker
        const lastMarker = markers[markers.length - 1]
        if (!lastMarker || i - lastMarker.lineIdx > 30) {
          markers.push({ lineIdx: i, title: line })
          console.log(`  Found: "${line}" at line ${i}`)
        }
        break
      }
    }
  }
  
  if (markers.length < 2) return []
  
  // Extract chapters
  const chapters: Chapter[] = []
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].lineIdx + 1
    const end = i + 1 < markers.length ? markers[i + 1].lineIdx : lines.length
    
    const content = lines.slice(start, end).join('\n').trim()
    const wordCount = content.split(/\s+/).length
    
    if (wordCount > 50) {
      chapters.push({
        idx: chapters.length,
        title: markers[i].title,
        text: content,
      })
    }
  }
  
  return chapters
}

export async function saveChapters(bookId: string, chapters: Chapter[]): Promise<void> {
  const supabase = createServiceClient()
  
  console.log(`Deleting existing chapters for book ${bookId}...`)
  await supabase.from('chapters').delete().eq('book_id', bookId)
  
  for (const chapter of chapters) {
    const { error } = await supabase
      .from('chapters')
      .insert({
        book_id: bookId,
        idx: chapter.idx,
        title: chapter.title,
        text_content: chapter.text,
      })

    if (error) throw new Error(`Failed to save chapter ${chapter.idx}: ${error.message}`)
  }
  
  console.log(`Saved ${chapters.length} chapters`)
}

export async function getChapters(bookId: string) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('idx', { ascending: true })

  if (error) throw new Error(`Failed to fetch chapters: ${error.message}`)
  return data || []
}
