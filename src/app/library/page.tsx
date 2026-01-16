import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AppSidebar } from '@/components/AppSidebar'
import { DeleteBookButton } from '@/components/DeleteBookButton'
import { FavoriteButton, FinishButton } from '@/components/BookActionButtons'

interface BookWithProgress {
  id: string
  title: string
  author: string
  cover_image_url: string
  created_at: string
  series: string | null
  category: string | null
  totalChapters: number
  hasProgress: boolean
  audio_complete: boolean
  is_public: boolean
  isSharedBook?: boolean
  isFavorite?: boolean
  isFinished?: boolean
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { view?: string; category?: string; filter?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const view = searchParams.view || 'all'
  const categoryFilter = searchParams.category
  const statusFilter = searchParams.filter // 'finished' or 'unfinished'

  // Fetch user's own books
  let ownBooksQuery = supabase
    .from('books')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (categoryFilter) {
    ownBooksQuery = ownBooksQuery.ilike('category', `%${categoryFilter}%`)
  }

  const { data: ownBooks, error } = await ownBooksQuery

  // Fetch books from shared library that user has added
  const { data: libraryEntries } = await supabase
    .from('user_library')
    .select(`
      book_id,
      added_at,
      books (
        id,
        title,
        author,
        cover_image_url,
        created_at,
        series,
        category,
        audio_complete,
        is_public,
        total_chapters
      )
    `)
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  // Fetch user book statuses (favorites, finished)
  const { data: bookStatuses } = await supabase
    .from('user_book_status')
    .select('book_id, is_favorite, is_finished')
    .eq('user_id', user.id)

  const statusMap = new Map<string, { is_favorite: boolean; is_finished: boolean }>()
  bookStatuses?.forEach(status => {
    statusMap.set(status.book_id, {
      is_favorite: status.is_favorite,
      is_finished: status.is_finished
    })
  })

  // Combine books
  let sharedBooks: BookWithProgress[] = (libraryEntries || [])
    .filter(entry => entry.books)
    .map(entry => {
      const status = statusMap.get((entry.books as any).id)
      return {
        ...(entry.books as any),
        totalChapters: (entry.books as any).total_chapters || 0,
        hasProgress: false,
        isSharedBook: true,
        isFavorite: status?.is_favorite || false,
        isFinished: status?.is_finished || false,
      }
    })

  // Filter shared books by category if needed
  if (categoryFilter) {
    sharedBooks = sharedBooks.filter(book => 
      book.category?.toLowerCase().includes(categoryFilter.toLowerCase())
    )
  }

  // Get all book IDs for playback state lookup
  const ownBookIds = ownBooks?.map(b => b.id) || []
  const sharedBookIds = sharedBooks.map(b => b.id)
  const allBookIds = [...ownBookIds, ...sharedBookIds]

  // Fetch playback states
  const { data: playbackStates } = allBookIds.length > 0 ? await supabase
    .from('playback_state')
    .select('book_id, chapter_id, updated_at')
    .eq('user_id', user.id)
    .in('book_id', allBookIds)
    .order('updated_at', { ascending: false }) : { data: null }

  const playbackMap = new Map<string, { chapter_id: string }>()
  playbackStates?.forEach((state) => {
    if (!playbackMap.has(state.book_id)) {
      playbackMap.set(state.book_id, { chapter_id: state.chapter_id })
    }
  })

  // Update shared books with progress
  sharedBooks.forEach(book => {
    book.hasProgress = playbackMap.has(book.id)
  })

  // Get chapters for own books to calculate progress
  const booksWithProgress: BookWithProgress[] = await Promise.all(
    (ownBooks || []).map(async (book) => {
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id')
        .eq('book_id', book.id)
        .order('idx', { ascending: true })

      const totalChapters = chapters?.length || 0
      const hasProgress = playbackMap.has(book.id)
      const status = statusMap.get(book.id)
      
      return {
        ...book,
        totalChapters,
        hasProgress,
        isSharedBook: false,
        isFavorite: status?.is_favorite || false,
        isFinished: status?.is_finished || false,
      }
    })
  )

  // Filter based on view
  let displayBooks: BookWithProgress[] = []
  if (view === 'shared') {
    displayBooks = sharedBooks
  } else if (view === 'my-books') {
    displayBooks = booksWithProgress
  } else if (view === 'favorites') {
    displayBooks = [...booksWithProgress, ...sharedBooks].filter(b => b.isFavorite)
  } else {
    // All: combine and sort by creation date
    displayBooks = [...booksWithProgress, ...sharedBooks].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  // Apply finished/unfinished filter
  if (statusFilter === 'finished') {
    displayBooks = displayBooks.filter(b => b.isFinished)
  } else if (statusFilter === 'unfinished') {
    displayBooks = displayBooks.filter(b => !b.isFinished)
  }

  // Get unique categories from all books for the header
  const allCategories = [...new Set([
    ...booksWithProgress.map(b => b.category).filter(Boolean),
    ...sharedBooks.map(b => b.category).filter(Boolean)
  ])]

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <AppSidebar userEmail={user.email} />

      {/* Main Content */}
      <main className="flex-1 bg-white">
        {/* Top Header with Search */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex-1"></div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search your library"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-black mb-2">
              {categoryFilter ? `Category: ${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}` : 'Library'}
            </h1>
            {categoryFilter && (
              <Link href="/library" className="text-orange-500 hover:text-orange-600 text-sm">
                ← Back to all books
              </Link>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-6 mb-4 mt-4">
              <Link 
                href="/library?view=all" 
                className={`pb-2 transition-colors ${view === 'all' && !categoryFilter ? 'text-black font-semibold border-b-2 border-black' : 'text-gray-600 hover:text-black'}`}
              >
                All
              </Link>
              <Link 
                href="/library?view=my-books" 
                className={`pb-2 transition-colors ${view === 'my-books' ? 'text-black font-semibold border-b-2 border-black' : 'text-gray-600 hover:text-black'}`}
              >
                My Uploads
              </Link>
              <Link 
                href="/library?view=shared" 
                className={`pb-2 transition-colors ${view === 'shared' ? 'text-black font-semibold border-b-2 border-black' : 'text-gray-600 hover:text-black'}`}
              >
                Shared Library
              </Link>
              <Link 
                href="/library?view=favorites" 
                className={`pb-2 transition-colors ${view === 'favorites' ? 'text-black font-semibold border-b-2 border-black' : 'text-gray-600 hover:text-black'}`}
              >
                Favorites
              </Link>
              <Link 
                href="/library/browse" 
                className="text-gray-600 hover:text-black transition-colors pb-2"
              >
                Browse All Books
              </Link>
            </div>

            {/* Filters and Sort */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Link 
                  href={categoryFilter ? `/library?category=${categoryFilter}` : '/library'}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${!statusFilter ? 'border-2 border-black text-black' : 'text-gray-600 hover:text-black'}`}
                >
                  All titles
                </Link>
                <Link 
                  href={categoryFilter ? `/library?category=${categoryFilter}&filter=finished` : '/library?filter=finished'}
                  className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'finished' ? 'border-2 border-black text-black font-medium' : 'text-gray-600 hover:text-black'}`}
                >
                  Finished
                </Link>
                <Link 
                  href={categoryFilter ? `/library?category=${categoryFilter}&filter=unfinished` : '/library?filter=unfinished'}
                  className={`px-4 py-2 rounded-lg transition-colors ${statusFilter === 'unfinished' ? 'border-2 border-black text-black font-medium' : 'text-gray-600 hover:text-black'}`}
                >
                  Unfinished
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Sort by:</span>
                  <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option>Date Added</option>
                    <option>Title A-Z</option>
                    <option>Author</option>
                    <option>Duration</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category Pills */}
            {allCategories.length > 0 && !categoryFilter && (
              <div className="flex flex-wrap gap-2 mb-4">
                {allCategories.map(cat => (
                  <Link
                    key={cat}
                    href={`/library?category=${encodeURIComponent(cat!)}`}
                    className="px-3 py-1 bg-gray-100 hover:bg-orange-100 text-gray-700 hover:text-orange-600 rounded-full text-sm transition-colors"
                  >
                    {cat}
                  </Link>
                ))}
                <Link
                  href="/library/categories"
                  className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm hover:bg-orange-200 transition-colors"
                >
                  View All Categories →
                </Link>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="mb-8">
            <Link
              href="/upload"
              className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-sm"
            >
              + Upload Book
            </Link>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
              Error loading books: {error.message}
            </div>
          )}

          {/* Books List */}
          {displayBooks.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-black mb-4 text-lg">
                {view === 'shared' ? 'No shared books in your library yet' : 
                 view === 'favorites' ? 'No favorite books yet' :
                 statusFilter === 'finished' ? 'No finished books yet' :
                 categoryFilter ? `No books in "${categoryFilter}" category` :
                 'No books yet'}
              </p>
              {view === 'shared' ? (
                <Link
                  href="/library/browse"
                  className="inline-block px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-lg"
                >
                  Browse Shared Library
                </Link>
              ) : (
                <Link
                  href="/upload"
                  className="inline-block px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-lg"
                >
                  Upload your first book
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {displayBooks.map((book) => {
                const playbackState = playbackMap.get(book.id)
                const bookLink = playbackState 
                  ? `/book/${book.id}/chapter/${playbackState.chapter_id}` 
                  : `/book/${book.id}`

                return (
                    <div key={book.id} className="flex gap-6 bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    {/* Cover Image */}
                    <Link href={`/book/${book.id}`} className="flex-shrink-0">
                      <div className="w-48 h-48 bg-gradient-to-br from-gray-200 to-gray-300 rounded-lg flex items-center justify-center overflow-hidden shadow-sm relative">
                        {book.cover_image_url ? (
                          <img
                            src={book.cover_image_url}
                            alt={book.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        )}
                        {/* Shared Badge */}
                        {book.isSharedBook && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>Shared</span>
                          </div>
                        )}
                        {/* Audio Ready Badge */}
                        {book.audio_complete && !book.isSharedBook && (
                          <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Complete</span>
                          </div>
                        )}
                        {/* Finished Badge */}
                        {book.isFinished && (
                          <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                            ✓ Finished
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Book Details */}
                    <div className="flex-1 flex flex-col">
                      {/* Title and Duration */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <Link href={`/book/${book.id}`}>
                            <h2 className="text-2xl font-bold text-black mb-1 hover:text-orange-600 transition-colors">
                              {book.title}
                            </h2>
                          </Link>
                          {playbackState && !book.isFinished && (
                            <div className="flex items-center space-x-4 mt-2">
                              <div className="flex-1 max-w-xs">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                                </div>
                              </div>
                              <span className="text-gray-600 text-sm">In Progress</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {playbackState ? (
                            <Link href={bookLink}>
                              <button className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
                                Listen now
                              </button>
                            </Link>
                          ) : (
                            <Link href={`/book/${book.id}`}>
                              <button className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
                                View Details
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="space-y-1 mb-4 text-gray-700">
                        <p className="text-sm">
                          <span className="font-semibold">Written by:</span>{' '}
                          {book.author || user.email?.split('@')[0] || 'Unknown Author'}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Narrated by:</span> Echo Pages AI
                        </p>
                        {book.category && (
                          <p className="text-sm">
                            <span className="font-semibold">Category:</span>{' '}
                            <Link 
                              href={`/library?category=${encodeURIComponent(book.category)}`}
                              className="text-orange-500 hover:text-orange-600"
                            >
                              {book.category}
                            </Link>
                          </p>
                        )}
                        {book.series && (
                          <p className="text-sm">
                            <span className="font-semibold">Series:</span> {book.series}
                          </p>
                        )}
                        {book.totalChapters > 0 && (
                          <p className="text-sm">
                            <span className="font-semibold">Chapters:</span> {book.totalChapters}
                          </p>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <svg key={i} className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">Write a review.</span>
                      </div>

                      {/* Description/Placeholder */}
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {book.isSharedBook 
                          ? 'From the shared library. Audio is ready to play!'
                          : `Uploaded on ${new Date(book.created_at).toLocaleDateString()}. Click to view chapters and start listening.`
                        }
                      </p>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-6 mt-auto pt-4 border-t border-gray-100">
                        <FavoriteButton bookId={book.id} initialFavorite={book.isFavorite} />
                        <FinishButton bookId={book.id} initialFinished={book.isFinished} />
                        {!book.isSharedBook && (
                          <DeleteBookButton bookId={book.id} bookTitle={book.title} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
