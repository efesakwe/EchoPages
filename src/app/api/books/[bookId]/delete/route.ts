import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = params

    // Use service client for all operations to bypass RLS
    const serviceSupabase = createServiceClient()

    // Verify book ownership
    const { data: book, error: bookError } = await serviceSupabase
      .from('books')
      .select('id, pdf_url, owner_id')
      .eq('id', bookId)
      .eq('owner_id', user.id)
      .single()

    if (bookError || !book) {
      console.error('Book not found:', bookError)
      return NextResponse.json({ error: 'Book not found or access denied' }, { status: 404 })
    }

    console.log('Deleting book:', bookId, book.pdf_url)

    // Get all chapters to find audio files
    const { data: chapters } = await serviceSupabase
      .from('chapters')
      .select('id')
      .eq('book_id', bookId)

    console.log('Found chapters to delete:', chapters?.length || 0)

    // Delete audio files from storage for each chapter
    if (chapters && chapters.length > 0) {
      for (const chapter of chapters) {
        try {
          const { data: audioFiles } = await serviceSupabase.storage
            .from('books')
            .list(`audio/${chapter.id}/`)

          if (audioFiles && audioFiles.length > 0) {
            const filePaths = audioFiles.map(f => `audio/${chapter.id}/${f.name}`)
            console.log('Deleting audio files:', filePaths)
            await serviceSupabase.storage
              .from('books')
              .remove(filePaths)
          }
        } catch (err) {
          console.error('Error deleting audio files for chapter:', chapter.id, err)
        }
      }

      // Delete audio chunks using service client
      const chapterIds = chapters.map(c => c.id)
      const { error: chunksError } = await serviceSupabase
        .from('audio_chunks')
        .delete()
        .in('chapter_id', chapterIds)
      
      if (chunksError) {
        console.error('Error deleting audio chunks:', chunksError)
      }
    }

    // Delete the PDF file from storage
    if (book.pdf_url) {
      try {
        // Extract file path from URL - handle different URL formats
        let pdfPath = null
        if (book.pdf_url.includes('/books/')) {
          pdfPath = book.pdf_url.split('/books/')[1]?.split('?')[0]
        } else if (book.pdf_url.includes('/object/public/books/')) {
          pdfPath = book.pdf_url.split('/object/public/books/')[1]?.split('?')[0]
        }
        
        if (pdfPath) {
          // Decode URI components
          pdfPath = decodeURIComponent(pdfPath)
          console.log('Deleting PDF:', pdfPath)
          await serviceSupabase.storage
            .from('books')
            .remove([pdfPath])
        }
      } catch (err) {
        console.error('Error deleting PDF:', err)
      }
    }

    // Delete playback state for this book using service client
    const { error: playbackError } = await serviceSupabase
      .from('playback_state')
      .delete()
      .eq('book_id', bookId)

    if (playbackError) {
      console.error('Error deleting playback state:', playbackError)
    }

    // Delete chapters using service client
    const { error: chaptersError } = await serviceSupabase
      .from('chapters')
      .delete()
      .eq('book_id', bookId)

    if (chaptersError) {
      console.error('Error deleting chapters:', chaptersError)
    }

    // Delete the book record using service client
    const { error: deleteError } = await serviceSupabase
      .from('books')
      .delete()
      .eq('id', bookId)

    if (deleteError) {
      console.error('Failed to delete book:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    console.log('Book deleted successfully:', bookId)
    return NextResponse.json({ success: true, message: 'Book deleted successfully' })
  } catch (error: any) {
    console.error('Delete book error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete book' },
      { status: 500 }
    )
  }
}
