import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AppSidebar } from '@/components/AppSidebar'
import { ChapterManagementButtons } from '@/components/ChapterManagementButtons'
import { ChapterPreviewButton } from '@/components/ChapterPreviewButton'
import { VoiceSelector } from '@/components/VoiceSelector'
import { TTSProviderSelector } from '@/components/TTSProviderSelector'

export default async function BookDetailPage({
  params,
}: {
  params: { bookId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { bookId } = params

  // Fetch book with all metadata
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .eq('owner_id', user.id)
    .single()

  if (bookError || !book) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Book not found</h1>
          <Link href="/library" className="text-orange-500 hover:text-orange-600">
            ← Back to Library
          </Link>
        </div>
      </div>
    )
  }

  // Fetch chapters with text content for preview
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, idx, title, text_content')
    .eq('book_id', bookId)
    .order('idx', { ascending: true })

  // Check if any chapters have generated audio
  let hasGeneratedAudio = false
  if (chapters && chapters.length > 0) {
    const { count } = await supabase
      .from('audio_chunks')
      .select('id', { count: 'exact', head: true })
      .in('chapter_id', chapters.map(c => c.id))
      .eq('status', 'done')
    
    hasGeneratedAudio = (count || 0) > 0
  }

  // Fetch playback state
  const { data: playbackState } = await supabase
    .from('playback_state')
    .select('chapter_id, chunk_idx, seconds_in_chunk')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .single()

  // Calculate total duration estimate (rough: 1 chapter ≈ 20-30 min)
  const estimatedHours = chapters ? Math.floor((chapters.length * 25) / 60) : 0
  const estimatedMinutes = chapters ? (chapters.length * 25) % 60 : 0
  const duration = chapters && chapters.length > 0 
    ? `${estimatedHours}h ${estimatedMinutes}m`
    : 'Duration unknown'

  // Get first chapter for "Play" button
  const firstChapter = chapters && chapters.length > 0 ? chapters[0] : null
  const playLink = playbackState 
    ? `/book/${bookId}/chapter/${playbackState.chapter_id}`
    : firstChapter 
      ? `/book/${bookId}/chapter/${firstChapter.id}`
      : null

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Sidebar */}
      <AppSidebar userEmail={user.email} />

      {/* Main Content */}
      <main className="flex-1">
        {/* Top Navigation */}
        <nav className="bg-white border-b border-gray-200 px-8 py-4">
          <Link href="/library" className="text-gray-600 hover:text-black transition-colors">
            ← Back to Library
          </Link>
        </nav>

        {/* Book Details Section */}
        <div className="px-8 py-8">
          <div className="flex gap-8 mb-12">
            {/* Left Column - Book Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-black mb-2">{book.title}</h1>
              {book.series && (
                <p className="text-xl text-gray-600 mb-4">{book.series}</p>
              )}

              <div className="space-y-2 mb-6">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold uppercase">Written by</span>{' '}
                  <Link href={`/library?author=${encodeURIComponent(book.author || '')}`} className="text-blue-600 hover:underline">
                    {book.author || 'Unknown Author'}
                  </Link>
                </p>
              </div>

              {/* TTS Provider Selector */}
              <div className="mb-6">
                <TTSProviderSelector 
                  bookId={bookId} 
                  currentProvider={book.tts_provider || 'openai'} 
                  hasGeneratedAudio={hasGeneratedAudio}
                />
              </div>

              {/* Voice Selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold uppercase text-gray-500 mb-2">
                  Narrator Voice
                </label>
                <VoiceSelector 
                  bookId={bookId} 
                  currentVoice={book.narrator_voice || 'rachel'} 
                  hasGeneratedAudio={hasGeneratedAudio}
                  currentProvider={book.tts_provider || 'openai'}
                />
              </div>

              {/* Rating */}
              <div className="flex items-center space-x-2 mb-6">
                <span className="text-2xl font-bold text-black">{book.rating?.toFixed(1) || '4.5'}</span>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i <= Math.floor(book.rating || 4.5) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-gray-600">({book.rating_count || 0} ratings)</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-4 mb-6">
                {playLink ? (
                  <Link
                    href={playLink}
                    className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play</span>
                  </Link>
                ) : (
                  <button
                    disabled
                    className="px-8 py-3 bg-gray-300 text-gray-500 rounded-lg font-semibold cursor-not-allowed flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play</span>
                  </button>
                )}
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  <span>In your Library</span>
                </button>
                <button className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
                  More options
                </button>
              </div>

              {/* Extract Chapters Button */}
              {(!chapters || chapters.length === 0) && (
                <div className="mb-6">
                  <ChapterManagementButtons bookId={bookId} hasChapters={false} />
                </div>
              )}
            </div>

            {/* Right Column - Cover Image */}
            <div className="flex-shrink-0">
              <div className="w-64 h-64 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg shadow-lg flex items-center justify-center overflow-hidden">
                {book.cover_image_url ? (
                  <img
                    src={book.cover_image_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-32 h-32 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
              </div>
              {firstChapter && (
                <Link
                  href={`/book/${bookId}/chapter/${firstChapter.id}`}
                  className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Preview</span>
                </Link>
              )}
            </div>
          </div>

          {/* Bottom Section - About and Metadata */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left - About this listen */}
              <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold text-black mb-4">About this listen</h2>
                <div className="prose max-w-none">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {book.summary || 'No description available. This book has been uploaded to your library.'}
                  </p>
                </div>
              </div>

              {/* Right - Metadata */}
              <div className="lg:col-span-1">
                <h2 className="text-xl font-bold text-black mb-4">Details</h2>
                <div className="space-y-3 text-sm">
                  {book.series && (
                    <div>
                      <span className="font-semibold uppercase text-gray-500">Series</span>
                      <p className="text-black mt-1">{book.series}</p>
                    </div>
                  )}
                  {book.published_date && (
                    <div>
                      <span className="font-semibold uppercase text-gray-500">Release Date</span>
                      <p className="text-black mt-1">
                        {new Date(book.published_date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold uppercase text-gray-500">Language</span>
                    <p className="text-black mt-1">{book.language || 'English'}</p>
                  </div>
                  <div>
                    <span className="font-semibold uppercase text-gray-500">Format</span>
                    <p className="text-black mt-1">Unabridged Audiobook</p>
                  </div>
                  <div>
                    <span className="font-semibold uppercase text-gray-500">Length</span>
                    <p className="text-black mt-1">{duration}</p>
                  </div>
                  {book.publisher && (
                    <div>
                      <span className="font-semibold uppercase text-gray-500">Publisher</span>
                      <p className="text-black mt-1">{book.publisher}</p>
                    </div>
                  )}
                  {book.category && (
                    <div>
                      <span className="font-semibold uppercase text-gray-500">Categories</span>
                      <p className="text-black mt-1">{book.category}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Chapters Section */}
          {chapters && chapters.length > 0 && (
            <div className="mt-8 bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-black">Chapters</h2>
                <ChapterManagementButtons bookId={bookId} hasChapters={true} />
              </div>
              
              {/* Important Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Preview chapters before generating audio!</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Click "Preview" on each chapter to verify the text was extracted correctly. 
                      This saves credits by catching issues early.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {chapters
                  .filter(ch => ch && ch.id && ch.title && ch.title.trim().length > 0)
                  .map((chapter) => {
                    const isCurrentChapter = playbackState?.chapter_id === chapter.id
                    const chapterTitle = chapter.title?.trim() || `Chapter ${chapter.idx + 1}`
                    const charCount = chapter.text_content?.length || 0
                    const wordCount = chapter.text_content?.split(/\s+/).length || 0
                    
                    return (
                      <div
                        key={chapter.id}
                        className={`px-4 py-3 rounded-lg transition-colors ${
                          isCurrentChapter
                            ? 'bg-orange-100 border-2 border-orange-500'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/book/${bookId}/chapter/${chapter.id}`}
                            className="flex-1"
                          >
                            <span className="text-sm font-medium text-black">
                              {/* Show clean chapter titles - no automatic numbering */}
                              {chapterTitle}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({wordCount.toLocaleString()} words)
                            </span>
                          </Link>
                          <div className="flex items-center gap-3">
                            {chapter.text_content && (
                              <ChapterPreviewButton 
                                chapterTitle={chapterTitle}
                                chapterText={chapter.text_content}
                              />
                            )}
                            {isCurrentChapter && (
                              <span className="text-xs text-orange-600 font-semibold">Continue →</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
