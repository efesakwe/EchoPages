import { createClient } from '@/lib/supabase/server'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
})

const audioQueue = new Queue('audio-generation', {
  connection: redis,
})

export async function POST(
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

    // Check if chunks already exist
    const { data: existingChunks } = await supabase
      .from('audio_chunks')
      .select('id')
      .eq('chapter_id', chapterId)

    if (existingChunks && existingChunks.length > 0) {
      // Enqueue job to generate missing chunks
      await audioQueue.add('generate-chunks', {
        chapterId,
        userId: user.id,
      })
    } else {
      // First time: need to create chunks from chapter text
      await audioQueue.add('structure-and-generate', {
        chapterId,
        userId: user.id,
      })
    }

    return NextResponse.json({ success: true, message: 'Audio generation queued' })
  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to queue generation' },
      { status: 500 }
    )
  }
}
