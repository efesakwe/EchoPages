'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeleteBookButtonProps {
  bookId: string
  bookTitle: string
}

export function DeleteBookButton({ bookId, bookTitle }: DeleteBookButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/books/${bookId}/delete`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (response.ok) {
        router.refresh()
      } else {
        alert(data.error || 'Failed to delete book')
      }
    } catch (error: any) {
      alert('Error deleting book: ' + error.message)
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
          <h3 className="text-lg font-bold text-black mb-2">Delete Book?</h3>
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete &quot;{bookTitle}&quot;? This will permanently remove the book, all chapters, and generated audio. This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-600 hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center space-x-2 text-red-500 hover:text-red-700 transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span className="text-sm">Delete</span>
    </button>
  )
}
