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
 * Main: Detect and extract chapters by scanning entire document
 */
export async function detectChapters(
  text: string,
  pageTexts?: string[]
): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  console.log(`Total words: ~${text.split(/\s+/).length}`)
  
  const lines = text.split('\n')
  
  // SCAN ENTIRE DOCUMENT for chapter markers
  console.log('\n--- Scanning entire document for chapter markers ---')
  const allMarkers = scanEntireDocument(lines)
  
  if (allMarkers.length >= 2) {
    console.log(`Found ${allMarkers.length} chapter markers`)
    const chapters = extractChaptersBetweenMarkers(lines, allMarkers)
    
    if (chapters.length >= 2) {
      return validateAndReturn(chapters, text)
    }
  }
  
  // FALLBACK: AI-based detection
  console.log('\n--- Fallback: AI-based chapter detection ---')
  const aiChapters = await detectChaptersWithAI(text, lines)
  
  if (aiChapters.length >= 2) {
    return validateAndReturn(aiChapters, text)
  }
  
  // Return full book if nothing works
  console.log('WARNING: Could not detect chapters, returning full book')
  return [{
    idx: 0,
    title: 'Full Book',
    text: text,
  }]
}

/**
 * Scan entire document for chapter markers
 * Returns all markers sorted by their position in the document
 */
function scanEntireDocument(lines: string[]): { lineIdx: number; title: string; priority: number }[] {
  const markers: { lineIdx: number; title: string; priority: number }[] = []
  
  // Track which chapter numbers we've seen to avoid duplicates
  const seenChapterNums = new Set<number>()
  const seenSpecials = new Set<string>()
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    // Skip empty or very long lines
    if (line.length === 0 || line.length > 100) continue
    
    // Skip if this looks like TOC content (has page numbers at end)
    if (/[\s.·…_\-]+\d+\s*$/.test(line)) continue
    
    // Check context - chapter headers usually have blank lines around them
    const prevLine = i > 0 ? lines[i - 1].trim() : ''
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
    const prevEmpty = prevLine.length < 5
    const nextEmpty = nextLine.length < 5
    const hasContext = prevEmpty || nextEmpty
    
    // PRIORITY 1: Special sections at start (Foreword, Preface, Prologue)
    if (/^(foreword|preface|prologue|introduction)$/i.test(line)) {
      const key = lineLower
      if (!seenSpecials.has(key) && hasContext) {
        seenSpecials.add(key)
        markers.push({ lineIdx: i, title: line, priority: 1 })
        console.log(`  [START] "${line}" at line ${i}`)
      }
      continue
    }
    
    // PRIORITY 2: Numbered chapters - "Chapter 1", "Chapter One", "CHAPTER 1"
    const chapterMatch = line.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty[- ]?one|twenty[- ]?two|twenty[- ]?three|twenty[- ]?four|twenty[- ]?five|twenty[- ]?six|twenty[- ]?seven|twenty[- ]?eight|twenty[- ]?nine|thirty|forty|fifty)/i)
    if (chapterMatch) {
      const numStr = chapterMatch[1].toLowerCase()
      const num = isNaN(parseInt(numStr)) ? wordToNum(numStr) : parseInt(numStr)
      
      if (!seenChapterNums.has(num) && hasContext) {
        seenChapterNums.add(num)
        markers.push({ lineIdx: i, title: line, priority: 2 })
        console.log(`  [CHAPTER] "${line}" at line ${i}`)
      }
      continue
    }
    
    // PRIORITY 3: Part markers - "Part One", "Part 1"
    if (/^part\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(line) && hasContext) {
      markers.push({ lineIdx: i, title: line, priority: 3 })
      console.log(`  [PART] "${line}" at line ${i}`)
      continue
    }
    
    // PRIORITY 4: Special sections at end (Epilogue, Afterword, Acknowledgments)
    if (/^(epilogue|afterword|acknowledgments?|about the author|author'?s? note)$/i.test(line)) {
      const key = lineLower
      if (!seenSpecials.has(key) && hasContext) {
        seenSpecials.add(key)
        markers.push({ lineIdx: i, title: line, priority: 4 })
        console.log(`  [END] "${line}" at line ${i}`)
      }
      continue
    }
    
    // PRIORITY 5: Standalone numbers that might be chapters (e.g., "1" or "1.")
    // Only if we haven't found Chapter X format
    if (seenChapterNums.size === 0 && /^\d{1,2}\.?$/.test(line) && hasContext) {
      const num = parseInt(line)
      if (num >= 1 && num <= 50 && !seenChapterNums.has(num)) {
        // Verify next line starts with text (not another number)
        if (nextLine.length > 20 || /^[A-Z]/.test(nextLine)) {
          seenChapterNums.add(num)
          markers.push({ lineIdx: i, title: `Chapter ${num}`, priority: 5 })
          console.log(`  [NUM] "${line}" -> "Chapter ${num}" at line ${i}`)
        }
      }
    }
  }
  
  // Sort by line position (order in document)
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Filter out markers that are too close together (within 20 lines - probably TOC entries)
  const filteredMarkers: typeof markers = []
  for (const marker of markers) {
    const lastMarker = filteredMarkers[filteredMarkers.length - 1]
    if (!lastMarker || marker.lineIdx - lastMarker.lineIdx > 30) {
      filteredMarkers.push(marker)
    } else {
      // If markers are close, keep the one with higher priority (lower number)
      if (marker.priority < lastMarker.priority) {
        filteredMarkers[filteredMarkers.length - 1] = marker
      }
    }
  }
  
  return filteredMarkers
}

/**
 * Extract chapter content between markers
 */
function extractChaptersBetweenMarkers(
  lines: string[],
  markers: { lineIdx: number; title: string; priority: number }[]
): Chapter[] {
  const chapters: Chapter[] = []
  
  console.log('\n--- Extracting chapter content ---')
  
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    const next = markers[i + 1]
    
    // Start from the line AFTER the marker
    const startLine = current.lineIdx + 1
    // End at the line BEFORE the next marker (or end of document)
    const endLine = next ? next.lineIdx : lines.length
    
    // Extract content
    const contentLines = lines.slice(startLine, endLine)
    let content = contentLines.join('\n').trim()
    
    // Skip first few lines if they're empty or very short (subtitle, etc.)
    const contentSplit = content.split('\n')
    let skipLines = 0
    for (let j = 0; j < Math.min(5, contentSplit.length); j++) {
      if (contentSplit[j].trim().length < 5) {
        skipLines++
      } else {
        break
      }
    }
    if (skipLines > 0) {
      content = contentSplit.slice(skipLines).join('\n').trim()
    }
    
    const wordCount = content.split(/\s+/).length
    
    if (content.length > 200 && wordCount > 50) {
      chapters.push({
        idx: chapters.length,
        title: current.title,
        text: content,
      })
      console.log(`  ${chapters.length}. "${current.title}" - ${wordCount} words (lines ${startLine}-${endLine})`)
    } else {
      console.log(`  SKIPPED "${current.title}" - too short (${wordCount} words)`)
    }
  }
  
  return chapters
}

/**
 * AI-based chapter detection (fallback)
 */
async function detectChaptersWithAI(text: string, lines: string[]): Promise<Chapter[]> {
  try {
    const openai = getOpenAI()
    
    console.log('Using AI to find chapter structure...')
    
    // Sample from throughout the book
    const sampleSize = 4000
    const samples = [
      `[BEGINNING]\n${text.substring(0, sampleSize)}`,
      `[MIDDLE]\n${text.substring(Math.floor(text.length * 0.3), Math.floor(text.length * 0.3) + sampleSize)}`,
      `[LATER]\n${text.substring(Math.floor(text.length * 0.6), Math.floor(text.length * 0.6) + sampleSize)}`,
      `[END]\n${text.substring(Math.max(0, text.length - sampleSize))}`,
    ].join('\n\n')
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a book chapter analyzer. Find ALL chapter/section markers in this book.

Look for patterns like:
- "PROLOGUE", "Prologue"
- "CHAPTER ONE", "Chapter 1", "CHAPTER 1"
- "Part One", "PART 1"
- "EPILOGUE", "Epilogue"
- Simple numbers like "1" or "1." at the start of lines

Return JSON with the EXACT text of each chapter marker as it appears:
{
  "markers": [
    "PROLOGUE",
    "CHAPTER ONE", 
    "CHAPTER TWO",
    ...
    "EPILOGUE"
  ]
}

Include ALL chapters you can identify. Use EXACT text as shown in the book.`,
        },
        {
          role: 'user',
          content: `Find all chapter markers in this book:\n\n${samples}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    const aiMarkers = result.markers || []
    
    console.log(`AI found ${aiMarkers.length} chapter markers:`, aiMarkers)
    
    if (aiMarkers.length < 2) return []
    
    // Find these markers in the actual text
    const foundMarkers: { lineIdx: number; title: string }[] = []
    let searchFrom = 0
    
    for (const markerText of aiMarkers) {
      const markerLower = markerText.toLowerCase().trim()
      
      for (let i = searchFrom; i < lines.length; i++) {
        const line = lines[i].trim()
        const lineLower = line.toLowerCase()
        
        // Skip TOC entries (have page numbers)
        if (/[\s.·…_\-]+\d+\s*$/.test(line)) continue
        
        // Match the marker
        if (lineLower === markerLower || lineLower.startsWith(markerLower + ' ') || lineLower.startsWith(markerLower + ':')) {
          // Check context
          const prevEmpty = i === 0 || lines[i - 1].trim().length < 5
          const nextEmpty = i >= lines.length - 1 || lines[i + 1].trim().length < 5
          
          if (prevEmpty || nextEmpty || line.length < 50) {
            foundMarkers.push({ lineIdx: i, title: line })
            console.log(`  Found "${line}" at line ${i}`)
            searchFrom = i + 20 // Skip ahead to avoid TOC duplicates
            break
          }
        }
      }
    }
    
    if (foundMarkers.length < 2) return []
    
    // Extract chapters
    const chapters: Chapter[] = []
    for (let i = 0; i < foundMarkers.length; i++) {
      const start = foundMarkers[i].lineIdx + 1
      const end = i + 1 < foundMarkers.length ? foundMarkers[i + 1].lineIdx : lines.length
      
      const content = lines.slice(start, end).join('\n').trim()
      const wordCount = content.split(/\s+/).length
      
      if (content.length > 200 && wordCount > 50) {
        chapters.push({
          idx: chapters.length,
          title: foundMarkers[i].title,
          text: content,
        })
      }
    }
    
    return chapters
  } catch (error) {
    console.error('AI chapter detection failed:', error)
    return []
  }
}

/**
 * Validate chapters and return
 */
function validateAndReturn(chapters: Chapter[], fullText: string): Chapter[] {
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
  
  return chapters
}

// Helper: Word to number
function wordToNum(word: string): number {
  const normalized = word.toLowerCase().replace(/[- ]/g, '')
  const words: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'twentyone': 21, 'twentytwo': 22, 'twentythree': 23, 'twentyfour': 24, 'twentyfive': 25,
    'twentysix': 26, 'twentyseven': 27, 'twentyeight': 28, 'twentynine': 29, 'thirty': 30,
    'forty': 40, 'fifty': 50,
  }
  return words[normalized] || 0
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
