'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AppLayout } from '@/components/app/AppLayout'
import { getBookById, getChapterById } from '@/lib/mockData'

export default function PlayerPage() {
  const params = useParams()
  const bookId = params.bookId as string
  const chapterId = params.chapterId as string
  
  const book = getBookById(bookId)
  const chapter = getChapterById(bookId, chapterId)
  const audioRef = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showChapterDrawer, setShowChapterDrawer] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnded = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  if (!book || !chapter) {
    return (
      <AppLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Chapter not found</h1>
          <Link href="/library" className="text-[var(--color-lilac)]">Back to Library</Link>
        </div>
      </AppLayout>
    )
  }

  const currentChapterIndex = book.chapters.findIndex(ch => ch.id === chapterId)
  const previousChapter = currentChapterIndex > 0 ? book.chapters[currentChapterIndex - 1] : null
  const nextChapter = currentChapterIndex < book.chapters.length - 1 ? book.chapters[currentChapterIndex + 1] : null

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const newTime = parseFloat(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const skipBack = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 15)
  }

  const skipForward = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(duration, audio.currentTime + 30)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const speedOptions = [0.75, 1, 1.25, 1.5, 2]

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          href={`/book/${bookId}`}
          className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Book
        </Link>

        {/* Audio Element (hidden, using mock audio) */}
        <audio
          ref={audioRef}
          src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
          preload="metadata"
        />

        {/* Player UI */}
        <div className="glass-panel rounded-xl p-6 sm:p-8">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-[var(--color-text-primary)]">{book.title}</h1>
            <h2 className="text-xl sm:text-2xl text-[var(--color-text-secondary)]">{chapter.title}</h2>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-[var(--color-purple-dark)] rounded-lg appearance-none cursor-pointer accent-[var(--color-pink-neon)]"
              style={{
                background: `linear-gradient(to right, var(--color-pink-neon) 0%, var(--color-pink-neon) ${(currentTime / (duration || 1)) * 100}%, var(--color-purple-dark) ${(currentTime / (duration || 1)) * 100}%, var(--color-purple-dark) 100%)`,
              }}
            />
            <div className="flex justify-between text-sm text-[var(--color-text-muted)] mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mb-8">
            <button
              onClick={() => previousChapter && (window.location.href = `/player/${bookId}/${previousChapter.id}`)}
              disabled={!previousChapter}
              className="p-3 rounded-lg border border-[var(--color-glass-border)] hover:border-[var(--color-lilac)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Previous Chapter"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={skipBack}
              className="p-3 rounded-lg border border-[var(--color-glass-border)] hover:border-[var(--color-lilac)] transition-all"
              title="Back 15 seconds"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
              </svg>
              <span className="text-xs mt-1 block">15s</span>
            </button>

            <button
              onClick={togglePlay}
              className="p-4 bg-gradient-to-r from-[var(--color-lilac)] to-[var(--color-pink-neon)] rounded-full hover:shadow-[0_0_30px_rgba(244,114,182,0.5)] transition-all"
            >
              {isPlaying ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={skipForward}
              className="p-3 rounded-lg border border-[var(--color-glass-border)] hover:border-[var(--color-lilac)] transition-all"
              title="Forward 30 seconds"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
              </svg>
              <span className="text-xs mt-1 block">30s</span>
            </button>

            <button
              onClick={() => nextChapter && (window.location.href = `/player/${bookId}/${nextChapter.id}`)}
              disabled={!nextChapter}
              className="p-3 rounded-lg border border-[var(--color-glass-border)] hover:border-[var(--color-lilac)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next Chapter"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Speed Control */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-sm text-[var(--color-text-muted)]">Speed:</span>
            <div className="flex gap-2">
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackRate(speed)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    playbackRate === speed
                      ? 'bg-[var(--color-lilac)] bg-opacity-30 border border-[var(--color-lilac)]'
                      : 'border border-[var(--color-glass-border)] hover:border-[var(--color-lilac)]'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Chapter Drawer Toggle */}
          <button
            onClick={() => setShowChapterDrawer(!showChapterDrawer)}
            className="w-full py-3 border border-[var(--color-glass-border)] rounded-lg hover:border-[var(--color-lilac)] transition-all flex items-center justify-center gap-2"
          >
            <span className="text-sm font-semibold">Chapters</span>
            <svg
              className={`w-5 h-5 transition-transform ${showChapterDrawer ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Chapter Drawer */}
          <AnimatePresence>
            {showChapterDrawer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {book.chapters.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/player/${bookId}/${ch.id}`}
                      className={`block p-3 rounded-lg transition-all ${
                        ch.id === chapterId
                          ? 'bg-[var(--color-lilac)] bg-opacity-20 border border-[var(--color-lilac)]'
                          : 'border border-[var(--color-glass-border)] hover:border-[var(--color-lilac)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {ch.index}. {ch.title}
                        </span>
                        {ch.status === 'ready' && (
                          <span className="text-xs px-2 py-1 bg-green-500 bg-opacity-20 rounded">Ready</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  )
}
