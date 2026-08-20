import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/push'
import { PUSH_TITLES } from '@/lib/constants'

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
