import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import OpenAI from 'openai'

const ChapterSchema = z.object({
  idx: z.number(),
  title: z.string(),
  text: z.string(),
})

export type Chapter = z.infer<typeof ChapterSchema>

interface TOCEntry {
  title: string
  type: 'special' | 'chapter' | 'part'
  chapterNum: number | null
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey })
}

/**
 * Main: Detect and extract chapters from book text
 * Priority: TOC parsing -> Direct scan -> AI detection -> Size split
 */
export async function detectChapters(
  text: string,
  pageTexts?: string[]
): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  console.log(`Total words: ~${text.split(/\s+/).length}`)
  
  const lines = text.split('\n')
  
  // STEP 1: Find and parse the Table of Contents
  console.log('\n--- Step 1: Finding Table of Contents ---')
  const tocEntries = await findAndParseTOC(text, lines)
  
  if (tocEntries.length >= 2) {
    console.log(`Found ${tocEntries.length} entries in TOC`)
    tocEntries.forEach((e, i) => console.log(`  ${i + 1}. "${e.title}" (${e.type})`))
    
    // STEP 2: Locate each TOC entry in the book text
    console.log('\n--- Step 2: Locating chapters in text ---')
    const chapters = locateAndExtractChapters(text, lines, tocEntries)
    
    if (chapters.length >= 2) {
      return validateAndReturn(chapters, text)
    }
  }
  
  // FALLBACK: Direct chapter marker scan
  console.log('\n--- Fallback: Direct chapter marker scan ---')
  const directChapters = scanForChapterMarkers(text, lines)
  
  if (directChapters.length >= 2) {
    return validateAndReturn(directChapters, text)
  }
  
  // LAST RESORT: AI-based detection
  console.log('\n--- Last Resort: AI chapter detection ---')
  const aiChapters = await detectChaptersWithAI(text)
  
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
 * Find and parse the Table of Contents using AI
 */
async function findAndParseTOC(text: string, lines: string[]): Promise<TOCEntry[]> {
  // First, find where the TOC is
  let tocStartIdx = -1
  let tocEndIdx = -1
  
  for (let i = 0; i < Math.min(500, lines.length); i++) {
    const line = lines[i].trim().toLowerCase()
    if (line === 'contents' || line === 'table of contents' || line === 'toc') {
      tocStartIdx = i + 1
      break
    }
  }
  
  if (tocStartIdx === -1) {
    console.log('No explicit TOC found, using AI to analyze book structure')
    return await parseTOCWithAI(text)
  }
  
  // Find where TOC ends (usually before chapter 1 or first content)
  for (let i = tocStartIdx; i < Math.min(tocStartIdx + 200, lines.length); i++) {
    const line = lines[i].trim().toLowerCase()
    // TOC ends when we hit actual chapter content
    if (line.length > 200 || 
        (line.startsWith('chapter') && lines[i + 1]?.trim().length > 100) ||
        line === 'prologue' && lines[i + 1]?.trim().length > 100) {
      tocEndIdx = i
      break
    }
  }
  
  if (tocEndIdx === -1) tocEndIdx = Math.min(tocStartIdx + 150, lines.length)
  
  // Extract TOC text
  const tocText = lines.slice(tocStartIdx, tocEndIdx).join('\n')
  console.log(`Found TOC from line ${tocStartIdx} to ${tocEndIdx}`)
  
  // Parse TOC entries
  return parseTOCText(tocText)
}

/**
 * Parse TOC text to extract entries
 */
function parseTOCText(tocText: string): TOCEntry[] {
  const entries: TOCEntry[] = []
  const lines = tocText.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.length > 100) continue
    
    // Remove page numbers at end (e.g., "Chapter 1 ........... 15")
    const cleaned = trimmed
      .replace(/[\s.·…_\-]+\d+\s*$/, '')  // Remove trailing page numbers
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim()
    
    if (cleaned.length === 0) continue
    
    // Detect entry type
    const lowerCleaned = cleaned.toLowerCase()
    
    // Special sections
    if (/^(foreword|preface|prologue|introduction|afterword|epilogue|acknowledgments?|about the author)/i.test(cleaned)) {
      entries.push({
        title: cleaned,
        type: 'special',
        chapterNum: null,
      })
      continue
    }
    
    // Parts
    const partMatch = cleaned.match(/^part\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i)
    if (partMatch) {
      entries.push({
        title: cleaned,
        type: 'part',
        chapterNum: null,
      })
      continue
    }
    
    // Chapters with "Chapter X" format
    const chapterMatch = cleaned.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i)
    if (chapterMatch) {
      const numStr = chapterMatch[1].toLowerCase()
      const num = isNaN(parseInt(numStr)) ? wordToNum(numStr) : parseInt(numStr)
      entries.push({
        title: cleaned,
        type: 'chapter',
        chapterNum: num,
      })
      continue
    }
    
    // Numbered entries like "1. Chapter Title" or "1 Chapter Title"
    const numberedMatch = cleaned.match(/^(\d{1,2})[\.\s:]\s*(.+)/)
    if (numberedMatch) {
      entries.push({
        title: cleaned,
        type: 'chapter',
        chapterNum: parseInt(numberedMatch[1]),
      })
      continue
    }
    
    // Standalone number (might be chapter)
    if (/^\d{1,2}$/.test(cleaned)) {
      entries.push({
        title: `Chapter ${cleaned}`,
        type: 'chapter',
        chapterNum: parseInt(cleaned),
      })
    }
  }
  
  return entries
}

/**
 * Use AI to parse TOC when not found explicitly
 */
async function parseTOCWithAI(text: string): Promise<TOCEntry[]> {
  try {
    const openai = getOpenAI()
    
    // Sample beginning of book to find structure
    const sample = text.substring(0, 15000)
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a book structure analyzer. Analyze the text and identify ALL chapters/sections in order.

Look for:
- Table of Contents if present
- Chapter markers like "Chapter 1", "CHAPTER ONE", "1.", etc.
- Special sections: Foreword, Preface, Prologue, Introduction, Epilogue, Afterword, Acknowledgments
- Parts if the book has them

Return JSON:
{
  "entries": [
    {"title": "Foreword", "type": "special", "chapterNum": null},
    {"title": "Prologue", "type": "special", "chapterNum": null},
    {"title": "Chapter 1: The Beginning", "type": "chapter", "chapterNum": 1},
    {"title": "Chapter 2", "type": "chapter", "chapterNum": 2},
    ...
    {"title": "Epilogue", "type": "special", "chapterNum": null}
  ]
}

Use the EXACT titles as they appear. Include ALL chapters even if you can only see a few - estimate based on patterns.`,
        },
        {
          role: 'user',
          content: `Identify all chapters/sections in this book:\n\n${sample}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    return result.entries || []
  } catch (error) {
    console.error('AI TOC parsing failed:', error)
    return []
  }
}

/**
 * Locate each TOC entry in the text and extract chapter content
 */
function locateAndExtractChapters(
  text: string,
  lines: string[],
  tocEntries: TOCEntry[]
): Chapter[] {
  const chapters: Chapter[] = []
  const locations: { entry: TOCEntry; lineIdx: number }[] = []
  
  // Skip the TOC section when searching (start after line 100 typically)
  let searchStartLine = 0
  for (let i = 0; i < Math.min(300, lines.length); i++) {
    const line = lines[i].trim().toLowerCase()
    if (line === 'contents' || line === 'table of contents') {
      searchStartLine = i + 50 // Skip past TOC
      break
    }
  }
  searchStartLine = Math.max(searchStartLine, 50) // At least skip first 50 lines
  
  console.log(`Searching for chapters starting at line ${searchStartLine}`)
  
  // Find each entry in the text
  for (const entry of tocEntries) {
    const location = findEntryInText(lines, entry, searchStartLine)
    
    if (location !== -1) {
      locations.push({ entry, lineIdx: location })
      console.log(`  Found "${entry.title}" at line ${location}`)
      // Update search start to avoid finding same location again
      searchStartLine = location + 5
    } else {
      console.log(`  WARNING: Could not find "${entry.title}"`)
    }
  }
  
  // Sort by line index
  locations.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Extract chapter content between markers
  for (let i = 0; i < locations.length; i++) {
    const current = locations[i]
    const next = locations[i + 1]
    
    // Start from current marker, end at next marker (or end of text)
    const startLine = current.lineIdx
    const endLine = next ? next.lineIdx : lines.length
    
    // Extract all text between markers
    const chapterLines = lines.slice(startLine, endLine)
    let chapterText = chapterLines.join('\n').trim()
    
    // Remove the chapter header from content (first line or two)
    const headerLines = chapterText.split('\n').slice(0, 3)
    for (let h = 0; h < headerLines.length; h++) {
      const headerLine = headerLines[h].trim().toLowerCase()
      const entryTitleLower = current.entry.title.toLowerCase()
      
      if (headerLine === entryTitleLower || 
          headerLine.includes(entryTitleLower) ||
          headerLine.length < 5) {
        // Remove this header line
        chapterText = chapterText.split('\n').slice(h + 1).join('\n').trim()
      } else {
        break
      }
    }
    
    const wordCount = chapterText.split(/\s+/).length
    console.log(`  Extracted "${current.entry.title}": ${wordCount} words (lines ${startLine}-${endLine})`)
    
    if (chapterText.length > 200) {
      chapters.push({
        idx: i,
        title: current.entry.title,
        text: chapterText,
      })
    }
  }
  
  return chapters
}

/**
 * Find a TOC entry in the text
 */
function findEntryInText(lines: string[], entry: TOCEntry, startFrom: number): number {
  const searchTerms: string[] = []
  
  // Build search terms based on entry
  if (entry.type === 'special') {
    // For Prologue, Epilogue, etc. - search for exact word
    const keyword = entry.title.split(/[\s:]/)[0].toLowerCase()
    searchTerms.push(keyword)
  } else if (entry.chapterNum !== null) {
    // For chapters, search for various formats
    const num = entry.chapterNum
    searchTerms.push(`chapter ${num}`)
    searchTerms.push(`chapter ${numToWord(num)}`)
    searchTerms.push(`${num}.`)
    searchTerms.push(`${num}`)
    // Also try full title
    searchTerms.push(entry.title.toLowerCase())
  } else {
    searchTerms.push(entry.title.toLowerCase())
  }
  
  // Search for the entry
  for (let i = startFrom; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    // Skip very long lines (probably not chapter headers)
    if (line.length > 80) continue
    
    // Check if line matches any search term
    for (const term of searchTerms) {
      // Exact match or starts with
      if (lineLower === term || lineLower.startsWith(term + ' ') || lineLower.startsWith(term + ':')) {
        // Verify it's likely a header (short line, possibly with blank before/after)
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 10
        const nextEmpty = i >= lines.length - 1 || lines[i + 1].trim().length < 10
        const isShort = line.length < 60
        
        if (isShort || prevEmpty || nextEmpty) {
          return i
        }
      }
    }
  }
  
  return -1
}

/**
 * Direct scan for chapter markers (fallback)
 */
function scanForChapterMarkers(text: string, lines: string[]): Chapter[] {
  const markers: { lineIdx: number; title: string }[] = []
  
  console.log('Scanning for chapter markers...')
  
  for (let i = 50; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    if (line.length === 0 || line.length > 70) continue
    
    // Check for chapter patterns
    const isChapterLine = 
      /^chapter\s+\d+/i.test(line) ||
      /^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i.test(line) ||
      /^(prologue|epilogue|foreword|preface|introduction|afterword)$/i.test(line) ||
      /^part\s+(one|two|three|\d+)/i.test(line)
    
    if (isChapterLine) {
      // Verify context
      const prevEmpty = i === 0 || lines[i - 1].trim().length < 5
      const nextEmpty = i >= lines.length - 1 || lines[i + 1].trim().length < 5
      
      if (prevEmpty || nextEmpty) {
        markers.push({ lineIdx: i, title: line })
        console.log(`  Found marker: "${line}" at line ${i}`)
      }
    }
  }
  
  // Extract chapters
  const chapters: Chapter[] = []
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].lineIdx
    const end = i + 1 < markers.length ? markers[i + 1].lineIdx : lines.length
    
    const chapterText = lines.slice(start + 1, end).join('\n').trim()
    
    if (chapterText.length > 500) {
      chapters.push({
        idx: i,
        title: markers[i].title,
        text: chapterText,
      })
    }
  }
  
  return chapters
}

/**
 * AI-based chapter detection (last resort)
 */
async function detectChaptersWithAI(text: string): Promise<Chapter[]> {
  try {
    const openai = getOpenAI()
    
    // Get AI to find chapter markers throughout the text
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze this book and find the EXACT text that marks each chapter/section start.

Return JSON:
{
  "markers": [
    {"text": "PROLOGUE", "type": "special"},
    {"text": "CHAPTER ONE", "type": "chapter"},
    {"text": "CHAPTER TWO", "type": "chapter"},
    ...
  ]
}

Use the EXACT text as it appears in the book. Include special sections and all chapters.`,
        },
        {
          role: 'user',
          content: `Find all chapter markers in this book (showing beginning, middle and end samples):\n\n${text.substring(0, 5000)}\n\n...[middle]...\n\n${text.substring(Math.floor(text.length/2), Math.floor(text.length/2) + 3000)}\n\n...[end]...\n\n${text.substring(text.length - 3000)}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    const markers = result.markers || []
    
    if (markers.length < 2) return []
    
    console.log(`AI found ${markers.length} chapter markers`)
    
    // Find markers in text and extract chapters
    const lines = text.split('\n')
    const locations: { lineIdx: number; title: string }[] = []
    let searchFrom = 50
    
    for (const marker of markers) {
      const markerText = marker.text.toLowerCase().trim()
      
      for (let i = searchFrom; i < lines.length; i++) {
        const line = lines[i].trim().toLowerCase()
        
        if (line === markerText || line.startsWith(markerText)) {
          locations.push({ lineIdx: i, title: marker.text })
          searchFrom = i + 10
          break
        }
      }
    }
    
    // Extract chapters
    const chapters: Chapter[] = []
    for (let i = 0; i < locations.length; i++) {
      const start = locations[i].lineIdx
      const end = i + 1 < locations.length ? locations[i + 1].lineIdx : lines.length
      
      const chapterText = lines.slice(start + 1, end).join('\n').trim()
      
      if (chapterText.length > 500) {
        chapters.push({
          idx: i,
          title: locations[i].title,
          text: chapterText,
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
  // Re-index chapters
  chapters = chapters.map((ch, idx) => ({ ...ch, idx }))
  
  // Log results
  console.log(`\n========== EXTRACTION COMPLETE ==========`)
  console.log(`Extracted ${chapters.length} chapters:`)
  
  let totalChars = 0
  chapters.forEach((ch, i) => {
    const wordCount = ch.text.split(/\s+/).length
    totalChars += ch.text.length
    console.log(`  ${i + 1}. "${ch.title}" (~${wordCount} words)`)
  })
  
  const coverage = (totalChars / fullText.length) * 100
  console.log(`\nCoverage: ${coverage.toFixed(1)}% (${totalChars}/${fullText.length} chars)`)
  
  if (coverage < 50) {
    console.warn(`WARNING: Very low coverage (${coverage.toFixed(1)}%). Some content may be missing.`)
  }
  
  return chapters
}

// Helper: Word to number
function wordToNum(word: string): number {
  const words: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  }
  return words[word.toLowerCase()] || 0
}

// Helper: Number to word
function numToWord(num: number): string {
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
  return words[num] || num.toString()
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
