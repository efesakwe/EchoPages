import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PlaybackStateSchema = z.object({
  userId: z.string().uuid(),
  bookId: z.string().uuid(),
  chapterId: z.string().uuid(),
  chunkIdx: z.number().int().min(0),
  secondsInChunk: z.number().min(0),
  playbackRate: z.number().min(0.5).max(2.0),
})

export type PlaybackState = z.infer<typeof PlaybackStateSchema>

export async function savePlaybackState(state: PlaybackState): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('playback_state')
    .upsert({
      user_id: state.userId,
      book_id: state.bookId,
      chapter_id: state.chapterId,
      chunk_idx: state.chunkIdx,
      seconds_in_chunk: state.secondsInChunk,
      playback_rate: state.playbackRate,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,book_id,chapter_id',
    })

  if (error) {
    throw new Error(`Failed to save playback state: ${error.message}`)
  }
}

export async function loadPlaybackState(
  userId: string,
  bookId: string,
  chapterId?: string
): Promise<PlaybackState | null> {
  const supabase = createServiceClient()

  let query = supabase
    .from('playback_state')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  } else {
    query = query.order('updated_at', { ascending: false }).limit(1)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw new Error(`Failed to load playback state: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return {
    userId: data.user_id,
    bookId: data.book_id,
    chapterId: data.chapter_id,
    chunkIdx: data.chunk_idx,
    secondsInChunk: parseFloat(data.seconds_in_chunk),
    playbackRate: parseFloat(data.playback_rate),
  }
}
