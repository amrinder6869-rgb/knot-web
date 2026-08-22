export async function track(
  supabase: any,
  eventName: string,
  properties: Record<string, any> = {},
  knotId?: string
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('events').insert({
    user_id: user.id,
    knot_id: knotId || null,
    event_name: eventName,
    properties,
  })
}
