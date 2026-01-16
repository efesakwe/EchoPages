import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chapterId } = params

    // First, get the chapter
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*, book_id')
      .eq('id', chapterId)
      .single()

    if (chapterError || !chapter) {
      console.error('Chapter fetch error:', chapterError)
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('owner_id')
      .eq('id', chapter.book_id)
      .eq('owner_id', user.id)
      .single()

    if (bookError || !book) {
      console.error('Book ownership verification error:', bookError)
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get audio chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('audio_chunks')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('idx', { ascending: true })

    if (chunksError) {
      return NextResponse.json({ error: chunksError.message }, { status: 500 })
    }

    // Calculate generation status
    const total = chunks?.length || 0
    const done = chunks?.filter(c => c.status === 'done').length || 0
    const processing = chunks?.filter(c => c.status === 'processing').length || 0
    const error = chunks?.filter(c => c.status === 'error').length || 0
    const pending = chunks?.filter(c => c.status === 'pending').length || 0

    const progress = total > 0 ? Math.round((done / total) * 100) : 0

    return NextResponse.json({
      chunks: chunks || [],
      status: {
        total,
        done,
        processing,
        error,
        pending,
        progress,
      },
    })
  } catch (error: any) {
    console.error('Get chunks error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chunks' },
      { status: 500 }
    )
  }
}
