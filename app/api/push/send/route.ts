import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Server-to-server only: called from lib/push.ts with a shared secret, never
// from the browser. push_subscriptions' RLS only allows a row's own owner to
// SELECT it (user_id = auth.uid()), and this route has no user session — it
// needs the service role key to read subscriptions across the target
// userIds. Requires SUPABASE_SERVICE_ROLE_KEY to be set in addition to the
// PUSH_SECRET / VAPID env vars.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-push-secret')
  if (!process.env.PUSH_SECRET || secret !== process.env.PUSH_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublicKey || !vapidPrivateKey)
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })

  webpush.setVapidDetails('mailto:hello@knot.app', vapidPublicKey, vapidPrivateKey)

  const body = await request.json().catch(() => null)
  const userIds: string[] = Array.isArray(body?.userIds) ? body.userIds : []
  const title: string = body?.title || 'Knot'
  const notificationBody: string = body?.body || ''
  const url: string = body?.url || '/'
  const tag: string = body?.tag || 'knot-notification'

  if (userIds.length === 0) return NextResponse.json({ sent: 0, failed: 0 })

  const supabase = getServiceClient()
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subscriptions || subscriptions.length === 0) return NextResponse.json({ sent: 0, failed: 0 })

  const payload = JSON.stringify({ title, body: notificationBody, url, tag })

  let sent = 0
  let failed = 0

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
    } catch (err: any) {
      failed++
      if (err?.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }))

  return NextResponse.json({ sent, failed })
}
