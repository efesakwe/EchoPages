import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AudioPlayer } from '@/components/AudioPlayer'
import { GenerateAudioButton } from '@/components/GenerateAudioButton'

export default async function ChapterPlayerPage({
  params,
}: {
  params: { bookId: string; chapterId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { bookId, chapterId } = params

  // Verify book ownership and fetch book data
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .eq('owner_id', user.id)
    .single()

  if (!book) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Access denied</h1>
          <Link href="/library" className="text-orange-600 hover:text-orange-700">
            ← Back to Library
          </Link>
        </div>
      </div>
    )
  }

  // Fetch all chapters for the book
  const { data: allChapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('idx', { ascending: true })

  // Fetch current chapter
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
    .eq('book_id', bookId)
    .single()

  if (chapterError || !chapter) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Chapter not found</h1>
          <Link href={`/book/${bookId}`} className="text-orange-600 hover:text-orange-700">
            ← Back to Book
          </Link>
        </div>
      </div>
    )
  }

  // Fetch audio chunks
  const { data: chunks } = await supabase
    .from('audio_chunks')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('idx', { ascending: true })

  // Fetch playback state
  const { data: playbackState } = await supabase
    .from('playback_state')
    .select('*')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .eq('chapter_id', chapterId)
    .single()

  // Calculate generation status
  const total = chunks?.length || 0
  const done = chunks?.filter(c => c.status === 'done').length || 0
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  
  // Determine which provider was used (check most recent chunks)
  const completedChunks = chunks?.filter(c => c.status === 'done') || []
  const providers = completedChunks.map(c => {
    // Default to 'elevenlabs' for old chunks that don't have provider set
    return c.provider || 'elevenlabs'
  })
  
  const providerCounts: Record<string, number> = {}
  providers.forEach(p => {
    providerCounts[p] = (providerCounts[p] || 0) + 1
  })
  
  // Get the most common provider, or use the most recent chunk's provider
  const primaryProvider = providers.length > 0
    ? Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'elevenlabs'
    : (chunks && chunks.length > 0 ? (chunks[0]?.provider || 'elevenlabs') : null)

  // Filter valid chapters
  const validChapters = (allChapters || []).filter(
    ch => ch && ch.id && ch.title && ch.title.trim().length > 0
  )

  // If no audio yet, show generation UI
  if (!chunks || chunks.length === 0 || progress < 100) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 to-white">
        {/* Top Navigation */}
        <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Link href={`/book/${bookId}`} className="text-gray-600 hover:text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Book
            </Link>
          </div>
        </nav>

        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-8">
          {/* Provider Info Banner - Show if there are completed chunks */}
          {done > 0 && primaryProvider && (
            <div className={`mb-4 px-4 py-2 rounded-lg max-w-md ${
              primaryProvider === 'openai' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-purple-50 border border-purple-200'
            }`}>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">TTS Provider:</span>{' '}
                <span className={`font-bold ${primaryProvider === 'openai' ? 'text-green-700' : 'text-purple-700'}`}>
                  {primaryProvider === 'openai' ? '💰 OpenAI TTS' : '🎙️ ElevenLabs'}
                </span>
                {' '}({done} chunks generated)
              </p>
            </div>
          )}
          
          {/* Cover Image */}
          <div className="w-64 h-64 rounded-lg shadow-xl overflow-hidden bg-gray-200 mb-6">
            {book.cover_image_url ? (
              <img
                src={book.cover_image_url}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-200 to-pink-200">
                <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
            {chapter.title}
          </h2>
          <p className="text-gray-500 mb-8">{book.title}</p>

          {chunks && chunks.length > 0 && progress < 100 ? (
            <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Generating Audio</span>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div
                  className="bg-orange-500 h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {done} of {total} parts generated
              </p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg border border-gray-200">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-gray-700 mb-2 text-lg">No audio generated yet</p>
              <p className="text-sm text-gray-500 mb-6">Generate audio to start listening</p>
              <GenerateAudioButton chapterId={chapterId} />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Full player view
  return (
    <div className="relative">
      {/* Provider Info Banner - Show above player if audio is ready */}
      {done > 0 && primaryProvider && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center ${
          primaryProvider === 'openai' 
            ? 'bg-green-50 border-b border-green-200' 
            : 'bg-purple-50 border-b border-purple-200'
        }`}>
          <p className="text-sm text-gray-700">
            <span className="font-semibold">TTS Provider:</span>{' '}
            <span className={`font-bold ${primaryProvider === 'openai' ? 'text-green-700' : 'text-purple-700'}`}>
              {primaryProvider === 'openai' ? '💰 OpenAI TTS' : '🎙️ ElevenLabs'}
            </span>
            {' '}(Used for this chapter's audio)
          </p>
        </div>
      )}
      <AudioPlayer
      chapterId={chapterId}
      bookId={bookId}
      chunks={chunks}
      initialPlaybackState={playbackState ? {
        chunkIdx: playbackState.chunk_idx,
        secondsInChunk: parseFloat(playbackState.seconds_in_chunk),
        playbackRate: parseFloat(playbackState.playback_rate),
      } : undefined}
      book={{
        title: book.title,
        author: book.author,
        cover_image_url: book.cover_image_url,
      }}
      chapter={{
        title: chapter.title,
        idx: chapter.idx,
      }}
      allChapters={validChapters}
    />
    </div>
  )
}
