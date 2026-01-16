'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface GenerateAudioButtonProps {
  chapterId: string
}

type GenerationStatus = 'idle' | 'queuing' | 'generating' | 'finished' | 'error'

export function GenerateAudioButton({ chapterId }: GenerateAudioButtonProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const router = useRouter()

  // Poll for chunk status
  const checkProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/chapters/${chapterId}/chunks`)
      if (!response.ok) return null
      
      const data = await response.json()
      const chunks = data.chunks || []
      
      if (chunks.length === 0) return null
      
      const doneChunks = chunks.filter((c: any) => c.status === 'done').length
      const totalChunks = chunks.length
      
      return { done: doneChunks, total: totalChunks, allDone: doneChunks === totalChunks }
    } catch {
      return null
    }
  }, [chapterId])

  // Polling effect
  useEffect(() => {
    if (status !== 'generating') return

    const pollInterval = setInterval(async () => {
      const result = await checkProgress()
      
      if (result) {
        setProgress({ done: result.done, total: result.total })
        
        if (result.allDone && result.total > 0) {
          setStatus('finished')
          setMessage('✓ Audio generation complete!')
          clearInterval(pollInterval)
          
          // Auto-refresh after showing "Finished" for 2 seconds
          setTimeout(() => {
            router.refresh()
          }, 2000)
        }
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [status, checkProgress, router])

  const handleGenerate = async () => {
    setStatus('queuing')
    setMessage('')
    setProgress({ done: 0, total: 0 })
    
    try {
      const response = await fetch(`/api/chapters/${chapterId}/generate`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to queue audio generation')
      }

      setStatus('generating')
      setMessage('Generating audio...')
      
      // Initial check
      const result = await checkProgress()
      if (result) {
        setProgress({ done: result.done, total: result.total })
      }
      
    } catch (err: any) {
      setStatus('error')
      setMessage('Error: ' + err.message)
    }
  }

  const getButtonText = () => {
    switch (status) {
      case 'queuing':
        return 'Queuing...'
      case 'generating':
        return progress.total > 0 
          ? `Generating... ${progress.done}/${progress.total}` 
          : 'Generating...'
      case 'finished':
        return '✓ Finished!'
      default:
        return 'Generate Audio'
    }
  }

  const getButtonStyle = () => {
    if (status === 'finished') {
      return { backgroundColor: '#22c55e' } // Green
    }
    return { backgroundColor: '#f472b6' } // Pink
  }

  return (
    <div className="text-center">
      <button
        onClick={handleGenerate}
        disabled={status === 'queuing' || status === 'generating' || status === 'finished'}
        className="px-6 py-3 text-white rounded-lg hover:opacity-90 transition-all font-medium shadow-sm disabled:cursor-not-allowed"
        style={getButtonStyle()}
      >
        {getButtonText()}
      </button>
      
      {/* Progress bar */}
      {status === 'generating' && progress.total > 0 && (
        <div className="mt-4 w-64 mx-auto">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-pink-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {progress.done} of {progress.total} chunks complete
          </p>
        </div>
      )}
      
      {message && (
        <p className={`mt-4 text-sm ${
          status === 'error' ? 'text-red-600' : 
          status === 'finished' ? 'text-green-600 font-semibold' : 
          'text-gray-600'
        }`}>
          {message}
        </p>
      )}
      
      {status === 'finished' && (
        <p className="mt-2 text-xs text-gray-400">Refreshing page...</p>
      )}
    </div>
  )
}
