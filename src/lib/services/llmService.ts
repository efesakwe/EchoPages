import OpenAI from 'openai'

// Lazy initialization to ensure env vars are loaded first
let openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set. Make sure .env.local exists with OPENAI_API_KEY.')
    }
    openai = new OpenAI({
      apiKey,
    })
  }
  return openai
}

export interface ChunkData {
  idx: number
  voice: string  // 'narrator' or character name like 'Sarah', 'John', etc.
  cleanedText: string
  emotionHint?: string
  character?: string  // Character name if dialogue
}

export interface CharacterInfo {
  name: string
  gender: 'male' | 'female' | 'unknown'
  age: 'child' | 'young' | 'adult' | 'elderly' | 'unknown'
  personality?: string  // Brief description for voice selection
}

/**
 * First pass: Detect all characters in the chapter
 */
export async function detectCharacters(text: string): Promise<CharacterInfo[]> {
  const sampleText = text.slice(0, 15000)  // Use first 15k chars for detection
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert literary analyst. Analyze the text and identify ALL named characters who SPEAK (have dialogue).

For each speaking character, determine:
1. **name**: Their name as it appears in dialogue tags (e.g., "said John" → "John")
2. **gender**: "male", "female", or "unknown"
3. **age**: "child" (0-12), "young" (13-25), "adult" (26-60), "elderly" (60+), or "unknown"
4. **personality**: Brief description (e.g., "authoritative", "timid", "cheerful", "gruff")

Only include characters who actually SPEAK in the text (have quoted dialogue attributed to them).
Do NOT include the narrator or characters who are only mentioned but don't speak.

Return a JSON object with a "characters" array.`,
        },
        {
          role: 'user',
          content: `Identify all SPEAKING characters in this text:\n\n${sampleText}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(response.choices[0]?.message?.content || '{}')
    const characters = result.characters || []
    
    console.log(`Detected ${characters.length} speaking characters:`, characters.map((c: CharacterInfo) => c.name))
    
    return characters
  } catch (error) {
    console.error('Character detection failed:', error)
    return []
  }
}

/**
 * Split text into chunks - GUARANTEED to include ALL text
 * Uses single newlines as paragraph breaks to be more inclusive
 */
function splitIntoParagraphs(text: string): string[] {
  // First try double newlines
  let paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
  
  // If we only get a few chunks, the book might use single newlines
  if (paragraphs.length < 5 && text.length > 1000) {
    paragraphs = text
      .split(/\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
  }
  
  // If still too few, just split by sentences into reasonable chunks
  if (paragraphs.length < 3 && text.length > 500) {
    const sentences = text.split(/(?<=[.!?])\s+/)
    paragraphs = []
    let current = ''
    for (const sentence of sentences) {
      if (current.length + sentence.length > 500) {
        if (current.length > 0) paragraphs.push(current.trim())
        current = sentence
      } else {
        current += (current ? ' ' : '') + sentence
      }
    }
    if (current.length > 0) paragraphs.push(current.trim())
  }
  
  return paragraphs
}

/**
 * Structure chapter text with character-tagged dialogue
 * GUARANTEES all text is included in output chunks
 */
export async function structureChapterText(
  text: string,
  characters?: CharacterInfo[]
): Promise<ChunkData[]> {
  // Detect characters if not provided
  if (!characters || characters.length === 0) {
    characters = await detectCharacters(text)
  }
  
  const characterNames = characters.map(c => c.name)
  
  // Split text into paragraphs
  const paragraphs = splitIntoParagraphs(text)
  
  console.log(`\n📝 Structuring ${paragraphs.length} paragraphs (${text.length} chars total)`)

  // Process in batches - but ALWAYS use original text, LLM only for metadata
  const batchSize = 10
  const chunks: ChunkData[] = []
  let chunkIdx = 0
  let totalCharsProcessed = 0

  for (let i = 0; i < paragraphs.length; i += batchSize) {
    const batch = paragraphs.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(paragraphs.length / batchSize)
    
    console.log(`  Processing batch ${batchNum}/${totalBatches} (paragraphs ${i + 1}-${Math.min(i + batchSize, paragraphs.length)})`)
    
    let metadata: Array<{ voice: string; emotionHint: string; character?: string }> = []
    
    try {
      const response = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert audiobook director. For each paragraph, determine:

1. **Voice type**: 
   - "narrator" for descriptive text, scene setting, internal thoughts, action
   - CHARACTER NAME for spoken dialogue (from the character list)
   - "dialogue" for unattributed speech

2. **Emotional tone**: neutral, joyful, sad, angry, fearful, excited, romantic, mysterious, tense, contemplative, warm, cold

Return JSON with "results" array (EXACTLY ${batch.length} items, one per paragraph):
[{"voice": "narrator|character_name|dialogue", "emotionHint": "emotion", "character": "name or null"}]

Known characters: ${characterNames.length > 0 ? characterNames.join(', ') : 'None'}`,
          },
          {
            role: 'user',
            content: batch.map((p, idx) => `[${idx + 1}] ${p.substring(0, 300)}${p.length > 300 ? '...' : ''}`).join('\n\n'),
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      })

      const result = JSON.parse(response.choices[0]?.message?.content || '{}')
      metadata = result.results || result.chunks || result.paragraphs || []
      
    } catch (error) {
      console.error(`  ⚠️ LLM failed for batch ${batchNum}, using defaults`)
    }
    
    // ALWAYS create chunks from original paragraphs - LLM only provides metadata
    for (let j = 0; j < batch.length; j++) {
      const para = batch[j]
      const meta = metadata[j] || {}
      
      // Determine voice from metadata or fallback
      let voice = meta.voice || 'narrator'
      let emotionHint = meta.emotionHint || detectBasicEmotion(para)
      let character = meta.character
      
      // Fallback voice detection
      if (!meta.voice) {
        const hasDialogue = /[""'']/.test(para)
        voice = hasDialogue ? 'dialogue' : 'narrator'
      }
      
      // Clean the original text (not LLM output)
      const cleanedText = para
        .replace(/\s+/g, ' ')
        .replace(/\.{4,}/g, '...')
        .trim()
      
      if (cleanedText.length > 0) {
        chunks.push({
          idx: chunkIdx++,
          voice,
          cleanedText,
          emotionHint,
          character: character || (voice !== 'narrator' && voice !== 'dialogue' ? voice : undefined),
        })
        totalCharsProcessed += cleanedText.length
      }
    }
  }

  // Verification: make sure we didn't lose text
  const originalLength = text.replace(/\s+/g, ' ').trim().length
  const chunksLength = chunks.reduce((sum, c) => sum + c.cleanedText.length, 0)
  const coverage = (chunksLength / originalLength) * 100
  
  console.log(`\n✅ Created ${chunks.length} chunks`)
  console.log(`   Original: ${originalLength} chars`)
  console.log(`   Chunks:   ${chunksLength} chars`)
  console.log(`   Coverage: ${coverage.toFixed(1)}%`)
  
  if (coverage < 95) {
    console.warn(`⚠️ WARNING: Only ${coverage.toFixed(1)}% of text was chunked! Some content may be missing.`)
  }

  return chunks
}

function detectBasicEmotion(text: string): string {
  if (/[!]{2,}/.test(text) || /excited|joy|celebrate|thrill/i.test(text)) {
    return 'excited'
  } else if (/sad|sorrow|tears|crying|grief|loss/i.test(text)) {
    return 'sad'
  } else if (/angry|furious|rage|shout|yell|frustrat/i.test(text)) {
    return 'angry'
  } else if (/fear|terror|anxious|worry|dread/i.test(text)) {
    return 'fearful'
  } else if (/love|affection|tender|romantic/i.test(text)) {
    return 'romantic'
  } else if (/[?]/.test(text) || /wonder|mystery|secret|uncertain/i.test(text)) {
    return 'mysterious'
  }
  return 'neutral'
}
