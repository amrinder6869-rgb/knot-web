import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DAILY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Daily API key not configured' }, { status: 500 })

  const { hangoutId } = await request.json()
  if (!hangoutId) return NextResponse.json({ error: 'Missing hangoutId' }, { status: 400 })

  try {
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: `knot-${hangoutId}`,
        properties: {
          enable_chat: true,
          enable_knocking: false,
          start_audio_off: false,
          start_video_off: false,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      // Room may already exist — fetch it instead
      if (err.error === 'invalid-request-error' && err.info?.includes('already exists')) {
        const existing = await fetch(`https://api.daily.co/v1/rooms/knot-${hangoutId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        const room = await existing.json()
        return NextResponse.json({ url: room.url })
      }
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    const room = await response.json()
    return NextResponse.json({ url: room.url })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}
