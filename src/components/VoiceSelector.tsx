'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { NARRATOR_VOICES, VoiceOption } from '@/lib/services/voiceOptions'

interface VoiceSelectorProps {
  bookId: string
  currentVoice?: string
  hasGeneratedAudio?: boolean
  currentProvider?: 'openai' | 'elevenlabs' | 'google'  // Which TTS provider is selected for the book
}

export function VoiceSelector({ 
  bookId, 
  currentVoice = 'nova-openai', 
  hasGeneratedAudio = false,
  currentProvider = 'openai'  // Default to OpenAI (Regular)
}: VoiceSelectorProps) {
  const [selectedVoice, setSelectedVoice] = useState(currentVoice)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [filter, setFilter] = useState<'all' | 'female' | 'male'>('all')
  const router = useRouter()

  // Filter voices by the selected TTS provider
  const providerVoices = NARRATOR_VOICES.filter(v => v.provider === currentProvider)
  
  // Sync state when prop changes (after page refresh)
  useEffect(() => {
    setSelectedVoice(currentVoice)
  }, [currentVoice])

  // Find the current voice option, or default to first voice of selected provider
  const currentVoiceOption = NARRATOR_VOICES.find(v => v.id === selectedVoice) 
    || providerVoices[0] 
    || NARRATOR_VOICES[0]

  // Filter by gender within the selected provider's voices
  const filteredVoices = filter === 'all' 
    ? providerVoices 
    : providerVoices.filter(v => v.gender === filter)

  const handleSelectVoice = async (voice: VoiceOption) => {
    if (voice.id === selectedVoice) {
      setIsOpen(false)
      return
    }

    setSelectedVoice(voice.id)
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch(`/api/books/${bookId}/voice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narratorVoice: voice.id }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save voice preference')
      }
      
      setSaveSuccess(true)
      
      // Keep modal open briefly to show success
      setTimeout(() => {
        setIsOpen(false)
        router.refresh()
      }, 500)
      
    } catch (error) {
      console.error('Error saving voice:', error)
      setSelectedVoice(currentVoice) // Revert on error
      alert('Failed to save voice. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="relative">
      {/* Current Selection Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSaving}
        className={`flex items-center gap-3 px-4 py-3 bg-white border-2 rounded-xl transition-all shadow-sm w-full ${
          currentProvider === 'elevenlabs'
            ? 'border-purple-200 hover:border-purple-400'
            : 'border-green-200 hover:border-green-400'
        }`}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${
          currentVoiceOption.gender === 'female'
            ? 'bg-gradient-to-br from-pink-400 to-pink-500'
            : 'bg-gradient-to-br from-blue-400 to-blue-500'
        }`}>
          {currentVoiceOption.gender === 'female' ? 'F' : 'M'}
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-gray-800">{currentVoiceOption.name}</div>
          <div className="text-xs text-gray-500">{currentVoiceOption.accent} • {currentVoiceOption.description}</div>
        </div>
        {isSaving ? (
          <svg className="w-5 h-5 text-lilac-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 z-40"
            onClick={() => !isSaving && setIsOpen(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:absolute md:inset-auto md:top-full md:left-0 md:right-0 md:translate-y-0 md:mt-2 bg-white rounded-2xl shadow-2xl z-50 max-h-[70vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className={`sticky top-0 text-white px-6 py-4 ${
              currentProvider === 'elevenlabs'
                ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                : 'bg-gradient-to-r from-green-500 to-green-600'
            }`}>
              <h3 className="text-lg font-bold">Choose Narrator Voice</h3>
              <p className="text-sm opacity-90">
                {currentProvider === 'elevenlabs' 
                  ? 'Premium voices from ElevenLabs' 
                  : 'Regular voices from OpenAI TTS'}
              </p>
              <div className="mt-2 text-xs opacity-75">
                {providerVoices.length} voices available
              </div>
            </div>

            {/* Warning for existing audio */}
            {hasGeneratedAudio && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Changing the voice will only affect NEW audio generation. 
                  To apply to existing chapters, regenerate their audio.
                </p>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'female', label: 'Female' },
                { key: 'male', label: 'Male' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    filter === key 
                      ? currentProvider === 'elevenlabs'
                        ? 'bg-purple-500 text-white'
                        : 'bg-green-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Voice List */}
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {filteredVoices.map((voice) => {
                const isSelected = voice.id === selectedVoice
                const isCurrentlySaved = voice.id === currentVoice
                return (
                  <button
                    key={voice.id}
                    onClick={() => handleSelectVoice(voice)}
                    disabled={isSaving}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all mb-2 ${
                      isSelected 
                        ? currentProvider === 'elevenlabs'
                          ? 'bg-purple-100 border-2 border-purple-400'
                          : 'bg-green-100 border-2 border-green-400'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    } ${isSaving ? 'opacity-50' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                      voice.gender === 'female' 
                        ? 'bg-gradient-to-br from-pink-300 to-pink-400' 
                        : 'bg-gradient-to-br from-blue-300 to-blue-400'
                    }`}>
                      {voice.gender === 'female' ? 'F' : 'M'}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800">{voice.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                          {voice.accent}
                        </span>
                        {isCurrentlySaved && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            currentProvider === 'elevenlabs'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{voice.description}</div>
                      <div className="text-xs text-gray-400 mt-1">{voice.style}</div>
                    </div>

                    {/* Selected/Saving Indicator */}
                    {isSelected && (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        saveSuccess ? 'bg-green-500' : currentProvider === 'elevenlabs' ? 'bg-purple-500' : 'bg-green-500'
                      }`}>
                        {isSaving ? (
                          <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-3 border-t text-center">
              <p className="text-xs text-gray-500">
                Change Audio Quality above to switch between Regular (OpenAI) and Premium (ElevenLabs) voices.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
