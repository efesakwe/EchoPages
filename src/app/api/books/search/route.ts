import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Search for existing public books by title and/or author
 * Used to check if a book already exists before uploading
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const title = searchParams.get('title')
    const author = searchParams.get('author')

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Search for public books with matching title (and optionally author)
    let query = supabase
      .from('books')
      .select(`
        id,
        title,
        author,
        cover_image_url,
        summary,
        total_chapters,
        completed_chapters,
        audio_complete,
        is_public,
        narrator_voice,
        tts_provider
      `)
      .eq('is_public', true)
      .eq('audio_complete', true)
      .ilike('title', `%${title}%`)

    if (author) {
      query = query.ilike('author', `%${author}%`)
    }

    const { data: books, error } = await query.limit(5)

    if (error) {
      console.error('Error searching books:', error)
      return NextResponse.json({ error: 'Failed to search books' }, { status: 500 })
    }

    // Check if user already has any of these books in their library
    if (books && books.length > 0) {
      const bookIds = books.map(b => b.id)
      const { data: userLibrary } = await supabase
        .from('user_library')
        .select('book_id')
        .eq('user_id', user.id)
        .in('book_id', bookIds)

      const userBookIds = new Set(userLibrary?.map(l => l.book_id) || [])
      
      // Add flag to indicate if user already has the book
      const booksWithStatus = books.map(book => ({
        ...book,
        in_user_library: userBookIds.has(book.id)
      }))

      return NextResponse.json({
        found: true,
        books: booksWithStatus,
        message: books.length === 1 
          ? 'This book is already in our library!' 
          : `Found ${books.length} matching books in our library`
      })
    }

    return NextResponse.json({
      found: false,
      books: [],
      message: 'No matching books found. You can upload this book.'
    })

  } catch (error: any) {
    console.error('Error in book search:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
