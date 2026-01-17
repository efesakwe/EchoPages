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
 * Use AI to parse Table of Contents more accurately
 */
async function parseTOCWithAI(text: string): Promise<TOCEntry[]> {
  try {
    // Extract first 5000 chars which typically contains TOC
    const tocSample = text.substring(0, Math.min(5000, text.length))
    
    console.log('Using AI to parse Table of Contents...')
    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a book parsing expert. Extract the complete Table of Contents (TOC) from the text. 
          Identify ALL entries including Prologue, Foreword, Preface, Chapter 1, Chapter 2, Epilogue, etc.
          Return a JSON object with an "entries" array. Each entry should have:
          - "title": The EXACT title as it appears in TOC (e.g., "Chapter 1", "Prologue", "Chapter 2: The Journey Begins")
          - "type": "special" (for Prologue, Foreword, Preface, Epilogue), "chapter" (for numbered chapters), or "part"
          - "chapterNum": The chapter number if it's a chapter (null for special sections)
          
          IMPORTANT: 
          - Preserve the EXACT title format from TOC
          - Extract ALL entries in order
          - Do NOT modify or shorten titles
          - Include chapter numbers in titles (e.g., "Chapter 1", not just "1")`,
        },
        {
          role: 'user',
          content: `Extract the complete Table of Contents from this text:\n\n${tocSample}\n\nReturn JSON with format: {"entries": [{"title": "Prologue", "type": "special", "chapterNum": null}, {"title": "Chapter 1", "type": "chapter", "chapterNum": 1}, ...]}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    const entries = result.entries || []
    
    console.log(`AI parsed ${entries.length} TOC entries`)
    entries.forEach((e: TOCEntry, i: number) => {
      console.log(`  ${i + 1}. ${e.title} (${e.type}, num: ${e.chapterNum})`)
    })
    
    return entries
  } catch (error) {
    console.error('AI TOC parsing failed:', error)
    return []
  }
}

/**
 * Find chapter locations using page-based extraction
 * Handles cases where chapter numbers are on separate pages
 */
function findChapterLocationsWithPages(
  lines: string[],
  pageTexts: string[],
  tocEntries: TOCEntry[]
): { title: string; pageIdx: number; lineIdx: number; startPage: number }[] {
  const locations: { title: string; pageIdx: number; lineIdx: number; startPage: number }[] = []
  
  console.log(`\n--- Finding chapters using TOC and page-based search ---`)
  console.log(`Looking for ${tocEntries.length} chapters/sections`)
  
  // Map page texts to line indices (approximate)
  const pageLineMap: number[] = []
  let currentLine = 0
  for (let p = 0; p < pageTexts.length; p++) {
    pageLineMap[p] = currentLine
    const pageLines = pageTexts[p].split('\n').length
    currentLine += pageLines
  }
  
  for (const entry of tocEntries) {
    let found = false
    const searchTitle = entry.title.toLowerCase()
    
    // Search through pages first (more reliable for chapter title pages)
    for (let pageIdx = 0; pageIdx < pageTexts.length; pageIdx++) {
      const pageText = pageTexts[pageIdx].toLowerCase()
      const pageLines = pageTexts[pageIdx].split('\n')
      
      // Check if this page contains the chapter marker
      let matchLine = -1
      let isChapterTitlePage = false
      
      // Check if entire page is just the chapter title (common pattern)
      const pageTrimmed = pageText.trim()
      if (pageTrimmed.length < 200 && (
        pageTrimmed.includes(searchTitle) ||
        (entry.chapterNum !== null && pageTrimmed.includes(`chapter ${entry.chapterNum}`)) ||
        (entry.chapterNum !== null && pageTrimmed === entry.chapterNum.toString())
      )) {
        isChapterTitlePage = true
        matchLine = pageLineMap[pageIdx]
        console.log(`  Found "${entry.title}" as standalone page ${pageIdx + 1} (chapter title page)`)
      } else {
        // Check lines in this page
        for (let lineIdx = 0; lineIdx < pageLines.length; lineIdx++) {
          const line = pageLines[lineIdx].trim().toLowerCase()
          
          // Match chapter markers
          let matches = false
          if (entry.type === 'special') {
            const keyword = entry.title.split(/\s/)[0].toLowerCase()
            matches = line === keyword || line.startsWith(keyword + ' ') || line === searchTitle
          } else if (entry.chapterNum !== null) {
            matches = 
              line === `chapter ${entry.chapterNum}` ||
              line.startsWith(`chapter ${entry.chapterNum} `) ||
              line === entry.chapterNum.toString() ||
              line === entry.chapterNum.toString() + '.' ||
              (line.includes(searchTitle) && entry.title.length > 5)
          }
          
          if (matches && line.length < 100) {
            matchLine = pageLineMap[pageIdx] + lineIdx
            console.log(`  Found "${entry.title}" at page ${pageIdx + 1}, line ${matchLine}`)
            break
          }
        }
      }
      
      if (matchLine >= 0) {
        // Determine the actual start page for content
        // If it's a chapter title page, content starts on next page
        // Otherwise, content might start a few lines later on same page
        const startPage = isChapterTitlePage ? pageIdx + 1 : pageIdx
        
        // Use the TOC title, not the found line
        locations.push({
          title: entry.title, // Always use TOC title
          pageIdx: startPage,
          lineIdx: matchLine,
          startPage,
        })
        console.log(`  ✓ Located "${entry.title}" → content starts at page ${startPage + 1}`)
        found = true
        break
      }
    }
    
    if (!found) {
      // Fallback: search in full text lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim().toLowerCase()
        if (line.includes(searchTitle) && line.length < 100) {
          // Find which page this line is in
          let pageNum = 0
          for (let p = 0; p < pageLineMap.length; p++) {
            if (i >= pageLineMap[p]) {
              pageNum = p
            } else {
              break
            }
          }
          
          locations.push({
            title: entry.title,
            pageIdx: pageNum,
            lineIdx: i,
            startPage: pageNum,
          })
          console.log(`  Found "${entry.title}" in text at page ${pageNum + 1}, line ${i}`)
          found = true
          break
        }
      }
    }
    
    if (!found) {
      console.warn(`  WARNING: Could not find "${entry.title}"`)
    }
  }
  
  return locations.sort((a, b) => a.pageIdx - b.pageIdx)
}

/**
 * Extract chapters using page-based extraction
 */
function extractChaptersFromPages(
  pageTexts: string[],
  locations: { title: string; pageIdx: number; lineIdx: number; startPage: number }[]
): Chapter[] {
  const chapters: Chapter[] = []
  
  console.log(`\n--- Extracting chapters from pages ---`)
  
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    const nextLoc = i + 1 < locations.length ? locations[i + 1] : null
    
    // Extract pages for this chapter
    const startPage = Math.max(0, loc.startPage)
    const endPage = nextLoc ? Math.max(startPage + 1, nextLoc.startPage) : pageTexts.length
    
    // Ensure we have valid page range
    if (startPage >= pageTexts.length) {
      console.warn(`  WARNING: Start page ${startPage + 1} is beyond PDF (${pageTexts.length} pages), skipping`)
      continue
    }
    
    // Get all text from startPage to endPage (inclusive)
    const chapterPages = pageTexts.slice(startPage, endPage)
    let chapterText = chapterPages.join('\n\n').trim()
    
    // If chapter is too short, it might be a title page - try next page
    if (chapterText.length < 500 && startPage + 1 < pageTexts.length) {
      console.log(`  Chapter "${loc.title}" is very short (${chapterText.length} chars), including next page`)
      chapterText = pageTexts.slice(startPage, Math.min(startPage + 2, pageTexts.length)).join('\n\n').trim()
    }
    
    // Clean up: remove chapter title/header if it's at the start
    let cleanedText = chapterText
    const titleLower = loc.title.toLowerCase()
    const firstFewLines = cleanedText.substring(0, 500).toLowerCase()
    
    // Remove title and any empty lines at start
    if (firstFewLines.includes(titleLower) || firstFewLines.length < 100) {
      const lines = cleanedText.split('\n')
      let skipLines = 0
      
      // Skip empty lines and title lines
      for (let j = 0; j < Math.min(10, lines.length); j++) {
        const lineLower = lines[j].toLowerCase().trim()
        if (lineLower.length === 0 || 
            lineLower === titleLower ||
            lineLower.includes(titleLower) ||
            lineLower.length < 3) {
          skipLines++
        } else {
          // Found actual content
          break
        }
      }
      
      if (skipLines > 0 && skipLines < lines.length) {
        cleanedText = lines.slice(skipLines).join('\n').trim()
      }
    }
    
    // Validate chapter has substantial content
    if (cleanedText.length < 100) {
      console.warn(`  WARNING: Chapter "${loc.title}" has very little content (${cleanedText.length} chars), may be extraction error`)
      // Try to get more content from surrounding pages
      if (startPage > 0 && startPage + 2 < pageTexts.length) {
        cleanedText = pageTexts.slice(Math.max(0, startPage - 1), Math.min(startPage + 3, pageTexts.length)).join('\n\n').trim()
        console.log(`  Retrying with expanded page range: ${cleanedText.length} chars`)
      }
    }
    
    if (cleanedText.length > 50) {
      chapters.push({
        idx: i,
        title: loc.title, // Use TOC title, not extracted title
        text: cleanedText,
      })
      const wordCount = cleanedText.split(/\s+/).length
      console.log(`  ✓ Chapter ${i + 1}: "${loc.title}" (pages ${startPage + 1}-${endPage}, ${cleanedText.length} chars, ~${wordCount} words)`)
    } else {
      console.error(`  ✗ Chapter "${loc.title}" has insufficient content (${cleanedText.length} chars), skipping`)
    }
  }
  
  return chapters
}

/**
 * Main: Detect and extract chapters using AI and page-based extraction
 */
export async function detectChapters(
  text: string,
  pageTexts?: string[]
): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  console.log(`Pages available: ${pageTexts ? pageTexts.length : 'No'}`)
  
  const lines = text.split('\n')
  
  // Step 1: Parse TOC using AI
  console.log('\n--- Step 1: Parsing Table of Contents with AI ---')
  let tocEntries = await parseTOCWithAI(text)
  
  // Fallback to simple TOC parsing if AI fails
  if (tocEntries.length < 2) {
    console.log('AI TOC parsing found few entries, trying simple parsing...')
    tocEntries = parseTOCSimple(lines)
  }
  
  // Store TOC entries for validation later
  const allTOCEntries = [...tocEntries]
  
  if (tocEntries.length === 0) {
    console.warn('No TOC entries found, trying direct chapter scan...')
    return scanForChaptersDirect(lines, pageTexts)
  }
  
  console.log(`Found ${tocEntries.length} TOC entries to locate`)
  
  // Step 2: Find chapter locations
  let locations: { title: string; pageIdx: number; lineIdx: number; startPage: number }[]
  
  if (pageTexts && pageTexts.length > 0) {
    console.log('\n--- Step 2: Finding chapters using page-based search ---')
    locations = findChapterLocationsWithPages(lines, pageTexts, tocEntries)
  } else {
    console.log('\n--- Step 2: Finding chapters using text search ---')
    locations = findChapterLocationsInText(lines, tocEntries)
  }
  
  if (locations.length === 0) {
    console.warn('No chapter locations found, trying direct scan...')
    return scanForChaptersDirect(lines, pageTexts)
  }
  
  console.log(`Found ${locations.length} chapter locations`)
  
  // Step 3: Extract chapters
  let chapters: Chapter[]
  
  if (pageTexts && pageTexts.length > 0 && locations[0]?.pageIdx !== undefined) {
    console.log('\n--- Step 3: Extracting chapters from pages ---')
    chapters = extractChaptersFromPages(pageTexts, locations)
  } else {
    console.log('\n--- Step 3: Extracting chapters from text ---')
    chapters = extractChaptersFromText(lines, locations)
  }
  
  // Validation and cleanup
  if (chapters.length === 0) {
    console.warn('No chapters extracted, using full book')
    return [{ idx: 0, title: 'Full Book', text }]
  }
  
  // Validate chapters - check for suspicious titles (page numbers)
  const validatedChapters: Chapter[] = []
  for (const ch of chapters) {
    // Check if title looks like a page number (e.g., "15. 14", "41. 40")
    const pageNumPattern = /^\d+\.\s*\d+$/
    if (pageNumPattern.test(ch.title.trim())) {
      console.warn(`  WARNING: Chapter title "${ch.title}" looks like a page number, using TOC entry instead`)
      // Try to find matching TOC entry
      const tocMatch = allTOCEntries.find(e => 
        ch.text.toLowerCase().includes(e.title.toLowerCase()) ||
        e.title.toLowerCase().includes(ch.title.toLowerCase())
      )
      if (tocMatch) {
        ch.title = tocMatch.title
        console.log(`  Fixed title to: "${ch.title}"`)
      } else {
        ch.title = `Chapter ${ch.idx + 1}`
        console.log(`  Using default title: "${ch.title}"`)
      }
    }
    
    // Check for very short chapters (might be extraction error)
    if (ch.text.length < 200 && validatedChapters.length > 0) {
      console.warn(`  WARNING: Chapter "${ch.title}" is very short (${ch.text.length} chars), may be incomplete`)
      // Try to merge with previous chapter if it's suspiciously short
      if (validatedChapters.length > 0) {
        const prevChapter = validatedChapters[validatedChapters.length - 1]
        if (prevChapter.text.length < 50000) { // Only merge if previous isn't huge
          prevChapter.text += '\n\n' + ch.text
          prevChapter.title = `${prevChapter.title} (continued)`
          console.log(`  Merged short chapter into previous chapter`)
          continue
        }
      }
    }
    
    validatedChapters.push(ch)
  }
  
  console.log(`\n========== EXTRACTION COMPLETE ==========`)
  console.log(`Extracted ${validatedChapters.length} chapters:`)
  validatedChapters.forEach((ch, i) => {
    const wordCount = ch.text.split(/\s+/).length
    console.log(`  ${i + 1}. "${ch.title}" (${ch.text.length} chars, ~${wordCount} words)`)
  })
  
  // Verify coverage
  const totalExtracted = validatedChapters.reduce((sum, ch) => sum + ch.text.length, 0)
  const coverage = (totalExtracted / text.length) * 100
  console.log(`Coverage: ${coverage.toFixed(1)}% (${totalExtracted}/${text.length} chars)`)
  
  if (coverage < 80) {
    console.warn(`WARNING: Low coverage (${coverage.toFixed(1)}%). Some text may be missing.`)
  }
  
  return validatedChapters
}

/**
 * Simple TOC parsing (fallback)
 */
function parseTOCSimple(lines: string[]): TOCEntry[] {
  const entries: TOCEntry[] = []
  let tocStart = -1
  
  for (let i = 0; i < Math.min(300, lines.length); i++) {
    const lower = lines[i].trim().toLowerCase()
    if (lower === 'contents' || lower === 'table of contents') {
      tocStart = i + 1
      break
    }
  }
  
  if (tocStart === -1) return []
  
  for (let i = tocStart; i < Math.min(tocStart + 150, lines.length); i++) {
    const line = lines[i].trim()
    if (line.length === 0 || line.length > 120) continue
    
    const cleaned = line.replace(/[\s.·…_\-]+\d+\s*$/, '').trim()
    if (cleaned.length === 0) continue
    
    const specialMatch = cleaned.match(/^(foreword|preface|prologue|epilogue|introduction|afterword)/i)
    if (specialMatch) {
      entries.push({ title: cleaned, type: 'special', chapterNum: null })
      continue
    }
    
    const chapterMatch = cleaned.match(/^chapter\s+(\d+)/i)
    if (chapterMatch) {
      entries.push({ title: cleaned, type: 'chapter', chapterNum: parseInt(chapterMatch[1]) })
      continue
    }
    
    const numMatch = cleaned.match(/^(\d{1,2})(?:\s|$|\.|\:)/)
    if (numMatch) {
      entries.push({ title: cleaned, type: 'chapter', chapterNum: parseInt(numMatch[1]) })
    }
  }
  
  return entries
}

/**
 * Find chapter locations in text (fallback when pages not available)
 */
function findChapterLocationsInText(
  lines: string[],
  tocEntries: TOCEntry[]
): { title: string; pageIdx: number; lineIdx: number; startPage: number }[] {
  const locations: { title: string; pageIdx: number; lineIdx: number; startPage: number }[] = []
  let searchFrom = 50
  
  for (const entry of tocEntries) {
    const searchTitle = entry.title.toLowerCase()
    
    for (let i = searchFrom; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase()
      
      let matches = false
      if (entry.type === 'special') {
        const keyword = entry.title.split(/\s/)[0].toLowerCase()
        matches = line === keyword || line.startsWith(keyword + ' ')
      } else if (entry.chapterNum !== null) {
        matches = 
          line === `chapter ${entry.chapterNum}` ||
          line.startsWith(`chapter ${entry.chapterNum} `) ||
          line === entry.chapterNum.toString()
      }
      
      if (matches && line.length < 100) {
        locations.push({
          title: entry.title,
          pageIdx: 0,
          lineIdx: i,
          startPage: 0,
        })
        searchFrom = i + 20
        break
      }
    }
  }
  
  return locations
}

/**
 * Extract chapters from text (fallback)
 */
function extractChaptersFromText(
  lines: string[],
  locations: { title: string; pageIdx: number; lineIdx: number; startPage: number }[]
): Chapter[] {
  const chapters: Chapter[] = []
  
  for (let i = 0; i < locations.length; i++) {
    const start = locations[i].lineIdx
    const end = i + 1 < locations.length ? locations[i + 1].lineIdx : lines.length
    const chapterText = lines.slice(start, end).join('\n').trim()
    
    if (chapterText.length > 100) {
      chapters.push({
        idx: i,
        title: locations[i].title,
        text: chapterText,
      })
    }
  }
  
  return chapters
}

/**
 * Direct chapter scan (last resort)
 */
function scanForChaptersDirect(
  lines: string[],
  pageTexts?: string[]
): Chapter[] {
  console.log('Scanning directly for chapter markers...')
  const markers: { title: string; lineIdx: number }[] = []
  let expectedNum = 1
  
  for (let i = 30; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length === 0 || line.length > 80) continue
    
    const prevEmpty = i > 0 && lines[i - 1].trim().length < 5
    
    const chapterMatch = line.match(/^chapter\s+(\d+)/i)
    if (chapterMatch && prevEmpty) {
      const num = parseInt(chapterMatch[1])
      if (num === expectedNum) {
        markers.push({ title: line, lineIdx: i })
        expectedNum++
      }
    }
  }
  
  if (markers.length === 0) {
    return [{ idx: 0, title: 'Full Book', text: lines.join('\n') }]
  }
  
  const chapters: Chapter[] = []
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].lineIdx
    const end = i + 1 < markers.length ? markers[i + 1].lineIdx : lines.length
    const chapterText = lines.slice(start, end).join('\n').trim()
    
    if (chapterText.length > 100) {
      chapters.push({
        idx: i,
        title: markers[i].title,
        text: chapterText,
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
