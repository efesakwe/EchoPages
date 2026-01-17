import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { uploadPDF } from '@/lib/services/storageService'
import { fetchBookMetadata } from '@/lib/services/bookMetadataService'
import { extractTextFromPDF } from '@/lib/services/pdfService'
import { createServiceClient } from '@/lib/supabase/server'
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

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in to upload books.' }, { status: 401 })
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

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    console.log(`Starting upload for user ${user.id}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // Upload PDF to storage
    let pdfUrl: string
    try {
      pdfUrl = await uploadPDF(file, user.id)
      console.log('PDF uploaded successfully:', pdfUrl)
    } catch (uploadError: any) {
      console.error('PDF upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message || 'Failed to upload PDF file' }, { status: 500 })
    }

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
    let metadata
    try {
      metadata = await fetchBookMetadata(title.trim(), extractedTextSample, authorInput?.trim())
      console.log('Metadata fetched:', { author: metadata.author, category: metadata.category, cover: metadata.coverImageUrl })
    } catch (metadataError: any) {
      console.error('Metadata fetch error:', metadataError)
      // Continue with basic metadata if fetch fails
      metadata = {
        title: title.trim(),
        author: authorInput?.trim() || null,
        summary: '',
        coverImageUrl: null,
        publishedDate: null,
        publisher: null,
        category: null,
        isbn: null,
        language: 'English',
        series: null,
      }
    }

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
      return NextResponse.json({ 
        error: `Failed to create book record: ${bookError.message}. Make sure the "books" table exists in your Supabase database.` 
      }, { status: 500 })
    }

    if (!book) {
      return NextResponse.json({ error: 'Book created but no data returned' }, { status: 500 })
    }

    console.log('Book created successfully:', book.id)
    return NextResponse.json({ bookId: book.id })
  } catch (error: any) {
    console.error('Upload error:', error)
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to upload book'
    
    if (error.message?.includes('Missing Supabase service role')) {
      errorMessage = 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Please check your .env.local file.'
    } else if (error.message?.includes('Bucket not found')) {
      errorMessage = 'Storage bucket "books" does not exist. Please create it in your Supabase dashboard under Storage.'
    } else if (error.message?.includes('row-level security policy')) {
      errorMessage = 'Permission denied. Please check your Supabase storage RLS policies for the "books" bucket.'
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
