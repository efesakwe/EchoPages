import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Queue, ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const supabase = createClient()
    const serviceSupabase = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { chapterId } = params

    // Verify chapter access - first get the chapter
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, book_id')
      .eq('id', chapterId)
      .single()

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Then verify user owns the book
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id')
      .eq('id', chapter.book_id)
      .eq('owner_id', user.id)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get existing chunks to find audio files to delete
    const { data: existingChunks } = await supabase
      .from('audio_chunks')
      .select('idx')
      .eq('chapter_id', chapterId)

    // Delete audio files from storage
    if (existingChunks && existingChunks.length > 0) {
      const filesToDelete = existingChunks.map(c => `audio/${chapterId}/${c.idx}.mp3`)
      console.log('Deleting audio files:', filesToDelete)
      const { error: storageError } = await serviceSupabase.storage
        .from('books')
        .remove(filesToDelete)
      if (storageError) {
        console.error('Failed to delete audio files:', storageError)
      }
    }

    // Delete existing audio chunks from database
    const { error: deleteError } = await supabase
      .from('audio_chunks')
      .delete()
      .eq('chapter_id', chapterId)

    if (deleteError) {
      console.error('Failed to delete audio chunks:', deleteError)
    }

    console.log(`Deleted chunks for chapter ${chapterId}, queueing regeneration...`)

    // Re-queue the audio generation job
    // Support both REDIS_URL (Railway external) and separate host/port/password
    const redis = process.env.REDIS_URL 
      ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : new IORedis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: null,
        })
    const queue = new Queue('audio-generation', { connection: redis as unknown as ConnectionOptions })

    await queue.add('generate', {
      chapterId,
      userId: user.id,
    })

    await redis.quit()

    return NextResponse.json({ 
      success: true, 
      message: 'Audio regeneration queued' 
    })
  } catch (error: any) {
    console.error('Regenerate audio error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to regenerate audio' },
      { status: 500 }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
