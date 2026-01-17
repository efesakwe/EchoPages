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
 * Main: Detect and extract chapters
 */
export async function detectChapters(
  text: string,
  pageTexts?: string[]
): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  
  const lines = text.split('\n')
  console.log(`Total lines: ${lines.length}`)
  
  // STEP 1: Find where the TOC ends (skip past it)
  const tocEndLine = findTOCEnd(lines)
  console.log(`TOC ends at line: ${tocEndLine}`)
  
  // STEP 2: Scan for chapter markers AFTER the TOC
  console.log('\n--- Scanning for chapter markers after TOC ---')
  const markers = scanForChapterMarkers(lines, tocEndLine)
  
  if (markers.length >= 2) {
    console.log(`Found ${markers.length} chapter markers`)
    
    // STEP 3: Extract chapter content
    const chapters = extractChapters(lines, markers)
    
    if (chapters.length >= 2) {
      logResults(chapters, text)
      return chapters
    }
  }
  
  console.log('WARNING: Could not detect chapters, returning full book')
  return [{
    idx: 0,
    title: 'Full Book',
    text: text,
  }]
}

/**
 * Find where the Table of Contents ends
 */
function findTOCEnd(lines: string[]): number {
  let tocStart = -1
  
  // Find "CONTENTS" or "TABLE OF CONTENTS"
  for (let i = 0; i < Math.min(200, lines.length); i++) {
    const line = lines[i].trim().toLowerCase()
    if (line === 'contents' || line === 'table of contents') {
      tocStart = i
      break
    }
  }
  
  if (tocStart === -1) {
    // No TOC found, start from beginning but skip first 50 lines (title pages, etc)
    return 50
  }
  
  // Find where TOC ends - look for first long paragraph after TOC
  // TOC entries are short, actual content is longer
  for (let i = tocStart + 1; i < Math.min(tocStart + 200, lines.length); i++) {
    const line = lines[i].trim()
    
    // Skip empty lines
    if (line.length === 0) continue
    
    // If we find a line that's clearly content (long prose), TOC has ended
    if (line.length > 100 && !line.match(/^[\d\s.·…_\-]+$/)) {
      console.log(`TOC ends before line ${i}: "${line.substring(0, 50)}..."`)
      return i
    }
  }
  
  // Default: skip 150 lines after TOC start
  return tocStart + 100
}

/**
 * Scan for chapter markers after the TOC
 */
function scanForChapterMarkers(lines: string[], startLine: number): { lineIdx: number; title: string }[] {
  const markers: { lineIdx: number; title: string }[] = []
  
  // Track chapter numbers to ensure they're sequential
  let lastChapterNum = 0
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    // Skip empty lines
    if (line.length === 0) continue
    
    // Skip very long lines (these are content, not headers)
    if (line.length > 60) continue
    
    // Check context - chapter headers usually have space before them
    const prevLine = i > 0 ? lines[i - 1].trim() : ''
    const prevPrevLine = i > 1 ? lines[i - 2].trim() : ''
    const hasSpaceBefore = prevLine.length === 0 || prevLine.length < 5
    
    // SPECIAL SECTIONS: Prologue, Epilogue, etc.
    if (/^(prologue|epilogue|foreword|preface|introduction|afterword|acknowledgments?)$/i.test(line)) {
      if (hasSpaceBefore) {
        markers.push({ lineIdx: i, title: line })
        console.log(`  Found: "${line}" at line ${i}`)
      }
      continue
    }
    
    // CHAPTER formats
    
    // "Chapter 1", "Chapter One", etc.
    const chapterMatch = line.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i)
    if (chapterMatch && hasSpaceBefore) {
      markers.push({ lineIdx: i, title: line })
      console.log(`  Found: "${line}" at line ${i}`)
      continue
    }
    
    // Just a number (1, 2, 3...) - common format
    // Must be preceded by empty line and be sequential
    if (/^\d{1,2}$/.test(line)) {
      const num = parseInt(line)
      
      // Check if it's the expected next chapter number
      if (hasSpaceBefore && (num === 1 || num === lastChapterNum + 1)) {
        // Additional check: the line AFTER should be actual content (not another number)
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
        const nextNextLine = i + 2 < lines.length ? lines[i + 2].trim() : ''
        
        // Next line should either be empty or start with content
        const looksLikeChapterStart = 
          nextLine.length === 0 || // Empty line after chapter number
          (nextLine.length > 20 && !/^\d{1,2}$/.test(nextLine)) || // Content
          (nextLine.length < 5 && nextNextLine.length > 20) // Short line then content
        
        if (looksLikeChapterStart) {
          markers.push({ lineIdx: i, title: `Chapter ${num}` })
          console.log(`  Found: "${num}" -> "Chapter ${num}" at line ${i}`)
          lastChapterNum = num
        }
      }
      continue
    }
  }
  
  return markers
}

/**
 * Extract chapter content between markers
 */
function extractChapters(lines: string[], markers: { lineIdx: number; title: string }[]): Chapter[] {
  const chapters: Chapter[] = []
  
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    const next = markers[i + 1]
    
    const startLine = current.lineIdx + 1
    const endLine = next ? next.lineIdx : lines.length
    
    const content = lines.slice(startLine, endLine).join('\n').trim()
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    
    if (wordCount > 50) {
      chapters.push({
        idx: chapters.length,
        title: current.title,
        text: content,
      })
    }
  }
  
  return chapters
}

/**
 * Log results
 */
function logResults(chapters: Chapter[], fullText: string) {
  console.log(`\n========== EXTRACTION COMPLETE ==========`)
  console.log(`Extracted ${chapters.length} chapters:`)
  
  let totalChars = 0
  chapters.forEach((ch, i) => {
    const wordCount = ch.text.split(/\s+/).length
    totalChars += ch.text.length
    console.log(`  ${i + 1}. "${ch.title}" (~${wordCount} words)`)
  })
  
  const coverage = (totalChars / fullText.length) * 100
  console.log(`\nCoverage: ${coverage.toFixed(1)}%`)
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
