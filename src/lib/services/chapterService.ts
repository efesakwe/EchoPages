import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

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

/**
 * Parse Table of Contents
 */
function parseTOC(lines: string[]): TOCEntry[] {
  const entries: TOCEntry[] = []
  
  // Find TOC
  let tocStart = -1
  for (let i = 0; i < Math.min(lines.length, 300); i++) {
    const lower = lines[i].trim().toLowerCase()
    if (lower === 'contents' || lower === 'table of contents') {
      tocStart = i + 1
      console.log(`Found TOC at line ${i}`)
      break
    }
  }
  
  if (tocStart === -1) return []
  
  let consecutiveMisses = 0
  const seenSpecial = new Set<string>()
  
  for (let i = tocStart; i < Math.min(lines.length, tocStart + 150); i++) {
    const line = lines[i].trim()
    if (line.length === 0) continue
    if (line.length > 120) {
      consecutiveMisses++
      if (consecutiveMisses > 3) break
      continue
    }
    
    // Clean line - remove page numbers
    const cleaned = line.replace(/[\s.·…_\-]+\d+\s*$/, '').trim()
    if (cleaned.length === 0) continue
    
    // Check for special sections
    const specialMatch = cleaned.match(/^(foreword|preface|prologue|epilogue|introduction|afterword|acknowledgments?)/i)
    if (specialMatch) {
      const specialType = specialMatch[1].toLowerCase()
      if (!seenSpecial.has(specialType)) {
        seenSpecial.add(specialType)
        entries.push({ title: cleaned, type: 'special', chapterNum: null })
        console.log(`  TOC special: "${cleaned}"`)
      }
      consecutiveMisses = 0
      continue
    }
    
    // Part markers
    if (/^part\s+/i.test(cleaned)) {
      entries.push({ title: cleaned, type: 'part', chapterNum: null })
      console.log(`  TOC part: "${cleaned}"`)
      consecutiveMisses = 0
      continue
    }
    
    // Chapter X format
    const chapterMatch = cleaned.match(/^chapter\s+(\d+)/i)
    if (chapterMatch) {
      entries.push({ title: cleaned, type: 'chapter', chapterNum: parseInt(chapterMatch[1]) })
      console.log(`  TOC chapter: "${cleaned}"`)
      consecutiveMisses = 0
      continue
    }
    
    // Starts with number
    const numMatch = cleaned.match(/^(\d{1,2})(?:\s|$|\.|\:)/)
    if (numMatch) {
      entries.push({ title: cleaned, type: 'chapter', chapterNum: parseInt(numMatch[1]) })
      console.log(`  TOC numbered: "${cleaned}"`)
      consecutiveMisses = 0
      continue
    }
    
    consecutiveMisses++
    if (consecutiveMisses > 5) break
  }
  
  console.log(`Parsed ${entries.length} TOC entries`)
  return entries
}

/**
 * Check if a standalone number is likely a page number (not chapter marker)
 */
function isLikelyPageNumber(lines: string[], lineIdx: number, num: number): boolean {
  const prevLine = lines[lineIdx - 1]?.trim() || ''
  const nextLine = lines[lineIdx + 1]?.trim() || ''
  const nextNextLine = lines[lineIdx + 2]?.trim() || ''
  
  // Page numbers are usually:
  // 1. At the very end of content (after a sentence ending with . ! ?)
  // 2. Before the start of new content (sentence starting with capital)
  // 3. Not followed by a clear chapter opening
  
  // If prev line ends with punctuation and next line continues narrative = page number
  const prevEndsWithPunctuation = /[.!?'"]\s*$/.test(prevLine)
  const nextStartsWithLowerOrContinuation = /^[a-z]/.test(nextLine) || 
    /^(She|He|They|The|It|But|And|Then|When|After|Before|Now|As|In|On|At|To|For|With|From|About)\s/.test(nextLine)
  
  if (prevEndsWithPunctuation && nextStartsWithLowerOrContinuation) {
    console.log(`  Line ${lineIdx}: "${num}" looks like page number (continues narrative)`)
    return true
  }
  
  // If the number appears mid-paragraph (content both before and after)
  if (prevLine.length > 50 && nextLine.length > 50) {
    console.log(`  Line ${lineIdx}: "${num}" looks like page number (mid-content)`)
    return true
  }
  
  // Small numbers appearing early are suspicious
  if (num === 1 && lineIdx < 200) {
    // Check if there's actual chapter content following
    const followingText = lines.slice(lineIdx + 1, lineIdx + 10).join(' ').trim()
    // If following text continues from previous (no clear chapter start)
    if (!/^(chapter|part|\d+\.|[A-Z]{2,})/i.test(nextLine) && followingText.length > 100) {
      // Check if it looks like continuous prose
      if (/^[a-z]/.test(nextLine) || /^[""']/.test(nextLine)) {
        console.log(`  Line ${lineIdx}: "${num}" looks like page number (prose continues)`)
        return true
      }
    }
  }
  
  return false
}

/**
 * Find chapter locations, avoiding duplicates and page numbers
 */
function findChapterLocations(lines: string[], tocEntries: TOCEntry[]): { title: string; lineIdx: number }[] {
  const locations: { title: string; lineIdx: number }[] = []
  let searchFrom = 50
  
  const foundSpecial = new Set<string>()
  
  for (const entry of tocEntries) {
    let found = false
    
    for (let i = searchFrom; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.length > 80 || line.length === 0) continue
      
      let isMatch = false
      const lineLower = line.toLowerCase()
      
      if (entry.type === 'special') {
        const keyword = entry.title.split(/\s/)[0].toLowerCase()
        if (lineLower === keyword || lineLower.startsWith(keyword + ' ')) {
          if (!foundSpecial.has(keyword)) {
            isMatch = true
            foundSpecial.add(keyword)
          }
        }
      } else if (entry.chapterNum !== null) {
        const num = entry.chapterNum.toString()
        
        // Check for explicit "Chapter X" first (most reliable)
        if (new RegExp(`^chapter\\s+${num}\\b`, 'i').test(line)) {
          isMatch = true
        }
        // Standalone number - check it's not a page number
        else if (line === num || line === num + '.') {
          if (!isLikelyPageNumber(lines, i, entry.chapterNum)) {
            isMatch = true
          }
        }
      } else if (entry.type === 'part') {
        if (lineLower.startsWith('part ')) {
          isMatch = true
        }
      }
      
      if (isMatch) {
        locations.push({ title: line, lineIdx: i })
        console.log(`Found "${entry.title}" → "${line}" at line ${i}`)
        searchFrom = i + 20  // Skip ahead more to avoid page numbers
        found = true
        break
      }
    }
    
    if (!found) {
      console.log(`  WARNING: Could not find "${entry.title}"`)
    }
  }
  
  return locations.sort((a, b) => a.lineIdx - b.lineIdx)
}

/**
 * Fallback: Scan directly for chapter markers
 */
function scanForChapterMarkers(lines: string[]): { title: string; lineIdx: number }[] {
  const markers: { title: string; lineIdx: number }[] = []
  let expectedNum = 1
  const foundSpecial = new Set<string>()
  
  console.log('Scanning for chapter markers...')
  
  for (let i = 30; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length === 0 || line.length > 60) continue
    
    const prevEmpty = i > 0 && lines[i - 1].trim().length < 5
    const lineLower = line.toLowerCase()
    
    // Special sections
    const specialMatch = line.match(/^(foreword|preface|prologue|epilogue|introduction|afterword)$/i)
    if (specialMatch && prevEmpty) {
      const keyword = specialMatch[1].toLowerCase()
      if (!foundSpecial.has(keyword)) {
        foundSpecial.add(keyword)
        markers.push({ title: line, lineIdx: i })
        console.log(`Found special: "${line}" at line ${i}`)
      }
      continue
    }
    
    // Chapter X format (most reliable)
    const chapterMatch = line.match(/^chapter\s+(\d+)/i)
    if (chapterMatch && prevEmpty) {
      const num = parseInt(chapterMatch[1])
      if (num === expectedNum) {
        markers.push({ title: line, lineIdx: i })
        console.log(`Found chapter: "${line}" at line ${i}`)
        expectedNum++
        continue
      }
    }
    
    // Standalone number - be VERY careful
    if (/^\d{1,2}$/.test(line) && prevEmpty) {
      const num = parseInt(line)
      if (num === expectedNum) {
        // Extra validation: must NOT be a page number
        if (!isLikelyPageNumber(lines, i, num)) {
          const nextContent = lines.slice(i + 1, i + 15).join(' ')
          if (nextContent.length > 150) {
            markers.push({ title: line, lineIdx: i })
            console.log(`Found number: "${line}" at line ${i}`)
            expectedNum++
          }
        }
      }
    }
  }
  
  return markers.sort((a, b) => a.lineIdx - b.lineIdx)
}

/**
 * Main: Detect and extract chapters
 */
export async function detectChapters(text: string): Promise<Chapter[]> {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  
  const lines = text.split('\n')
  console.log(`Lines: ${lines.length}, Chars: ${text.length}`)
  
  // Parse TOC
  console.log('\n--- Parsing TOC ---')
  const tocEntries = parseTOC(lines)
  
  let chapterLocations: { title: string; lineIdx: number }[]
  
  if (tocEntries.length >= 3) {
    console.log('\n--- Finding chapters from TOC ---')
    chapterLocations = findChapterLocations(lines, tocEntries)
    
    if (chapterLocations.length < tocEntries.length / 2) {
      console.log('\nFallback to direct scan...')
      chapterLocations = scanForChapterMarkers(lines)
    }
  } else {
    console.log('\n--- Direct scan ---')
    chapterLocations = scanForChapterMarkers(lines)
  }
  
  // Remove duplicates
  const dedupedLocations: typeof chapterLocations = []
  for (const loc of chapterLocations) {
    const lastLoc = dedupedLocations[dedupedLocations.length - 1]
    if (!lastLoc || loc.lineIdx > lastLoc.lineIdx + 20) {
      dedupedLocations.push(loc)
    }
  }
  
  console.log(`\nFound ${dedupedLocations.length} unique chapter locations`)
  
  if (dedupedLocations.length === 0) {
    return [{ idx: 0, title: 'Full Book', text }]
  }
  
  // Extract chapters
  const chapters: Chapter[] = []
  
  for (let i = 0; i < dedupedLocations.length; i++) {
    const start = dedupedLocations[i].lineIdx
    const end = i + 1 < dedupedLocations.length 
      ? dedupedLocations[i + 1].lineIdx 
      : lines.length
    
    const chapterText = lines.slice(start, end).join('\n').trim()
    
    if (chapterText.length > 50) {
      chapters.push({
        idx: i,
        title: dedupedLocations[i].title,
        text: chapterText,
      })
    }
  }
  
  console.log(`\n========== RESULT ==========`)
  chapters.forEach((ch, i) => console.log(`  ${i + 1}. "${ch.title}" (${ch.text.length} chars)`))
  
  // Show first/last 200 chars of each chapter for verification
  console.log(`\n========== CHAPTER PREVIEWS ==========`)
  chapters.forEach((ch, i) => {
    console.log(`\n[${i + 1}] ${ch.title}:`)
    console.log(`  START: "${ch.text.substring(0, 150).replace(/\n/g, ' ')}..."`)
    console.log(`  END: "...${ch.text.substring(ch.text.length - 150).replace(/\n/g, ' ')}"`)
  })
  
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
