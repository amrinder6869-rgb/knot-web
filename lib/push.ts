import type { SupabaseClient } from '@supabase/supabase-js'

// `supabase` isn't used directly here — /api/push/send does its own lookups
// with the service role key — but it's kept in the signature so call sites
// that already have a client in scope (lib/notify.ts, lib/notifications.ts)
// can pass it through without a special case.
export async function sendPushNotification(
  supabase: SupabaseClient,
  userIds: string[],
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  if (!userIds.length) return
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-push-secret': process.env.PUSH_SECRET || '' },
      body: JSON.stringify({ userIds, ...payload }),
    })
  } catch (err) {
    console.error('sendPushNotification error:', err)
  }
}
