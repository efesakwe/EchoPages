import axios from 'axios'
import { CharacterInfo } from './llmService'
import { NARRATOR_VOICES, getVoiceById } from './voiceOptions'
import OpenAI from 'openai'
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech'

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1'

// Google Cloud TTS client (lazy initialized)
let googleTTSClient: TextToSpeechClient | null = null

function getGoogleTTSClient(): TextToSpeechClient {
  if (!googleTTSClient) {
    // Check for API key first (simpler setup)
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY
    if (apiKey) {
      googleTTSClient = new TextToSpeechClient({ apiKey })
    } else {
      // Fall back to service account credentials
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
      if (!credentials) {
        throw new Error('GOOGLE_CLOUD_API_KEY or GOOGLE_APPLICATION_CREDENTIALS must be set for Google Cloud TTS')
      }
      googleTTSClient = new TextToSpeechClient()
    }
  }
  return googleTTSClient
}

// TTS Provider types
export type TTSProvider = 'elevenlabs' | 'openai' | 'google'

// Provider configuration
export const TTS_PROVIDERS = {
  elevenlabs: {
    name: 'ElevenLabs',
    costPer1MChars: 500, // ~$0.50 per 1M chars (varies by plan)
    quality: 'premium',
  },
  openai: {
    name: 'OpenAI TTS',
    costPer1MChars: 15, // $15 per 1M chars (tts-1)
    quality: 'high',
  },
  google: {
    name: 'Google Cloud TTS',
    costPer1MChars: 16, // ~$16 per 1M chars (Neural2 voices)
    quality: 'high',
  },
}

// Get default provider from env or use cheapest
export function getDefaultProvider(): TTSProvider {
  const envProvider = process.env.TTS_PROVIDER as TTSProvider
  if (envProvider && ['elevenlabs', 'openai', 'google'].includes(envProvider)) {
    return envProvider
  }
  return 'openai' // Default to OpenAI (good balance of cost/quality)
}

// ElevenLabs voice pool - diverse voices for characters
export const VOICE_POOL = {
  // Female voices (varied)
  female_young_1: 'EXAVITQu4vr4xnSDxMaL',   // Bella - young, warm
  female_young_2: 'jBpfuIE2acCO8z3wKNLl',   // Gigi - animated, bright
  female_adult_1: 'XB0fDUnXU5powFXDhCwa',   // Charlotte - sophisticated
  female_adult_2: 'oWAxZDx7w5VEj9dCyTzz',   // Grace - gentle, mature
  female_elderly: 'pqHfZKP75CvOlQylNhV4',   // Lily - wise, soft
  
  // Male voices (varied)
  male_young_1: 'SOYHLrjzK2X1ezoPC6cr',     // Harry - young, energetic
  male_young_2: 'TX3LPaxmHKxFdv7VOQHJ',     // Liam - casual, friendly
  male_adult_1: 'VR6AewLTigWG4xSOukaG',     // Arnold - deep, commanding
  male_adult_2: 'pNInz6obpgDQGcFmaJgB',     // Adam - neutral, professional
  male_elderly: 'N2lVS1w4EtoT3dr4eOWO',     // Callum - warm, grandfatherly
  
  // Child voices
  child_female: 'jsCqWAovK2LkecY7zXl4',     // Dorothy - young girl
  child_male: 'iP95p4xoKVk53GoZ742B',       // Christopher - young boy
}

// OpenAI TTS voices - ONLY the 9 valid voices
// Valid: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
export const OPENAI_VOICES = {
  'alloy': { gender: 'neutral', accent: 'American', style: 'Neutral, versatile' },
  'ash': { gender: 'male', accent: 'American', style: 'Clear, professional' },
  'coral': { gender: 'female', accent: 'American', style: 'Warm, friendly' },
  'echo': { gender: 'male', accent: 'American', style: 'Deep, clear' },
  'fable': { gender: 'male', accent: 'British', style: 'Narrator, storytelling' },
  'nova': { gender: 'female', accent: 'American', style: 'Warm, expressive' },
  'onyx': { gender: 'male', accent: 'American', style: 'Deep, authoritative' },
  'sage': { gender: 'male', accent: 'American', style: 'Wise, calm' },
  'shimmer': { gender: 'female', accent: 'American', style: 'Soft, gentle' },
}

// Valid OpenAI voice names for validation
const VALID_OPENAI_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer']

// Google Cloud TTS voices (Neural2 - best quality)
// Format: languageCode, voiceName, gender
export const GOOGLE_VOICES = {
  // Female voices
  'en-US-Neural2-C': { gender: 'female', accent: 'American', style: 'Warm, professional' },
  'en-US-Neural2-E': { gender: 'female', accent: 'American', style: 'Soft, calm' },
  'en-US-Neural2-F': { gender: 'female', accent: 'American', style: 'Friendly, expressive' },
  'en-US-Neural2-G': { gender: 'female', accent: 'American', style: 'Clear, natural' },
  'en-US-Neural2-H': { gender: 'female', accent: 'American', style: 'Warm, engaging' },
  'en-GB-Neural2-A': { gender: 'female', accent: 'British', style: 'Elegant, refined' },
  'en-GB-Neural2-C': { gender: 'female', accent: 'British', style: 'Soft, sophisticated' },
  
  // Male voices
  'en-US-Neural2-A': { gender: 'male', accent: 'American', style: 'Deep, authoritative' },
  'en-US-Neural2-D': { gender: 'male', accent: 'American', style: 'Clear, professional' },
  'en-US-Neural2-I': { gender: 'male', accent: 'American', style: 'Warm, friendly' },
  'en-US-Neural2-J': { gender: 'male', accent: 'American', style: 'Calm, steady' },
  'en-GB-Neural2-B': { gender: 'male', accent: 'British', style: 'Distinguished, narrator' },
  'en-GB-Neural2-D': { gender: 'male', accent: 'British', style: 'Warm, storytelling' },
  
  // Neutral/versatile
  'en-US-Studio-O': { gender: 'female', accent: 'American', style: 'Studio quality, narrator' },
  'en-US-Studio-Q': { gender: 'male', accent: 'American', style: 'Studio quality, narrator' },
}

const VALID_GOOGLE_VOICES = Object.keys(GOOGLE_VOICES)

// Current book's narrator voice (set per book)
// Default to OpenAI Nova since OpenAI is the default (Regular) provider
let currentNarratorVoiceId: string = 'nova' // Default: Nova (OpenAI)
let currentNarratorVoiceName: string = 'nova-openai'
let currentProvider: TTSProvider = getDefaultProvider()

// Track assigned voices for the current book's characters
const characterVoiceMap = new Map<string, string>()
let availableVoices = { 
  male: [...Object.entries(VOICE_POOL).filter(([k]) => k.startsWith('male_'))], 
  female: [...Object.entries(VOICE_POOL).filter(([k]) => k.startsWith('female_'))] 
}

/**
 * Set the narrator voice for the current book
 * NOTE: This does NOT change the provider - provider is set separately via setProvider()
 */
export function setNarratorVoice(voiceIdOrName: string): void {
  // First check if it's a voice option ID (like 'rachel', 'charlotte', 'nova-openai')
  const voiceOption = getVoiceById(voiceIdOrName)
  if (voiceOption) {
    currentNarratorVoiceId = voiceOption.voiceId
    currentNarratorVoiceName = voiceOption.id
    // DO NOT override provider here - it's set separately via book's tts_provider setting
    console.log(`[VOICE] Narrator voice set to: ${voiceOption.name} (${voiceOption.accent})`)
    return
  }
  
  // Otherwise assume it's a raw voice ID (fallback for compatibility)
  currentNarratorVoiceId = voiceIdOrName
  console.log(`[VOICE] Narrator voice set to ID: ${voiceIdOrName}`)
}

/**
 * Set TTS provider
 */
export function setProvider(provider: TTSProvider): void {
  currentProvider = provider
  console.log(`[TTS] Provider set to: ${TTS_PROVIDERS[provider].name}`)
}

/**
 * Get current narrator voice ID
 */
export function getNarratorVoiceId(): string {
  return currentNarratorVoiceId
}

/**
 * Get voice for OpenAI TTS based on narrator voice option
 * ONLY returns valid OpenAI voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
 */
function getOpenAIVoiceForNarrator(): string {
  const voiceOption = getVoiceById(currentNarratorVoiceName)
  if (!voiceOption) return 'nova' // Default
  
  // If it's already an OpenAI voice, validate and use its voiceId directly
  if (voiceOption.provider === 'openai') {
    const voiceId = voiceOption.voiceId
    // Validate it's a real OpenAI voice
    if (VALID_OPENAI_VOICES.includes(voiceId)) {
      return voiceId
    }
    return 'nova' // Fallback if invalid
  }
  
  // Otherwise, map ElevenLabs voice to OpenAI equivalent
  // Map to OpenAI voices based on gender and accent
  if (voiceOption.gender === 'female') {
    if (voiceOption.accent === 'British') return 'shimmer'
    // Match style descriptions
    if (voiceOption.style?.includes('warm') || voiceOption.style?.includes('expressive')) return 'nova'
    if (voiceOption.style?.includes('soft') || voiceOption.style?.includes('gentle')) return 'shimmer'
    if (voiceOption.style?.includes('bright') || voiceOption.style?.includes('energetic')) return 'coral'
    return 'coral' // Warm, friendly default
  } else {
    if (voiceOption.accent === 'British') return 'fable'
    if (voiceOption.accent === 'Irish') return 'echo'
    // Match style descriptions
    if (voiceOption.style?.includes('deep') || voiceOption.style?.includes('authoritative')) return 'onyx'
    if (voiceOption.style?.includes('calm') || voiceOption.style?.includes('wise')) return 'sage'
    if (voiceOption.style?.includes('warm')) return 'fable'
    if (voiceOption.style?.includes('clear') || voiceOption.style?.includes('professional')) return 'ash'
    return 'echo' // Clear default
  }
}

/**
 * Get voice for Google Cloud TTS based on narrator voice option
 */
function getGoogleVoiceForNarrator(): string {
  const voiceOption = getVoiceById(currentNarratorVoiceName)
  if (!voiceOption) return 'en-US-Neural2-F' // Default female narrator
  
  // If it's already a Google voice, use it directly
  if (voiceOption.provider === 'google') {
    return voiceOption.voiceId
  }
  
  // Map to Google voices based on gender and accent
  if (voiceOption.gender === 'female') {
    if (voiceOption.accent === 'British') return 'en-GB-Neural2-A'
    if (voiceOption.style?.includes('warm') || voiceOption.style?.includes('expressive')) return 'en-US-Neural2-F'
    if (voiceOption.style?.includes('soft') || voiceOption.style?.includes('gentle')) return 'en-US-Neural2-E'
    return 'en-US-Neural2-F' // Default female
  } else {
    if (voiceOption.accent === 'British') return 'en-GB-Neural2-B'
    if (voiceOption.style?.includes('deep') || voiceOption.style?.includes('authoritative')) return 'en-US-Neural2-A'
    if (voiceOption.style?.includes('calm') || voiceOption.style?.includes('wise')) return 'en-US-Neural2-J'
    return 'en-US-Neural2-D' // Default male
  }
}

/**
 * Map any voice to a Google Cloud TTS voice
 */
function mapToGoogleVoice(voiceId: string, characterInfo?: CharacterInfo): string {
  // If it's already a valid Google voice, use it
  if (VALID_GOOGLE_VOICES.includes(voiceId)) {
    return voiceId
  }
  
  // Map based on character info or default
  if (characterInfo) {
    const gender = characterInfo.gender || 'unknown'
    const age = characterInfo.age || 'adult'
    
    if (gender === 'female') {
      if (age === 'child' || age === 'young') return 'en-US-Neural2-G'
      if (age === 'elderly') return 'en-US-Neural2-E'
      return 'en-US-Neural2-F' // Adult female
    } else {
      if (age === 'child' || age === 'young') return 'en-US-Neural2-I'
      if (age === 'elderly') return 'en-US-Neural2-J'
      return 'en-US-Neural2-D' // Adult male
    }
  }
  
  // Default rotation for variety
  const googleVoices = ['en-US-Neural2-F', 'en-US-Neural2-D', 'en-US-Neural2-E', 'en-US-Neural2-A', 
                        'en-GB-Neural2-A', 'en-GB-Neural2-B', 'en-US-Neural2-G', 'en-US-Neural2-I']
  const hash = voiceId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
  return googleVoices[hash % googleVoices.length]
}

/**
 * Get or assign a voice for a character
 */
export function getVoiceForCharacter(
  character: string | undefined,
  voiceType: string,
  characterInfo?: CharacterInfo
): string {
  // Narrator always uses the selected narrator voice
  // Also use narrator voice for "null", "undefined", empty, or "dialogue" without specific character
  const isNarratorVoice = voiceType === 'narrator' || 
    !character || 
    character === 'null' || 
    character === 'undefined' || 
    character === 'dialogue' ||
    character.trim() === ''
  
  if (isNarratorVoice) {
    if (currentProvider === 'openai') {
      return getOpenAIVoiceForNarrator()
    }
    if (currentProvider === 'google') {
      return getGoogleVoiceForNarrator()
    }
    return currentNarratorVoiceId
  }
  
  // Check if character already has assigned voice
  if (characterVoiceMap.has(character)) {
    return characterVoiceMap.get(character)!
  }
  
  // Assign new voice based on character info
  let voiceId: string
  
  if (currentProvider === 'openai') {
    // Use OpenAI voices - ONLY the 9 valid voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
    if (characterInfo) {
      const gender = characterInfo.gender || 'unknown'
      const age = characterInfo.age || 'adult'
      
      if (gender === 'male') {
        if (age === 'child' || age === 'young') {
          voiceId = 'echo' // Clear, younger male
        } else if (age === 'elderly') {
          voiceId = 'sage' // Wise, calm
        } else {
          // Adult male - choose based on personality
          if (characterInfo.personality?.includes('authoritative') || characterInfo.personality?.includes('deep')) {
            voiceId = 'onyx'
          } else if (characterInfo.personality?.includes('warm')) {
            voiceId = 'fable' // British narrator voice
          } else if (characterInfo.personality?.includes('energetic')) {
            voiceId = 'ash' // Clear, professional
          } else {
            voiceId = 'echo' // Deep, clear default
          }
        }
      } else {
        // Female voices
        if (age === 'child' || age === 'young') {
          voiceId = 'coral' // Warm, friendly for young females
        } else if (age === 'elderly') {
          voiceId = 'shimmer' // Soft, gentle
        } else {
          // Adult female - choose based on personality
          if (characterInfo.personality?.includes('warm') || characterInfo.personality?.includes('expressive')) {
            voiceId = 'nova'
          } else if (characterInfo.personality?.includes('soft') || characterInfo.personality?.includes('gentle')) {
            voiceId = 'shimmer'
          } else if (characterInfo.personality?.includes('bright') || characterInfo.personality?.includes('energetic')) {
            voiceId = 'coral' // Warm, friendly
          } else {
            voiceId = 'nova' // Warm, expressive default
          }
        }
      }
    } else {
      // Alternate between all 9 valid OpenAI voices for variety
      const assignedCount = characterVoiceMap.size
      const voices = ['nova', 'shimmer', 'onyx', 'echo', 'fable', 'coral', 'ash', 'sage', 'alloy']
      voiceId = voices[assignedCount % voices.length]
    }
  } else if (currentProvider === 'google') {
    // Google Cloud TTS voices
    if (characterInfo) {
      const gender = characterInfo.gender || 'unknown'
      const age = characterInfo.age || 'adult'
      
      if (gender === 'male') {
        if (age === 'child' || age === 'young') {
          voiceId = 'en-US-Neural2-I' // Warm, friendly young male
        } else if (age === 'elderly') {
          voiceId = 'en-US-Neural2-J' // Calm, steady
        } else {
          if (characterInfo.personality?.includes('authoritative') || characterInfo.personality?.includes('deep')) {
            voiceId = 'en-US-Neural2-A' // Deep, authoritative
          } else if (characterInfo.personality?.includes('warm')) {
            voiceId = 'en-US-Neural2-I' // Warm, friendly
          } else {
            voiceId = 'en-US-Neural2-D' // Clear, professional default
          }
        }
      } else {
        // Female voices
        if (age === 'child' || age === 'young') {
          voiceId = 'en-US-Neural2-G' // Clear, natural young female
        } else if (age === 'elderly') {
          voiceId = 'en-US-Neural2-E' // Soft, calm
        } else {
          if (characterInfo.personality?.includes('warm') || characterInfo.personality?.includes('expressive')) {
            voiceId = 'en-US-Neural2-F' // Friendly, expressive
          } else if (characterInfo.personality?.includes('soft') || characterInfo.personality?.includes('gentle')) {
            voiceId = 'en-US-Neural2-E' // Soft, calm
          } else {
            voiceId = 'en-US-Neural2-F' // Friendly, expressive default
          }
        }
      }
    } else {
      // Alternate between Google voices for variety
      const assignedCount = characterVoiceMap.size
      const voices = ['en-US-Neural2-F', 'en-US-Neural2-D', 'en-US-Neural2-E', 'en-US-Neural2-A', 
                      'en-GB-Neural2-A', 'en-GB-Neural2-B', 'en-US-Neural2-G', 'en-US-Neural2-I']
      voiceId = voices[assignedCount % voices.length]
    }
  } else {
    // ElevenLabs voices (original logic)
    if (characterInfo) {
      const gender = characterInfo.gender || 'unknown'
      const age = characterInfo.age || 'adult'
      
      if (age === 'child') {
        voiceId = gender === 'male' ? VOICE_POOL.child_male : VOICE_POOL.child_female
      } else if (age === 'elderly') {
        voiceId = gender === 'male' ? VOICE_POOL.male_elderly : VOICE_POOL.female_elderly
      } else if (age === 'young') {
        if (gender === 'male') {
          voiceId = availableVoices.male.find(([k]) => k.includes('young'))?.[1] || VOICE_POOL.male_young_1
        } else {
          voiceId = availableVoices.female.find(([k]) => k.includes('young'))?.[1] || VOICE_POOL.female_young_1
        }
      } else {
        if (gender === 'male') {
          voiceId = availableVoices.male.find(([k]) => k.includes('adult'))?.[1] || VOICE_POOL.male_adult_1
        } else {
          voiceId = availableVoices.female.find(([k]) => k.includes('adult'))?.[1] || VOICE_POOL.female_adult_1
        }
      }
    } else {
      const assignedCount = characterVoiceMap.size
      const pool = assignedCount % 2 === 0 ? availableVoices.female : availableVoices.male
      const voice = pool[assignedCount % pool.length]
      voiceId = voice ? voice[1] : currentNarratorVoiceId
    }
  }
  
  // Store assignment
  characterVoiceMap.set(character, voiceId)
  console.log(`Assigned voice for "${character}": ${voiceId}`)
  
  return voiceId
}

/**
 * Reset voice assignments (call when starting a new book)
 */
export function resetVoiceAssignments(): void {
  characterVoiceMap.clear()
  availableVoices = {
    male: [...Object.entries(VOICE_POOL).filter(([k]) => k.startsWith('male_'))],
    female: [...Object.entries(VOICE_POOL).filter(([k]) => k.startsWith('female_'))]
  }
}

/**
 * Set up voice assignments for a list of characters
 */
export function setupVoicesForCharacters(characters: CharacterInfo[]): Map<string, string> {
  resetVoiceAssignments()
  
  for (const char of characters) {
    getVoiceForCharacter(char.name, 'dialogue', char)
  }
  
  console.log(`Set up ${characterVoiceMap.size} character voices`)
  return new Map(characterVoiceMap)
}

export interface TTSOptions {
  voiceId?: string
  modelId?: string
  stability?: number
  similarityBoost?: number
  emotionHint?: string
  character?: string
  characterInfo?: CharacterInfo
  provider?: TTSProvider
}

/**
 * Generate audio using OpenAI TTS
 */
async function generateAudioOpenAI(text: string, voice: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const openai = new OpenAI({ apiKey })

  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1', // Use tts-1 for cost savings (tts-1-hd is 2x more expensive)
      voice: voice as any,
      input: text,
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    console.log(`Generated audio (OpenAI, voice: ${voice}): ${buffer.length} bytes`)
    return buffer
  } catch (error: any) {
    console.error('OpenAI TTS error:', error)
    throw new Error(`OpenAI TTS failed: ${error.message}`)
  }
}

/**
 * Generate audio using Google Cloud TTS (Neural2 voices)
 * Cost: ~$4 per 1M characters
 */
async function generateAudioGoogle(text: string, voice: string): Promise<Buffer> {
  try {
    const client = getGoogleTTSClient()
    
    // Extract language code from voice name (e.g., 'en-US-Neural2-C' -> 'en-US')
    const languageCode = voice.split('-').slice(0, 2).join('-')
    
    // Determine SSML gender from voice
    const voiceInfo = GOOGLE_VOICES[voice as keyof typeof GOOGLE_VOICES]
    const ssmlGender = voiceInfo?.gender === 'female' 
      ? 'FEMALE' as const
      : 'MALE' as const
    
    console.log(`   → Calling Google Cloud TTS API with voice: ${voice}...`)
    
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text },
      voice: {
        languageCode,
        name: voice,
        ssmlGender,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: 1.0,
        pitch: 0,
      },
    }

    const [response] = await client.synthesizeSpeech(request)
    
    if (!response.audioContent) {
      throw new Error('Google Cloud TTS returned no audio content')
    }

    const buffer = Buffer.from(response.audioContent as Uint8Array)
    console.log(`Generated audio (Google, voice: ${voice}): ${buffer.length} bytes`)
    return buffer
  } catch (error: any) {
    console.error('Google Cloud TTS error:', error)
    throw new Error(`Google Cloud TTS failed: ${error.message}`)
  }
}

/**
 * Generate audio using ElevenLabs
 */
async function generateAudioElevenLabs(text: string, options: TTSOptions): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set')
  }

  const voiceId = options.voiceId || currentNarratorVoiceId
  const modelId = options.modelId || 'eleven_monolingual_v1'

  // Adjust voice settings based on emotion
  let stability = options.stability ?? 0.5
  let similarityBoost = options.similarityBoost ?? 0.75
  
  const emotionSettings: Record<string, { stability: number; similarityBoost: number }> = {
    'joyful': { stability: 0.4, similarityBoost: 0.8 },
    'excited': { stability: 0.3, similarityBoost: 0.75 },
    'angry': { stability: 0.35, similarityBoost: 0.7 },
    'fearful': { stability: 0.4, similarityBoost: 0.75 },
    'tense': { stability: 0.35, similarityBoost: 0.8 },
    'sad': { stability: 0.45, similarityBoost: 0.8 },
    'romantic': { stability: 0.5, similarityBoost: 0.85 },
    'mysterious': { stability: 0.4, similarityBoost: 0.75 },
    'contemplative': { stability: 0.55, similarityBoost: 0.8 },
    'melodramatic': { stability: 0.25, similarityBoost: 0.7 },
    'warm': { stability: 0.5, similarityBoost: 0.85 },
    'cold': { stability: 0.6, similarityBoost: 0.8 },
    'neutral': { stability: 0.5, similarityBoost: 0.75 },
  }
  
  if (options.emotionHint && emotionSettings[options.emotionHint]) {
    const settings = emotionSettings[options.emotionHint]
    stability = settings.stability
    similarityBoost = settings.similarityBoost
  }

  try {
    const response = await axios.post(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: modelId,
        voice_settings: {
          stability: stability,
          similarity_boost: similarityBoost,
        },
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        responseType: 'arraybuffer',
        timeout: 60000,
      }
    )

    const buffer = Buffer.from(response.data)
    
    if (!buffer || buffer.length === 0) {
      throw new Error('ElevenLabs returned empty audio data')
    }
    
    console.log(`Generated audio (ElevenLabs, voice: ${voiceId}): ${buffer.length} bytes`)
    return buffer
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMsg = error.response?.data?.detail?.message || error.message
      console.error('ElevenLabs TTS error:', errorMsg)
      throw new Error(`ElevenLabs TTS failed: ${errorMsg}`)
    }
    throw error
  }
}

/**
 * Main audio generation function - routes to appropriate provider
 */
export async function generateAudio(
  text: string,
  options: TTSOptions = {}
): Promise<Buffer> {
  const provider = options.provider || currentProvider
  
  console.log(`[TTS] generateAudio called with provider: ${provider} (currentProvider: ${currentProvider})`)

  // Get appropriate voice based on provider
  let voiceId = options.voiceId
  if (!voiceId) {
    if (options.character) {
      voiceId = getVoiceForCharacter(options.character, 'dialogue', options.characterInfo)
    } else {
      if (provider === 'openai') {
        voiceId = getOpenAIVoiceForNarrator()
      } else if (provider === 'google') {
        voiceId = getGoogleVoiceForNarrator()
      } else {
        voiceId = currentNarratorVoiceId
      }
    }
  }
  
  // For Google provider, convert voice to Google format if needed
  if (provider === 'google' && !voiceId.includes('Neural2') && !voiceId.includes('Studio')) {
    voiceId = mapToGoogleVoice(voiceId, options.characterInfo)
  }
  
  console.log(`   Voice ID: ${voiceId}, Character: ${options.character || 'narrator'}`)

  // Route to appropriate provider
  if (provider === 'openai') {
    console.log(`   → Calling OpenAI TTS API...`)
    return generateAudioOpenAI(text, voiceId)
  } else if (provider === 'google') {
    return generateAudioGoogle(text, voiceId)
  } else if (provider === 'elevenlabs') {
    console.log(`   → Calling ElevenLabs TTS API...`)
    return generateAudioElevenLabs(text, { ...options, voiceId })
  } else {
    throw new Error(`Unsupported TTS provider: ${provider}`)
  }
}

export function estimateAudioDuration(text: string): number {
  const words = text.split(/\s+/).length
  return Math.ceil(words / 2.5)
}

/**
 * Estimate cost for generating audio
 */
export function estimateCost(text: string, provider: TTSProvider = currentProvider): number {
  const chars = text.length
  const providerInfo = TTS_PROVIDERS[provider]
  return (chars / 1_000_000) * providerInfo.costPer1MChars
}
