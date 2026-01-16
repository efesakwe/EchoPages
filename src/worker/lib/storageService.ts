import { createServiceClient } from './supabase'
import { v4 as uuidv4 } from 'uuid'

export async function uploadAudioChunk(
  audioBuffer: Buffer,
  chapterId: string,
  chunkIdx: number
): Promise<string> {
  const supabase = createServiceClient()
  const fileName = `${chapterId}/${chunkIdx}.mp3`
  const filePath = `audio/${fileName}`

  // Validate buffer before upload
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Audio buffer is empty or invalid')
  }

  console.log(`Uploading audio chunk: ${filePath}, size: ${audioBuffer.length} bytes`)

  // Delete existing file first to ensure clean upload
  await supabase.storage.from('books').remove([filePath])

  // Supabase storage accepts Buffer directly in Node.js
  const { data, error } = await supabase.storage
    .from('books')
    .upload(filePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (error) {
    console.error(`Upload error for ${filePath}:`, error)
    throw new Error(`Failed to upload audio chunk: ${error.message}`)
  }

  if (!data) {
    throw new Error('Upload succeeded but no data returned')
  }

  console.log(`Upload successful: ${data.path}`)

  // Use signed URL (1 hour expiry) - more reliable than public URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from('books')
    .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days expiry

  if (signedError || !signedData?.signedUrl) {
    console.error('Failed to create signed URL, falling back to public URL')
    const { data: { publicUrl } } = supabase.storage
      .from('books')
      .getPublicUrl(filePath)
    return publicUrl
  }

  console.log(`Signed URL generated: ${signedData.signedUrl}`)

  return signedData.signedUrl
}
