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
 * Main: Detect and extract chapters from book text
 * Uses multiple strategies with reliable fallbacks
 */
export async function detectChapters(
  text: string,
  pageTexts?: string[]
): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  console.log(`Total words: ~${text.split(/\s+/).length}`)
  console.log(`Pages available: ${pageTexts ? pageTexts.length : 'No'}`)
  
  // Strategy 1: Find chapter markers directly in text
  console.log('\n--- Strategy 1: Direct chapter marker search ---')
  let chapters = findChaptersDirectly(text)
  
  if (chapters.length >= 2) {
    console.log(`Found ${chapters.length} chapters using direct search`)
    return validateAndReturn(chapters, text)
  }
  
  // Strategy 2: AI-based chapter detection
  console.log('\n--- Strategy 2: AI-based chapter detection ---')
  chapters = await detectChaptersWithAI(text)
  
  if (chapters.length >= 2) {
    console.log(`Found ${chapters.length} chapters using AI`)
    return validateAndReturn(chapters, text)
  }
  
  // Strategy 3: Page-based detection (if pages available)
  if (pageTexts && pageTexts.length > 1) {
    console.log('\n--- Strategy 3: Page-based chapter detection ---')
    chapters = findChaptersInPages(pageTexts)
    
    if (chapters.length >= 2) {
      console.log(`Found ${chapters.length} chapters using page search`)
      return validateAndReturn(chapters, text)
    }
  }
  
  // Strategy 4: Split by size (last resort)
  console.log('\n--- Strategy 4: Splitting by estimated chapter size ---')
  chapters = splitBySize(text)
  
  return validateAndReturn(chapters, text)
}

/**
 * Find chapters directly by scanning for common patterns
 */
function findChaptersDirectly(text: string): Chapter[] {
  const chapters: Chapter[] = []
  const lines = text.split('\n')
  
  // Patterns to match chapter markers
  const chapterPatterns = [
    // "Chapter 1", "Chapter One", "CHAPTER 1"
    /^(?:chapter)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty[- ]?one|twenty[- ]?two|twenty[- ]?three|twenty[- ]?four|twenty[- ]?five|thirty|forty|fifty)(?:\s*[:\-–—]?\s*(.*))?$/i,
    // "Prologue", "Epilogue", "Foreword", etc.
    /^(prologue|epilogue|foreword|preface|introduction|afterword)(?:\s*[:\-–—]?\s*(.*))?$/i,
    // "Part One", "Part 1"
    /^(?:part)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[:\-–—]?\s*(.*))?$/i,
  ]
  
  const foundMarkers: { lineIdx: number; title: string; type: string }[] = []
  
  // Scan through lines looking for chapter markers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty or very long lines
    if (line.length === 0 || line.length > 100) continue
    
    // Check each pattern
    for (const pattern of chapterPatterns) {
      const match = line.match(pattern)
      if (match) {
        // Verify it's likely a chapter header (usually has blank lines around it)
        const prevEmpty = i === 0 || lines[i - 1].trim().length < 3
        const nextEmpty = i === lines.length - 1 || lines[i + 1].trim().length < 3
        const isShortLine = line.length < 60
        
        if ((prevEmpty || nextEmpty) && isShortLine) {
          foundMarkers.push({
            lineIdx: i,
            title: line,
            type: pattern.source.includes('prologue') ? 'special' : 
                  pattern.source.includes('part') ? 'part' : 'chapter'
          })
          console.log(`  Found: "${line}" at line ${i}`)
          break
        }
      }
    }
  }
  
  // Also check for numbered chapters like "1" or "1." at start of line after blank
  let expectedNum = 1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const prevEmpty = i > 0 && lines[i - 1].trim().length < 3
    
    // Check for standalone number (chapter marker)
    if (prevEmpty && /^\d{1,2}\.?$/.test(line)) {
      const num = parseInt(line)
      // Only accept if it matches expected sequence or is 1
      if (num === expectedNum || num === 1) {
        // Make sure this isn't a page number by checking context
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
        const isLikelyChapter = nextLine.length > 20 || nextLine === '' || 
          /^[A-Z]/.test(nextLine) // Starts with capital letter
        
        if (isLikelyChapter && !foundMarkers.some(m => Math.abs(m.lineIdx - i) < 10)) {
          foundMarkers.push({
            lineIdx: i,
            title: `Chapter ${num}`,
            type: 'chapter'
          })
          console.log(`  Found numbered: "${line}" -> "Chapter ${num}" at line ${i}`)
          expectedNum = num + 1
        }
      }
    }
  }
  
  // Sort by line index
  foundMarkers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Extract chapter content
  for (let i = 0; i < foundMarkers.length; i++) {
    const start = foundMarkers[i].lineIdx
    const end = i + 1 < foundMarkers.length ? foundMarkers[i + 1].lineIdx : lines.length
    
    // Get chapter text, skipping the title line
    const chapterLines = lines.slice(start + 1, end)
    const chapterText = chapterLines.join('\n').trim()
    
    // Only include if it has substantial content
    if (chapterText.length > 500) {
      chapters.push({
        idx: i,
        title: foundMarkers[i].title,
        text: chapterText,
      })
    }
  }
  
  return chapters
}

/**
 * Use AI to detect chapter boundaries
 */
async function detectChaptersWithAI(text: string): Promise<Chapter[]> {
  try {
    const openai = getOpenAI()
    
    // Sample text from different parts of the book
    const sampleSize = 3000
    const samples = [
      text.substring(0, sampleSize),
      text.substring(Math.floor(text.length * 0.25), Math.floor(text.length * 0.25) + sampleSize),
      text.substring(Math.floor(text.length * 0.5), Math.floor(text.length * 0.5) + sampleSize),
    ].join('\n\n...[text continues]...\n\n')
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a book chapter detection expert. Analyze the text and identify the EXACT chapter/section markers used in this book.

Return a JSON object with:
{
  "chapterPattern": "description of how chapters are marked (e.g., 'Chapter 1', 'CHAPTER ONE', just '1', 'Part One: Title')",
  "specialSections": ["list of special sections like Prologue, Epilogue"],
  "chapters": [
    {"marker": "exact text that marks chapter start", "title": "full chapter title"},
    ...
  ]
}

Important:
- Include ALL chapters/sections found
- Use EXACT text as it appears
- Include special sections (Prologue, Epilogue, etc.)
- Do NOT include page numbers as chapters`,
        },
        {
          role: 'user',
          content: `Analyze this book text and identify all chapter markers:\n\n${samples}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    console.log(`AI detected pattern: ${result.chapterPattern}`)
    console.log(`AI found ${result.chapters?.length || 0} chapters`)
    
    if (!result.chapters || result.chapters.length < 2) {
      return []
    }
    
    // Now find these markers in the actual text
    const chapters: Chapter[] = []
    const lines = text.split('\n')
    const markers: { lineIdx: number; title: string }[] = []
    
    for (const ch of result.chapters) {
      const markerText = ch.marker.toLowerCase().trim()
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim().toLowerCase()
        
        if (line === markerText || line.startsWith(markerText)) {
          // Avoid duplicates
          if (!markers.some(m => Math.abs(m.lineIdx - i) < 5)) {
            markers.push({
              lineIdx: i,
              title: ch.title || lines[i].trim(),
            })
            break
          }
        }
      }
    }
    
    markers.sort((a, b) => a.lineIdx - b.lineIdx)
    
    // Extract chapters
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].lineIdx + 1
      const end = i + 1 < markers.length ? markers[i + 1].lineIdx : lines.length
      const chapterText = lines.slice(start, end).join('\n').trim()
      
      if (chapterText.length > 500) {
        chapters.push({
          idx: i,
          title: markers[i].title,
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
 * Find chapters in page texts
 */
function findChaptersInPages(pageTexts: string[]): Chapter[] {
  const chapters: Chapter[] = []
  const chapterStarts: { pageIdx: number; title: string }[] = []
  
  // Look for chapter markers in each page
  for (let p = 0; p < pageTexts.length; p++) {
    const pageText = pageTexts[p].trim()
    const pageLines = pageText.split('\n')
    
    // Check first few lines of each page
    for (let l = 0; l < Math.min(5, pageLines.length); l++) {
      const line = pageLines[l].trim()
      
      // Chapter patterns
      const chapterMatch = line.match(/^chapter\s+(\d+|[a-z]+)(?:\s*[:\-–—]?\s*(.*))?$/i)
      const specialMatch = line.match(/^(prologue|epilogue|foreword|preface|introduction|afterword)(?:\s*[:\-–—]?\s*(.*))?$/i)
      const partMatch = line.match(/^part\s+(\d+|[a-z]+)(?:\s*[:\-–—]?\s*(.*))?$/i)
      
      if ((chapterMatch || specialMatch || partMatch) && line.length < 60) {
        console.log(`  Found chapter at page ${p + 1}: "${line}"`)
        chapterStarts.push({
          pageIdx: p,
          title: line,
        })
        break
      }
    }
  }
  
  // Extract chapter content
  for (let i = 0; i < chapterStarts.length; i++) {
    const startPage = chapterStarts[i].pageIdx
    const endPage = i + 1 < chapterStarts.length ? chapterStarts[i + 1].pageIdx : pageTexts.length
    
    const chapterText = pageTexts.slice(startPage, endPage).join('\n\n').trim()
    
    // Remove the chapter title from the start
    const titleLine = chapterStarts[i].title.toLowerCase()
    let cleanText = chapterText
    const firstLineEnd = chapterText.indexOf('\n')
    if (firstLineEnd > 0) {
      const firstLine = chapterText.substring(0, firstLineEnd).toLowerCase().trim()
      if (firstLine === titleLine || firstLine.includes(titleLine)) {
        cleanText = chapterText.substring(firstLineEnd + 1).trim()
      }
    }
    
    if (cleanText.length > 500) {
      chapters.push({
        idx: i,
        title: chapterStarts[i].title,
        text: cleanText,
      })
    }
  }
  
  return chapters
}

/**
 * Split text into chapters by estimated size (fallback)
 */
function splitBySize(text: string): Chapter[] {
  const chapters: Chapter[] = []
  const lines = text.split('\n')
  
  // Target ~5000 words per chapter (roughly 30,000 chars)
  const targetChapterSize = 30000
  const totalChars = text.length
  const estimatedChapters = Math.max(1, Math.ceil(totalChars / targetChapterSize))
  const charsPerChapter = Math.floor(totalChars / estimatedChapters)
  
  console.log(`Splitting ${totalChars} chars into ~${estimatedChapters} chapters`)
  
  let currentStart = 0
  let chapterIdx = 0
  
  while (currentStart < text.length) {
    let targetEnd = currentStart + charsPerChapter
    
    // Try to find a good break point (paragraph boundary)
    if (targetEnd < text.length) {
      // Look for double newline near target
      const searchStart = Math.max(currentStart, targetEnd - 2000)
      const searchEnd = Math.min(text.length, targetEnd + 2000)
      const searchText = text.substring(searchStart, searchEnd)
      
      const breakPoint = searchText.lastIndexOf('\n\n')
      if (breakPoint > 0) {
        targetEnd = searchStart + breakPoint
      }
    } else {
      targetEnd = text.length
    }
    
    const chapterText = text.substring(currentStart, targetEnd).trim()
    
    if (chapterText.length > 100) {
      chapters.push({
        idx: chapterIdx,
        title: `Part ${chapterIdx + 1}`,
        text: chapterText,
      })
      chapterIdx++
    }
    
    currentStart = targetEnd
  }
  
  return chapters
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
    console.log(`  ${i + 1}. "${ch.title}" (~${wordCount} words, ${ch.text.length} chars)`)
  })
  
  const coverage = (totalChars / fullText.length) * 100
  console.log(`\nCoverage: ${coverage.toFixed(1)}% (${totalChars}/${fullText.length} chars)`)
  
  if (coverage < 70) {
    console.warn(`WARNING: Low coverage. Returning full book as single chapter.`)
    return [{
      idx: 0,
      title: 'Full Book',
      text: fullText,
    }]
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
