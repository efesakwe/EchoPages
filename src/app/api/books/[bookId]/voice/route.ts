import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { NARRATOR_VOICES } from '@/lib/services/voiceOptions'

export async function PATCH(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookId } = params
    const body = await request.json()
    const { narratorVoice } = body

    console.log(`Updating narrator voice for book ${bookId} to: ${narratorVoice}`)

    // Validate the voice ID
    const validVoice = NARRATOR_VOICES.find(v => v.id === narratorVoice)
    if (!validVoice) {
      console.error('Invalid voice ID:', narratorVoice)
      return NextResponse.json({ error: 'Invalid voice ID' }, { status: 400 })
    }

    // First verify the user owns this book
    const { data: existingBook, error: fetchError } = await supabase
      .from('books')
      .select('id, owner_id, narrator_voice')
      .eq('id', bookId)
      .single()

    if (fetchError || !existingBook) {
      console.error('Book not found:', fetchError)
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    if (existingBook.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Use service client for the update (bypasses RLS)
    const serviceClient = createServiceClient()
    
    const { data: updatedBook, error: updateError } = await serviceClient
      .from('books')
      .update({ narrator_voice: narratorVoice })
      .eq('id', bookId)
      .select('id, narrator_voice')
      .single()

    if (updateError) {
      console.error('Error updating narrator voice:', updateError)
      
      // Check if the column doesn't exist
      if (updateError.message?.includes('narrator_voice') || updateError.code === '42703') {
        return NextResponse.json({ 
          error: 'Database needs migration. Please run: ALTER TABLE books ADD COLUMN narrator_voice TEXT DEFAULT \'rachel\';' 
        }, { status: 500 })
      }
      
      return NextResponse.json({ error: 'Failed to update voice: ' + updateError.message }, { status: 500 })
    }

    console.log('Successfully updated narrator voice:', updatedBook)

    return NextResponse.json({ 
      success: true, 
      narratorVoice: narratorVoice,
      voiceName: validVoice.name,
      book: updatedBook
    })
  } catch (error: any) {
    console.error('Error in voice update:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
