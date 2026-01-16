// Load environment variables (worker runs as separate process)
import dotenv from 'dotenv'
import { resolve } from 'path'

// Try multiple paths for .env.local
const envPath = resolve(process.cwd(), '.env.local')
dotenv.config({ path: envPath })

// Also load from .env as fallback
dotenv.config({ path: resolve(process.cwd(), '.env') })

// Verify critical env vars are loaded
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not found in environment variables!')
  console.error('Make sure .env.local exists in the project root with OPENAI_API_KEY set.')
  process.exit(1)
}

if (!process.env.ELEVENLABS_API_KEY) {
  console.error('ERROR: ELEVENLABS_API_KEY not found in environment variables!')
  console.error('Make sure .env.local exists in the project root with ELEVENLABS_API_KEY set.')
  process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not found in environment variables!')
  console.error('Make sure .env.local exists in the project root with SUPABASE_SERVICE_ROLE_KEY set.')
  process.exit(1)
}

console.log('[OK] Environment variables loaded successfully')

import { Worker, ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'
import { createServiceClient } from './lib/supabase'
import { structureChapterText, detectCharacters, CharacterInfo } from './lib/llmService'
import { generateAudio, setupVoicesForCharacters, getVoiceForCharacter, setNarratorVoice, setProvider, getDefaultProvider, TTS_PROVIDERS } from './lib/ttsService'
import { uploadAudioChunk } from './lib/storageService'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
})

// Store character info per book for voice consistency
const bookCharacterCache = new Map<string, CharacterInfo[]>()

const worker = new Worker(
  'audio-generation',
  async (job) => {
    const { chapterId, userId } = job.data

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Processing job ${job.id} for chapter ${chapterId}`)
    console.log(`${'='.repeat(60)}`)

    const supabase = createServiceClient()

    // First, fetch the chapter
    console.log(`[FETCH] Chapter ${chapterId}...`)
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .single()

    if (chapterError) {
      console.error('[ERROR] Chapter query error:', chapterError)
      throw new Error(`Chapter query failed: ${chapterError.message}`)
    }

    if (!chapter) {
      throw new Error(`Chapter not found: ${chapterId}`)
    }

    console.log(`[OK] Chapter found: "${chapter.title}" (book_id: ${chapter.book_id})`)

    // Then, fetch the book info
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, title, narrator_voice, tts_provider')
      .eq('id', chapter.book_id)
      .single()

    if (bookError) {
      console.error('[ERROR] Book query error:', bookError)
      throw new Error(`Book query failed: ${bookError.message}`)
    }

    console.log(`[OK] Book found: "${book?.title}" (tts_provider: ${book?.tts_provider})`)

    if (!chapter.text_content) {
      throw new Error(`Chapter has no text content: ${chapterId}`)
    }

    const bookId = chapter.book_id
    const narratorVoice = book?.narrator_voice || 'nova-openai'
    
    // Get TTS provider from book settings (user can choose Regular=openai or Premium=elevenlabs)
    const bookProvider = book?.tts_provider || 'openai'
    const provider = bookProvider as 'openai' | 'elevenlabs'
    setProvider(provider)
    
    const providerLabel = provider === 'openai' ? 'Regular (OpenAI TTS)' : 'Premium (ElevenLabs)'
    console.log(`[TTS] Using Provider: ${providerLabel}`)
    console.log(`   Cost: ~$${TTS_PROVIDERS[provider].costPer1MChars}/1M chars`)
    
    // Set the narrator voice for this book
    setNarratorVoice(narratorVoice)
    console.log(`[VOICE] Book narrator voice: ${narratorVoice}`)

    // Get or detect characters for this book
    let characters: CharacterInfo[] = []
    
    if (bookCharacterCache.has(bookId)) {
      characters = bookCharacterCache.get(bookId)!
      console.log(`Using cached characters for book: ${characters.map(c => c.name).join(', ')}`)
    } else {
      // Detect characters from this chapter (first chapter processed will set the voice assignments)
      console.log('Detecting characters in chapter text...')
      characters = await detectCharacters(chapter.text_content)
      
      if (characters.length > 0) {
        bookCharacterCache.set(bookId, characters)
        // Set up voice assignments for all detected characters
        setupVoicesForCharacters(characters)
        console.log(`Detected and assigned voices for ${characters.length} characters`)
      }
    }
    
    // Create character lookup map
    const characterMap = new Map<string, CharacterInfo>()
    for (const char of characters) {
      characterMap.set(char.name.toLowerCase(), char)
    }

    // Check if chunks already exist
    const { data: existingChunks } = await supabase
      .from('audio_chunks')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('idx', { ascending: true })

    let chunksToProcess: Array<{
      idx: number
      voice: string
      cleanedText: string
      emotionHint?: string
      character?: string
    }>

    console.log(`Existing chunks for chapter ${chapterId}: ${existingChunks?.length || 0}`)

    if (existingChunks && existingChunks.length > 0) {
      // Use existing chunk structure, only process missing audio
      chunksToProcess = existingChunks
        .filter(c => !c.audio_url || c.status !== 'done')
        .map(c => ({
          idx: c.idx,
          voice: c.voice,
          cleanedText: c.text,
          emotionHint: undefined,
          character: c.voice !== 'narrator' && c.voice !== 'dialogue' ? c.voice : undefined,
        }))
      console.log(`Chunks needing processing: ${chunksToProcess.length}`)
    } else {
      // First time: structure the text into chunks with character detection
      console.log(`Structuring chapter text (${chapter.text_content.length} chars) with character detection...`)
      try {
        chunksToProcess = await structureChapterText(chapter.text_content, characters)
        console.log(`LLM returned ${chunksToProcess.length} chunks`)
        
        // Log character distribution
        const charCounts: Record<string, number> = {}
        for (const chunk of chunksToProcess) {
          const key = chunk.character || chunk.voice
          charCounts[key] = (charCounts[key] || 0) + 1
        }
        console.log('Voice distribution:', charCounts)
        
      } catch (llmError: any) {
        console.error('LLM structuring failed:', llmError.message)
        // Fallback: split ALL text into chunks by paragraphs
        console.log('Using fallback: splitting by paragraphs...')
        
        const paragraphs = chapter.text_content
          .split(/\n\s*\n/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0)
        
        // If no paragraphs found, split by single newlines
        const textParts = paragraphs.length > 0 ? paragraphs : 
          chapter.text_content.split('\n').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        
        chunksToProcess = textParts.map((text: string, idx: number) => ({
          idx,
          voice: 'narrator',
          cleanedText: text.replace(/\s+/g, ' ').trim(),
          emotionHint: 'neutral',
        }))
        
        console.log(`Fallback created ${chunksToProcess.length} chunks from ${chapter.text_content.length} chars`)
      }

      // Create chunk records with character info
      for (const chunk of chunksToProcess) {
        const { error } = await supabase
          .from('audio_chunks')
          .insert({
            chapter_id: chapterId,
            idx: chunk.idx,
            voice: chunk.character || chunk.voice,  // Store character name as voice
            provider: provider,  // Save which TTS provider was used
            text: chunk.cleanedText,
            status: 'pending',
          })

        if (error) {
          console.error(`Failed to create chunk ${chunk.idx}:`, error)
        } else {
          console.log(`Created chunk ${chunk.idx} (${chunk.character || chunk.voice})`)
        }
      }
    }

    // VERIFICATION: Ensure all text is accounted for
    const originalTextLength = chapter.text_content.replace(/\s+/g, ' ').trim().length
    const chunksTextLength = chunksToProcess.reduce((sum, c) => sum + c.cleanedText.length, 0)
    const coverage = (chunksTextLength / originalTextLength) * 100
    
    console.log(`\n[VERIFY] TEXT VERIFICATION:`)
    console.log(`   Original chapter: ${originalTextLength} chars`)
    console.log(`   Total in chunks:  ${chunksTextLength} chars`)
    console.log(`   Coverage: ${coverage.toFixed(1)}%`)
    
    if (coverage < 95) {
      console.warn(`[WARN] Only ${coverage.toFixed(1)}% coverage! Some text may not be converted to audio.`)
    }

    console.log(`\nTotal chunks to process: ${chunksToProcess.length}`)

    // Process chunks
    const processChunk = async (chunk: typeof chunksToProcess[0]) => {
      try {
        // Check if already processed (idempotent)
        const { data: chunkRecord } = await supabase
          .from('audio_chunks')
          .select('*')
          .eq('chapter_id', chapterId)
          .eq('idx', chunk.idx)
          .single()

        if (chunkRecord?.audio_url && chunkRecord.status === 'done') {
          console.log(`Skipping chunk ${chunk.idx} - already processed`)
          return
        }

        // Update status to processing
        await supabase
          .from('audio_chunks')
          .update({ status: 'processing' })
          .eq('chapter_id', chapterId)
          .eq('idx', chunk.idx)

        // Get character info for voice selection
        const characterInfo = chunk.character 
          ? characterMap.get(chunk.character.toLowerCase()) 
          : undefined

        // Generate audio with retries
        let audioBuffer: Buffer | null = null
        let retries = 3

        while (retries > 0 && !audioBuffer) {
          try {
            audioBuffer = await generateAudio(chunk.cleanedText, {
              emotionHint: chunk.emotionHint,
              character: chunk.character,
              characterInfo: characterInfo,
            })
          } catch (error) {
            retries--
            if (retries === 0) {
              throw error
            }
            console.warn(`TTS failed for chunk ${chunk.idx}, retrying... (${retries} left)`)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }

        if (!audioBuffer) {
          throw new Error('Failed to generate audio after retries')
        }

        if (audioBuffer.length === 0) {
          throw new Error(`Generated audio buffer is empty for chunk ${chunk.idx}`)
        }

        console.log(`Generated audio for chunk ${chunk.idx} (${chunk.character || chunk.voice}): ${audioBuffer.length} bytes`)

        // Upload audio
        const audioUrl = await uploadAudioChunk(audioBuffer, chapterId, chunk.idx)
        
        console.log(`Uploaded audio for chunk ${chunk.idx}`)

        // Estimate duration
        const wordCount = chunk.cleanedText.split(/\s+/).length
        const estimatedDuration = Math.ceil((wordCount / 150) * 60)

        // Update chunk with audio URL
        await supabase
          .from('audio_chunks')
          .update({
            audio_url: audioUrl,
            status: 'done',
            duration_seconds: estimatedDuration,
            error_message: null,
          })
          .eq('chapter_id', chapterId)
          .eq('idx', chunk.idx)

        console.log(`[OK] Completed chunk ${chunk.idx}/${chunksToProcess.length}`)
      } catch (error: any) {
        console.error(`[ERROR] Error processing chunk ${chunk.idx}:`, error)

        await supabase
          .from('audio_chunks')
          .update({
            status: 'error',
            error_message: error.message || 'Unknown error',
          })
          .eq('chapter_id', chapterId)
          .eq('idx', chunk.idx)
      }
    }

    // Process chunks in parallel batches (3 at a time to avoid rate limits)
    const BATCH_SIZE = 3
    for (let i = 0; i < chunksToProcess.length; i += BATCH_SIZE) {
      const batch = chunksToProcess.slice(i, i + BATCH_SIZE)
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (chunks ${i + 1}-${Math.min(i + BATCH_SIZE, chunksToProcess.length)})`)
      await Promise.all(batch.map(processChunk))
    }

    // Final verification: check all chunks completed
    const { data: finalChunks } = await supabase
      .from('audio_chunks')
      .select('idx, status, audio_url')
      .eq('chapter_id', chapterId)
      .order('idx', { ascending: true })
    
    const completedCount = finalChunks?.filter(c => c.status === 'done' && c.audio_url).length || 0
    const errorCount = finalChunks?.filter(c => c.status === 'error').length || 0
    const pendingCount = finalChunks?.filter(c => c.status === 'pending' || c.status === 'processing').length || 0
    
    console.log(`\n[STATUS] FINAL STATUS for chapter ${chapterId}:`)
    console.log(`   [OK] Completed: ${completedCount}/${finalChunks?.length || 0}`)
    if (errorCount > 0) console.log(`   [ERROR] Errors: ${errorCount}`)
    if (pendingCount > 0) console.log(`   ⏳ Pending: ${pendingCount}`)
    
    if (completedCount === finalChunks?.length) {
      console.log(`\n[DONE] ALL ${completedCount} chunks completed successfully!`)
    } else {
      console.warn(`\n[WARN] Not all chunks completed. ${completedCount}/${finalChunks?.length} done.`)
    }
    
    return { success: true, chapterId, completedChunks: completedCount, totalChunks: finalChunks?.length }
  },
  {
    connection: redis as unknown as ConnectionOptions,
    concurrency: 1, // Process one chapter at a time
  }
)

worker.on('completed', async (job) => {
  console.log(`Job ${job.id} completed`)
  
  // Check if all chapters of the book are now complete
  try {
    const { chapterId } = job.data
    const supabase = createServiceClient()
    
    // Get the book ID from the chapter
    const { data: chapter } = await supabase
      .from('chapters')
      .select('book_id')
      .eq('id', chapterId)
      .single()
    
    if (!chapter) return
    
    const bookId = chapter.book_id
    
    // Get all chapters for this book
    const { data: allChapters } = await supabase
      .from('chapters')
      .select('id')
      .eq('book_id', bookId)
    
    if (!allChapters || allChapters.length === 0) return
    
    // Check how many chapters have all audio chunks completed
    let completedChapters = 0
    
    for (const ch of allChapters) {
      const { data: chunks } = await supabase
        .from('audio_chunks')
        .select('status')
        .eq('chapter_id', ch.id)
      
      if (chunks && chunks.length > 0) {
        const allDone = chunks.every(c => c.status === 'done')
        if (allDone) completedChapters++
      }
    }
    
    // Update book's chapter counts
    await supabase
      .from('books')
      .update({
        total_chapters: allChapters.length,
        completed_chapters: completedChapters,
      })
      .eq('id', bookId)
    
    console.log(`[PROGRESS] Book progress: ${completedChapters}/${allChapters.length} chapters complete`)
    
    // If all chapters are complete, mark the book as public/complete
    if (completedChapters === allChapters.length) {
      await supabase
        .from('books')
        .update({
          audio_complete: true,
          is_public: true,
        })
        .eq('id', bookId)
      
      console.log(`[COMPLETE] BOOK COMPLETE! "${bookId}" is now available in the shared library!`)
    }
  } catch (error) {
    console.error('Error checking book completion:', error)
  }
})

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err)
})

console.log('[WORKER] Audio generation worker started (multi-voice enabled)')

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully')
  await worker.close()
  await redis.quit()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully')
  await worker.close()
  await redis.quit()
  process.exit(0)
})
