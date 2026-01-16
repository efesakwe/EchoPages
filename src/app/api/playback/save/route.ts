import { createClient } from '@/lib/supabase/server'
import { savePlaybackState } from '@/lib/services/playbackService'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const PlaybackStateSchema = z.object({
  bookId: z.string().uuid(),
  chapterId: z.string().uuid(),
  chunkIdx: z.number().int().min(0),
  secondsInChunk: z.number().min(0),
  playbackRate: z.number().min(0.5).max(2.0),
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = PlaybackStateSchema.parse(body)

    await savePlaybackState({
      userId: user.id,
      ...validated,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Save playback error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save playback state' },
      { status: 500 }
    )
  }
}
