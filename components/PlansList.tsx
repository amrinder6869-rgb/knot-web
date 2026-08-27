'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import HangoutCard, { HangoutCardSkeleton } from '@/components/HangoutCard'
import { loadHangoutBundle } from '@/lib/hangoutBundle'
import { ICON_SIZE } from '@/lib/constants'
import { EMPTY_HANGOUTS, PLAN_UNTITLED, TOAST_ERROR } from '@/lib/copy'
import { useToast } from '@/components/ToastProvider'
import { UPCOMING_PLANNING_STATUSES, PAST_PLANNING_STATUSES } from '@/lib/hangoutPhase'

type OpenChatOpts = {
  hangoutId: string
  scrollToBottom?: boolean
  scrollTarget?: 'poll' | 'bill' | null
}

export default function PlansList({
  currentUser,
  knots,
  activeKnotId,
  onOpenChat,
}: {
  currentUser: any
  knots: any[]
  activeKnotId?: string
  onOpenChat: (opts: OpenChatOpts) => void
}) {
  const toast = useToast()
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [past, setPast] = useState<any[]>([])
  const [bundle, setBundle] = useState<any>(null)
  const [membersByKnot, setMembersByKnot] = useState<Map<string, any[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!currentUser?.id || knots.length === 0) { setUpcoming([]); setPast([]); setLoading(false); return }
    const knotIds = knots.map((k: any) => k.id).filter(Boolean)
    const { data } = await supabase
      .from('hangouts')
      .select('*, profiles:created_by(name, avatar_url, username)')
      .in('knot_id', knotIds)
      .order('scheduled_for', { ascending: true })

    const seen = new Set<string>()
    const rows = (data || []).filter((h: any) => {
      if (seen.has(h.id)) return false
      seen.add(h.id)
      return true
    })

    const up = rows.filter((h: any) => {
      const ps = h.planning_status || h.status
      return (UPCOMING_PLANNING_STATUSES as readonly string[]).includes(ps)
    }).sort((a: any, b: any) => {
      const at = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER
      const bt = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER
      return at - bt
    })
    const down = rows.filter((h: any) => {
      const ps = h.planning_status || h.status
      return (PAST_PLANNING_STATUSES as readonly string[]).includes(ps)
    })

    setUpcoming(up)
    setPast(down)

    const hangoutIds = [...up, ...down].map((h: any) => h.id)
    const postIds = [...up, ...down].map((h: any) => h.post_id).filter(Boolean)
    const b = await loadHangoutBundle(hangoutIds, postIds, currentUser.id)
    setBundle(b)

    const { data: memberRows } = await supabase
      .from('knot_members')
      .select('knot_id, user_id, profiles:user_id(id, name, avatar_url, username)')
      .in('knot_id', knotIds)
    const map = new Map<string, any[]>()
    for (const m of memberRows || []) {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      const list = map.get(m.knot_id) || []
      list.push({
        id: m.user_id,
        name: (profile as any)?.name || 'Unknown',
        avatar_url: (profile as any)?.avatar_url || null,
        username: (profile as any)?.username || null,
      })
      map.set(m.knot_id, list)
    }
    setMembersByKnot(map)
    setLoading(false)
  }, [currentUser, knots])

  useEffect(() => { load() }, [load])

  async function handleNewPlan() {
    if (creating) return
    const knotId = activeKnotId || knots[0]?.id
    const { data: sessionData } = await supabase.auth.getUser()
    const userId = currentUser?.id || sessionData.user?.id
    if (!knotId || !userId) {
      toast.error(TOAST_ERROR)
      return
    }
    setCreating(true)
    const actorName = currentUser?.name || 'Someone'
    // Same p_input shape as Composer.tsx postHangout — create_hangout is
    // SECURITY DEFINER and bypasses hangouts INSERT RLS.
    const pInput: Record<string, any> = {
      knot_id:            knotId,
      title:               PLAN_UNTITLED,
      type:                'planned',
      scheduled_for:       null,
      venue_name:          null,
      venue_address:       null,
      venue_place_id:      null,
      venue_lat:           null,
      venue_lng:           null,
      venue_category:      null,
      venue_maps_url:      null,
      venue_booking_url:   null,
      meeting_url:         null,
      brief:               null,
      brief_vibe:          null,
      brief_budget:        null,
      movie_title:         null,
      movie_showtime:      null,
      event_restrictions:  [],
      invite_mode:         'all',
      is_surprise:         false,
      reveal_at:           null,
      poll_mode:           false,
      poll_title:          PLAN_UNTITLED,
      is_standalone:       false,
      post_content:        `${actorName} started a plan`,
      post_type:           'hangout',
    }
    try {
      const { data, error } = await supabase.rpc('create_hangout', { p_input: pInput })
      console.log('[create_hangout] handleNewPlan response', { data, error, pInput })
      if (error || !data || data.error) {
        console.error('[handleNewPlan] rpc failed', { error, data })
        toast.error(TOAST_ERROR)
        return
      }
      const newHangoutId = data.hangout_id as string
      if (!newHangoutId) {
        toast.error(TOAST_ERROR)
        return
      }
      const { error: statusError } = await supabase
        .from('hangouts')
        .update({ planning_status: 'voting', title: PLAN_UNTITLED })
        .eq('id', newHangoutId)
      if (statusError) {
        console.warn('[handleNewPlan] planning_status update failed', statusError)
      }
      onOpenChat({ hangoutId: newHangoutId, scrollToBottom: true })
      await load()
    } catch (err) {
      console.error('[handleNewPlan] failed', err)
      toast.error(TOAST_ERROR)
    } finally {
      setCreating(false)
    }
  }

  function buildCardData(hangout: any) {
    if (!bundle) return null
    const full = bundle.hangoutsById.get(hangout.id)
    if (!full) return null
    const options = (bundle.optionsByHangout.get(hangout.id) || []).map((o: any) => ({
      ...o,
      _myVote: (bundle.votesByHangout.get(hangout.id) || []).some((v: any) => v.option_id === o.id && v.user_id === currentUser?.id),
    }))
    return {
      hangout: full,
      options,
      rsvps: bundle.rsvpsByHangout.get(hangout.id) || [],
      comments: hangout.post_id ? (bundle.commentsByPost.get(hangout.post_id) || []) : [],
      bills: bundle.billsByHangout.get(hangout.id) || [],
      invites: bundle.invitesByHangout.get(hangout.id) || [],
      poll: bundle.pollByHangout.get(hangout.id) || null,
    }
  }

  function renderCard(h: any) {
    const cardData = buildCardData(h)
    if (!cardData) return null
    const post = {
      id: h.post_id || h.id,
      hangout_id: h.id,
      created_at: h.created_at,
      profiles: h.profiles,
      reactions: [],
    }
    return (
      <HangoutCard
        key={h.id}
        post={post}
        data={cardData}
        currentUser={currentUser}
        knotId={h.knot_id}
        members={membersByKnot.get(h.knot_id) || []}
        onRefresh={load}
        onOpenChat={(id) => onOpenChat({ hangoutId: id, scrollToBottom: true })}
      />
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Plans</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Upcoming across your Knots</div>
        </div>
        <button type="button" onClick={handleNewPlan} disabled={creating || knots.length === 0}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--yellow)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: creating ? 0.6 : 1 }}
          aria-label="Start a plan">
          <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.nav, color: '#111' }} />
        </button>
      </div>

      {loading && (
        <div>
          <HangoutCardSkeleton />
          <HangoutCardSkeleton />
        </div>
      )}

      {!loading && upcoming.length === 0 && past.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{EMPTY_HANGOUTS}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Tap + to start a plan.</div>
        </div>
      )}

      {!loading && upcoming.map(renderCard)}

      {!loading && past.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Past</div>
          {past.map(renderCard)}
        </div>
      )}
    </div>
  )
}
