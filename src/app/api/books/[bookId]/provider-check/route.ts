import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Check which TTS provider was used for a book's audio chunks
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

    const { bookId } = params

    // First get chapter IDs for this book
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id')
      .eq('book_id', bookId)

    const chapterIds = chapters?.map(c => c.id) || []

    // Get all audio chunks for this book's chapters
    const { data: chunks, error } = chapterIds.length > 0 
      ? await supabase
          .from('audio_chunks')
          .select('provider, status')
          .in('chapter_id', chapterIds)
          .eq('status', 'done')
      : { data: [], error: null }

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 })
    }

    // Count providers used
    const providerCounts: Record<string, number> = {}
    chunks?.forEach(chunk => {
      const provider = chunk.provider || 'elevenlabs' // Default for old chunks
      providerCounts[provider] = (providerCounts[provider] || 0) + 1
    })

    // Determine primary provider
    const totalChunks = chunks?.length || 0
    const primaryProvider = totalChunks > 0
      ? Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
      : null

    return NextResponse.json({
      bookId,
      totalChunks,
      providerCounts,
      primaryProvider,
      hasAudio: totalChunks > 0,
    })
  } catch (error: any) {
    console.error('Error checking provider:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
