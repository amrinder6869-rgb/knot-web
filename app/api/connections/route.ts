import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notify'

const ALLOWED_TYPES = new Set(['follow', 'connection'])

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
  const addresseeId = body?.addressee_id
  const type = body?.type
  if (typeof addresseeId !== 'string' || !ALLOWED_TYPES.has(type))
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  if (addresseeId === user.id)
    return NextResponse.json({ error: 'Cannot connect to yourself' }, { status: 400 })

  const { data, error } = await supabase
    .from('connections')
    .insert({ requester_id: user.id, addressee_id: addresseeId, type })
    .select()
    .single()

  if (error) {
    // Unique violation: request already exists, so return it instead of failing.
    if (error.code === '23505') {
      const { data: existing, error: fetchError } = await supabase
        .from('connections')
        .select()
        .eq('requester_id', user.id)
        .eq('addressee_id', addresseeId)
        .eq('type', type)
        .single()
      if (fetchError) return NextResponse.json({ error: 'Could not create connection' }, { status: 500 })
      return NextResponse.json(existing)
    }
    return NextResponse.json({ error: 'Could not create connection' }, { status: 500 })
  }

  if (type === 'follow') {
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', user.id)
      .single()
    await createNotification(supabase, {
      userId: addresseeId,
      type: 'follow_request',
      actorId: user.id,
      entityId: data.id,
      message: `${requesterProfile?.name || 'Someone'} sent you a follow request`,
      linkUrl: requesterProfile?.username ? `/${requesterProfile.username}` : null,
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const auth = await authenticate(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, user } = auth

  const body = await request.json().catch(() => null)
  const addresseeId = body?.addressee_id
  const type = body?.type
  if (typeof addresseeId !== 'string' || !ALLOWED_TYPES.has(type))
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('requester_id', user.id)
    .eq('addressee_id', addresseeId)
    .eq('type', type)

  if (error) return NextResponse.json({ error: 'Could not remove connection' }, { status: 500 })

  return NextResponse.json({ success: true })
}
