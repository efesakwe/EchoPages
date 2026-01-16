import { createClient } from '@/lib/supabase/server'
import { loadPlaybackState } from '@/lib/services/playbackService'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bookId = searchParams.get('bookId')
    const chapterId = searchParams.get('chapterId')

    if (!bookId) {
      return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
    }

    const state = await loadPlaybackState(user.id, bookId, chapterId || undefined)

    return NextResponse.json({ state })
  } catch (error: any) {
    console.error('Load playback error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load playback state' },
      { status: 500 }
    )
  }
}
