import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Add a public book to user's personal library
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { bookId } = body

    if (!bookId) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 })
    }

    // Verify the book is public and has complete audio
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, is_public, audio_complete')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (!book.is_public || !book.audio_complete) {
      return NextResponse.json({ error: 'This book is not available in the shared library' }, { status: 400 })
    }

    // Check if already in user's library
    const { data: existing } = await supabase
      .from('user_library')
      .select('id')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .single()

    if (existing) {
      return NextResponse.json({ 
        success: true, 
        message: 'Book is already in your library',
        alreadyAdded: true 
      })
    }

    // Add to user's library
    const { error: insertError } = await supabase
      .from('user_library')
      .insert({
        user_id: user.id,
        book_id: bookId,
      })

    if (insertError) {
      console.error('Error adding to library:', insertError)
      return NextResponse.json({ error: 'Failed to add book to library' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `"${book.title}" has been added to your library!`,
      alreadyAdded: false
    })

  } catch (error: any) {
    console.error('Error adding book to library:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
