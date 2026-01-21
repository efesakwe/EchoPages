import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ChapterSchema = z.object({
  idx: z.number(),
  title: z.string(),
  text: z.string(),
})

export type Chapter = z.infer<typeof ChapterSchema>

// Number words - expanded to 50
const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twentyone', 'twentytwo', 'twentythree', 'twentyfour', 'twentyfive',
  'twentysix', 'twentyseven', 'twentyeight', 'twentynine', 'thirty',
  'thirtyone', 'thirtytwo', 'thirtythree', 'thirtyfour', 'thirtyfive',
  'thirtysix', 'thirtyseven', 'thirtyeight', 'thirtynine', 'forty',
  'fortyone', 'fortytwo', 'fortythree', 'fortyfour', 'fortyfive',
  'fortysix', 'fortyseven', 'fortyeight', 'fortynine', 'fifty'
]

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
  
  // Debug: Show first 100 non-empty lines to understand document structure
  console.log('\n--- First 100 non-empty lines for debugging ---')
  let shown = 0
  for (let i = 0; i < lines.length && shown < 100; i++) {
    const line = lines[i].trim()
    if (line.length > 0) {
      console.log(`  [${i}] (${line.length} chars): "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`)
      shown++
    }
  }
  
  // Strategy 1: Try to find TOC with numbered entries (e.g., "1. CASEY")
  const tocEntries = findTOC(lines)
  if (tocEntries.length > 0) {
    console.log(`\nFound TOC with ${tocEntries.length} numbered entries`)
    const markersFromTOC = findMarkersFromTOC(lines, tocEntries)
    if (markersFromTOC.length >= 2) {
      console.log(`\nFound ${markersFromTOC.length} chapter markers from TOC`)
      const chapters = extractChapters(lines, markersFromTOC)
      if (chapters.length >= 2) {
        logResults(chapters, text)
        return chapters
      }
    }
  }
  
  // Strategy 2: Scan entire document for chapter markers
  console.log('\n--- Strategy 2: Scanning for standard chapter markers ---')
  const contentStart = findContentStart(lines)
  console.log(`Content starts at line: ${contentStart}`)
  const markers = scanForChapterMarkers(lines, contentStart)
  
  if (markers.length >= 2) {
    console.log(`\nFound ${markers.length} chapter markers`)
    const chapters = extractChapters(lines, markers)
    
    if (chapters.length >= 2) {
      logResults(chapters, text)
      return chapters
    }
  }
  
  // Strategy 3: Try topic-based TOC detection (e.g., "Goal #1: Be with Jesus", "Dust")
  console.log('\n--- Strategy 3: Trying topic-based chapter detection ---')
  const topicMarkers = findTopicBasedChapters(lines)
  if (topicMarkers.length >= 2) {
    console.log(`\nFound ${topicMarkers.length} topic-based chapter markers`)
    const chapters = extractChapters(lines, topicMarkers)
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
 * Find TOC and extract chapter entries
 */
function findTOC(lines: string[]): Array<{ number: number; name: string; title: string }> {
  const entries: Array<{ number: number; name: string; title: string }> = []
  let tocStart = -1
  let tocEnd = -1
  
  // Find TOC section
  for (let i = 0; i < Math.min(500, lines.length); i++) {
    const line = lines[i].trim().toLowerCase()
    if (line.includes('contents') || line.includes('table of contents')) {
      tocStart = i
      break
    }
  }
  
  if (tocStart === -1) return entries
  
  // Find where TOC ends (first long prose line)
  for (let i = tocStart + 1; i < Math.min(tocStart + 100, lines.length); i++) {
    const line = lines[i].trim()
    // TOC entries are typically short, prose is long
    if (line.length > 100 && !/^\d+\./.test(line)) {
      tocEnd = i
      break
    }
  }
  
  if (tocEnd === -1) tocEnd = Math.min(tocStart + 100, lines.length)
  
  // Extract entries from TOC
  for (let i = tocStart + 1; i < tocEnd; i++) {
    const line = lines[i].trim()
    
    // Pattern: "1. CASEY" or "1.  CASEY" or "1.CASEY" (number + period + optional space(s) + name)
    // Name can be uppercase letters with optional spaces
    const match = line.match(/^(\d{1,2})\.\s*([A-Z][A-Z\s]{1,30})$/i)
    if (match) {
      const number = parseInt(match[1])
      const name = match[2].trim().toUpperCase() // Normalize to uppercase
      entries.push({ number, name, title: `${number}. ${name}` })
      console.log(`  TOC Entry: ${number}. ${name}`)
    }
  }
  
  return entries
}

/**
 * Find chapter markers in the text based on TOC entries
 */
function findMarkersFromTOC(lines: string[], tocEntries: Array<{ number: number; name: string; title: string }>): { lineIdx: number; title: string; chapterNum: number }[] {
  const markers: { lineIdx: number; title: string; chapterNum: number }[] = []
  
  // Find where content starts (after TOC)
  const contentStart = findContentStart(lines)
  
  // Search for each TOC entry in the text
  // Track which lines have already been used to avoid duplicates
  const usedLineIndices = new Set<number>()
  
  for (const entry of tocEntries) {
    // Normalize name: escape special regex characters and handle spaces
    const escapedName = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    // Try to find the pattern in the text: "1. CASEY" or just "CASEY" on its own line
    // Pattern 1: "1. CASEY" (with number)
    const pattern1 = new RegExp(`^${entry.number}\\.\\s*${escapedName}$`, 'i')
    // Pattern 2: Just "CASEY" (name only, case-insensitive)
    const pattern2 = new RegExp(`^${escapedName}$`, 'i')
    
    let found = false
    
    // Search from content start, but skip already used lines
    for (let i = contentStart; i < lines.length && !found; i++) {
      // Skip if this line was already used as a marker
      if (usedLineIndices.has(i)) continue
      
      const line = lines[i].trim()
      
      // Skip if line is too long (not a chapter marker)
      if (line.length > 100) continue
      
      // Try exact match: "1. CASEY"
      if (pattern1.test(line)) {
        const nextLine = lines[i + 1]?.trim() || ''
        const nextNextLine = lines[i + 2]?.trim() || ''
        
        // Verify content follows
        const hasContent = nextLine.length > 30 || 
          (nextLine.length === 0 && nextNextLine.length > 30)
        
        if (hasContent) {
          markers.push({ lineIdx: i, title: entry.title, chapterNum: entry.number })
          usedLineIndices.add(i)
          console.log(`  Found marker for "${entry.title}" at line ${i}`)
          found = true
          break
        }
      }
      
      // Try name-only match: "CASEY" (only if name is reasonably short)
      if (!found && entry.name.length <= 20 && pattern2.test(line)) {
        const prevLine = lines[i - 1]?.trim() || ''
        const nextLine = lines[i + 1]?.trim() || ''
        const nextNextLine = lines[i + 2]?.trim() || ''
        
        // Should be preceded by empty/short line, followed by content
        const validContext = (prevLine.length === 0 || prevLine.length < 30) &&
          (nextLine.length > 30 || (nextLine.length === 0 && nextNextLine.length > 30))
        
        if (validContext) {
          markers.push({ lineIdx: i, title: entry.title, chapterNum: entry.number })
          usedLineIndices.add(i)
          console.log(`  Found marker for "${entry.title}" at line ${i} (name only)`)
          found = true
          break
        }
      }
    }
    
    if (!found) {
      console.warn(`  WARNING: Could not find marker for "${entry.title}" in the text`)
    }
  }
  
  // Sort by line index to get correct reading order
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Re-number sequentially (1, 2, 3...) based on order, but preserve the name
  // This ensures chapters are numbered sequentially even if TOC has gaps (e.g., 46, 47)
  let sequentialNum = 1
  for (const marker of markers) {
    // Extract the name from the title (e.g., "46. DYLAN" -> "DYLAN")
    const nameMatch = marker.title.match(/^\d+\.\s*(.+)$/)
    if (nameMatch) {
      const name = nameMatch[1].trim()
      const originalNum = marker.chapterNum
      marker.title = `${sequentialNum}. ${name}`
      marker.chapterNum = sequentialNum++
      console.log(`  Renumbered: ${originalNum}. ${name} -> ${marker.title}`)
    } else {
      // If no number in title, just add sequential number
      const originalTitle = marker.title
      marker.title = `${sequentialNum}. ${marker.title}`
      marker.chapterNum = sequentialNum++
      console.log(`  Renumbered: "${originalTitle}" -> ${marker.title}`)
    }
  }
  
  return markers
}

/**
 * Strategy 3: Find topic-based chapters by scanning the ENTIRE document
 * This handles books with themed/topic chapters like "Goal #1: Be with Jesus", "Dust"
 * Scans for chapter-like patterns in the main content, not just the TOC
 */
function findTopicBasedChapters(lines: string[]): { lineIdx: number; title: string; chapterNum: number }[] {
  const markers: { lineIdx: number; title: string; chapterNum: number }[] = []
  const contentStart = findContentStart(lines)
  
  console.log(`  Scanning document from line ${contentStart} for topic-based chapter patterns...`)
  
  // Chapter-like patterns to look for:
  const chapterPatterns = [
    // "Goal #1: ...", "Part 1: ...", "Section 2: ..."
    { regex: /^(Goal|Part|Section)\s*#?\d+\s*[:.]?\s*.*/i, name: 'Goal/Part/Section' },
    // Questions: "How? A Rule of Life"
    { regex: /^(How|What|Why|When|Where)\?\s*.*/i, name: 'Question' },
    // Single capitalized word (2-15 chars): "Dust", "Prologue"
    { regex: /^[A-Z][a-z]{1,14}$/, name: 'Single Word' },
    // Special sections
    { regex: /^(Prologue|Epilogue|Introduction|Conclusion|Preface|Foreword|Afterword|Appendix)$/i, name: 'Special Section' },
  ]
  
  // Additional pattern: Title case phrases (2-5 words) where first word is capitalized
  // and the phrase is short (under 50 chars)
  // Examples: "Apprentice to Jesus", "Be with Jesus", "A Rule of Life"
  
  for (let i = contentStart; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines and very long lines
    if (line.length === 0 || line.length > 60) continue
    
    // Skip lines that look like regular prose (too many words, ends with punctuation)
    const words = line.split(/\s+/)
    if (words.length > 6) continue
    if (/[.!,;]$/.test(line) && !/\?$/.test(line)) continue  // Allow questions
    
    // Skip lines that are clearly not chapter titles
    if (/^[a-z]/.test(line)) continue  // Starts lowercase
    if (line.startsWith('"') || line.startsWith('"') || line.startsWith("'")) continue  // Quoted
    if (/^\d+\.\s+[A-Z][a-z]/.test(line) && !/^(Goal|Part|Section)/i.test(line)) continue  // Numbered subsections like "1. To be..."
    
    // Check against chapter patterns
    let isChapterTitle = false
    let matchType = ''
    
    for (const pattern of chapterPatterns) {
      if (pattern.regex.test(line)) {
        isChapterTitle = true
        matchType = pattern.name
        break
      }
    }
    
    // Also check for title-case phrases (2-5 words, first word capitalized, reasonable length)
    if (!isChapterTitle && words.length >= 2 && words.length <= 5 && line.length <= 40) {
      const firstWordCap = /^[A-Z]/.test(words[0])
      const notAllLowerMiddle = words.slice(1, -1).some(w => /^[A-Z]/.test(w)) || words.length === 2
      
      if (firstWordCap && (notAllLowerMiddle || words.length <= 3)) {
        isChapterTitle = true
        matchType = 'Title Case'
      }
    }
    
    if (!isChapterTitle) continue
    
    // Verify context: should look like a chapter heading
    const prevLine = lines[i - 1]?.trim() || ''
    const prevPrevLine = lines[i - 2]?.trim() || ''
    const nextLine = lines[i + 1]?.trim() || ''
    const nextNextLine = lines[i + 2]?.trim() || ''
    
    // Good context indicators:
    // - Preceded by empty line or page break
    // - Followed by content (prose text)
    const goodPrev = prevLine.length === 0 || prevLine.length < 20 || 
                     (prevPrevLine.length === 0 && prevLine.length < 40)
    const goodNext = nextLine.length > 30 || 
                     (nextLine.length === 0 && nextNextLine.length > 30) ||
                     (nextLine.length < 40 && nextNextLine.length > 30)
    
    if (goodPrev && goodNext) {
      // Check we haven't already found something too close (within 20 lines)
      const tooClose = markers.some(m => Math.abs(m.lineIdx - i) < 20)
      if (!tooClose) {
        markers.push({ lineIdx: i, title: line, chapterNum: markers.length + 1 })
        console.log(`  Found topic chapter (${matchType}): "${line}" at line ${i}`)
      }
    }
  }
  
  // Sort by line index and re-number
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  let num = 1
  for (const marker of markers) {
    marker.chapterNum = num
    marker.title = `${num}. ${marker.title}`
    num++
  }
  
  console.log(`  Found ${markers.length} topic-based chapters`)
  return markers
}

/**
 * Find where actual book content starts (skip TOC, title pages, etc.)
 */
function findContentStart(lines: string[]): number {
  // Look for first line of actual prose (long line after short lines)
  for (let i = 0; i < Math.min(300, lines.length); i++) {
    const line = lines[i].trim()
    
    // If we find a long prose line after some short lines, content has started
    if (line.length > 100) {
      // Check if previous lines are short (indicates we're past TOC)
      let shortCount = 0
      for (let j = Math.max(0, i - 10); j < i; j++) {
        if (lines[j].trim().length < 50) shortCount++
      }
      if (shortCount > 5) {
        return Math.max(0, i - 5) // Start a few lines before
      }
    }
  }
  return 30 // Default - skip first 30 lines
}

/**
 * Scan for chapter markers
 */
function scanForChapterMarkers(lines: string[], startLine: number): { lineIdx: number; title: string; chapterNum: number }[] {
  const markers: { lineIdx: number; title: string; chapterNum: number }[] = []
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines, but allow longer lines for numbered names (up to 100 chars)
    if (line.length === 0) continue
    
    // Allow longer lines if they match numbered name pattern
    const isNumberedName = /^\d{1,2}\.\s*[A-Za-z]/.test(line)
    if (line.length > 100 && !isNumberedName) continue
    
    // Normalize: remove spaces and hyphens, convert to lowercase
    const normalized = line.replace(/\s+/g, '').replace(/-/g, '').toLowerCase()
    
    // Check for PROLOGUE/EPILOGUE (with or without spaces)
    if (normalized === 'prologue') {
      markers.push({ lineIdx: i, title: 'Prologue', chapterNum: 0 })
      console.log(`  Found: Prologue at line ${i} ("${line}")`)
      continue
    }
    if (normalized === 'epilogue') {
      markers.push({ lineIdx: i, title: 'Epilogue', chapterNum: 999 })
      console.log(`  Found: Epilogue at line ${i}`)
      continue
    }
    if (normalized === 'acknowledgments' || normalized === 'acknowledgements') {
      markers.push({ lineIdx: i, title: 'Acknowledgments', chapterNum: 1000 })
      console.log(`  Found: Acknowledgments at line ${i}`)
      continue
    }
    
    // Check for number words (ONE, TWO, etc. - with or without spaces)
    const wordIndex = NUMBER_WORDS.indexOf(normalized)
    if (wordIndex >= 0) {
      const chapterNum = wordIndex + 1
      // Verify the next line looks like content start (not another short line)
      const nextLine = lines[i + 1]?.trim() || ''
      const nextNextLine = lines[i + 2]?.trim() || ''
      
      // Next line should be content OR empty (then content after)
      const looksLikeChapterStart = 
        nextLine.length > 30 || // Actual content
        (nextLine.length === 0 && nextNextLine.length > 30) || // Empty then content
        (nextLine.length < 30 && nextLine.length > 0 && nextNextLine.length > 30) // Subtitle then content
      
      if (looksLikeChapterStart) {
        markers.push({ lineIdx: i, title: `Chapter ${chapterNum}`, chapterNum })
        console.log(`  Found: Chapter ${chapterNum} ("${line}") at line ${i}`)
      }
      continue
    }
    
    // Check for "Chapter X" format
    const chapterMatch = line.match(/^chapter\s+(\d+)/i)
    if (chapterMatch) {
      const chapterNum = parseInt(chapterMatch[1])
      markers.push({ lineIdx: i, title: line, chapterNum })
      console.log(`  Found: ${line} at line ${i}`)
      continue
    }
    
    // Check for standalone digits (1, 2, 3...)
    if (/^\d{1,2}$/.test(line)) {
      const num = parseInt(line)
      const nextLine = lines[i + 1]?.trim() || ''
      // Must be followed by content, not another number
      if (nextLine.length > 20 && !/^\d{1,2}$/.test(nextLine)) {
        markers.push({ lineIdx: i, title: `Chapter ${num}`, chapterNum: num })
        console.log(`  Found: Chapter ${num} (digit) at line ${i}`)
      }
    }
    
    // Check for "1. NAME" or "1. CHARACTERNAME" format (numbered POV chapters)
    // Pattern: number + period + space + word(s)
    const numberedNameMatch = line.match(/^(\d{1,2})\.\s*([A-Za-z][A-Za-z\s]+)$/i)
    if (numberedNameMatch) {
      const num = parseInt(numberedNameMatch[1])
      const name = numberedNameMatch[2].trim()
      const nextLine = lines[i + 1]?.trim() || ''
      const nextNextLine = lines[i + 2]?.trim() || ''
      const nextNextNextLine = lines[i + 3]?.trim() || ''
      
      // Check if we're still in TOC (multiple consecutive numbered entries)
      // Look at next 3 lines - if 2+ are also numbered entries, we're likely in TOC
      let numberedEntryCount = 0
      for (let j = 1; j <= 3; j++) {
        const checkLine = lines[i + j]?.trim() || ''
        if (/^\d{1,2}\.\s*[A-Za-z]/.test(checkLine)) {
          numberedEntryCount++
        }
      }
      const isInTOC = numberedEntryCount >= 2
      
      if (!isInTOC) {
        // Check if content follows (prose text, not more TOC entries)
        const hasContent = nextLine.length > 40 || 
          (nextLine.length === 0 && nextNextLine.length > 40) ||
          (nextLine.length < 30 && nextNextLine.length > 40 && nextNextNextLine.length > 40)
        
        if (hasContent) {
          markers.push({ lineIdx: i, title: `${num}. ${name}`, chapterNum: num })
          console.log(`  Found: ${num}. ${name} (numbered name) at line ${i}`)
        }
      } else {
        console.log(`  Skipped: ${num}. ${name} at line ${i} (likely TOC entry)`)
      }
    }
    
    // Check for just "NAME" in all caps on its own line (POV chapters without numbers)
    // Only if it's a short line (2-20 chars) and all caps
    if (/^[A-Z]{2,20}$/.test(line) && !['PROLOGUE', 'EPILOGUE', 'CONTENTS', 'CHAPTER', 'PART', 'THE', 'AND', 'BUT'].includes(line)) {
      const nextLine = lines[i + 1]?.trim() || ''
      const nextNextLine = lines[i + 2]?.trim() || ''
      const prevLine = lines[i - 1]?.trim() || ''
      
      // Should be preceded by empty line or short line, followed by content
      const validContext = (prevLine.length === 0 || prevLine.length < 30) &&
        (nextLine.length > 40 || (nextLine.length === 0 && nextNextLine.length > 40))
      
      if (validContext) {
        markers.push({ lineIdx: i, title: line, chapterNum: markers.length + 1 })
        console.log(`  Found: ${line} (character name) at line ${i}`)
      }
    }
  }
  
  // Sort by line index to get correct order
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Re-assign chapter numbers based on order (Prologue=0, then 1,2,3...)
  // But preserve original titles for named chapters (like "1. CASEY")
  let chapterCounter = 1
  for (const marker of markers) {
    if (marker.title === 'Prologue') {
      marker.chapterNum = 0
    } else if (marker.title === 'Epilogue') {
      marker.chapterNum = 998
    } else if (marker.title === 'Acknowledgments') {
      marker.chapterNum = 999
    } else {
      // Check if title already has a meaningful name (like "1. CASEY" or just "CASEY")
      const hasNamedFormat = /^\d+\.\s*[A-Za-z]/.test(marker.title) || /^[A-Z]{2,}$/.test(marker.title)
      
      if (hasNamedFormat) {
        // Preserve the original title but update the chapter number for ordering
        marker.chapterNum = chapterCounter++
        // If it's just a name without number, prefix with the number
        if (/^[A-Z]{2,}$/.test(marker.title)) {
          marker.title = `${marker.chapterNum}. ${marker.title}`
        }
      } else {
        marker.chapterNum = chapterCounter++
        marker.title = `Chapter ${marker.chapterNum}`
      }
    }
  }
  
  return markers
}

/**
 * Extract chapter content between markers
 */
function extractChapters(lines: string[], markers: { lineIdx: number; title: string; chapterNum: number }[]): Chapter[] {
  const chapters: Chapter[] = []
  
  if (markers.length === 0) {
    console.error('No markers provided for extraction')
    return chapters
  }
  
  console.log(`\nExtracting content for ${markers.length} chapters...`)
  
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    const next = markers[i + 1]
    
    const startLine = current.lineIdx + 1
    let endLine = next ? next.lineIdx : lines.length
    
    // Check for suspiciously large chapters BEFORE extraction
    const lineRange = endLine - startLine
    const avgWordsPerLine = 50 // Rough estimate
    const estimatedWords = lineRange * avgWordsPerLine
    
    // If estimated size exceeds 10k words, search for missing markers first
    if (estimatedWords > 10000 && !next) {
      // This is likely the last chapter, search for missing markers
      console.warn(`    WARNING: Chapter "${current.title}" estimated to be very large (${estimatedWords} words). Searching for missing markers...`)
      
      const maxSearchLines = Math.min(lines.length, startLine + 500) // Search up to 500 lines ahead
      for (let searchLine = startLine + 50; searchLine < maxSearchLines; searchLine++) {
        const line = lines[searchLine]?.trim() || ''
        
        // Check for numbered name pattern: "N. NAME"
        const numberedNameMatch = line.match(/^(\d{1,2})\.\s*([A-Za-z][A-Za-z\s]+)$/i)
        if (numberedNameMatch) {
          const num = parseInt(numberedNameMatch[1])
          const name = numberedNameMatch[2].trim()
          const nextLine = lines[searchLine + 1]?.trim() || ''
          const nextNextLine = lines[searchLine + 2]?.trim() || ''
          
          const hasContent = nextLine.length > 30 || 
            (nextLine.length === 0 && nextNextLine.length > 30)
          
          if (hasContent) {
            endLine = searchLine
            console.warn(`    Found missing chapter marker at line ${searchLine}: "${num}. ${name}" - truncating at this point`)
            break
          }
        }
        
        // Also check for standalone character names
        if (/^[A-Z]{2,20}$/.test(line) && !['PROLOGUE', 'EPILOGUE', 'CONTENTS', 'CHAPTER', 'PART'].includes(line)) {
          const prevLine = lines[searchLine - 1]?.trim() || ''
          const nextLine = lines[searchLine + 1]?.trim() || ''
          const nextNextLine = lines[searchLine + 2]?.trim() || ''
          
          const validContext = (prevLine.length === 0 || prevLine.length < 30) &&
            (nextLine.length > 40 || (nextLine.length === 0 && nextNextLine.length > 40))
          
          if (validContext) {
            endLine = searchLine
            console.warn(`    Found missing chapter marker at line ${searchLine}: "${line}" - truncating at this point`)
            break
          }
        }
      }
    }
    
    // Get content, filter out watermarks
    const contentLines = lines.slice(startLine, endLine).filter(line => {
      const trimmed = line.trim().toLowerCase()
      return !trimmed.includes('oceanofpdf') && line.trim().length > 0
    })
    
    let content = contentLines.join('\n').trim()
    let wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    
    // Log chapter extraction details
    console.log(`  Chapter ${i + 1} "${current.title}":`)
    console.log(`    Lines: ${startLine}-${endLine} (${lineRange} lines)`)
    console.log(`    Words: ${wordCount}`)
    
    // If chapter still exceeds 10k words after early marker detection, truncate at word boundary
    if (wordCount >= 10000) {
      console.warn(`    WARNING: Chapter "${current.title}" still exceeds 10k words (${wordCount} words) after marker search. Truncating...`)
      
      // Estimate characters per word (roughly 5-6 chars per word)
      const avgCharsPerWord = 5.5
      const maxChars = 9500 * avgCharsPerWord // Target ~9.5k words to be safe
      const truncatedContent = content.substring(0, maxChars)
      
      // Try to cut at a sentence or paragraph boundary for clean truncation
      const lastPeriod = truncatedContent.lastIndexOf('.')
      const lastNewline = truncatedContent.lastIndexOf('\n\n')
      const lastSingleNewline = truncatedContent.lastIndexOf('\n')
      
      // Prefer paragraph break, then sentence, then line break
      let cutPoint = Math.max(lastNewline, lastPeriod, lastSingleNewline)
      
      // Ensure we're cutting at a reasonable point (at least 90% of target)
      if (cutPoint < maxChars * 0.9) {
        cutPoint = Math.floor(maxChars * 0.95) // Use 95% as fallback
      }
      
      content = truncatedContent.substring(0, cutPoint + 1).trim()
      wordCount = content.split(/\s+/).filter(w => w.length > 0).length
      console.warn(`    Truncated chapter to ${wordCount} words (cut at character ${cutPoint})`)
    }
    
    // Enforce strict 10k word limit (no chapter should have more than 10k words)
    if (wordCount > 50 && wordCount < 10000) {
      chapters.push({
        idx: chapters.length,
        title: current.title,
        text: content,
      })
    } else if (wordCount >= 10000) {
      console.error(`    ERROR: Chapter "${current.title}" exceeds 10k word limit (${wordCount} words). Skipping to prevent oversized chapters.`)
    } else {
      console.warn(`    WARNING: Chapter "${current.title}" is too short (${wordCount} words), skipping.`)
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

/**
 * Sanitize text for PostgreSQL storage
 * Removes null bytes and other problematic Unicode characters
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')  // Remove null bytes
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')  // Remove control chars
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
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
        title: sanitizeText(chapter.title),
        text_content: sanitizeText(chapter.text),
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
