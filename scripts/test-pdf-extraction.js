/**
 * Local script to test PDF chapter extraction
 * Run: node scripts/test-pdf-extraction.js /path/to/your/book.pdf
 */

const fs = require('fs')
const path = require('path')

// Dynamically import pdf-parse
async function extractPDF(filePath) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  
  console.log(`\nReading PDF: ${filePath}`)
  const buffer = fs.readFileSync(filePath)
  
  const data = await pdfParse(buffer)
  
  console.log(`\nPDF Info:`)
  console.log(`  Pages: ${data.numpages}`)
  console.log(`  Text length: ${data.text.length} characters`)
  
  return data.text
}

// Number words
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

function detectChapters(text) {
  console.log(`\n========== CHAPTER DETECTION ==========`)
  console.log(`Total characters: ${text.length}`)
  
  const lines = text.split('\n')
  console.log(`Total lines: ${lines.length}`)
  
  // Show first 150 non-empty lines
  console.log('\n--- First 150 non-empty lines ---')
  let shown = 0
  for (let i = 0; i < lines.length && shown < 150; i++) {
    const line = lines[i].trim()
    if (line.length > 0) {
      console.log(`  [${i}] (${line.length} chars): "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`)
      shown++
    }
  }
  
  // Strategy 1: Find TOC
  console.log('\n--- Strategy 1: Looking for TOC ---')
  const tocEntries = findTOC(lines)
  if (tocEntries.length > 0) {
    console.log(`Found ${tocEntries.length} TOC entries:`)
    tocEntries.forEach((e, i) => console.log(`  ${i+1}. "${e}"`))
  } else {
    console.log('No numbered TOC found')
  }
  
  // Strategy 2: Scan for standard markers
  console.log('\n--- Strategy 2: Scanning for standard chapter markers ---')
  const contentStart = findContentStart(lines)
  console.log(`Content starts at line: ${contentStart}`)
  const markers = scanForChapterMarkers(lines, contentStart)
  console.log(`Found ${markers.length} standard markers:`)
  markers.slice(0, 20).forEach(m => console.log(`  Line ${m.lineIdx}: "${m.title}"`))
  
  // Strategy 3: Topic-based
  console.log('\n--- Strategy 3: Topic-based chapters ---')
  const topicMarkers = findTopicBasedChapters(lines)
  console.log(`Found ${topicMarkers.length} topic-based markers:`)
  topicMarkers.forEach(m => console.log(`  Line ${m.lineIdx}: "${m.title}"`))
  
  // Determine which strategy to use
  let finalMarkers = []
  if (tocEntries.length > 0) {
    const markersFromTOC = findMarkersFromTOC(lines, tocEntries)
    if (markersFromTOC.length >= 2) {
      finalMarkers = markersFromTOC
      console.log('\n>>> Using Strategy 1 (TOC-based)')
    }
  }
  
  if (finalMarkers.length < 2 && markers.length >= 2) {
    finalMarkers = markers
    console.log('\n>>> Using Strategy 2 (Standard markers)')
  }
  
  if (finalMarkers.length < 2 && topicMarkers.length >= 2) {
    finalMarkers = topicMarkers
    console.log('\n>>> Using Strategy 3 (Topic-based)')
  }
  
  if (finalMarkers.length < 2) {
    console.log('\n>>> WARNING: No chapters detected, would return Full Book')
    return []
  }
  
  console.log(`\n>>> Final: ${finalMarkers.length} chapters detected`)
  return finalMarkers
}

function findTOC(lines) {
  const entries = []
  let inTOC = false
  let tocEnd = 0
  
  for (let i = 0; i < Math.min(500, lines.length); i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase()
    
    if (!inTOC && (lower === 'contents' || lower === 'table of contents' || lower.includes('table of contents'))) {
      inTOC = true
      tocEnd = i + 100
      console.log(`  TOC starts at line ${i}`)
      continue
    }
    
    if (inTOC && i < tocEnd) {
      // Look for numbered entries like "1. CASEY" or "47. DYLAN"
      const match = line.match(/^(\d+)\.\s+([A-Z][A-Z\s]+)$/)
      if (match) {
        entries.push(match[2].trim())
      }
      
      // Also try: "1 CASEY" without period
      const match2 = line.match(/^(\d+)\s+([A-Z][A-Z\s]+)$/)
      if (match2 && !match) {
        entries.push(match2[2].trim())
      }
    }
  }
  
  return entries
}

function findContentStart(lines) {
  for (let i = 0; i < Math.min(300, lines.length); i++) {
    const line = lines[i].trim()
    if (line.length > 150) {
      return Math.max(0, i - 10)
    }
  }
  return 0
}

function scanForChapterMarkers(lines, startLine) {
  const markers = []
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.length === 0 || line.length > 80) continue
    
    // Check for chapter patterns
    const isChapter = 
      /^chapter\s+\d+/i.test(line) ||
      /^chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten)/i.test(line) ||
      /^(prologue|epilogue|introduction|conclusion|preface|foreword|afterword)$/i.test(line) ||
      /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/i.test(line) ||
      /^[A-Z]\s+[A-Z]\s+[A-Z]/.test(line) // Spaced letters like "P R O L O G U E"
    
    if (isChapter) {
      markers.push({ lineIdx: i, title: line, chapterNum: markers.length + 1 })
    }
  }
  
  return markers
}

function findTopicBasedChapters(lines) {
  const markers = []
  const contentStart = findContentStart(lines)
  
  const chapterPatterns = [
    { regex: /^(Goal|Part|Section)\s*#?\d+\s*[:.]?\s*.*/i, name: 'Goal/Part/Section' },
    { regex: /^(How|What|Why|When|Where)\?\s*.*/i, name: 'Question' },
    { regex: /^[A-Z][a-z]{1,14}$/, name: 'Single Word' },
    { regex: /^(Prologue|Epilogue|Introduction|Conclusion|Preface|Foreword|Afterword|Appendix)$/i, name: 'Special Section' },
  ]
  
  for (let i = contentStart; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.length === 0 || line.length > 60) continue
    
    const words = line.split(/\s+/)
    if (words.length > 6) continue
    if (/[.!,;]$/.test(line) && !/\?$/.test(line)) continue
    if (/^[a-z]/.test(line)) continue
    if (line.startsWith('"') || line.startsWith('"') || line.startsWith("'")) continue
    
    let isChapterTitle = false
    let matchType = ''
    
    for (const pattern of chapterPatterns) {
      if (pattern.regex.test(line)) {
        isChapterTitle = true
        matchType = pattern.name
        break
      }
    }
    
    if (!isChapterTitle && words.length >= 2 && words.length <= 5 && line.length <= 40) {
      const firstWordCap = /^[A-Z]/.test(words[0])
      if (firstWordCap) {
        isChapterTitle = true
        matchType = 'Title Case'
      }
    }
    
    if (!isChapterTitle) continue
    
    const prevLine = lines[i - 1]?.trim() || ''
    const nextLine = lines[i + 1]?.trim() || ''
    const nextNextLine = lines[i + 2]?.trim() || ''
    
    const goodPrev = prevLine.length === 0 || prevLine.length < 20
    const goodNext = nextLine.length > 30 || (nextLine.length === 0 && nextNextLine.length > 30)
    
    if (goodPrev && goodNext) {
      const tooClose = markers.some(m => Math.abs(m.lineIdx - i) < 20)
      if (!tooClose) {
        markers.push({ lineIdx: i, title: line, chapterNum: markers.length + 1 })
        console.log(`  Found (${matchType}): "${line}" at line ${i}`)
      }
    }
  }
  
  return markers
}

function findMarkersFromTOC(lines, tocEntries) {
  const markers = []
  const contentStart = findContentStart(lines)
  
  for (const entry of tocEntries) {
    const simplified = entry.replace(/[^\w\s]/g, '').toLowerCase().trim()
    
    for (let i = contentStart; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineSimplified = line.replace(/[^\w\s]/g, '').toLowerCase().trim()
      
      if (lineSimplified === simplified || line.toUpperCase() === entry) {
        markers.push({ lineIdx: i, title: entry, chapterNum: markers.length + 1 })
        console.log(`  Found TOC entry "${entry}" at line ${i}`)
        break
      }
    }
  }
  
  return markers
}

// Main
async function main() {
  const pdfPath = process.argv[2]
  
  if (!pdfPath) {
    console.log('Usage: node scripts/test-pdf-extraction.js /path/to/book.pdf')
    console.log('')
    console.log('This will show you exactly how the PDF text is parsed')
    console.log('and what chapter patterns are detected.')
    process.exit(1)
  }
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`)
    process.exit(1)
  }
  
  try {
    const text = await extractPDF(pdfPath)
    detectChapters(text)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

main()
