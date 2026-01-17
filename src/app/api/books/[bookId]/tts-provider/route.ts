import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const VALID_PROVIDERS = ['openai', 'elevenlabs', 'google']

async function handleProviderUpdate(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const { bookId } = params
    const body = await request.json()
    // Accept both "ttsProvider" and "provider" for mobile compatibility
    const ttsProvider = body.ttsProvider || body.provider

    // Validate the provider
    if (!VALID_PROVIDERS.includes(ttsProvider)) {
      return NextResponse.json({ error: 'Invalid provider. Must be "google", "openai", or "elevenlabs"' }, { status: 400 })
    }

    // Check for Bearer token (mobile app)
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const serviceSupabase = createServiceClient()
      const { data: { user }, error: authError } = await serviceSupabase.auth.getUser(token)
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
      userId = user.id
    } else {
      // Standard cookie-based auth (web app)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // Use service client to update
    const serviceSupabase = createServiceClient()

    // Verify book ownership and update
    const { data: book, error: updateError } = await serviceSupabase
      .from('books')
      .update({ tts_provider: ttsProvider })
      .eq('id', bookId)
      .eq('owner_id', userId)
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

// Support both PATCH (web app) and PUT (mobile app)
export async function PATCH(
  request: Request,
  context: { params: { bookId: string } }
) {
  return handleProviderUpdate(request, context)
}

export async function PUT(
  request: Request,
  context: { params: { bookId: string } }
) {
  return handleProviderUpdate(request, context)
}

export async function GET(
  request: Request,
  { params }: { params: { bookId: string } }
) {
  try {
    const { bookId } = params

    // Check for Bearer token (mobile app)
    const authHeader = request.headers.get('Authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const serviceSupabase = createServiceClient()
      const { data: { user }, error: authError } = await serviceSupabase.auth.getUser(token)
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
      userId = user.id
    } else {
      // Standard cookie-based auth (web app)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const serviceSupabase = createServiceClient()
    const { data: book, error } = await serviceSupabase
      .from('books')
      .select('tts_provider')
      .eq('id', bookId)
      .eq('owner_id', userId)
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
