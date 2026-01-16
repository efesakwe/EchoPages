import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Queue, ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'
import { NextResponse } from 'next/server'

// Lazy-load Redis to avoid build-time connection
let redis: Redis | null = null
let audioQueue: Queue | null = null

function getQueue() {
  if (!audioQueue) {
    // Support both REDIS_URL (Railway external) and separate host/port/password
    if (process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
      })
    } else {
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
      })
    }
    audioQueue = new Queue('audio-generation', {
      connection: redis as unknown as ConnectionOptions,
    })
  }
  return audioQueue
}

// Helper to get user from either cookie session or Bearer token
async function getAuthenticatedUser(request: Request) {
  // First try cookie-based auth (web app)
  const supabase = createClient()
  const { data: { user: cookieUser } } = await supabase.auth.getUser()
  
  if (cookieUser) {
    return { user: cookieUser, supabase }
  }
  
  // Try Bearer token auth (mobile app)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    // Create a new Supabase client with the token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const tokenClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    
    const { data: { user: tokenUser } } = await tokenClient.auth.getUser(token)
    
    if (tokenUser) {
      return { user: tokenUser, supabase: tokenClient }
    }
  }
  
  return { user: null, supabase }
}

export async function POST(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

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

    const queue = getQueue()
    
    if (existingChunks && existingChunks.length > 0) {
      // Enqueue job to generate missing chunks
      await queue.add('generate-chunks', {
        chapterId,
        userId: user.id,
      })
    } else {
      // First time: need to create chunks from chapter text
      await queue.add('structure-and-generate', {
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

// Force dynamic rendering
export const dynamic = 'force-dynamic'
