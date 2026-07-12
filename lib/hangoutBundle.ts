import { supabase } from '@/lib/supabase'

export type HangoutBundle = {
  hangoutsById: Map<string, any>
  optionsByHangout: Map<string, any[]>
  votesByHangout: Map<string, any[]>
  rsvpsByHangout: Map<string, any[]>
  commentsByPost: Map<string, any[]>
  billsByHangout: Map<string, any[]>
}

export async function loadHangoutBundle(hangoutIds: string[], postIds: string[]): Promise<HangoutBundle> {
  if (hangoutIds.length === 0) {
    return {
      hangoutsById: new Map(),
      optionsByHangout: new Map(),
      votesByHangout: new Map(),
      rsvpsByHangout: new Map(),
      commentsByPost: new Map(),
      billsByHangout: new Map(),
    }
  }

  const [
    { data: hangoutsData },
    { data: optionsData },
    { data: votesData },
    { data: rsvpsData },
    { data: commentsData },
    { data: billsData },
  ] = await Promise.all([
    supabase.from('hangouts').select('*, profiles:created_by(name)').in('id', hangoutIds),
    supabase.from('hangout_options').select('*').in('hangout_id', hangoutIds),
    supabase.from('hangout_votes').select('option_id, user_id, hangout_id').in('hangout_id', hangoutIds),
    supabase.from('hangout_rsvps').select('*, profiles:user_id(name)').in('hangout_id', hangoutIds),
    postIds.length > 0
      ? supabase.from('comments').select('*, profiles:author_id(name)').in('post_id', postIds).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('bills').select('*, bill_splits(*, profiles:user_id(name))').in('hangout_id', hangoutIds),
  ])

  const hangoutsById = new Map<string, any>((hangoutsData || []).map((h: any) => [h.id, h]))

  const optionsByHangout = new Map<string, any[]>()
  for (const o of optionsData || []) {
    const voteCount = (votesData || []).filter((v: any) => v.option_id === o.id).length
    const list = optionsByHangout.get(o.hangout_id) || []
    list.push({ ...o, vote_count: voteCount })
    optionsByHangout.set(o.hangout_id, list)
  }
  for (const list of optionsByHangout.values()) {
    list.sort((a, b) => b.vote_count - a.vote_count)
  }

  const votesByHangout = new Map<string, any[]>()
  for (const v of votesData || []) {
    const list = votesByHangout.get(v.hangout_id) || []
    list.push(v)
    votesByHangout.set(v.hangout_id, list)
  }

  const rsvpsByHangout = new Map<string, any[]>()
  for (const r of rsvpsData || []) {
    const list = rsvpsByHangout.get(r.hangout_id) || []
    list.push(r)
    rsvpsByHangout.set(r.hangout_id, list)
  }

  const commentsByPost = new Map<string, any[]>()
  for (const c of commentsData || []) {
    if (c.photo_path) {
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(c.photo_path)
      c.photo_url = publicUrl
    }
    const list = commentsByPost.get(c.post_id) || []
    list.push(c)
    commentsByPost.set(c.post_id, list)
  }

  const billsByHangout = new Map<string, any[]>()
  for (const b of billsData || []) {
    const list = billsByHangout.get(b.hangout_id) || []
    list.push(b)
    billsByHangout.set(b.hangout_id, list)
  }

  return { hangoutsById, optionsByHangout, votesByHangout, rsvpsByHangout, commentsByPost, billsByHangout }
}
