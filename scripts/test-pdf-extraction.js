/**
 * Local script to test PDF chapter extraction
 * Uses the ACTUAL chapterService code
 * Run: npx tsx scripts/test-pdf-extraction.js /path/to/your/book.pdf
 */

import fs from 'fs'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

// Copy of NUMBER_WORDS from chapterService
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
 * Strategy 3: Find topic-based chapters (SAME AS PRODUCTION CODE)
 */
function findTopicBasedChapters(lines) {
  const markers = []
  
  console.log(`  Strategy 3: Looking for topic-based TOC...`)
  
  // Step 1: Find TOC area and extract ALL titles (chapters + subsections)
  const tocTitles = []
  let tocStart = -1
  let tocEnd = -1
  
  for (let i = 50; i < Math.min(300, lines.length); i++) {
    const line = lines[i].trim()
    const lower = line.toLowerCase()
    
    // Skip publication/copyright info lines
    const isPublishingInfo = 
      lower.includes('penguin') || lower.includes('random house') ||
      lower.includes('congress') || lower.includes('library of') ||
      lower.includes('isbn') || lower.includes('lccn') ||
      lower.includes('copyright') || lower.includes('design') ||
      lower.includes('published') || lower.includes('author') ||
      lower.includes('trademark') || lower.includes('permission') ||
      lower.includes('.com') || lower.includes('www.') ||
      lower.includes('©') || /^\d{4}/.test(line) ||
      lower.includes('edition') || lower.includes('cover') ||
      /^names?:/i.test(line) || /^title:/i.test(line)
    
    if (isPublishingInfo) continue
    
    const isTocEntry = 
      line.length > 3 && line.length < 60 &&
      /^[A-Z"]/.test(line) &&
      !line.toLowerCase().includes('oceanofpdf')
    
    if (isTocEntry) {
      let shortLineCount = 0
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
        const nearby = lines[j].trim()
        if (nearby.length > 3 && nearby.length < 60 && /^[A-Z"]/.test(nearby)) {
          shortLineCount++
        }
      }
      
      if (shortLineCount >= 4 && tocStart === -1) {
        tocStart = i
        console.log(`  TOC starts at line ${i}`)
      }
      
      if (tocStart !== -1 && tocEnd === -1) {
        // Collect ALL TOC entries except metadata
        if (!line.toLowerCase().includes('notes') && 
            !line.toLowerCase().includes('gratitude') &&
            !/^The\s+(nine|practicing)/i.test(line)) {
          tocTitles.push(line)
          console.log(`    TOC entry: "${line}"`)
        }
      }
    }
    
    if (tocStart !== -1 && tocEnd === -1) {
      const lower = line.toLowerCase()
      if (line.length > 100 || 
          /^OceanofPDF/i.test(line) || 
          /^"Come,/i.test(line) ||
          lower === 'notes' ||
          lower === 'gratitude') {
        tocEnd = i
        console.log(`  TOC ends at line ${i}`)
        break
      }
    }
  }
  
  if (tocTitles.length < 3) {
    console.log(`  Only found ${tocTitles.length} TOC entries, not enough`)
    return []
  }
  
  console.log(`  Found ${tocTitles.length} entries in TOC (lines ${tocStart}-${tocEnd})`)
  
  // Step 2: Find Notes section
  let notesStart = lines.length
  for (let i = Math.floor(lines.length * 0.7); i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase()
    if (line === 'notes' || line === 'endnotes' || line === 'references' || 
        line.includes('back to note reference') || /^\d+\.\s+[a-z]+\s+\dv\d/.test(line)) {
      notesStart = i
      console.log(`  Notes section detected at line ${i}`)
      break
    }
  }
  
  // Step 3: Find sections in content
  const contentStart = Math.max(tocEnd + 10, 150)
  const contentEnd = notesStart - 50
  const foundTitles = new Set()
  
  console.log(`  Searching for sections between lines ${contentStart} and ${contentEnd}`)
  
  for (const tocTitle of tocTitles) {
    const normalizedTocTitle = tocTitle.toLowerCase().trim()
    const cleanTocTitle = normalizedTocTitle.replace(/^[""]|[""]$/g, '')
    
    for (let i = contentStart; i < contentEnd; i++) {
      const line = lines[i].trim()
      const normalizedLine = line.toLowerCase().trim()
      const cleanLine = normalizedLine.replace(/^[""]|[""]$/g, '')
      
      if (cleanLine === cleanTocTitle || normalizedLine === normalizedTocTitle || line === tocTitle) {
        const nextLine = lines[i + 1]?.trim() || ''
        const nextNextLine = lines[i + 2]?.trim() || ''
        
        if (nextLine.includes('BACK TO NOTE') || nextNextLine.includes('BACK TO NOTE')) {
          continue
        }
        
        const prevLine = lines[i - 1]?.trim() || ''
        const prevIsTransition = prevLine.length === 0 || 
                                 prevLine.length < 30 ||
                                 /[.!?"]$/.test(prevLine) ||
                                 /^OceanofPDF/i.test(prevLine) ||
                                 /^\[\d+\]$/.test(prevLine)
        
        if (prevIsTransition && !foundTitles.has(cleanTocTitle)) {
          foundTitles.add(cleanTocTitle)
          markers.push({ lineIdx: i, title: tocTitle, chapterNum: markers.length + 1 })
          console.log(`    Found: "${tocTitle}" at line ${i}`)
          break
        }
      }
    }
  }
  
  if (markers.length < 2) {
    console.log(`  Only found ${markers.length} sections in content, need at least 2`)
    return []
  }
  
  markers.sort((a, b) => a.lineIdx - b.lineIdx)
  let num = 1
  for (const marker of markers) {
    marker.chapterNum = num
    marker.title = `${num}. ${marker.title}`
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
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`)
    process.exit(1)
  }
  
  try {
    console.log(`\nReading PDF: ${pdfPath}`)
    const buffer = fs.readFileSync(pdfPath)
    const data = await pdfParse(buffer)
    const text = data.text
    const lines = text.split('\n')
    
    console.log(`\nPDF Info:`)
    console.log(`  Pages: ${data.numpages}`)
    console.log(`  Total lines: ${lines.length}`)
    
    // Show TOC area
    console.log('\n--- Lines 100-160 (TOC area) ---')
    for (let i = 100; i < 160; i++) {
      const line = lines[i]?.trim() || ''
      if (line.length > 0) {
        console.log(`  [${i}] (${line.length}): "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`)
      }
    }
    
    // Show content start area
    console.log('\n--- Lines 160-180 (content start) ---')
    for (let i = 160; i < 180; i++) {
      const line = lines[i]?.trim() || ''
      console.log(`  [${i}] (${line.length}): "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`)
    }
    
    // Run Strategy 3
    console.log('\n========== CHAPTER DETECTION ==========')
    const markers = findTopicBasedChapters(lines)
    
    console.log('\n========== RESULTS ==========')
    if (markers.length > 0) {
      console.log(`Found ${markers.length} chapters:`)
      markers.forEach((m, i) => {
        const preview = lines.slice(m.lineIdx, m.lineIdx + 3).map(l => l.trim().substring(0, 40)).join(' | ')
        console.log(`  ${i+1}. ${m.title} (line ${m.lineIdx})`)
        console.log(`      Preview: ${preview}...`)
      })
    } else {
      console.log('No chapters found - would return Full Book')
    }
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

main()
