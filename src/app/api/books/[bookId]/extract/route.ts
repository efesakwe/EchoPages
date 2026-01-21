import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { extractTextFromPDF } from '@/lib/services/pdfService'
import { detectChapters, saveChapters } from '@/lib/services/chapterService'
import { NextResponse } from 'next/server'

// Helper to get user from either cookie session or Bearer token
async function getAuthenticatedUser(request: Request) {
  // First try cookie-based auth (web app)
  const supabase = createClient()
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  
  if (cookieUser) {
    return { user: cookieUser, supabase }
  }
  
  // Try Bearer token auth (mobile app)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const tokenClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    
    const { data: { user: tokenUser } } = await tokenClient.auth.getUser(token)
    
    if (tokenUser) {
      return { user: tokenUser, supabase: tokenClient }
    }
  }
  
  return { user: null, supabase }
}

export async function POST(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = params

    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .eq('owner_id', user.id)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Extract file path from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/books/pdfs/...
    // or: https://[project].supabase.co/storage/v1/object/sign/books/pdfs/...
    let filePath: string | null = null
    
    // Try to extract path after /books/
    const urlMatch = book.pdf_url.match(/\/books\/(.+)$/)
    if (urlMatch && urlMatch[1]) {
      // Path might already include 'pdfs/' or might not
      filePath = urlMatch[1].includes('pdfs/') ? urlMatch[1] : `pdfs/${urlMatch[1]}`
    }

    // If that didn't work, try splitting on 'books/'
    if (!filePath) {
      const urlParts = book.pdf_url.split('/books/')
      if (urlParts.length > 1) {
        filePath = urlParts[1].includes('pdfs/') ? urlParts[1] : `pdfs/${urlParts[1]}`
      }
    }

    if (!filePath) {
      console.error('Failed to extract file path from URL:', book.pdf_url)
      throw new Error(`Invalid PDF URL format: ${book.pdf_url}`)
    }

    // Delete existing chapters first (to allow re-extraction)
    const serviceSupabase = createServiceClient()
    const { error: deleteError } = await serviceSupabase
      .from('chapters')
      .delete()
      .eq('book_id', bookId)

    if (deleteError) {
      console.error('Warning: Failed to delete existing chapters:', deleteError)
      // Continue anyway - upsert will handle conflicts
    }

    console.log('Attempting to download PDF from path:', filePath)

    // Download PDF from Supabase Storage using service client
    const { data: pdfData, error: downloadError } = await serviceSupabase.storage
      .from('books')
      .download(filePath)

    if (downloadError) {
      console.error('PDF download error:', downloadError)
      throw new Error(`Failed to download PDF: ${downloadError.message || JSON.stringify(downloadError)}`)
    }

    if (!pdfData) {
      throw new Error('PDF download returned no data')
    }

    // Convert Blob to Buffer
    const arrayBuffer = await pdfData.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)
    
    if (pdfBuffer.length === 0) {
      throw new Error('Downloaded PDF is empty')
    }
    
    console.log(`Successfully downloaded PDF, size: ${pdfBuffer.length} bytes`)

    // Extract text
    const { text, numPages, pageTexts } = await extractTextFromPDF(pdfBuffer)

    if (!text || text.trim().length === 0) {
      throw new Error('PDF contains no extractable text')
    }

    console.log(`\n========== PDF EXTRACTION RESULTS ==========`)
    console.log(`Total pages in PDF: ${numPages}`)
    console.log(`Pages with text extracted: ${pageTexts?.length || 'N/A'}`)
    console.log(`Total characters extracted: ${text.length}`)
    
    // Check for empty pages
    if (pageTexts) {
      const emptyPages = pageTexts.map((p, i) => p.length < 10 ? i + 1 : null).filter(p => p !== null)
      if (emptyPages.length > 0) {
        console.warn(`[WARN] Pages with little/no text: ${emptyPages.join(', ')}`)
      }
      
      // Log first few pages content length
      console.log(`\nCharacters per page (first 20):`)
      pageTexts.slice(0, 20).forEach((p, i) => {
        console.log(`  Page ${i + 1}: ${p.length} chars`)
      })
    }
    
    console.log(`\nFirst 1000 chars of extracted text:`)
    console.log(text.substring(0, 1000))
    console.log(`\n============================================`)

    // Detect chapters with page-based extraction
    const chapters = await detectChapters(text, pageTexts)

    if (chapters.length === 0) {
      throw new Error('No chapters could be detected from the PDF')
    }

    console.log(`Detected ${chapters.length} chapters`)
    
    // Log each chapter's length for debugging
    let totalChapterChars = 0
    chapters.forEach((ch, i) => {
      console.log(`Chapter ${i} "${ch.title}": ${ch.text.length} characters`)
      totalChapterChars += ch.text.length
    })
    
    // Verify coverage
    const coveragePercent = (totalChapterChars / text.length) * 100
    console.log(`\n========== EXTRACTION VERIFICATION ==========`)
    console.log(`Original text: ${text.length} chars`)
    console.log(`Chapters total: ${totalChapterChars} chars`)
    console.log(`Coverage: ${coveragePercent.toFixed(1)}%`)
    if (coveragePercent < 90) {
      console.error(`[WARN] Low coverage! Only ${coveragePercent.toFixed(1)}% of text was captured.`)
      console.error(`Missing approximately ${text.length - totalChapterChars} characters`)
    }
    console.log(`==============================================\n`)

    // Save chapters
    await saveChapters(bookId, chapters)

    // For API calls (mobile), return JSON. For web, redirect.
    const acceptHeader = request.headers.get('Accept')
    if (acceptHeader?.includes('application/json') || request.headers.get('Authorization')) {
      return NextResponse.json({ 
        success: true, 
        message: `Successfully extracted ${chapters.length} chapters`,
        chaptersCount: chapters.length 
      })
    }

    // Redirect back to book page (web app)
    return NextResponse.redirect(new URL(`/book/${bookId}`, request.url))
  } catch (error: any) {
    console.error('Extract error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to extract chapters' },
      { status: 500 }
    )
  }
}
