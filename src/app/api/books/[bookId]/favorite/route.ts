import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Toggle favorite status for a book
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
      .select('id, is_favorite')
      .eq('user_id', user.id)
      .eq('book_id', bookId)
      .single()

    if (existing) {
      // Toggle favorite
      const { error } = await supabase
        .from('user_book_status')
        .update({ 
          is_favorite: !existing.is_favorite,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        is_favorite: !existing.is_favorite 
      })
    } else {
      // Create new record with favorite = true
      const { error } = await supabase
        .from('user_book_status')
        .insert({
          user_id: user.id,
          book_id: bookId,
          is_favorite: true,
        })

      if (error) throw error

      return NextResponse.json({ 
        success: true, 
        is_favorite: true 
      })
    }
  } catch (error: any) {
    console.error('Error toggling favorite:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Get favorite status for a book
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
      .select('is_favorite')
      .eq('user_id', user.id)
      .eq('book_id', params.bookId)
      .single()

    return NextResponse.json({ 
      is_favorite: data?.is_favorite || false 
    })
  } catch (error: any) {
    return NextResponse.json({ is_favorite: false })
  }
}
