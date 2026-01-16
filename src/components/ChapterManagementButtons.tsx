'use client'

import { useRouter } from 'next/navigation'

interface ChapterManagementButtonsProps {
  bookId: string
  hasChapters: boolean
}

export function ChapterManagementButtons({ bookId, hasChapters }: ChapterManagementButtonsProps) {
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete all chapters? This will also delete any audio generated for them.')) {
      return
    }

    try {
      const response = await fetch(`/api/books/${bookId}/chapters/delete`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete chapters')
      }

      router.refresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  if (!hasChapters) {
    return (
      <form action={`/api/books/${bookId}/extract`} method="POST">
        <button
          type="submit"
          className="px-6 py-2 text-white rounded-lg hover:bg-lilac-500 transition-colors font-medium shadow-sm"
          style={{ backgroundColor: '#f472b6' }}
        >
          Extract Chapters
        </button>
      </form>
    )
  }

  return (
    <div className="flex gap-3">
      <form action={`/api/books/${bookId}/extract`} method="POST">
        <button
          type="submit"
          className="px-6 py-2 text-white rounded-lg hover:bg-lilac-500 transition-colors font-medium shadow-sm"
          style={{ backgroundColor: '#f472b6' }}
        >
          Re-extract Chapters
        </button>
      </form>
      <button
        onClick={handleDelete}
        className="px-6 py-2 bg-white border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium shadow-sm"
      >
        Delete Chapters
      </button>
    </div>
  )
}
