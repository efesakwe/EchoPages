import { createClient } from '@/lib/supabase/server'
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

    // Delete all chapters for this book (cascades will delete audio_chunks and playback_state)
    // RLS policy should allow this if book ownership is verified
    const { error: deleteError } = await supabase
      .from('chapters')
      .delete()
      .eq('book_id', bookId)

    if (deleteError) {
      throw new Error(`Failed to delete chapters: ${deleteError.message}`)
    }

    return NextResponse.json({ success: true, message: 'Chapters deleted' })
  } catch (error: any) {
    console.error('Delete chapters error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete chapters' },
      { status: 500 }
    )
  }
}
