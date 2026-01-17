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
  
  // Find the end of front matter (title pages, TOC, etc.)
  const contentStart = findContentStart(lines)
  console.log(`Content starts at line: ${contentStart}`)
  
  // Scan for chapter markers
  console.log('\n--- Scanning for chapter markers ---')
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
    
    // Skip empty or very long lines
    if (line.length === 0 || line.length > 60) continue
    
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
      
      // Verify this looks like a chapter marker (followed by content, not more TOC entries)
      const isInTOC = /^\d{1,2}\.\s*[A-Za-z]/.test(nextLine) // Next line is also "N. Name" format
      
      if (!isInTOC) {
        // Check if content follows
        const hasContent = nextLine.length > 30 || 
          (nextLine.length === 0 && nextNextLine.length > 30) ||
          (nextLine.length < 30 && nextNextLine.length > 30)
        
        if (hasContent) {
          markers.push({ lineIdx: i, title: `${num}. ${name}`, chapterNum: num })
          console.log(`  Found: ${num}. ${name} (numbered name) at line ${i}`)
        }
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
  
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    const next = markers[i + 1]
    
    const startLine = current.lineIdx + 1
    const endLine = next ? next.lineIdx : lines.length
    
    // Get content, filter out watermarks
    const contentLines = lines.slice(startLine, endLine).filter(line => {
      const trimmed = line.trim().toLowerCase()
      return !trimmed.includes('oceanofpdf') && line.trim().length > 0
    })
    
    const content = contentLines.join('\n').trim()
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
