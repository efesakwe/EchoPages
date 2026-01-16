import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Check which TTS provider was used for a specific chapter
 */
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

    // Get chapter and verify ownership
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, idx, title, book_id, books!inner(owner_id)')
      .eq('id', chapterId)
      .single()

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    if ((chapter.books as any)?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get audio chunks for this chapter
    const { data: chunks, error: chunksError } = await supabase
      .from('audio_chunks')
      .select('id, idx, provider, status, created_at')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: false })

    if (chunksError) {
      return NextResponse.json({ error: 'Failed to fetch chunks' }, { status: 500 })
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        chapterId,
        chapterTitle: chapter.title,
        chapterIdx: chapter.idx,
        hasAudio: false,
        provider: null,
        message: 'No audio chunks found for this chapter',
      })
    }

    // Determine which provider was used
    const providers = chunks
      .filter(c => c.status === 'done')
      .map(c => c.provider || 'elevenlabs') // Default for old chunks

    const providerCounts: Record<string, number> = {}
    providers.forEach(p => {
      providerCounts[p] = (providerCounts[p] || 0) + 1
    })

    const primaryProvider = providers.length > 0
      ? Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
      : null

    const mostRecentChunk = chunks[0]
    const mostRecentProvider = mostRecentChunk?.provider || 'elevenlabs'
    const generatedAt = mostRecentChunk?.created_at

    return NextResponse.json({
      chapterId,
      chapterTitle: chapter.title,
      chapterIdx: chapter.idx,
      hasAudio: chunks.some(c => c.status === 'done'),
      provider: primaryProvider || mostRecentProvider,
      mostRecentProvider,
      providerCounts,
      totalChunks: chunks.length,
      completedChunks: chunks.filter(c => c.status === 'done').length,
      generatedAt: generatedAt || null,
      message: primaryProvider 
        ? `This chapter used ${primaryProvider === 'openai' ? 'OpenAI TTS' : 'ElevenLabs'} for audio generation`
        : 'Provider information not available',
    })
  } catch (error: any) {
    console.error('Error checking provider:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
