import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AppSidebar } from '@/components/AppSidebar'

// Common book categories/genres
// SVG icon component for categories
const BookIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)

const GENRE_INFO: Record<string, { name: string; color: string }> = {
  'fiction': { name: 'Fiction', color: 'bg-purple-500' },
  'non-fiction': { name: 'Non-Fiction', color: 'bg-green-500' },
  'mystery': { name: 'Mystery', color: 'bg-purple-600' },
  'romance': { name: 'Romance', color: 'bg-pink-500' },
  'sci-fi': { name: 'Science Fiction', color: 'bg-cyan-500' },
  'fantasy': { name: 'Fantasy', color: 'bg-indigo-500' },
  'thriller': { name: 'Thriller', color: 'bg-red-500' },
  'horror': { name: 'Horror', color: 'bg-gray-800' },
  'biography': { name: 'Biography', color: 'bg-amber-500' },
  'history': { name: 'History', color: 'bg-yellow-600' },
  'self-help': { name: 'Self-Help', color: 'bg-teal-500' },
  'business': { name: 'Business', color: 'bg-slate-600' },
  'religion': { name: 'Religion & Spirituality', color: 'bg-violet-500' },
  'children': { name: "Children's", color: 'bg-pink-400' },
  'young-adult': { name: 'Young Adult', color: 'bg-rose-400' },
  'poetry': { name: 'Poetry', color: 'bg-fuchsia-500' },
  'drama': { name: 'Drama', color: 'bg-red-400' },
  'comedy': { name: 'Comedy', color: 'bg-yellow-400' },
  'christian': { name: 'Christian Fiction', color: 'bg-sky-500' },
  'historical-fiction': { name: 'Historical Fiction', color: 'bg-amber-600' },
}

export default async function CategoriesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all unique categories from books
  const { data: books } = await supabase
    .from('books')
    .select('category')
    .or(`owner_id.eq.${user.id},is_public.eq.true`)

  // Count books per category
  const categoryCounts: Record<string, number> = {}
  books?.forEach(book => {
    if (book.category) {
      const cat = book.category.toLowerCase()
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
    }
  })

  // Get all categories that have books
  const activeCategories = Object.keys(categoryCounts)

  return (
    <div className="flex min-h-screen bg-white">
      <AppSidebar userEmail={user.email} />

      <main className="flex-1 bg-white">
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <Link href="/library" className="text-gray-600 hover:text-black transition-colors flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Library
          </Link>
        </div>

        <div className="p-8">
          <h1 className="text-4xl font-bold text-black mb-2">Categories</h1>
          <p className="text-gray-600 mb-8">Browse books by genre</p>

          {activeCategories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-black mb-4 text-lg">No categories yet</p>
              <p className="text-gray-600">Upload books with categories to see them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeCategories.map(cat => {
                const info = GENRE_INFO[cat] || { 
                  name: cat.charAt(0).toUpperCase() + cat.slice(1), 
                  color: 'bg-gray-500'
                }
                return (
                  <Link
                    key={cat}
                    href={`/library?category=${encodeURIComponent(cat)}`}
                    className="group"
                  >
                    <div className={`${info.color} rounded-xl p-6 text-white hover:opacity-90 transition-opacity`}>
                      <div className="mb-3"><BookIcon /></div>
                      <h3 className="font-bold text-lg">{info.name}</h3>
                      <p className="text-white/80 text-sm">{categoryCounts[cat]} book{categoryCounts[cat] !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Show all available categories */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-black mb-4">All Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Object.entries(GENRE_INFO).map(([key, info]) => {
                const count = categoryCounts[key] || 0
                return (
                  <Link
                    key={key}
                    href={`/library?category=${encodeURIComponent(key)}`}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                      count > 0 
                        ? 'border-gray-200 hover:border-orange-300 hover:bg-orange-50' 
                        : 'border-gray-100 opacity-50'
                    }`}
                  >
                    <BookIcon />
                    <div>
                      <p className="font-medium text-black text-sm">{info.name}</p>
                      <p className="text-xs text-gray-500">{count} book{count !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
