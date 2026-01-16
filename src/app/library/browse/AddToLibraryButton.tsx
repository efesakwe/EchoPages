'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  bookId: string
  bookTitle: string
}

export function AddToLibraryButton({ bookId, bookTitle }: Props) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleAdd = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/library/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId }),
      })

      if (response.ok) {
        setSuccess(true)
        // Redirect to the book page after a short delay
        setTimeout(() => {
          router.push(`/book/${bookId}`)
        }, 500)
      }
    } catch (error) {
      console.error('Error adding to library:', error)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <button 
        disabled 
        className="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-medium flex items-center justify-center space-x-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Added!</span>
      </button>
    )
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center justify-center space-x-2"
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Adding...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add to Library</span>
        </>
      )}
    </button>
  )
}
