// Cron: marks 'planning' hangouts silent for 7+ days as 'abandoned' so they
// drop out of the Planner's "Planning now" section on their own. Composer-created
// hangouts are excluded via `post_id is null` — they never belong to the
// planning lifecycle in the first place (see AGENTS.md planner lifecycle notes).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? ''
  const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
  if (authHeader !== expected) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString()

  const { data, error } = await supabase
    .from('hangouts')
    .update({ planning_status: 'abandoned' })
    .eq('planning_status', 'planning')
    .is('post_id', null)
    .lt('last_planning_activity_at', cutoff)
    .select('id')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ archived: data?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
