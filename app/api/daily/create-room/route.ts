import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ROOM_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

async function fetchRoom(apiKey: string, roomName: string) {
  const res = await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.info || err?.error || 'Failed to fetch room')
  }
  return res.json()
}

async function createRoom(apiKey: string, roomName: string) {
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_chat: true,
        enable_knocking: false,
        start_audio_off: false,
        start_video_off: false,
        exp: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
      },
    }),
  })

  if (res.ok) return res.json()

  const err = await res.json().catch(() => ({}))
  // Race: another client created it — fetch existing
  if (err.error === 'invalid-request-error' && String(err.info || '').includes('already exists')) {
    const existing = await fetchRoom(apiKey, roomName)
    if (existing) return existing
  }
  throw new Error(err?.info || err?.error || 'Failed to create room')
}

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

  const roomName = `knot-${hangoutId}`

  try {
    // Prefer an existing live room; recreate if it expired / was deleted
    let room = await fetchRoom(apiKey, roomName)
    if (!room) {
      room = await createRoom(apiKey, roomName)
    }

    if (!room?.url) {
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
    }

    return NextResponse.json({ url: room.url, name: room.name })
  } catch (err: any) {
    console.error('Daily create-room error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create room' }, { status: 500 })
  }
}
