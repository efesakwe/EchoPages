import JSZip from 'jszip'

export interface EpubChapter {
  idx: number
  title: string
  text: string
}

/**
 * Parse EPUB file and extract chapters
 * EPUB is a ZIP file containing HTML/XML content with a structured TOC
 */
export async function parseEpub(buffer: Buffer): Promise<{
  title: string
  author: string
  chapters: EpubChapter[]
  fullText: string
}> {
  console.log(`\n========== EPUB PARSING ==========`)
  
  const zip = await JSZip.loadAsync(buffer)
  
  // Find the content.opf file (contains metadata and spine)
  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) {
    throw new Error('Invalid EPUB: Missing container.xml')
  }
  
  // Extract path to content.opf
  const rootfileMatch = containerXml.match(/full-path="([^"]+)"/)
  const opfPath = rootfileMatch ? rootfileMatch[1] : 'OEBPS/content.opf'
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1)
  
  console.log(`OPF path: ${opfPath}`)
  console.log(`OPF directory: ${opfDir}`)
  
  // Read content.opf
  const opfContent = await zip.file(opfPath)?.async('string')
  if (!opfContent) {
    throw new Error('Invalid EPUB: Missing content.opf')
  }
  
  // Extract metadata
  const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i)
  const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i)
  
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : 'Unknown Title'
  const author = authorMatch ? decodeHtmlEntities(authorMatch[1]) : 'Unknown Author'
  
  console.log(`Title: ${title}`)
  console.log(`Author: ${author}`)
  
  // Try to find TOC (table of contents)
  // Look for toc.ncx or nav.xhtml
  let tocItems: { title: string; href: string }[] = []
  
  // Try toc.ncx first (EPUB 2)
  const ncxMatch = opfContent.match(/href="([^"]*\.ncx)"/i)
  if (ncxMatch) {
    const ncxPath = opfDir + ncxMatch[1]
    const ncxContent = await zip.file(ncxPath)?.async('string')
    if (ncxContent) {
      tocItems = parseNCX(ncxContent)
      console.log(`Found ${tocItems.length} TOC entries from NCX`)
    }
  }
  
  // If no NCX, try nav.xhtml (EPUB 3)
  if (tocItems.length === 0) {
    const navMatch = opfContent.match(/href="([^"]*nav[^"]*\.x?html?)"/i)
    if (navMatch) {
      const navPath = opfDir + navMatch[1]
      const navContent = await zip.file(navPath)?.async('string')
      if (navContent) {
        tocItems = parseNav(navContent)
        console.log(`Found ${tocItems.length} TOC entries from NAV`)
      }
    }
  }
  
  // If still no TOC, use spine order
  if (tocItems.length === 0) {
    console.log('No TOC found, using spine order')
    const spineItems = opfContent.match(/<itemref[^>]+idref="([^"]+)"[^>]*>/gi) || []
    const manifestItems = new Map<string, string>()
    
    const manifestMatches = opfContent.matchAll(/<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*>/gi)
    for (const match of manifestMatches) {
      manifestItems.set(match[1], match[2])
    }
    
    for (const item of spineItems) {
      const idMatch = item.match(/idref="([^"]+)"/)
      if (idMatch && manifestItems.has(idMatch[1])) {
        tocItems.push({
          title: `Chapter ${tocItems.length + 1}`,
          href: manifestItems.get(idMatch[1])!
        })
      }
    }
  }
  
  // Extract chapter content
  const chapters: EpubChapter[] = []
  let fullText = ''
  
  console.log(`\nExtracting ${tocItems.length} chapters:`)
  
  for (let i = 0; i < tocItems.length; i++) {
    const item = tocItems[i]
    
    // Handle href with fragment (e.g., "chapter1.xhtml#section1")
    const hrefBase = item.href.split('#')[0]
    const filePath = opfDir + hrefBase
    
    try {
      const content = await zip.file(filePath)?.async('string')
      if (content) {
        const text = stripHtml(content)
        
        if (text.length > 100) { // Skip very short chapters
          chapters.push({
            idx: chapters.length,
            title: item.title,
            text: text
          })
          
          fullText += text + '\n\n'
          
          const wordCount = text.split(/\s+/).length
          console.log(`  ${i + 1}. "${item.title}" (~${wordCount} words)`)
        }
      }
    } catch (err) {
      console.warn(`  Could not extract "${item.title}":`, err)
    }
  }
  
  console.log(`\nExtracted ${chapters.length} chapters`)
  console.log(`Total text length: ${fullText.length} chars`)
  console.log(`==========================================\n`)
  
  return {
    title,
    author,
    chapters,
    fullText
  }
}

/**
 * Parse NCX (EPUB 2 table of contents)
 */
function parseNCX(ncxContent: string): { title: string; href: string }[] {
  const items: { title: string; href: string }[] = []
  
  // Match navPoints
  const navPoints = ncxContent.match(/<navPoint[^>]*>[\s\S]*?<\/navPoint>/gi) || []
  
  for (const navPoint of navPoints) {
    const titleMatch = navPoint.match(/<text>([^<]+)<\/text>/i)
    const hrefMatch = navPoint.match(/<content[^>]+src="([^"]+)"[^>]*>/i)
    
    if (titleMatch && hrefMatch) {
      items.push({
        title: decodeHtmlEntities(titleMatch[1].trim()),
        href: hrefMatch[1]
      })
    }
  }
  
  return items
}

/**
 * Parse NAV (EPUB 3 table of contents)
 */
function parseNav(navContent: string): { title: string; href: string }[] {
  const items: { title: string; href: string }[] = []
  
  // Find the TOC nav element
  const tocMatch = navContent.match(/<nav[^>]*epub:type="toc"[^>]*>[\s\S]*?<\/nav>/i)
  if (!tocMatch) return items
  
  // Match links
  const links = tocMatch[0].match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi) || []
  
  for (const link of links) {
    const hrefMatch = link.match(/href="([^"]+)"/)
    const textMatch = link.match(/>([^<]+)</)
    
    if (hrefMatch && textMatch) {
      items.push({
        title: decodeHtmlEntities(textMatch[1].trim()),
        href: hrefMatch[1]
      })
    }
  }
  
  return items
}

/**
 * Strip HTML tags and decode entities
 */
function stripHtml(html: string): string {
  return html
    // Remove script and style tags with their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Replace block elements with newlines
    .replace(/<\/(p|div|h[1-6]|br|li|tr)>/gi, '\n')
    .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
    // Remove all other tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * Check if a buffer is an EPUB file
 */
export function isEpub(buffer: Buffer): boolean {
  // EPUB files are ZIP files starting with "PK"
  if (buffer.length < 4) return false
  return buffer[0] === 0x50 && buffer[1] === 0x4B
}
