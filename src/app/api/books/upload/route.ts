import { createClient } from '@/lib/supabase/server'
import { uploadPDF } from '@/lib/services/storageService'
import { fetchBookMetadata } from '@/lib/services/bookMetadataService'
import { extractTextFromPDF } from '@/lib/services/pdfService'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const authorInput = formData.get('author') as string | null

    if (!file || !title) {
      return NextResponse.json({ error: 'Missing file or title' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    // Upload PDF to storage
    const pdfUrl = await uploadPDF(file, user.id)

    // Extract a sample of text from PDF for metadata extraction
    let extractedTextSample = ''
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfBuffer = Buffer.from(arrayBuffer)
      const { text } = await extractTextFromPDF(pdfBuffer)
      extractedTextSample = text.substring(0, 2000) // First 2000 chars for context
    } catch (error) {
      console.warn('Failed to extract text for metadata:', error)
    }

    // Fetch book metadata using AI (pass author if provided for better cover matching)
    console.log('Fetching book metadata for:', title, 'by', authorInput || 'unknown')
    const metadata = await fetchBookMetadata(title.trim(), extractedTextSample, authorInput?.trim())
    console.log('Metadata fetched:', { author: metadata.author, category: metadata.category, cover: metadata.coverImageUrl })

    // Create book record with metadata
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert({
        owner_id: user.id,
        title: metadata.title || title.trim(),
        pdf_url: pdfUrl,
        author: metadata.author,
        published_date: metadata.publishedDate || null,
        summary: metadata.summary,
        publisher: metadata.publisher || null,
        category: metadata.category || null,
        cover_image_url: metadata.coverImageUrl || null,
        isbn: metadata.isbn || null,
        language: metadata.language || 'English',
        series: metadata.series || null,
      })
      .select()
      .single()

    if (bookError) {
      console.error('Book creation error:', bookError)
      return NextResponse.json({ error: bookError.message }, { status: 500 })
    }

    return NextResponse.json({ bookId: book.id })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload book' },
      { status: 500 }
    )
  }
}
