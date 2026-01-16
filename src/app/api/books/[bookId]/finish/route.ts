import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Toggle finished status for a book (personal to each user)
 */
export async function POST(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookId = params.bookId

    // Check if status record exists
    const { data: existing } = await supabase
      .from('user_book_status')
      .select('id, is_finished')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .single()

    if (existing) {
      // Toggle finished
      const newFinished = !existing.is_finished
      const { error } = await supabase
        .from('user_book_status')
        .update({ 
          is_finished: newFinished,
          finished_at: newFinished ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        is_finished: newFinished 
      })
    } else {
      // Create new record with finished = true
      const { error } = await supabase
        .from('user_book_status')
        .insert({
          user_id: user.id,
          book_id: bookId,
          is_finished: true,
          finished_at: new Date().toISOString(),
        })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        is_finished: true 
      })
    }
  } catch (error: any) {
    console.error('Error toggling finished:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Get finished status for a book
 */
export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data } = await supabase
      .from('user_book_status')
      .select('is_finished, finished_at')
      .eq('user_id', user.id)
      .eq('book_id', params.bookId)
      .single()

    return NextResponse.json({ 
      is_finished: data?.is_finished || false,
      finished_at: data?.finished_at || null
    })
  } catch (error: any) {
    return NextResponse.json({ is_finished: false, finished_at: null })
  }
}
