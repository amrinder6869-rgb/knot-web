import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const agentUserId = process.env.KNOT_AGENT_USER_ID
  if (!agentUserId) return NextResponse.json({ error: 'Agent not configured' }, { status: 500 })

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { hangout_id, content, photo_path } = await request.json()
    if (!hangout_id || typeof hangout_id !== 'string') {
      return NextResponse.json({ error: 'Missing hangout_id' }, { status: 400 })
    }
    if ((!content || typeof content !== 'string' || !content.trim()) && !photo_path) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400 })
    }

    const { data: hangout } = await userClient
      .from('hangouts')
      .select('id, knot_id')
      .eq('id', hangout_id)
      .maybeSingle()
    if (!hangout?.knot_id) return NextResponse.json({ error: 'Hangout not found' }, { status: 404 })

    const { data: membership } = await userClient
      .from('knot_members')
      .select('user_id')
      .eq('knot_id', hangout.knot_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await serviceClient
      .from('hangout_messages')
      .insert({
        hangout_id,
        author_id: agentUserId,
        content: content?.trim() || null,
        photo_path: photo_path || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[hangout-messages/agent] insert failed:', error)
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('[hangout-messages/agent] unhandled error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
