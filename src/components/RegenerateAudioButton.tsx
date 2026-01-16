'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RegenerateAudioButtonProps {
  chapterId: string
}

export function RegenerateAudioButton({ chapterId }: RegenerateAudioButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRegenerate = async () => {
    if (!confirm('This will delete the existing audio and regenerate it. Continue?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chapters/${chapterId}/regenerate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to regenerate')
      }

      alert('Audio regeneration queued! Refresh the page in a few moments.')
      router.refresh()
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={isLoading}
      className="px-4 py-2 text-sm bg-white border-2 border-lilac-300 text-lilac-600 rounded-lg hover:bg-lilac-50 transition-colors font-medium disabled:opacity-50"
    >
      {isLoading ? 'Queuing...' : 'Regenerate Audio'}
    </button>
  )
}
