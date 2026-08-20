import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push'

// Push title per notification type. Falls back to 'Knot' for any other
// type. The push body reuses the notification's own `message` — callers
// already write that as a short, human-readable line (e.g. "Reminder: you
// owe $12.00 for Dinner"), so it doubles as accurate push copy without a
// separate template per type needing its own actor/knot/amount lookups.
const PUSH_TITLES: Record<string, string> = {
  new_moment:         'New moment',
  bill_reminder:      'Bill reminder',
  follow_request:     'New follower',
  rsvp_momentum:      'Who is in?',
  hangout_confirmed:  'Plan locked',
}

export async function createNotification(supabase: SupabaseClient, {
  userId,
  knotId,
  type,
  actorId,
  entityId,
  message,
  linkUrl,
}: {
  userId: string
  knotId?: string | null
  type: string
  actorId?: string | null
  entityId?: string | null
  message: string
  linkUrl?: string | null
}) {
  await supabase.from('notifications').insert({
    user_id:   userId,
    knot_id:   knotId || null,
    type,
    actor_id:  actorId || null,
    entity_id: entityId || null,
    message,
    link_url:  linkUrl || null,
    read:      false,
  })

  await sendPushNotification(supabase, [userId], {
    title: PUSH_TITLES[type] || 'Knot',
    body:  message,
    url:   linkUrl || undefined,
    tag:   type,
  })
}
