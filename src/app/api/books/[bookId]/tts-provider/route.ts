import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_PROVIDERS = ['openai', 'elevenlabs', 'google']

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
    const { ttsProvider } = body

    // Validate the provider
    if (!VALID_PROVIDERS.includes(ttsProvider)) {
      return NextResponse.json({ error: 'Invalid provider. Must be "google", "openai", or "elevenlabs"' }, { status: 400 })
    }

    // Use service client to update
    const serviceSupabase = createServiceClient()

    // Verify book ownership and update
    const { data: book, error: updateError } = await serviceSupabase
      .from('books')
      .update({ tts_provider: ttsProvider })
      .eq('id', bookId)
      .eq('owner_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating TTS provider:', updateError)
      return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 })
    }

    if (!book) {
      return NextResponse.json({ error: 'Book not found or not owned by user' }, { status: 404 })
    }

    const providerNames: Record<string, string> = {
      'google': 'Budget (Google Cloud TTS)',
      'openai': 'Regular (OpenAI TTS)',
      'elevenlabs': 'Premium (ElevenLabs)',
    }
    const providerName = providerNames[ttsProvider] || ttsProvider

    return NextResponse.json({
      success: true,
      ttsProvider: ttsProvider,
      providerName: providerName,
    })
  } catch (error: any) {
    console.error('Error in TTS provider update:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(
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

    const { data: book, error } = await supabase
      .from('books')
      .select('tts_provider')
      .eq('id', bookId)
      .eq('owner_id', user.id)
      .single()

    if (error || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    return NextResponse.json({
      ttsProvider: book.tts_provider || 'openai',
    })
  } catch (error: any) {
    console.error('Error getting TTS provider:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
