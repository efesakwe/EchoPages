'use client'

import { useState } from 'react'

interface Props {
  bookId: string
  initialFavorite?: boolean
  initialFinished?: boolean
}

export function FavoriteButton({ bookId, initialFavorite = false }: Props) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const [loading, setLoading] = useState(false)

  const toggleFavorite = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/books/${bookId}/favorite`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setIsFavorite(data.is_favorite)
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={toggleFavorite}
      disabled={loading}
      className={`flex items-center space-x-2 transition-colors ${
        isFavorite 
          ? 'text-red-500 hover:text-red-600' 
          : 'text-gray-600 hover:text-red-500'
      }`}
    >
      <svg 
        className="w-5 h-5" 
        fill={isFavorite ? 'currentColor' : 'none'} 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      <span className="text-sm">{isFavorite ? 'Favourited' : 'Add to favourites'}</span>
    </button>
  )
}

export function FinishButton({ bookId, initialFinished = false }: Props) {
  const [isFinished, setIsFinished] = useState(initialFinished)
  const [loading, setLoading] = useState(false)

  const toggleFinished = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/books/${bookId}/finish`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.success) {
        setIsFinished(data.is_finished)
      }
    } catch (error) {
      console.error('Error toggling finished:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={toggleFinished}
      disabled={loading}
      className={`flex items-center space-x-2 transition-colors ${
        isFinished 
          ? 'text-green-600 hover:text-green-700' 
          : 'text-gray-600 hover:text-green-600'
      }`}
    >
      <svg 
        className="w-5 h-5" 
        fill={isFinished ? 'currentColor' : 'none'} 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-sm">{isFinished ? 'Finished' : 'Mark as Finished'}</span>
    </button>
  )
}
