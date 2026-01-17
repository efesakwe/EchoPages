import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
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

// GET - Get book details
export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: book, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', params.bookId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json({ book })
  } catch (error: any) {
    console.error('Error getting book:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a book and all associated data
export async function DELETE(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookId = params.bookId

    // Verify ownership
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, owner_id, pdf_url')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (book.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this book' }, { status: 403 })
    }

    // Use service client for deletion to bypass RLS
    const serviceClient = createServiceClient()

    // Get all chapters and their audio chunks for cleanup
    const { data: chapters } = await serviceClient
      .from('chapters')
      .select('id')
      .eq('book_id', bookId)

    // Delete audio files from storage
    if (chapters && chapters.length > 0) {
      const chapterIds = chapters.map(c => c.id)
      
      // Get audio chunk URLs to delete from storage
      const { data: audioChunks } = await serviceClient
        .from('audio_chunks')
        .select('audio_url')
        .in('chapter_id', chapterIds)

      // Delete audio files from storage
      if (audioChunks && audioChunks.length > 0) {
        const filePaths = audioChunks
          .filter(chunk => chunk.audio_url)
          .map(chunk => {
            // Extract path from URL
            const url = chunk.audio_url!
            const match = url.match(/\/audio\/(.+)$/)
            return match ? `audio/${match[1]}` : null
          })
          .filter(Boolean)

        if (filePaths.length > 0) {
          await serviceClient.storage
            .from('books')
            .remove(filePaths as string[])
        }
      }

      // Delete audio chunks
      await serviceClient
        .from('audio_chunks')
        .delete()
        .in('chapter_id', chapterIds)
    }

    // Delete chapters
    await serviceClient
      .from('chapters')
      .delete()
      .eq('book_id', bookId)

    // Delete user book status
    await serviceClient
      .from('user_book_status')
      .delete()
      .eq('book_id', bookId)

    // Delete user library entries
    await serviceClient
      .from('user_library')
      .delete()
      .eq('book_id', bookId)

    // Delete playback state
    await serviceClient
      .from('playback_state')
      .delete()
      .eq('book_id', bookId)

    // Delete PDF from storage
    if (book.pdf_url) {
      const pdfMatch = book.pdf_url.match(/\/pdfs\/(.+)$/)
      if (pdfMatch) {
        await serviceClient.storage
          .from('books')
          .remove([`pdfs/${pdfMatch[1]}`])
      }
    }

    // Finally, delete the book
    const { error: deleteError } = await serviceClient
      .from('books')
      .delete()
      .eq('id', bookId)

    if (deleteError) {
      console.error('Error deleting book:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Book deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting book:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
