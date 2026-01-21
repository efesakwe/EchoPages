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
  
  // Strategy 1: Try to find TOC and extract chapter names from it
  const tocEntries = findTOC(lines)
  if (tocEntries.length > 0) {
    console.log(`\nFound TOC with ${tocEntries.length} entries`)
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
  console.log('\n--- Scanning entire document for chapter markers ---')
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
  
  console.log('WARNING: Could not detect chapters, returning full book')
  return [{
    idx: 0,
    title: 'Full Book',
    text: text,
  }]
}

/**
 * Find TOC and extract chapter entries
* Supports multiple TOC styles:
 * 1. Numbered POV: "1. CASEY", "2. DYLAN" (all caps character names)
 * 2. Topic-based: "Dust", "Apprentice to Jesus", "Goal #1: Be with Jesus"
 */
function findTOC(lines: string[]): Array<{ number: number; name: string; title: string }> {
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
  
  if (tocStart === -1) return []
  
  // Find where TOC ends (first long prose line)
  for (let i = tocStart + 1; i < Math.min(tocStart + 200, lines.length); i++) {
    const line = lines[i].trim()
    if (line.length > 120 && !/^\d+\./.test(line)) {
      tocEnd = i
      break
    }
  }
  
  if (tocEnd === -1) tocEnd = Math.min(tocStart + 200, lines.length)
  
  console.log(`  TOC found at lines ${tocStart}-${tocEnd}`)
  
  // Collect all TOC lines for analysis
  const tocLines: string[] = []
  for (let i = tocStart + 1; i < tocEnd; i++) {
    const line = lines[i].trim()
    if (line.length > 0) {
      tocLines.push(line)
    }
  }
  
  // Detect TOC style by looking for patterns
  // Style 1: Numbered POV chapters "1. CASEY" (character name in CAPS after number)
  // Style 2: Topic-based "Goal #1:", "Dust", "Apprentice to Jesus"
  
  let hasNumberedPOV = false  // "1. CASEY" style
  let hasTopicBased = false   // "Goal #1:", "Dust" style
  
  for (const line of tocLines) {
    // Check for numbered POV: "1. CASEY" (number + ALL CAPS name, 1-2 words)
    if (/^\d{1,2}\.\s*[A-Z]{2,}(\s+[A-Z]{2,})?$/.test(line)) {
      hasNumberedPOV = true
    }
    // Check for topic-based: "Goal #1:", "Part 1:", single capitalized word
    if (/^(Goal|Part|Section)\s*#?\d+/i.test(line) || 
        /^[A-Z][a-z]+$/.test(line) ||  // Single capitalized word like "Dust"
        /^How\?|^What\?|^Why\?/i.test(line)) {
      hasTopicBased = true
    }
  }
  
  console.log(`  TOC style detection: numberedPOV=${hasNumberedPOV}, topicBased=${hasTopicBased}`)
  
  // If topic-based patterns found, use topic-based detection (even if some numbered items exist)
  // This prevents picking up numbered subsections like "1. To be with your rabbi"
  if (hasTopicBased) {
    console.log('  Using topic-based detection (found Goal/Part/single-word patterns)...')
    return findTopicBasedTOC(lines, tocStart, tocEnd)
  }
  
  // Otherwise, try numbered POV format: "1. CASEY"
  const entries: Array<{ number: number; name: string; title: string }> = []
  for (let i = tocStart + 1; i < tocEnd; i++) {
    const line = lines[i].trim()
    // Only match: number + period + ALL CAPS name (1-3 words)
    const match = line.match(/^(\d{1,2})\.\s*([A-Z]{2,}(?:\s+[A-Z]{2,}){0,2})$/)
    if (match) {
      const number = parseInt(match[1])
      const name = match[2].trim()
      entries.push({ number, name, title: `${number}. ${name}` })
      console.log(`  TOC Entry (numbered POV): ${number}. ${name}`)
    }
  }
  
  if (entries.length >= 2) {
    return entries
  }
  
  // Fallback to topic-based if numbered didn't work
  console.log('  Numbered detection found < 2 entries, trying topic-based...')
  return findTopicBasedTOC(lines, tocStart, tocEnd)
}

/**
 * Find topic-based TOC entries (chapters that are topics/themes, not numbered)
 * Example: "Dust", "Apprentice to Jesus", "Goal #1: Be with Jesus"
 * Sub-sections underneath these are NOT chapters
 */
function findTopicBasedTOC(lines: string[], tocStart: number, tocEnd: number): Array<{ number: number; name: string; title: string }> {
  const entries: Array<{ number: number; name: string; title: string }> = []
  const tocLines: string[] = []
  
  // Collect all non-empty TOC lines
  for (let i = tocStart + 1; i < tocEnd; i++) {
    const line = lines[i].trim()
    if (line.length > 0) {
      tocLines.push(line)
    }
  }
  
  console.log(`  Analyzing ${tocLines.length} TOC lines for topic-based structure...`)
  
  // CHAPTER patterns (main sections):
  const chapterPatterns = [
    /^(Prologue|Epilogue|Introduction|Conclusion|Preface|Foreword|Afterword)$/i,
    /^(Part|Goal|Section|Chapter)\s*#?\d+/i,  // "Goal #1:", "Part 1", "Section 2"
    /^How\?/i,   // Questions: "How? A Rule of Life"
    /^What\?/i,
    /^Why\?/i,
    /^When\?/i,
    /^Where\?/i,
  ]
  
  // SUB-SECTION patterns (NOT chapters - skip these):
  const subSectionPatterns = [
    /^["'"']/,                    // Starts with quote: "Abide in me"
    /^[a-z]/,                     // Starts lowercase
    /^\d+\.\s+[A-Z][a-z]/,       // "1. To be with" - numbered with lowercase continuation
    /^\d+\.\s+[A-Z][a-z].*\s(to|with|for|of|in|on|by|the|a|an)\s/i,  // Numbered descriptive
    /_/,                          // Underscored/italicized: _Disciple_
    /^(The|A|An)\s+\w+\s+\w+/i,  // Articles: "The reward for..."
    /^(Three|Four|Five|Six|Seven|Eight|Nine|Ten)\s+/i,  // Number words: "Three goals..."
    /\s(isn't|aren't|doesn't|don't|won't|can't)\s/i,  // Contractions (descriptive)
  ]
  
  let chapterNum = 0
  
  for (let i = 0; i < tocLines.length; i++) {
    const line = tocLines[i]
    const words = line.split(/\s+/)
    
    // Skip if matches sub-section pattern
    let isSubSection = false
    for (const pattern of subSectionPatterns) {
      if (pattern.test(line)) {
        isSubSection = true
        console.log(`    Skipped (subsection): "${line.substring(0, 50)}..."`)
        break
      }
    }
    if (isSubSection) continue
    
    // Skip very long lines (likely descriptive text)
    if (words.length > 7) {
      console.log(`    Skipped (too long): "${line.substring(0, 50)}..."`)
      continue
    }
    
    // Check if it matches chapter patterns
    let isChapter = false
    
    for (const pattern of chapterPatterns) {
      if (pattern.test(line)) {
        isChapter = true
        break
      }
    }
    
    // Also accept: Single capitalized word (like "Dust")
    if (!isChapter && /^[A-Z][a-z]+$/.test(line)) {
      isChapter = true
    }
    
    // Also accept: Short title case phrases (2-4 words, each capitalized)
    // Like "Apprentice to Jesus"
    if (!isChapter && words.length >= 2 && words.length <= 4) {
      const firstWordCapitalized = /^[A-Z]/.test(words[0])
      const lastWordCapitalized = /^[A-Z]/.test(words[words.length - 1])
      // Allow prepositions in the middle: "to", "of", "the"
      if (firstWordCapitalized && lastWordCapitalized) {
        isChapter = true
      }
    }
    
    if (isChapter) {
      chapterNum++
      entries.push({ 
        number: chapterNum, 
        name: line, 
        title: line 
      })
      console.log(`  TOC Entry (topic): ${chapterNum}. "${line}"`)
    }
  }
  
  return entries
}

/**
 * Find chapter markers in the text based on TOC entries
 * Handles both numbered ("1. CASEY") and topic-based ("Apprentice to Jesus") chapters
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
    const escapedName = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    
    // Build patterns to find this chapter in the main text
    // Pattern 1: Numbered format "1. NAME"
    const pattern1 = new RegExp(`^${entry.number}\\.\\s*${escapedName}$`, 'i')
    // Pattern 2: Just the name/title on its own line
    const pattern2 = new RegExp(`^${escapedName}$`, 'i')
    // Pattern 3: Name with slight variations (for topic-based chapters)
    // Allow some flexibility for formatting differences
    const simplifiedName = entry.name.replace(/[^\w\s]/g, '').toLowerCase()
    
    let found = false
    
    // Search from content start, but skip already used lines
    for (let i = contentStart; i < lines.length && !found; i++) {
      // Skip if this line was already used as a marker
      if (usedLineIndices.has(i)) continue
      
      const line = lines[i].trim()
      
      // Skip if line is too long (not a chapter marker) unless it's a topic-based chapter
      if (line.length > 100) continue
      
      // Skip if line is too short (empty or just punctuation)
      if (line.length < 2) continue
      
      // Try exact match: "1. NAME"
      if (pattern1.test(line)) {
        const nextLine = lines[i + 1]?.trim() || ''
        const nextNextLine = lines[i + 2]?.trim() || ''
        
        // Verify content follows
        const hasContent = nextLine.length > 30 || 
          (nextLine.length === 0 && nextNextLine.length > 30)
        
        if (hasContent) {
          markers.push({ lineIdx: i, title: entry.title, chapterNum: entry.number })
          usedLineIndices.add(i)
          console.log(`  Found marker for "${entry.title}" at line ${i} (numbered)`)
          found = true
          break
        }
      }
      
      // Try exact name match
      if (!found && pattern2.test(line)) {
        const prevLine = lines[i - 1]?.trim() || ''
        const nextLine = lines[i + 1]?.trim() || ''
        const nextNextLine = lines[i + 2]?.trim() || ''
        
        // Should be preceded by empty/short line, followed by content
        const validContext = (prevLine.length === 0 || prevLine.length < 40) &&
          (nextLine.length > 20 || (nextLine.length === 0 && nextNextLine.length > 20))
        
        if (validContext) {
          markers.push({ lineIdx: i, title: entry.title, chapterNum: entry.number })
          usedLineIndices.add(i)
          console.log(`  Found marker for "${entry.title}" at line ${i} (exact name)`)
          found = true
          break
        }
      }
      
      // Try simplified match for topic-based chapters (ignoring punctuation)
      if (!found) {
        const simplifiedLine = line.replace(/[^\w\s]/g, '').toLowerCase()
        if (simplifiedLine === simplifiedName || simplifiedLine.includes(simplifiedName)) {
          const prevLine = lines[i - 1]?.trim() || ''
          const nextLine = lines[i + 1]?.trim() || ''
          const nextNextLine = lines[i + 2]?.trim() || ''
          const nextNextNextLine = lines[i + 3]?.trim() || ''
          
          // Check if this looks like a chapter heading
          // - Preceded by empty/short line
          // - Followed by content (within a few lines)
          const validPrev = prevLine.length === 0 || prevLine.length < 40
          const hasContent = 
            nextLine.length > 30 ||
            (nextLine.length === 0 && nextNextLine.length > 30) ||
            (nextLine.length < 30 && nextNextLine.length > 30) ||
            (nextLine.length === 0 && nextNextLine.length === 0 && nextNextNextLine.length > 30)
          
          if (validPrev && hasContent) {
            markers.push({ lineIdx: i, title: entry.title, chapterNum: entry.number })
            usedLineIndices.add(i)
            console.log(`  Found marker for "${entry.title}" at line ${i} (simplified match: "${line}")`)
            found = true
            break
          }
        }
      }
    }
    
    if (!found) {
      console.warn(`  WARNING: Could not find marker for "${entry.title}" in the text`)
    }
  }
  
  // Sort by line index to get correct reading order
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Re-number sequentially based on order
  // For topic-based chapters, keep the original title but add a number prefix
  let sequentialNum = 0
  for (const marker of markers) {
    // Check if it's a prologue/epilogue (keep at 0 or end)
    const lowerTitle = marker.title.toLowerCase()
    if (lowerTitle.includes('prologue') || lowerTitle.includes('preface') || lowerTitle.includes('introduction')) {
      marker.chapterNum = 0
      marker.title = marker.title // Keep as-is (e.g., "Prologue" or "Dust")
      console.log(`  Prologue/Preface: "${marker.title}"`)
    } else if (lowerTitle.includes('epilogue') || lowerTitle.includes('afterword') || lowerTitle.includes('conclusion')) {
      marker.chapterNum = 998
      marker.title = marker.title
      console.log(`  Epilogue/Afterword: "${marker.title}"`)
    } else {
      sequentialNum++
      // Check if title already has a number prefix
      const hasNumberPrefix = /^\d+\.\s/.test(marker.title)
      if (!hasNumberPrefix) {
        const originalTitle = marker.title
        marker.title = `${sequentialNum}. ${marker.title}`
        console.log(`  Numbered: "${originalTitle}" -> "${marker.title}"`)
      }
      marker.chapterNum = sequentialNum
    }
  }
  
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
    
    // Check for standalone digits (1, 2, 3... up to 30)
    // Skip high numbers (likely footnotes/endnotes)
    if (/^\d{1,2}$/.test(line)) {
      const num = parseInt(line)
      // Only accept reasonable chapter numbers (1-30)
      if (num >= 1 && num <= 30) {
        const nextLine = lines[i + 1]?.trim() || ''
        const prevLine = lines[i - 1]?.trim() || ''
        // Must be preceded by empty line and followed by content, not another number
        if (prevLine.length === 0 && nextLine.length > 20 && !/^\d{1,2}$/.test(nextLine)) {
          markers.push({ lineIdx: i, title: `Chapter ${num}`, chapterNum: num })
          console.log(`  Found: Chapter ${num} (digit) at line ${i}`)
        }
      }
    }
    
    // Check for "1. NAME" or "1. CHARACTERNAME" format (numbered POV chapters)
    // STRICT: Only match ALL CAPS names (1-3 words) like "1. CASEY" or "1. MARY JANE"
    // This prevents matching numbered subsections like "1. To be with your rabbi"
    const numberedNameMatch = line.match(/^(\d{1,2})\.\s*([A-Z]{2,}(?:\s+[A-Z]{2,}){0,2})$/)
    if (numberedNameMatch) {
      const num = parseInt(numberedNameMatch[1])
      const name = numberedNameMatch[2].trim()
      const nextLine = lines[i + 1]?.trim() || ''
      const nextNextLine = lines[i + 2]?.trim() || ''
      const nextNextNextLine = lines[i + 3]?.trim() || ''
      
      // Check if we're still in TOC (multiple consecutive numbered entries)
      let numberedEntryCount = 0
      for (let j = 1; j <= 3; j++) {
        const checkLine = lines[i + j]?.trim() || ''
        if (/^\d{1,2}\.\s*[A-Z]{2,}/.test(checkLine)) {
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
          console.log(`  Found: ${num}. ${name} (numbered POV) at line ${i}`)
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
    // Remove null bytes (most common issue)
    .replace(/\u0000/g, '')
    // Remove other problematic control characters (except newlines and tabs)
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    // Replace problematic Unicode escape sequences
    .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '')
    // Normalize whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

export async function saveChapters(bookId: string, chapters: Chapter[]): Promise<void> {
  const supabase = createServiceClient()
  
  console.log(`Deleting existing chapters for book ${bookId}...`)
  await supabase.from('chapters').delete().eq('book_id', bookId)
  
  for (const chapter of chapters) {
    // Sanitize text before saving to prevent Unicode issues
    const sanitizedTitle = sanitizeText(chapter.title)
    const sanitizedText = sanitizeText(chapter.text)
    
    const { error } = await supabase
      .from('chapters')
      .insert({
        book_id: bookId,
        idx: chapter.idx,
        title: sanitizedTitle,
        text_content: sanitizedText,
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
