import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getUserClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const supabase = getUserClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return { supabase, user }
}

export async function POST(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, user } = auth

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.p256dh
  const authKey = body?.auth
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof authKey !== 'string')
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id:    user.id,
      endpoint,
      p256dh,
      auth:       authKey,
      user_agent: request.headers.get('user-agent') || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' })

  if (error) return NextResponse.json({ error: 'Could not save subscription' }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, user } = auth

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  if (typeof endpoint !== 'string')
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 })

  return NextResponse.json({ success: true })
}
