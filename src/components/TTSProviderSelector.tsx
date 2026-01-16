'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface TTSProviderSelectorProps {
  bookId: string
  currentProvider?: string
  hasGeneratedAudio?: boolean
}

const TTS_PROVIDERS = {
  google: {
    id: 'google',
    name: 'Budget',
    fullName: 'Google Cloud TTS',
    description: 'Great quality, 1M chars/month FREE',
    cost: '~$0.016 per 1K chars',
    icon: '🪙',
    color: 'blue',
  },
  openai: {
    id: 'openai',
    name: 'Regular',
    fullName: 'OpenAI TTS',
    description: 'High quality, balanced',
    cost: '~$0.015 per 1K chars',
    icon: '',
    color: 'green',
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'Premium',
    fullName: 'ElevenLabs',
    description: 'Ultra-realistic, emotional',
    cost: '~$0.30 per 1K chars',
    icon: '',
    color: 'purple',
  },
}

export function TTSProviderSelector({ 
  bookId, 
  currentProvider = 'openai',
  hasGeneratedAudio = false 
}: TTSProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState(currentProvider)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const router = useRouter()

  // Sync state when prop changes
  useEffect(() => {
    setSelectedProvider(currentProvider)
  }, [currentProvider])

  const handleSelectProvider = async (providerId: string) => {
    if (providerId === selectedProvider) return

    setSelectedProvider(providerId)
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // Update provider
      const response = await fetch(`/api/books/${bookId}/tts-provider`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttsProvider: providerId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save provider preference')
      }

      // Also update narrator voice to match the new provider
      let defaultVoice = 'rachel'
      if (providerId === 'openai') defaultVoice = 'nova-openai'
      else if (providerId === 'google') defaultVoice = 'aria-google'
      
      await fetch(`/api/books/${bookId}/voice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narratorVoice: defaultVoice }),
      })

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        router.refresh()
      }, 1000)

    } catch (error) {
      console.error('Error saving provider:', error)
      setSelectedProvider(currentProvider) // Revert on error
      alert('Failed to save provider. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const currentProviderInfo = TTS_PROVIDERS[selectedProvider as keyof typeof TTS_PROVIDERS] || TTS_PROVIDERS.openai

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-gray-700">
        Audio Quality
      </label>

      {/* Warning for existing audio */}
      {hasGeneratedAudio && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          Changing provider only affects <strong>new</strong> audio generation.
          Existing chapters will keep their current audio.
        </div>
      )}

      {/* Provider Options */}
      <div className="grid grid-cols-3 gap-2">
        {Object.values(TTS_PROVIDERS).map((provider) => {
          const isSelected = provider.id === selectedProvider
          const colorClasses = {
            blue: { border: 'border-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', indicator: 'bg-blue-500' },
            green: { border: 'border-green-400', bg: 'bg-green-50', text: 'text-green-700', indicator: 'bg-green-500' },
            purple: { border: 'border-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', indicator: 'bg-purple-500' },
          }
          const colors = colorClasses[provider.color as keyof typeof colorClasses]
          
          return (
            <button
              key={provider.id}
              onClick={() => handleSelectProvider(provider.id)}
              disabled={isSaving}
              className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? `${colors.border} ${colors.bg}`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${isSaving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center ${colors.indicator}`}>
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Provider info */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg">{provider.icon}</span>
                <span className={`font-bold text-sm ${colors.text}`}>
                  {provider.name}
                </span>
              </div>
              <p className="text-[10px] text-gray-600 mb-0.5 leading-tight">{provider.description}</p>
              <p className="text-[10px] text-gray-400">{provider.cost}</p>
            </button>
          )
        })}
      </div>

      {/* Status indicator */}
      {(isSaving || saveSuccess) && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-500">Saving...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-green-600">Saved!</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
