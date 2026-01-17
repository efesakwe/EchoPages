import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ChapterSchema = z.object({
  idx: z.number(),
  title: z.string(),
  text: z.string(),
})

export type Chapter = z.infer<typeof ChapterSchema>

// Word numbers for matching
const NUMBER_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
  'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty',
  'thirty-one', 'thirty-two', 'thirty-three', 'thirty-four', 'thirty-five'
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
  
  // Scan for ALL possible chapter markers
  console.log('\n--- Scanning for chapter markers ---')
  const markers = scanAllPatterns(lines)
  
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
 * Scan for all possible chapter patterns
 */
function scanAllPatterns(lines: string[]): { lineIdx: number; title: string; order: number }[] {
  const markers: { lineIdx: number; title: string; order: number }[] = []
  
  // Skip first ~100 lines (front matter, TOC)
  // But look for actual content markers
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lineLower = line.toLowerCase()
    
    // Skip empty or very long lines
    if (line.length === 0 || line.length > 80) continue
    
    // Check context
    const prevLine = i > 0 ? lines[i - 1].trim() : ''
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''
    const hasSpaceBefore = prevLine.length === 0 || prevLine.length < 10
    
    // PATTERN 1: Spaced-out words like "P R O L O G U E"
    const collapsed = line.replace(/\s+/g, '').toLowerCase()
    if (collapsed === 'prologue' || collapsed === 'epilogue') {
      if (hasSpaceBefore) {
        markers.push({ lineIdx: i, title: collapsed.charAt(0).toUpperCase() + collapsed.slice(1), order: collapsed === 'prologue' ? 0 : 999 })
        console.log(`  Found spaced: "${line}" -> "${collapsed}" at line ${i}`)
        continue
      }
    }
    
    // PATTERN 2: Word numbers (ONE, TWO, THREE...)
    const wordIndex = NUMBER_WORDS.findIndex(w => lineLower === w || lineLower === w.replace('-', ' '))
    if (wordIndex >= 0) {
      // Verify it's likely a chapter marker (has space before, short line)
      if (hasSpaceBefore && line.length < 20) {
        const chapterNum = wordIndex + 1
        markers.push({ lineIdx: i, title: `Chapter ${chapterNum}`, order: chapterNum })
        console.log(`  Found word number: "${line}" -> Chapter ${chapterNum} at line ${i}`)
        continue
      }
    }
    
    // PATTERN 3: Regular "Prologue", "Epilogue"
    if (/^(prologue|epilogue)$/i.test(line) && hasSpaceBefore) {
      markers.push({ lineIdx: i, title: line, order: lineLower === 'prologue' ? 0 : 999 })
      console.log(`  Found: "${line}" at line ${i}`)
      continue
    }
    
    // PATTERN 4: "Chapter 1", "Chapter One"
    const chapterMatch = line.match(/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i)
    if (chapterMatch && hasSpaceBefore) {
      const numPart = chapterMatch[1].toLowerCase()
      const chapterNum = NUMBER_WORDS.indexOf(numPart) >= 0 ? NUMBER_WORDS.indexOf(numPart) + 1 : parseInt(numPart)
      markers.push({ lineIdx: i, title: line, order: chapterNum })
      console.log(`  Found chapter: "${line}" -> Chapter ${chapterNum} at line ${i}`)
      continue
    }
    
    // PATTERN 5: Digit numbers (1, 2, 3...) alone on a line
    if (/^\d{1,2}$/.test(line) && hasSpaceBefore) {
      const num = parseInt(line)
      // Verify it's not just a page number - next line should be content or short subtitle
      if (nextLine.length > 10 || nextLine.length === 0) {
        markers.push({ lineIdx: i, title: `Chapter ${num}`, order: num })
        console.log(`  Found digit: "${line}" -> Chapter ${num} at line ${i}`)
        continue
      }
    }
    
    // PATTERN 6: Other special sections
    if (/^(foreword|preface|introduction|afterword|acknowledgments?)$/i.test(line) && hasSpaceBefore) {
      markers.push({ lineIdx: i, title: line, order: lineLower.startsWith('fore') || lineLower.startsWith('pre') || lineLower.startsWith('intro') ? -1 : 1000 })
      console.log(`  Found special: "${line}" at line ${i}`)
      continue
    }
  }
  
  // Sort by line position
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  
  // Remove markers that are too close together (likely TOC)
  const filtered: typeof markers = []
  for (const marker of markers) {
    const last = filtered[filtered.length - 1]
    // Must be at least 50 lines apart (actual chapter content)
    if (!last || marker.lineIdx - last.lineIdx > 50) {
      filtered.push(marker)
    }
  }
  
  return filtered
}

/**
 * Extract chapter content between markers
 */
function extractChapters(lines: string[], markers: { lineIdx: number; title: string; order: number }[]): Chapter[] {
  const chapters: Chapter[] = []
  
  for (let i = 0; i < markers.length; i++) {
    const current = markers[i]
    const next = markers[i + 1]
    
    // Start after the chapter marker (and any subtitle line)
    let startLine = current.lineIdx + 1
    
    // Skip subtitle lines (short lines right after chapter marker)
    while (startLine < lines.length && lines[startLine].trim().length < 50 && lines[startLine].trim().length > 0) {
      startLine++
      if (startLine - current.lineIdx > 3) break // Don't skip more than 3 lines
    }
    
    const endLine = next ? next.lineIdx : lines.length
    
    // Get content, filtering out page markers like "OceanofPDF"
    const contentLines = lines.slice(startLine, endLine).filter(line => {
      const trimmed = line.trim()
      return !trimmed.includes('OceanofPDF') && trimmed.length > 0
    })
    
    const content = contentLines.join('\n').trim()
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    
    if (wordCount > 100) {
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
