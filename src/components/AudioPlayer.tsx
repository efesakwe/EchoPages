'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface AudioChunk {
  id: string
  idx: number
  audio_url: string | null
  text: string
  voice: string
  status?: string
  duration_seconds: number | null
  provider?: string  // TTS provider used
}

interface Chapter {
  id: string
  idx: number
  title: string
  book_id: string
}

interface PlaybackState {
  chunkIdx: number
  secondsInChunk: number
  playbackRate: number
}

interface AudioPlayerProps {
  chapterId: string
  bookId: string
  chunks: AudioChunk[]
  initialPlaybackState?: PlaybackState
  book: {
    title: string
    author?: string
    cover_image_url?: string
  }
  chapter: {
    title: string
    idx: number
  }
  allChapters: Chapter[]
}

const SPEED_OPTIONS = [
  0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0,
  2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5
]

export function AudioPlayer({
  chapterId,
  bookId,
  chunks,
  initialPlaybackState,
  book,
  chapter,
  allChapters,
}: AudioPlayerProps) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)
  
  // State
  const [currentChunkIdx, setCurrentChunkIdx] = useState(initialPlaybackState?.chunkIdx || 0)
  const [currentTime, setCurrentTime] = useState(initialPlaybackState?.secondsInChunk || 0)
  const [chunkDuration, setChunkDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackState?.playbackRate || 1.0)
  const [isLoading, setIsLoading] = useState(false)
  const [showChaptersModal, setShowChaptersModal] = useState(false)
  const [showSpeedModal, setShowSpeedModal] = useState(false)
  
  // Chapter transition state
  const [chapterEndCountdown, setChapterEndCountdown] = useState<number | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  // Filter valid chunks with audio
  const validChunks = chunks.filter(c => c.audio_url && c.status === 'done')
  const currentChunk = validChunks[currentChunkIdx]
  const hasAudio = validChunks.length > 0 && currentChunk?.audio_url

  // Determine TTS provider from chunks
  const providers = validChunks.map(c => c.provider || 'elevenlabs')
  const providerCounts: Record<string, number> = {}
  providers.forEach(p => {
    providerCounts[p] = (providerCounts[p] || 0) + 1
  })
  const primaryProvider = providers.length > 0
    ? Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'elevenlabs'
    : null

  // Calculate total chapter duration from all chunks
  const totalChapterDuration = validChunks.reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
  
  // Calculate elapsed time in chapter (all previous chunks + current position)
  const previousChunksDuration = validChunks
    .slice(0, currentChunkIdx)
    .reduce((sum, c) => sum + (c.duration_seconds || 0), 0)
  const chapterCurrentTime = previousChunksDuration + currentTime
  const timeLeft = Math.max(0, totalChapterDuration - chapterCurrentTime)

  // Chapter navigation
  const currentChapterArrayIdx = allChapters.findIndex(c => c.id === chapterId)
  const prevChapter = currentChapterArrayIdx > 0 ? allChapters[currentChapterArrayIdx - 1] : null
  const nextChapter = currentChapterArrayIdx < allChapters.length - 1 ? allChapters[currentChapterArrayIdx + 1] : null

  // Save playback state
  const savePlaybackState = useCallback(async () => {
    try {
      await fetch('/api/playback/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          chapterId,
          chunkIdx: currentChunkIdx,
          secondsInChunk: currentTime,
          playbackRate,
        }),
      })
    } catch (error) {
      console.error('Failed to save playback state:', error)
    }
  }, [bookId, chapterId, currentChunkIdx, currentTime, playbackRate])

  // Go to next chunk or next chapter
  const goToNextChunk = useCallback(() => {
    if (currentChunkIdx < validChunks.length - 1) {
      // More chunks in this chapter - continue immediately
      setCurrentChunkIdx(prev => prev + 1)
      setCurrentTime(0)
    } else if (nextChapter) {
      // End of chapter - show countdown before going to next chapter
      setIsPlaying(false)
      setChapterEndCountdown(5) // 5 second countdown
      
      // Start countdown
      let count = 5
      countdownRef.current = setInterval(() => {
        count--
        setChapterEndCountdown(count)
        
        if (count <= 0) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
          }
          setChapterEndCountdown(null)
          savePlaybackState()
          router.push(`/book/${bookId}/chapter/${nextChapter.id}`)
        }
      }, 1000)
    } else {
      // End of book
      setIsPlaying(false)
    }
  }, [currentChunkIdx, validChunks.length, nextChapter, bookId, router, savePlaybackState])
  
  // Cancel countdown
  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setChapterEndCountdown(null)
  }, [])
  
  // Skip countdown and go to next chapter immediately
  const skipToNextChapter = useCallback(() => {
    cancelCountdown()
    if (nextChapter) {
      savePlaybackState()
      router.push(`/book/${bookId}/chapter/${nextChapter.id}`)
    }
  }, [cancelCountdown, nextChapter, savePlaybackState, bookId, router])
  
  // Clean up countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [])

  // Go to previous chunk or restart
  const goToPreviousChunk = useCallback(() => {
    if (currentTime > 3) {
      // Restart current chunk if more than 3 seconds in
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        setCurrentTime(0)
      }
    } else if (currentChunkIdx > 0) {
      // Go to previous chunk
      setCurrentChunkIdx(prev => prev - 1)
      setCurrentTime(0)
    } else if (prevChapter) {
      // Go to previous chapter
      savePlaybackState()
      router.push(`/book/${bookId}/chapter/${prevChapter.id}`)
    }
  }, [currentTime, currentChunkIdx, prevChapter, bookId, router, savePlaybackState])

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setChunkDuration(audio.duration)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleLoadStart = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)
    
    const handleEnded = () => {
      // Automatically go to next chunk when current one ends
      goToNextChunk()
    }

    const handleError = (e: Event) => {
      console.error('Audio error:', (e.target as HTMLAudioElement).error)
      setIsLoading(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [goToNextChunk])

  // Load audio when chunk changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentChunk?.audio_url) return

    const wasPlaying = isPlaying
    
    audio.src = currentChunk.audio_url
    audio.playbackRate = playbackRate
    
    // Set initial position only for first load
    if (currentChunkIdx === (initialPlaybackState?.chunkIdx || 0) && currentTime === 0) {
      audio.currentTime = initialPlaybackState?.secondsInChunk || 0
    }

    // Auto-play if we were playing (seamless chunk transition)
    if (wasPlaying) {
      audio.play().catch(console.error)
    }
  }, [currentChunkIdx, currentChunk?.audio_url])

  // Update playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Save state periodically
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(savePlaybackState, 5000)
      return () => clearInterval(interval)
    }
  }, [isPlaying, savePlaybackState])

  // Save on unmount
  useEffect(() => {
    return () => {
      savePlaybackState()
    }
  }, [savePlaybackState])

  const handlePlayPause = async () => {
    const audio = audioRef.current
    if (!audio || !hasAudio) return

    if (isPlaying) {
      audio.pause()
    } else {
      // Ensure audio is loaded
      if (!audio.src && currentChunk?.audio_url) {
        audio.src = currentChunk.audio_url
      }
      try {
        await audio.play()
      } catch (err) {
        console.error('Play failed:', err)
      }
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Seek within the entire chapter
    const targetChapterTime = parseFloat(e.target.value)
    
    // Find which chunk this time falls into
    let accumulatedTime = 0
    for (let i = 0; i < validChunks.length; i++) {
      const chunkDur = validChunks[i].duration_seconds || 0
      if (targetChapterTime < accumulatedTime + chunkDur) {
        // This is the chunk
        const timeInChunk = targetChapterTime - accumulatedTime
        if (i !== currentChunkIdx) {
          setCurrentChunkIdx(i)
        }
        if (audioRef.current) {
          audioRef.current.currentTime = timeInChunk
        }
        setCurrentTime(timeInChunk)
        return
      }
      accumulatedTime += chunkDur
    }
  }

  const handleSkip = (seconds: number) => {
    const newChapterTime = chapterCurrentTime + seconds
    
    if (newChapterTime < 0) {
      // Go to start
      setCurrentChunkIdx(0)
      setCurrentTime(0)
      if (audioRef.current) audioRef.current.currentTime = 0
      return
    }
    
    if (newChapterTime >= totalChapterDuration) {
      // Go to next chapter
      goToNextChunk()
      return
    }
    
    // Find the chunk and position
    let accumulatedTime = 0
    for (let i = 0; i < validChunks.length; i++) {
      const chunkDur = validChunks[i].duration_seconds || 0
      if (newChapterTime < accumulatedTime + chunkDur) {
        const timeInChunk = newChapterTime - accumulatedTime
        if (i !== currentChunkIdx) {
          setCurrentChunkIdx(i)
          // The useEffect will load the new chunk
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.currentTime = timeInChunk
              if (isPlaying) audioRef.current.play()
            }
          }, 100)
        } else if (audioRef.current) {
          audioRef.current.currentTime = timeInChunk
        }
        setCurrentTime(timeInChunk)
        return
      }
      accumulatedTime += chunkDur
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const goToChapter = (chapterToGo: Chapter) => {
    setShowChaptersModal(false)
    if (chapterToGo.id !== chapterId) {
      savePlaybackState()
      router.push(`/book/${bookId}/chapter/${chapterToGo.id}`)
    }
  }

  const goToPreviousChapter = () => {
    if (prevChapter) {
      savePlaybackState()
      router.push(`/book/${bookId}/chapter/${prevChapter.id}`)
    }
  }

  const goToNextChapter = () => {
    if (nextChapter) {
      savePlaybackState()
      router.push(`/book/${bookId}/chapter/${nextChapter.id}`)
    }
  }

  // Media Session API for background playback and lock screen controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    // Set metadata for lock screen / notification center
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapter.title,
      artist: book.author || 'Unknown Author',
      album: book.title,
      artwork: book.cover_image_url
        ? [
            { src: book.cover_image_url, sizes: '96x96', type: 'image/jpeg' },
            { src: book.cover_image_url, sizes: '128x128', type: 'image/jpeg' },
            { src: book.cover_image_url, sizes: '192x192', type: 'image/jpeg' },
            { src: book.cover_image_url, sizes: '256x256', type: 'image/jpeg' },
            { src: book.cover_image_url, sizes: '384x384', type: 'image/jpeg' },
            { src: book.cover_image_url, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [],
    })
  }, [book.title, book.author, book.cover_image_url, chapter.title])

  // Media Session action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    // Play/Pause handlers
    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause()
    })

    // Seek handlers (±30 seconds)
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      handleSkip(-30)
    })
    navigator.mediaSession.setActionHandler('seekforward', () => {
      handleSkip(30)
    })

    // Track navigation
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      goToPreviousChunk()
    })
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      goToNextChunk()
    })

    return () => {
      // Clean up handlers
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null)
        navigator.mediaSession.setActionHandler('pause', null)
        navigator.mediaSession.setActionHandler('seekbackward', null)
        navigator.mediaSession.setActionHandler('seekforward', null)
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
      }
    }
  }, [handleSkip, goToPreviousChunk, goToNextChunk])

  // Update Media Session playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  // Update Media Session position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return
    
    if (totalChapterDuration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: totalChapterDuration,
          playbackRate: playbackRate,
          position: Math.min(chapterCurrentTime, totalChapterDuration),
        })
      } catch (e) {
        // Some browsers may throw if position > duration
        console.warn('Media Session position state error:', e)
      }
    }
  }, [chapterCurrentTime, totalChapterDuration, playbackRate])

  // Handle page visibility changes for background playback
  useEffect(() => {
    const handleVisibilityChange = () => {
      // When page becomes visible again, sync up the UI state
      if (document.visibilityState === 'visible' && audioRef.current) {
        setCurrentTime(audioRef.current.currentTime)
        setIsPlaying(!audioRef.current.paused)
      }
    }

    // Save state before user leaves
    const handleBeforeUnload = () => {
      savePlaybackState()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [savePlaybackState])

  if (!hasAudio) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-100 to-white flex items-center justify-center">
        <p className="text-gray-600">No audio available for this chapter.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-100 to-white flex flex-col">
      {/* Hidden audio element - background playback enabled */}
      <audio 
        ref={audioRef} 
        preload="auto"
        playsInline
        // These attributes help with background playback
        x-webkit-airplay="allow"
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <button 
          onClick={() => router.push(`/book/${bookId}`)}
          className="flex items-center text-gray-600 hover:text-gray-800"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center flex-1">
          <p className="text-sm text-gray-500 truncate px-4">{book.title}</p>
        </div>
        <button className="text-gray-600 text-2xl">•••</button>
      </div>

      {/* Cover Image */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-72 h-72 md:w-80 md:h-80 rounded-lg shadow-2xl overflow-hidden bg-gray-200 mb-6">
          {book.cover_image_url ? (
            <img
              src={book.cover_image_url}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-200 to-pink-200">
              <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>

        {/* Chapter Title */}
        <h2 className="text-xl font-semibold text-gray-800 text-center mb-8">
          {chapter.title}
        </h2>

        {/* Progress Bar - Shows CHAPTER progress, not chunk */}
        <div className="w-full max-w-md mb-4">
          <input
            type="range"
            min="0"
            max={totalChapterDuration || 100}
            value={chapterCurrentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f97316 0%, #f97316 ${(chapterCurrentTime / (totalChapterDuration || 1)) * 100}%, #d1d5db ${(chapterCurrentTime / (totalChapterDuration || 1)) * 100}%, #d1d5db 100%)`
            }}
          />
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>{formatTime(chapterCurrentTime)}</span>
            <span>{formatTime(timeLeft)} left</span>
            <span>– {formatTime(totalChapterDuration)}</span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center space-x-6 mb-8">
          {/* Previous Chapter */}
          <button
            onClick={goToPreviousChapter}
            disabled={!prevChapter}
            className="p-2 text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous Chapter"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          {/* Rewind 30s */}
          <button
            onClick={() => handleSkip(-30)}
            className="p-2 text-gray-700 hover:text-gray-900 relative"
            aria-label="Rewind 30 seconds"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold mt-1">30</span>
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            disabled={isLoading || !hasAudio}
            className="w-20 h-20 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-900 transition-colors shadow-lg disabled:opacity-50"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : isPlaying ? (
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Forward 30s */}
          <button
            onClick={() => handleSkip(30)}
            className="p-2 text-gray-700 hover:text-gray-900 relative"
            aria-label="Forward 30 seconds"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold mt-1">30</span>
          </button>

          {/* Next Chapter */}
          <button
            onClick={goToNextChapter}
            disabled={!nextChapter}
            className="p-2 text-gray-700 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next Chapter"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-center space-x-12 text-gray-700">
          {/* Speed */}
          <button
            onClick={() => setShowSpeedModal(true)}
            className="flex flex-col items-center space-y-1"
          >
            <span className="text-lg font-semibold">{playbackRate}x</span>
            <span className="text-xs text-gray-500">Narration Speed</span>
          </button>

          {/* Chapters */}
          <button
            onClick={() => setShowChaptersModal(true)}
            className="flex flex-col items-center space-y-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <span className="text-xs text-gray-500">Chapters</span>
          </button>

          {/* Bookmark */}
          <button className="flex flex-col items-center space-y-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            <span className="text-xs text-gray-500">Add a bookmark</span>
          </button>
        </div>

        {/* Chapter indicator */}
        <div className="mt-6 text-xs text-gray-400">
          <div>Chapter {chapter.idx + 1} of {allChapters.length}</div>
        </div>
      </div>

      {/* Chapter End Countdown Overlay */}
      {chapterEndCountdown !== null && nextChapter && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="mb-6">
              <svg className="w-16 h-16 mx-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chapter Complete!</h2>
            <p className="text-gray-600 mb-4">
              Next: <span className="font-semibold">{nextChapter.title}</span>
            </p>
            <div className="text-5xl font-bold text-orange-500 mb-6">
              {chapterEndCountdown}
            </div>
            <p className="text-sm text-gray-500 mb-6">Starting in {chapterEndCountdown} second{chapterEndCountdown !== 1 ? 's' : ''}...</p>
            <div className="flex space-x-4 justify-center">
              <button
                onClick={cancelCountdown}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Stay Here
              </button>
              <button
                onClick={skipToNextChapter}
                className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                Skip Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapters Modal */}
      {showChaptersModal && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setShowChaptersModal(false)}
              className="text-blue-600 font-medium"
            >
              Close
            </button>
            <h2 className="text-lg font-semibold">Chapters</h2>
            <div className="w-12" />
          </div>
          <div className="divide-y divide-gray-200">
            {allChapters
              .filter(ch => ch.title && ch.title.trim().length > 0)
              .map((ch) => {
                const isCurrentChapter = ch.id === chapterId
                return (
                  <button
                    key={ch.id}
                    onClick={() => goToChapter(ch)}
                    className={`w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 ${
                      isCurrentChapter ? 'bg-orange-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {isCurrentChapter && (
                        <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                      <span className={`${isCurrentChapter ? 'font-semibold text-orange-600' : 'text-gray-800'}`}>
                        {ch.title}
                      </span>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* Speed Modal */}
      {showSpeedModal && (
        <div className="fixed inset-0 bg-white z-50 overflow-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setShowSpeedModal(false)}
              className="text-blue-600 font-medium"
            >
              Close
            </button>
            <h2 className="text-lg font-semibold">Speed</h2>
            <div className="w-12" />
          </div>
          <div className="divide-y divide-gray-200">
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                onClick={() => {
                  setPlaybackRate(rate)
                  if (audioRef.current) {
                    audioRef.current.playbackRate = rate
                  }
                  setShowSpeedModal(false)
                }}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    playbackRate === rate ? 'border-blue-600' : 'border-gray-300'
                  }`}>
                    {playbackRate === rate && (
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <span className="text-gray-800">{rate}x</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
