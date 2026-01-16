// Narrator voices for audiobook generation
// Supports ElevenLabs, OpenAI TTS, and Google Cloud TTS providers

export interface VoiceOption {
  id: string
  voiceId: string  // Provider-specific voice ID
  name: string
  description: string
  gender: 'female' | 'male'
  accent: string
  style: string
  provider: 'elevenlabs' | 'openai' | 'google'  // Which TTS provider
  preview?: string
}

// ElevenLabs voices (premium, more expensive)
export const ELEVENLABS_VOICES: VoiceOption[] = [
  // Female Voices
  {
    id: 'rachel',
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Warm & Expressive',
    gender: 'female',
    accent: 'American',
    style: 'Storytelling, warm, engaging',
    provider: 'elevenlabs',
  },
  {
    id: 'charlotte',
    voiceId: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    description: 'Sophisticated & Elegant',
    gender: 'female',
    accent: 'British',
    style: 'Refined, articulate, classic',
    provider: 'elevenlabs',
  },
  {
    id: 'bella',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    description: 'Young & Warm',
    gender: 'female',
    accent: 'American',
    style: 'Friendly, relatable, youthful',
    provider: 'elevenlabs',
  },
  {
    id: 'elli',
    voiceId: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Elli',
    description: 'Crisp & Clear',
    gender: 'female',
    accent: 'American',
    style: 'Professional, clear, neutral',
    provider: 'elevenlabs',
  },
  {
    id: 'grace',
    voiceId: 'oWAxZDx7w5VEj9dCyTzz',
    name: 'Grace',
    description: 'Gentle & Mature',
    gender: 'female',
    accent: 'American (Southern)',
    style: 'Warm, maternal, soothing',
    provider: 'elevenlabs',
  },
  {
    id: 'domi',
    voiceId: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi',
    description: 'Bold & Confident',
    gender: 'female',
    accent: 'American',
    style: 'Strong, assertive, dynamic',
    provider: 'elevenlabs',
  },
  {
    id: 'serena',
    voiceId: 'pMsXgVXv3BLzUgSXRplE',
    name: 'Serena',
    description: 'Soft & Melodic',
    gender: 'female',
    accent: 'American',
    style: 'Calming, gentle, intimate',
    provider: 'elevenlabs',
  },
  
  // Male Voices
  {
    id: 'adam',
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    description: 'Deep & Professional',
    gender: 'male',
    accent: 'American',
    style: 'Authoritative, clear, trustworthy',
    provider: 'elevenlabs',
  },
  {
    id: 'josh',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    description: 'Calm & Authoritative',
    gender: 'male',
    accent: 'American',
    style: 'Narrator, documentary style',
    provider: 'elevenlabs',
  },
  {
    id: 'arnold',
    voiceId: 'VR6AewLTigWG4xSOukaG',
    name: 'Arnold',
    description: 'Deep & Commanding',
    gender: 'male',
    accent: 'American',
    style: 'Dramatic, powerful, resonant',
    provider: 'elevenlabs',
  },
  {
    id: 'sam',
    voiceId: 'yoZ06aMxZJJ28mfd3POQ',
    name: 'Sam',
    description: 'Raspy & Warm',
    gender: 'male',
    accent: 'American',
    style: 'Casual, friendly, conversational',
    provider: 'elevenlabs',
  },
  {
    id: 'callum',
    voiceId: 'N2lVS1w4EtoT3dr4eOWO',
    name: 'Callum',
    description: 'Warm & Grandfatherly',
    gender: 'male',
    accent: 'British',
    style: 'Wise, gentle, storytelling',
    provider: 'elevenlabs',
  },
  {
    id: 'daniel',
    voiceId: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'Refined British',
    gender: 'male',
    accent: 'British',
    style: 'Distinguished, articulate, classic',
    provider: 'elevenlabs',
  },
  {
    id: 'clyde',
    voiceId: '2EiwWnXFnvU5JabPnv8n',
    name: 'Clyde',
    description: 'Deep & Smooth',
    gender: 'male',
    accent: 'American',
    style: 'Rich, smooth, baritone',
    provider: 'elevenlabs',
  },
  {
    id: 'fin',
    voiceId: 'D38z5RcWu1voky8WS1ja',
    name: 'Fin',
    description: 'Irish Charm',
    gender: 'male',
    accent: 'Irish',
    style: 'Warm, friendly, engaging',
    provider: 'elevenlabs',
  },
]

// OpenAI TTS voices (cheaper, still high quality)
// ONLY the 9 valid OpenAI voices: alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
export const OPENAI_TTS_VOICES: VoiceOption[] = [
  // Female Voices
  {
    id: 'nova-openai',
    voiceId: 'nova',
    name: 'Nova',
    description: 'Warm & Expressive',
    gender: 'female',
    accent: 'American',
    style: 'Warm, expressive',
    provider: 'openai',
  },
  {
    id: 'shimmer-openai',
    voiceId: 'shimmer',
    name: 'Shimmer',
    description: 'Soft & Gentle',
    gender: 'female',
    accent: 'American',
    style: 'Soft, gentle',
    provider: 'openai',
  },
  {
    id: 'coral-openai',
    voiceId: 'coral',
    name: 'Coral',
    description: 'Warm & Friendly',
    gender: 'female',
    accent: 'American',
    style: 'Warm, friendly',
    provider: 'openai',
  },
  
  // Male Voices
  {
    id: 'onyx-openai',
    voiceId: 'onyx',
    name: 'Onyx',
    description: 'Deep & Authoritative',
    gender: 'male',
    accent: 'American',
    style: 'Deep, authoritative',
    provider: 'openai',
  },
  {
    id: 'echo-openai',
    voiceId: 'echo',
    name: 'Echo',
    description: 'Deep & Clear',
    gender: 'male',
    accent: 'American',
    style: 'Deep, clear',
    provider: 'openai',
  },
  {
    id: 'ash-openai',
    voiceId: 'ash',
    name: 'Ash',
    description: 'Clear & Professional',
    gender: 'male',
    accent: 'American',
    style: 'Clear, professional',
    provider: 'openai',
  },
  {
    id: 'sage-openai',
    voiceId: 'sage',
    name: 'Sage',
    description: 'Wise & Calm',
    gender: 'male',
    accent: 'American',
    style: 'Wise, calm',
    provider: 'openai',
  },
  {
    id: 'fable-openai',
    voiceId: 'fable',
    name: 'Fable',
    description: 'British Narrator',
    gender: 'male',
    accent: 'British',
    style: 'Narrator, storytelling',
    provider: 'openai',
  },
  // Neutral voice
  {
    id: 'alloy-openai',
    voiceId: 'alloy',
    name: 'Alloy',
    description: 'Neutral & Versatile',
    gender: 'male',
    accent: 'American',
    style: 'Neutral, versatile',
    provider: 'openai',
  },
]

// Google Cloud TTS voices (cheapest, very high quality Neural2 voices)
// Cost: ~$4 per 1M characters
export const GOOGLE_TTS_VOICES: VoiceOption[] = [
  // Female Voices
  {
    id: 'aria-google',
    voiceId: 'en-US-Neural2-F',
    name: 'Aria',
    description: 'Friendly & Expressive',
    gender: 'female',
    accent: 'American',
    style: 'Friendly, expressive',
    provider: 'google',
  },
  {
    id: 'luna-google',
    voiceId: 'en-US-Neural2-E',
    name: 'Luna',
    description: 'Soft & Calm',
    gender: 'female',
    accent: 'American',
    style: 'Soft, calm',
    provider: 'google',
  },
  {
    id: 'clara-google',
    voiceId: 'en-US-Neural2-G',
    name: 'Clara',
    description: 'Clear & Natural',
    gender: 'female',
    accent: 'American',
    style: 'Clear, natural',
    provider: 'google',
  },
  {
    id: 'olivia-google',
    voiceId: 'en-US-Neural2-H',
    name: 'Olivia',
    description: 'Warm & Engaging',
    gender: 'female',
    accent: 'American',
    style: 'Warm, engaging',
    provider: 'google',
  },
  {
    id: 'emma-google',
    voiceId: 'en-GB-Neural2-A',
    name: 'Emma',
    description: 'Elegant British',
    gender: 'female',
    accent: 'British',
    style: 'Elegant, refined',
    provider: 'google',
  },
  {
    id: 'sophie-google',
    voiceId: 'en-GB-Neural2-C',
    name: 'Sophie',
    description: 'Sophisticated British',
    gender: 'female',
    accent: 'British',
    style: 'Soft, sophisticated',
    provider: 'google',
  },
  {
    id: 'studio-f-google',
    voiceId: 'en-US-Studio-O',
    name: 'Studio Female',
    description: 'Studio Quality',
    gender: 'female',
    accent: 'American',
    style: 'Studio quality, narrator',
    provider: 'google',
  },
  
  // Male Voices
  {
    id: 'james-google',
    voiceId: 'en-US-Neural2-A',
    name: 'James',
    description: 'Deep & Authoritative',
    gender: 'male',
    accent: 'American',
    style: 'Deep, authoritative',
    provider: 'google',
  },
  {
    id: 'noah-google',
    voiceId: 'en-US-Neural2-D',
    name: 'Noah',
    description: 'Clear & Professional',
    gender: 'male',
    accent: 'American',
    style: 'Clear, professional',
    provider: 'google',
  },
  {
    id: 'ethan-google',
    voiceId: 'en-US-Neural2-I',
    name: 'Ethan',
    description: 'Warm & Friendly',
    gender: 'male',
    accent: 'American',
    style: 'Warm, friendly',
    provider: 'google',
  },
  {
    id: 'liam-google',
    voiceId: 'en-US-Neural2-J',
    name: 'Liam',
    description: 'Calm & Steady',
    gender: 'male',
    accent: 'American',
    style: 'Calm, steady',
    provider: 'google',
  },
  {
    id: 'oliver-google',
    voiceId: 'en-GB-Neural2-B',
    name: 'Oliver',
    description: 'Distinguished British',
    gender: 'male',
    accent: 'British',
    style: 'Distinguished, narrator',
    provider: 'google',
  },
  {
    id: 'henry-google',
    voiceId: 'en-GB-Neural2-D',
    name: 'Henry',
    description: 'Warm British Storyteller',
    gender: 'male',
    accent: 'British',
    style: 'Warm, storytelling',
    provider: 'google',
  },
  {
    id: 'studio-m-google',
    voiceId: 'en-US-Studio-Q',
    name: 'Studio Male',
    description: 'Studio Quality',
    gender: 'male',
    accent: 'American',
    style: 'Studio quality, narrator',
    provider: 'google',
  },
]

// Combined list of all narrator voices
export const NARRATOR_VOICES: VoiceOption[] = [
  ...ELEVENLABS_VOICES,
  ...OPENAI_TTS_VOICES,
  ...GOOGLE_TTS_VOICES,
]

export function getVoiceById(id: string): VoiceOption | undefined {
  return NARRATOR_VOICES.find(v => v.id === id)
}

export function getVoiceByVoiceId(voiceId: string): VoiceOption | undefined {
  return NARRATOR_VOICES.find(v => v.voiceId === voiceId)
}

export function getDefaultVoice(): VoiceOption {
  return NARRATOR_VOICES[0] // Rachel (ElevenLabs)
}
