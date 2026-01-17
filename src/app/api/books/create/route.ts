import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fetchBookMetadata } from '@/lib/services/bookMetadataService'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

// POST - Create a book record (used by mobile app after direct storage upload)
export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 })
    }

    const body = await request.json()
    const { title, author, pdfUrl } = body

    if (!title || !pdfUrl) {
      return NextResponse.json({ error: 'Missing title or pdfUrl' }, { status: 400 })
    }

    console.log(`Creating book record for user ${user.id}: ${title}`)

    // Fetch book metadata using AI
    console.log('Fetching book metadata for:', title, 'by', author || 'unknown')
    let metadata
    try {
      metadata = await fetchBookMetadata(title.trim(), '', author?.trim())
      console.log('Metadata fetched:', { author: metadata.author, category: metadata.category, cover: metadata.coverImageUrl })
    } catch (metadataError: any) {
      console.error('Metadata fetch error:', metadataError)
      // Continue with basic metadata if fetch fails
      metadata = {
        title: title.trim(),
        author: author?.trim() || null,
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
        author: metadata.author || author?.trim() || null,
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
        error: `Failed to create book record: ${bookError.message}` 
      }, { status: 500 })
    }

    if (!book) {
      return NextResponse.json({ error: 'Book created but no data returned' }, { status: 500 })
    }

    console.log('Book created successfully:', book.id)
    return NextResponse.json({ bookId: book.id })
  } catch (error: any) {
    console.error('Create book error:', error)
    return NextResponse.json({ error: error.message || 'Failed to create book' }, { status: 500 })
  }
}
