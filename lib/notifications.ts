import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'

// Mirrors PUSH_TITLES in lib/notify.ts. notifyKnotMembers is the other
// notification-creation path (broadcast to a whole knot, e.g. new_moment
// from Composer.tsx) — it doesn't go through createNotification, so it
// needs its own push call after the insert.
const PUSH_TITLES: Record<string, string> = {
  new_moment:         'New moment',
  bill_reminder:      'Bill reminder',
  follow_request:     'New follower',
  rsvp_momentum:      'Who is in?',
  hangout_confirmed:  'Plan locked',
}

export async function notifyKnotMembers({
  knotId,
  actorId,
  type,
  message,
  entityId,
}: {
  knotId: string
  actorId: string
  type: string
  message: string
  entityId?: string
}) {
  const { data: members } = await supabase
    .from('knot_members')
    .select('user_id')
    .eq('knot_id', knotId)
    .neq('user_id', actorId)

  if (!members || members.length === 0) return

  const inserts = members.map((m: any) => ({
    user_id:   m.user_id,
    knot_id:   knotId,
    actor_id:  actorId,
    type,
    message,
    entity_id: entityId || null,
    read:      false,
  }))

  await supabase.from('notifications').insert(inserts)

  await sendPushNotification(supabase, members.map((m: any) => m.user_id), {
    title: PUSH_TITLES[type] || 'Knot',
    body:  message,
    tag:   type,
  })
}
