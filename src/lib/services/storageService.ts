import { createServiceClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function uploadPDF(
  file: File,
  userId: string
): Promise<string> {
  try {
    const supabase = createServiceClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${uuidv4()}.${fileExt}`
    const filePath = `pdfs/${fileName}`

    const { data, error } = await supabase.storage
      .from('books')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      // Provide more helpful error messages
      if (error.message.includes('Bucket not found')) {
        throw new Error('Storage bucket "books" does not exist. Please create it in your Supabase dashboard under Storage.')
      }
      if (error.message.includes('new row violates row-level security policy')) {
        throw new Error('Storage permission denied. Please check your Supabase storage RLS policies for the "books" bucket.')
      }
      throw new Error(`Failed to upload PDF: ${error.message}`)
    }

    if (!data) {
      throw new Error('Upload succeeded but no data was returned')
    }

    const { data: { publicUrl } } = supabase.storage
      .from('books')
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error: any) {
    // Re-throw with better context if it's already our error
    if (error.message.includes('Missing Supabase service role')) {
      throw error
    }
    // Wrap other errors
    throw new Error(`PDF upload failed: ${error.message}`)
  }
}

export async function uploadAudioChunk(
  audioBuffer: Buffer,
  chapterId: string,
  chunkIdx: number
): Promise<string> {
  const supabase = createServiceClient()
  const fileName = `${chapterId}/${chunkIdx}.mp3`
  const filePath = `audio/${fileName}`

  // Supabase storage accepts Buffer directly in Node.js
  const { data, error } = await supabase.storage
    .from('books')
    .upload(filePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload audio chunk: ${error.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('books')
    .getPublicUrl(filePath)

  return publicUrl
}

export async function getAudioUrl(filePath: string): Promise<string> {
  const supabase = createServiceClient()
  const { data: { publicUrl } } = supabase.storage
    .from('books')
    .getPublicUrl(filePath)

  return publicUrl
}
