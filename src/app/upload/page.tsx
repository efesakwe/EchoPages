'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

interface ExistingBook {
  id: string
  title: string
  author: string
  cover_image_url: string
  summary: string
  total_chapters: number
  completed_chapters: number
  narrator_voice: string
  in_user_library: boolean
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState<ExistingBook[]>([])
  const [searching, setSearching] = useState(false)
  const [addingToLibrary, setAddingToLibrary] = useState<string | null>(null)
  const router = useRouter()

  // Debounced search for existing books
  const searchExistingBooks = useCallback(async (searchTitle: string, searchAuthor: string) => {
    if (searchTitle.length < 3) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const params = new URLSearchParams({ title: searchTitle })
      if (searchAuthor.trim()) {
        params.append('author', searchAuthor)
      }
      
      const response = await fetch(`/api/books/search?${params}`)
      const data = await response.json()
      
      if (data.found && data.books) {
        setSearchResults(data.books)
      } else {
        setSearchResults([])
      }
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  // Debounce effect for search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchExistingBooks(title, author)
    }, 500)
    return () => clearTimeout(timer)
  }, [title, author, searchExistingBooks])

  const addToLibrary = async (bookId: string) => {
    setAddingToLibrary(bookId)
    try {
      const response = await fetch('/api/library/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Redirect to the book
        router.push(`/book/${bookId}`)
      } else {
        setError(data.error || 'Failed to add book to library')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add book to library')
    } finally {
      setAddingToLibrary(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title.trim()) {
      setError('Please provide both a title and PDF file')
      return
    }

    setLoading(true)
    setError('')
    setLoadingMessage('Uploading PDF...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title)
      if (author.trim()) {
        formData.append('author', author)
      }

      setLoadingMessage('Fetching book details and cover...')

      const response = await fetch('/api/books/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const { bookId } = await response.json()
      router.push(`/book/${bookId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to upload book')
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center">
          <Link href="/library" className="text-gray-600 hover:text-black transition-colors flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Library
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-12 px-6">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-black mb-2">Upload a Book</h1>
          <p className="text-gray-600 mb-8">
            Enter the book details and we&apos;ll automatically fetch the cover and metadata.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-black mb-2">
                Book Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 border"
                placeholder="e.g., The Royal Artisan"
                required
              />
              {searching && (
                <p className="mt-1 text-xs text-gray-500 flex items-center">
                  <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching library...
                </p>
              )}
            </div>

            <div>
              <label htmlFor="author" className="block text-sm font-semibold text-black mb-2">
                Author
              </label>
              <input
                type="text"
                id="author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-4 py-3 border"
                placeholder="e.g., Tessa Afshar"
              />
              <p className="mt-1 text-xs text-gray-500">
                Adding the author helps us find the correct book cover
              </p>
            </div>

            {/* Existing Book Found */}
            {searchResults.length > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-green-800">
                    {searchResults.length === 1 ? 'This book is in our library!' : `Found ${searchResults.length} matching books`}
                  </span>
                </div>
                <p className="text-sm text-green-700 mb-4">
                  Save credits by using the audiobook we&apos;ve already generated!
                </p>
                
                <div className="space-y-3">
                  {searchResults.map((book) => (
                    <div key={book.id} className="flex items-center space-x-4 bg-white p-3 rounded-lg border border-green-200">
                      {book.cover_image_url ? (
                        <Image
                          src={book.cover_image_url}
                          alt={book.title}
                          width={48}
                          height={72}
                          className="rounded shadow-sm object-cover"
                        />
                      ) : (
                        <div className="w-12 h-18 bg-gray-200 rounded flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{book.title}</h4>
                        <p className="text-sm text-gray-600">{book.author || 'Unknown Author'}</p>
                        <p className="text-xs text-gray-500">{book.total_chapters} chapters • Audio ready</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToLibrary(book.id)}
                        disabled={addingToLibrary === book.id || book.in_user_library}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          book.in_user_library
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {addingToLibrary === book.id ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : book.in_user_library ? (
                          'Already in Library'
                        ) : (
                          'Use This Book'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                
                <p className="text-xs text-green-600 mt-3">
                  Or continue below to upload your own copy
                </p>
              </div>
            )}

            <div>
              <label htmlFor="file" className="block text-sm font-semibold text-black mb-2">
                PDF File *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-orange-400 transition-colors">
                <div className="space-y-1 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="file" className="relative cursor-pointer rounded-md font-medium text-orange-600 hover:text-orange-500">
                      <span>Upload a PDF</span>
                      <input
                        type="file"
                        id="file"
                        accept=".pdf"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="sr-only"
                        required
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PDF up to 50MB</p>
                </div>
              </div>
              {file && (
                <div className="mt-3 flex items-center space-x-2 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-lg shadow-sm text-base font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {loadingMessage || 'Processing...'}
                  </>
                ) : (
                  'Upload Book'
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">What happens next?</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start space-x-2">
                <span className="text-orange-500">1.</span>
                <span>We&apos;ll fetch the book cover and details using the title and author</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-orange-500">2.</span>
                <span>Extract chapters from your PDF</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-orange-500">3.</span>
                <span>Generate AI narration for each chapter</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
