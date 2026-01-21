import EPub from 'epub2'
import { promisify } from 'util'

export interface EpubChapter {
  idx: number
  title: string
  text: string
}

/**
 * Parse EPUB file and extract chapters
 * EPUB has structured TOC which makes chapter detection much more reliable
 */
export async function parseEpub(buffer: Buffer): Promise<{
  title: string
  author: string
  chapters: EpubChapter[]
  fullText: string
}> {
  return new Promise((resolve, reject) => {
    // Create a temporary file path for the epub (epub2 requires a file path)
    const tempPath = `/tmp/epub_${Date.now()}.epub`
    
    // Write buffer to temp file
    const fs = require('fs')
    fs.writeFileSync(tempPath, buffer)
    
    const epub = new EPub(tempPath)
    
    epub.on('error', (err: Error) => {
      fs.unlinkSync(tempPath) // Clean up
      reject(err)
    })
    
    epub.on('end', async () => {
      try {
        const title = epub.metadata?.title || 'Unknown Title'
        const author = epub.metadata?.creator || 'Unknown Author'
        
        console.log(`\n========== EPUB PARSING ==========`)
        console.log(`Title: ${title}`)
        console.log(`Author: ${author}`)
        console.log(`TOC entries: ${epub.toc?.length || 0}`)
        
        const chapters: EpubChapter[] = []
        let fullText = ''
        
        // Get chapters from TOC (Table of Contents)
        if (epub.toc && epub.toc.length > 0) {
          console.log(`\nExtracting ${epub.toc.length} chapters from TOC:`)
          
          for (let i = 0; i < epub.toc.length; i++) {
            const tocEntry = epub.toc[i]
            const chapterTitle = tocEntry.title || `Chapter ${i + 1}`
            
            try {
              // Get chapter content
              const getChapter = promisify(epub.getChapter.bind(epub))
              const html = await getChapter(tocEntry.id) as string
              
              // Strip HTML tags to get plain text
              const text = stripHtml(html)
              
              if (text.length > 100) { // Skip very short chapters
                chapters.push({
                  idx: chapters.length,
                  title: chapterTitle,
                  text: text,
                })
                
                fullText += text + '\n\n'
                
                const wordCount = text.split(/\s+/).length
                console.log(`  ${i + 1}. "${chapterTitle}" (~${wordCount} words)`)
              }
            } catch (err) {
              console.warn(`  Could not extract chapter "${chapterTitle}":`, err)
            }
          }
        } else {
          // Fallback: Get all chapters from spine
          console.log('\nNo TOC found, using spine order...')
          
          const getChapter = promisify(epub.getChapter.bind(epub))
          
          for (let i = 0; i < epub.spine.contents.length; i++) {
            const item = epub.spine.contents[i]
            
            try {
              const html = await getChapter(item.id) as string
              const text = stripHtml(html)
              
              if (text.length > 500) { // Skip very short sections
                chapters.push({
                  idx: chapters.length,
                  title: `Chapter ${chapters.length + 1}`,
                  text: text,
                })
                
                fullText += text + '\n\n'
              }
            } catch (err) {
              // Skip problematic chapters
            }
          }
        }
        
        // Clean up temp file
        fs.unlinkSync(tempPath)
        
        console.log(`\nExtracted ${chapters.length} chapters`)
        console.log(`Total text length: ${fullText.length} chars`)
        
        resolve({
          title,
          author,
          chapters,
          fullText,
        })
      } catch (err) {
        fs.unlinkSync(tempPath) // Clean up
        reject(err)
      }
    })
    
    epub.parse()
  })
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
    .replace(/<(p|div|h[1-6]|br|li|tr)[^>]*>/gi, '')
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
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * Check if a buffer is an EPUB file
 */
export function isEpub(buffer: Buffer): boolean {
  // EPUB files are ZIP files starting with "PK"
  // and contain "mimetype" as the first file with content "application/epub+zip"
  if (buffer.length < 4) return false
  
  // Check for ZIP signature
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B
  
  if (!isZip) return false
  
  // Check for "mimetype" string in first 100 bytes
  const header = buffer.slice(0, 100).toString('utf-8')
  return header.includes('mimetype') || header.includes('epub')
}
