/**
 * Test PDF chapter extraction - matches production chapterService.ts
 * Run: npx tsx scripts/test-pdf-extraction.js /path/to/book.pdf
 */

import fs from 'fs'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

function findTopicBasedChapters(lines) {
  const markers = []
  
  console.log(`  Strategy 3: Looking for MAIN chapters in TOC...`)
  
  // Step 1: Find TOC area
  let tocStart = -1
  let tocEnd = -1
  
  for (let i = 50; i < Math.min(300, lines.length); i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase()
    
    if (lower.includes('penguin') || lower.includes('random house') || 
        lower.includes('congress') || lower.includes('isbn') ||
        lower.includes('copyright') || lower.includes('.com')) continue
    
    const isTocEntry = line.length > 3 && line.length < 60 && /^[A-Z"]/.test(line)
    
    if (isTocEntry) {
      let shortLineCount = 0
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        const nearby = lines[j].trim()
        if (nearby.length > 3 && nearby.length < 60 && /^[A-Z"]/.test(nearby)) shortLineCount++
      }
      if (shortLineCount >= 4 && tocStart === -1) tocStart = i
    }
    
    if (tocStart !== -1 && tocEnd === -1) {
      if (line.length > 100 || /^OceanofPDF/i.test(line) || lower === 'notes') {
        tocEnd = i
        break
      }
    }
  }
  
  if (tocStart === -1) return []
  console.log(`  TOC found: lines ${tocStart}-${tocEnd}`)
  
  // Main chapter patterns
  const mainChapterPatterns = [
    /^Dust$/i, /^Apprentice to Jesus$/i,
    /^Goal\s*#?\s*1/i, /^Goal\s*#?\s*2/i, /^Goal\s*#?\s*3/i,
    /^How\?\s/i, /^Take up your cross$/i, /^Extras$/i,
    /^Prologue$/i, /^Epilogue$/i, /^Introduction$/i, /^Conclusion$/i,
    /^Part\s+(one|two|three|four|five|\d+)/i, /^Chapter\s+\d+/i,
  ]
  
  // Collect main chapters with multiple subsections
  const mainChapters = []
  let currentChapter = null
  
  for (let i = tocStart; i < tocEnd; i++) {
    const line = lines[i].trim()
    if (line.length < 3 || line.length > 60 || !/^[A-Z""'']/.test(line)) continue
    if (line.toLowerCase().includes('notes') || line.toLowerCase().includes('gratitude')) continue
    
    const isMainChapter = mainChapterPatterns.some(p => p.test(line))
    
    if (isMainChapter) {
      currentChapter = { title: line, tocLine: i, subsections: [] }
      mainChapters.push(currentChapter)
      console.log(`    Main chapter: "${line}"`)
    } else if (currentChapter && currentChapter.subsections.length < 5) {
      currentChapter.subsections.push(line)
      if (currentChapter.subsections.length === 1) {
        console.log(`      First subsection: "${line}"`)
      }
    }
  }
  
  if (mainChapters.length < 2) return []
  
  // Find Notes section
  let notesStart = lines.length
  for (let i = Math.floor(lines.length * 0.7); i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase()
    if (line === 'notes' || line.includes('back to note reference')) {
      notesStart = i
      break
    }
  }
  
  const contentStart = Math.max(tocEnd + 10, 150)
  const contentEnd = notesStart - 50
  console.log(`  Searching content: lines ${contentStart}-${contentEnd}`)
  
  // Find each chapter in content
  for (const chapter of mainChapters) {
    const searchTerms = [chapter.title, ...chapter.subsections]
    
    let found = false
    for (const term of searchTerms) {
      const normalizedTerm = term.toLowerCase()
        .replace(/[""]/g, '"').replace(/['']/g, "'").replace(/^["']|["']$/g, '').trim()
      
      for (let i = contentStart; i < contentEnd; i++) {
        const line = lines[i].trim()
        const normalizedLine = line.toLowerCase()
          .replace(/[""]/g, '"').replace(/['']/g, "'").replace(/^["']|["']$/g, '').trim()
        
        if (normalizedLine === normalizedTerm) {
          const prev = lines[i - 1]?.trim() || ''
          const next = lines[i + 1]?.trim() || ''
          const rawLine = lines[i].trim()
          
          if (next.includes('BACK TO NOTE')) continue
          if (rawLine.endsWith('.') || rawLine.endsWith(',') || rawLine.endsWith(':') || rawLine.endsWith(';')) continue
          
          const prevIsTransition = prev.length === 0 || prev.length < 40 || 
                                   /^OceanofPDF/i.test(prev) || /^\[\d+\]$/.test(prev)
          const lineIsShort = rawLine.length < 50
          
          // Check next few lines for content (some chapters start with short lines)
          let hasContentNearby = false
          for (let k = 1; k <= 3; k++) {
            const checkLine = lines[i + k]?.trim() || ''
            if (checkLine.length > 20 && !/^OceanofPDF/i.test(checkLine) && !/^\[\d+\]$/.test(checkLine)) {
              hasContentNearby = true
              break
            }
          }
          
          if (prevIsTransition && lineIsShort && hasContentNearby) {
            markers.push({ lineIdx: i, title: chapter.title, chapterNum: markers.length + 1 })
            console.log(`    Found "${chapter.title}" at line ${i} (matched: "${term}")`)
            found = true
            break
          }
        }
      }
      if (found) break
    }
    
    if (!found) console.log(`    NOT FOUND: "${chapter.title}" (tried ${searchTerms.length} terms)`)
  }
  
  if (markers.length < 2) return []
  
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  let num = 1
  for (const marker of markers) {
    marker.chapterNum = num
    // Don't add number prefix - UI does that
    num++
  }
  
  return markers
}

async function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    console.log('Usage: npx tsx scripts/test-pdf-extraction.js /path/to/book.pdf')
    process.exit(1)
  }
  
  const buffer = fs.readFileSync(pdfPath)
  const data = await pdfParse(buffer)
  const lines = data.text.split('\n')
  
  console.log(`\nPDF: ${pdfPath}`)
  console.log(`Pages: ${data.numpages}, Lines: ${lines.length}`)
  
  console.log('\n========== CHAPTER DETECTION ==========')
  const markers = findTopicBasedChapters(lines)
  
  console.log('\n========== RESULTS ==========')
  if (markers.length > 0) {
    console.log(`Found ${markers.length} MAIN chapters:\n`)
    
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i]
      const nextM = markers[i + 1]
      const endLine = nextM ? nextM.lineIdx : Math.min(lines.length, m.lineIdx + 5000)
      
      let wordCount = 0
      for (let j = m.lineIdx; j < endLine; j++) {
        wordCount += (lines[j]?.trim() || '').split(/\s+/).filter(w => w.length > 0).length
      }
      
      console.log(`  ${m.title}`)
      console.log(`      ${wordCount.toLocaleString()} words, starts at line ${m.lineIdx}`)
    }
  } else {
    console.log('No chapters found')
  }
}

main()
