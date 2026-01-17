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
  console.log(`Total words: ~${text.split(/\s+/).length}`)
  
  const lines = text.split('\n')
  
  // STEP 1: Use AI to understand the chapter format
  console.log('\n--- Step 1: AI analyzing chapter format ---')
  const chapterFormat = await analyzeChapterFormat(text)
  console.log(`Detected format: ${chapterFormat}`)
  
  // STEP 2: Scan for chapter markers based on detected format
  console.log('\n--- Step 2: Scanning for chapter markers ---')
  const markers = scanForMarkers(lines, chapterFormat)
  
  if (markers.length >= 2) {
    console.log(`Found ${markers.length} chapter markers`)
    
    // STEP 3: Extract chapter content
    console.log('\n--- Step 3: Extracting chapter content ---')
    const chapters = extractChapters(lines, markers)
    
    if (chapters.length >= 2) {
      logResults(chapters, text)
      return chapters
    }
  }
  
  // Fallback
  console.log('WARNING: Could not detect chapters, returning full book')
  return [{
    idx: 0,
    title: 'Full Book',
    text: text,
  }]
}

/**
 * Use AI to determine the chapter format used in the book
 */
async function analyzeChapterFormat(text: string): Promise<string> {
  try {
    const openai = getOpenAI()
    
    // Sample the beginning and middle
    const sample = text.substring(0, 10000) + '\n\n...\n\n' + text.substring(Math.floor(text.length / 2), Math.floor(text.length / 2) + 5000)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze this book and determine EXACTLY how chapters are marked.

Common formats:
- "numbered" = Just numbers: 1, 2, 3, 4...
- "chapter_number" = Chapter 1, Chapter 2...
- "chapter_word" = Chapter One, Chapter Two...
- "part" = Part 1, Part 2...
- "roman" = I, II, III, IV...
- "titled" = Chapters have titles only (no numbers)

Return JSON:
{
  "format": "one of the above formats",
  "hasSpecialSections": true/false,
  "specialSections": ["Prologue", "Epilogue", etc if present],
  "estimatedChapterCount": number
}`,
        },
        {
          role: 'user',
          content: `What chapter format does this book use?\n\n${sample}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    console.log('AI analysis:', result)
    return result.format || 'chapter_number'
  } catch (error) {
    console.error('AI format analysis failed:', error)
    return 'chapter_number'
  }
}

/**
 * Scan for chapter markers based on the detected format
 */
function scanForMarkers(lines: string[], format: string): { lineIdx: number; title: string }[] {
  const markers: { lineIdx: number; title: string }[] = []
  
  // Track numbers we've seen to ensure sequential chapters
  let expectedNumber = 1
  let foundFirstNumber = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    // Skip empty or long lines
    if (line.length === 0 || line.length > 80) continue
    
    // Skip TOC entries (dots followed by page numbers)
    if (/[.·…_\-]{3,}\s*\d+\s*$/.test(line)) continue
    
    // Check for special sections (these work for all formats)
    if (/^(prologue|epilogue|foreword|preface|introduction|afterword|acknowledgments?)$/i.test(line)) {
      // Verify context - should have blank lines around it
      const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
      
      if (prevEmpty && !markers.some(m => m.title.toLowerCase() === lineLower)) {
        markers.push({ lineIdx: i, title: line })
        console.log(`  Found special: "${line}" at line ${i}`)
      }
      continue
    }
    
    // Check based on format
    let isChapterMarker = false
    let chapterTitle = ''
    
    if (format === 'numbered') {
      // Just numbers: 1, 2, 3 (alone on a line)
      const numMatch = line.match(/^(\d{1,2})$/)
      if (numMatch) {
        const num = parseInt(numMatch[1])
        
        // Check context - must have blank line before
        const prevLine = i > 0 ? lines[i - 1].trim() : ''
        const prevEmpty = prevLine.length === 0
        
        // Sequential or first number
        if (prevEmpty && (num === expectedNumber || (!foundFirstNumber && num === 1))) {
          isChapterMarker = true
          chapterTitle = `Chapter ${num}`
          expectedNumber = num + 1
          foundFirstNumber = true
        }
      }
    } else if (format === 'chapter_number') {
      // "Chapter 1", "Chapter 2", etc.
      const match = line.match(/^chapter\s+(\d+)/i)
      if (match) {
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
        if (prevEmpty) {
          isChapterMarker = true
          chapterTitle = line
        }
      }
    } else if (format === 'chapter_word') {
      // "Chapter One", "Chapter Two", etc.
      const match = line.match(/^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i)
      if (match) {
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
        if (prevEmpty) {
          isChapterMarker = true
          chapterTitle = line
        }
      }
    } else if (format === 'part') {
      // "Part 1", "Part One", etc.
      const match = line.match(/^part\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i)
      if (match) {
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
        if (prevEmpty) {
          isChapterMarker = true
          chapterTitle = line
        }
      }
    } else if (format === 'roman') {
      // I, II, III, IV, etc.
      const match = line.match(/^(I{1,3}|IV|V|VI{1,3}|IX|X|XI{1,3}|XIV|XV|XVI{1,3}|XIX|XX)$/i)
      if (match) {
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
        if (prevEmpty) {
          isChapterMarker = true
          chapterTitle = `Chapter ${line}`
        }
      }
    }
    
    // Also check for generic chapter patterns as fallback
    if (!isChapterMarker) {
      const genericMatch = line.match(/^chapter\s+(\d+|[a-z]+)/i)
      if (genericMatch && line.length < 50) {
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
        if (prevEmpty) {
          isChapterMarker = true
          chapterTitle = line
        }
      }
    }
    
    if (isChapterMarker) {
      // Make sure this isn't too close to previous marker (skip TOC)
      const lastMarker = markers[markers.length - 1]
      if (!lastMarker || i - lastMarker.lineIdx > 20) {
        markers.push({ lineIdx: i, title: chapterTitle })
        console.log(`  Found chapter: "${chapterTitle}" at line ${i}`)
      }
    }
  }
  
  return markers
}

/**
 * Extract chapter content between markers
 */
function extractChapters(lines: string[], markers: { lineIdx: number; title: string }[]): Chapter[] {
  const chapters: Chapter[] = []
  
  // Sort markers by line index
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    const next = markers[i + 1]
    
    // Start after the chapter marker line
    const startLine = current.lineIdx + 1
    const endLine = next ? next.lineIdx : lines.length
    
    // Get content
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
