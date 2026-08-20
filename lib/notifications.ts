import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push'
import { PUSH_TITLES } from '@/lib/constants'

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
