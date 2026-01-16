import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AppSidebar } from '@/components/AppSidebar'
import { AddToLibraryButton } from './AddToLibraryButton'

export default async function BrowseLibraryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch all public books with complete audio
  const { data: publicBooks, error } = await supabase
    .from('books')
    .select('*')
    .eq('is_public', true)
    .eq('audio_complete', true)
    .order('title', { ascending: true })

  // Get books the user already has in their library (both owned and shared)
  const { data: ownedBooks } = await supabase
    .from('books')
    .select('id')
    .eq('owner_id', user.id)

  const { data: libraryBooks } = await supabase
    .from('user_library')
    .select('book_id')
    .eq('user_id', user.id)

  const ownedBookIds = new Set(ownedBooks?.map(b => b.id) || [])
  const libraryBookIds = new Set(libraryBooks?.map(b => b.book_id) || [])
  const allUserBookIds = new Set([...ownedBookIds, ...libraryBookIds])

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <AppSidebar userEmail={user.email} />

      {/* Main Content */}
      <main className="flex-1 bg-white">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <Link href="/library" className="text-gray-600 hover:text-black transition-colors flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to My Library
          </Link>
          <div className="relative">
            <input
              type="text"
              placeholder="Search shared library"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-black mb-2">Shared Library</h1>
            <p className="text-gray-600">
              Browse audiobooks that have been generated and shared by users. Add them to your library to start listening!
            </p>
          </div>

          {/* Info Banner */}
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
            <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-green-800">Save Credits!</h3>
              <p className="text-sm text-green-700">
                Books in the shared library have already been converted to audio. Add them to your library to listen without using any credits.
              </p>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
              Error loading books: {error.message}
            </div>
          )}

          {/* Books Grid */}
          {!publicBooks || publicBooks.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-black mb-4 text-lg">No books in the shared library yet</p>
              <p className="text-gray-600 mb-6">Be the first to upload and complete a book!</p>
              <Link
                href="/upload"
                className="inline-block px-8 py-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium shadow-lg"
              >
                Upload a Book
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {publicBooks.map((book) => {
                const isInUserLibrary = allUserBookIds.has(book.id)
                
                return (
                  <div key={book.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                    {/* Cover Image */}
                    <div className="aspect-[3/4] bg-gradient-to-br from-gray-200 to-gray-300 relative">
                      {book.cover_image_url ? (
                        <img
                          src={book.cover_image_url}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                      )}
                      {/* Audio Ready Badge */}
                      <div className="absolute top-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        <span>Audio Ready</span>
                      </div>
                    </div>

                    {/* Book Info */}
                    <div className="p-4">
                      <h3 className="font-bold text-black text-lg mb-1 line-clamp-2">{book.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{book.author || 'Unknown Author'}</p>
                      <p className="text-xs text-gray-500 mb-4">
                        {book.total_chapters || 0} chapters
                      </p>

                      {/* Action Button */}
                      {isInUserLibrary ? (
                        <Link href={`/book/${book.id}`}>
                          <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium flex items-center justify-center space-x-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>In Your Library</span>
                          </button>
                        </Link>
                      ) : (
                        <AddToLibraryButton bookId={book.id} bookTitle={book.title} />
                      )}
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
