import pdf from 'pdf-parse'

export interface PDFExtractResult {
  text: string
  numPages: number
  pageTexts: string[] // Text from each page separately
}

export async function extractTextFromPDF(buffer: Buffer): Promise<PDFExtractResult> {
  try {
    // Custom render function to capture text from each page with better formatting
    const pageTexts: string[] = []
    let currentPageText = ''
    
    const options = {
      // Custom page render to ensure we get ALL text
      pagerender: function(pageData: any) {
        return pageData.getTextContent({
          normalizeWhitespace: false, // Keep original whitespace
          disableCombineTextItems: false,
        }).then(function(textContent: any) {
          let lastY = -1
          let text = ''
          
          for (const item of textContent.items) {
            // Add newline when Y position changes significantly (new line)
            if (lastY !== -1 && Math.abs(lastY - item.transform[5]) > 5) {
              text += '\n'
            }
            text += item.str
            // Add space between text items on same line
            if (item.str && !item.str.endsWith(' ') && !item.str.endsWith('\n')) {
              text += ' '
            }
            lastY = item.transform[5]
          }
          
          // Store this page's text
          pageTexts.push(text.trim())
          currentPageText = text
          
          return text
        })
      }
    }
    
    const data = await pdf(buffer, options)
    
    // If pageTexts is empty, fall back to default extraction
    if (pageTexts.length === 0) {
      console.log('Custom page render returned no pages, using default extraction')
      return {
        text: data.text,
        numPages: data.numpages,
        pageTexts: [data.text],
      }
    }
    
    // Combine all pages with clear page markers
    const fullText = pageTexts.join('\n\n')
    
    console.log(`PDF Extraction Summary:`)
    console.log(`  Total pages: ${data.numpages}`)
    console.log(`  Pages with text: ${pageTexts.filter(p => p.length > 0).length}`)
    console.log(`  Total characters: ${fullText.length}`)
    console.log(`  Characters per page: ${pageTexts.map((p, i) => `Page ${i+1}: ${p.length}`).slice(0, 10).join(', ')}...`)
    
    // Verify we got text from all pages
    const emptyPages = pageTexts.map((p, i) => p.length === 0 ? i + 1 : null).filter(p => p !== null)
    if (emptyPages.length > 0) {
      console.warn(`Warning: Empty pages detected: ${emptyPages.slice(0, 10).join(', ')}${emptyPages.length > 10 ? '...' : ''}`)
    }
    
    return {
      text: fullText,
      numPages: data.numpages,
      pageTexts,
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Alternative extraction using simpler method if the above fails
export async function extractTextSimple(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer)
    return data.text
  } catch (error) {
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
