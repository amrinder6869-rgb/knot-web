'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'
import HangoutCard from '@/components/HangoutCard'
import { loadHangoutBundle } from '@/lib/hangoutBundle'
import {
  aggregateReactions,
  legacyHeartEmojis,
  normalizeReactionEmoji,
  toggleReactionLocal,
  type ReactionCount,
} from '@/lib/reactions'
import {
  getRandom,
  getRandomTagged,
  AGENT_RESOLVING_STATES,
  AGENT_MESSAGES,
  COMPOSER_PLACEHOLDER,
  EMPTY_TODO,
  CTA_CONFIRM,
  STATE_VOTING,
  STATE_CONFIRMED,
  STATE_LIVE,
  STATE_ENDED,
  STATE_CANCELLED,
  CHIP_WHERE,
  CHIP_WHEN,
  PLAN_BOARD_HINT,
  PLAN_BOARD_LIVE,
  PLAN_FIELD_NOT_BOOKED,
  PLAN_FIELD_TBD,
  PLAN_FIELD_POLL_OPEN,
  TODO_RSVP_SUB,
  TODO_VOTE_LABEL,
  TODO_SETTLE_LABEL,
  TODO_RSVP_ACTION,
  TODO_VOTE_ACTION,
  TODO_SETTLE_ACTION,
} from '@/lib/copy'

// TODO: replace with /public/knot-logo.png once the asset is exported.
function KnotMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" />
      <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5" />
    </svg>
  )
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatWhen(scheduledFor: string | null) {
  if (!scheduledFor) return null
  const date = new Date(scheduledFor)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Tonight · ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
}

function stateLabel(hangout: any): string {
  if (hangout.status === 'cancelled') return STATE_CANCELLED
  if (hangout.is_live) return STATE_LIVE
  if (hangout.status === 'ended') return STATE_ENDED
  if (hangout.status === 'confirmed') return STATE_CONFIRMED
  return STATE_VOTING
}

type ThreadMessage = {
  id: string
  hangout_id: string
  author_id: string
  content: string | null
  photo_path: string | null
  photo_url?: string
  created_at: string
  chips?: { label: string; action: string; value: any }[] | null
  revenue_suggestion?: { type: string; label: string; url: string } | null
}

export default function PlanningView({ knotId, currentUser, members }: {
  knotId?: string
  currentUser?: any
  members: any[]
}) {
  const agentId = process.env.NEXT_PUBLIC_KNOT_AGENT_USER_ID || ''

  const [hangouts, setHangouts] = useState<any[]>([])
  const [loadingHangouts, setLoadingHangouts] = useState(true)
  const [boardExpanded, setBoardExpanded] = useState(false)

  const [posts, setPosts] = useState<any[]>([])
  const [bundle, setBundle] = useState<any>(null)

  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolvingLine, setResolvingLine] = useState('')
  const [chatError, setChatError] = useState('')
  const [pendingChips, setPendingChips] = useState<{ label: string; action: string; value: any }[] | null>(null)
  const [pendingRevenue, setPendingRevenue] = useState<{ type: string; label: string; url: string } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [sheet, setSheet] = useState<null | 'plus' | 'moment' | 'bill'>(null)
  const [momentText, setMomentText] = useState('')
  const [momentPhoto, setMomentPhoto] = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentPosting, setMomentPosting] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [billDesc, setBillDesc] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [billSelectedIds, setBillSelectedIds] = useState<Set<string>>(new Set())
  const [billPosting, setBillPosting] = useState(false)
  const [billError, setBillError] = useState('')

  const [todoRsvps, setTodoRsvps] = useState<any[]>([])
  const [todoPolls, setTodoPolls] = useState<any[]>([])
  const [todoBills, setTodoBills] = useState<any[]>([])

  const activeHangout = hangouts.find(h => h.is_live)
    || hangouts.find(h => h.status === 'voting' || h.status === 'confirmed')
    || null

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
  }

const loadHangouts = useCallback(async () => {
    if (!knotId) return
    const { data } = await supabase
      .from('hangouts')
      .select('*')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
    setHangouts(data || [])
    setLoadingHangouts(false)
  }, [knotId])

  const loadHangoutPosts = useCallback(async () => {
    if (!knotId) return
    const { data: postData } = await supabase
      .from('posts')
      .select('*, profiles:author_id(name)')
      .eq('knot_id', knotId)
      .in('post_type', ['hangout', 'poll'])
      .order('created_at', { ascending: false })

    if (!postData || postData.length === 0) { setPosts([]); setBundle(null); return }

    const hangoutIds = postData.map((p: any) => p.hangout_id).filter(Boolean)
    const postIds = postData.map((p: any) => p.id)
    const b = await loadHangoutBundle(hangoutIds, postIds, currentUser?.id)

    const { data: reactionsData } = await supabase
      .from('reactions')
      .select('post_id, emoji, user_id')
      .in('post_id', postIds)
    const byPost: Record<string, { emoji: string; user_id: string }[]> = {}
    ;(reactionsData || []).forEach((r: any) => {
      if (!byPost[r.post_id]) byPost[r.post_id] = []
      byPost[r.post_id].push({ emoji: r.emoji, user_id: r.user_id })
    })
    const reactionsMap: Record<string, ReactionCount[]> = {}
    Object.keys(byPost).forEach(pid => { reactionsMap[pid] = aggregateReactions(byPost[pid], currentUser?.id) })

    setPosts(postData.map((p: any) => ({ ...p, reactions: reactionsMap[p.id] || [] })))
    setBundle(b)
  }, [knotId, currentUser])

  async function toggleReaction(postId: string, emoji: string) {
    if (!currentUser?.id) return
    const normalized = normalizeReactionEmoji(emoji)
    const post = posts.find(p => p.id === postId)
    const existing = post?.reactions?.find((r: ReactionCount) => r.e === normalized && r.mine)
    if (existing) {
      await supabase.from('reactions').delete()
        .eq('post_id', postId).eq('user_id', currentUser.id).in('emoji', legacyHeartEmojis(normalized))
    } else {
      await supabase.from('reactions').insert({ post_id: postId, user_id: currentUser.id, emoji: normalized })
    }
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, reactions: toggleReactionLocal(p.reactions || [], normalized) } : p))
  }

  function buildCardData(post: any) {
    if (!bundle || !post.hangout_id) return null
    const hangout = bundle.hangoutsById.get(post.hangout_id)
    const options = (bundle.optionsByHangout.get(post.hangout_id) || []).map((o: any) => ({
      ...o,
      _myVote: (bundle.votesByHangout.get(post.hangout_id) || []).some((v: any) => v.option_id === o.id && v.user_id === currentUser?.id),
    }))
    return {
      hangout,
      options,
      rsvps: bundle.rsvpsByHangout.get(post.hangout_id) || [],
      comments: bundle.commentsByPost.get(post.id) || [],
      bills: bundle.billsByHangout.get(post.hangout_id) || [],
      invites: bundle.invitesByHangout.get(post.hangout_id) || [],
      poll: bundle.pollByHangout.get(post.hangout_id) || null,
    }
  }

  const loadMessages = useCallback(async (hangoutId: string) => {
    setLoadingMessages(true)
    const { data } = await supabase
      .from('hangout_messages')
      .select('*, profiles:author_id(name)')
      .eq('hangout_id', hangoutId)
      .order('created_at', { ascending: true })
      .limit(100)
    const withUrls = await Promise.all((data || []).map(async (m: any) => {
      if (!m.photo_path) return m
      const url = await getSignedUrl(m.photo_path)
      return { ...m, photo_url: url ?? '' }
    }))
    setMessages(withUrls)
    setLoadingMessages(false)
    scrollToBottom()
  }, [])

  const appendMessage = useCallback(async (raw: any) => {
    let photo_url: string | undefined
    if (raw.photo_path) photo_url = (await getSignedUrl(raw.photo_path)) ?? ''
    setMessages(prev => {
      if (prev.some(m => m.id === raw.id)) return prev
      return [...prev, { ...raw, photo_url }]
    })
    scrollToBottom()
  }, [])

  const loadTodos = useCallback(async () => {
    if (!knotId || !currentUser?.id) return
    const upcoming = hangouts.filter(h => h.status !== 'ended' && h.status !== 'cancelled')
    const hangoutIds = upcoming.map(h => h.id)
    if (hangoutIds.length === 0) { setTodoRsvps([]); setTodoPolls([]); setTodoBills([]); return }

    const { data: myRsvps } = await supabase
      .from('hangout_rsvps')
      .select('hangout_id')
      .eq('user_id', currentUser.id)
      .in('hangout_id', hangoutIds)
    const rsvpedIds = new Set((myRsvps || []).map((r: any) => r.hangout_id))
    setTodoRsvps(upcoming.filter(h => !rsvpedIds.has(h.id)))

    const { data: openPolls } = await supabase
      .from('availability_polls')
      .select('id, hangout_id, title')
      .in('hangout_id', hangoutIds)
      .eq('status', 'open')
    if (openPolls && openPolls.length > 0) {
      const pollIds = openPolls.map((p: any) => p.id)
      const { data: myResponses } = await supabase
        .from('availability_poll_responses')
        .select('poll_id')
        .eq('user_id', currentUser.id)
        .in('poll_id', pollIds)
      const respondedIds = new Set((myResponses || []).map((r: any) => r.poll_id))
      setTodoPolls(openPolls.filter((p: any) => !respondedIds.has(p.id)))
    } else {
      setTodoPolls([])
    }

    const { data: knotBills } = await supabase.from('bills').select('id, description, total_amount').eq('knot_id', knotId)
    if (knotBills && knotBills.length > 0) {
      const billIds = knotBills.map((b: any) => b.id)
      const { data: mySplits } = await supabase
        .from('bill_splits')
        .select('bill_id, amount, settled')
        .eq('user_id', currentUser.id)
        .eq('settled', false)
        .in('bill_id', billIds)
      const billById = new Map(knotBills.map((b: any) => [b.id, b]))
      setTodoBills((mySplits || []).map((s: any) => ({ ...s, bill: billById.get(s.bill_id) })))
    } else {
      setTodoBills([])
    }
  }, [knotId, currentUser, hangouts])

  useEffect(() => { if (knotId) { loadHangouts(); loadHangoutPosts() } }, [knotId, loadHangouts, loadHangoutPosts])
  useEffect(() => { loadTodos() }, [loadTodos])

  useEffect(() => {
    if (!knotId) return
    const channel = supabase
      .channel(`planning:${knotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangouts', filter: `knot_id=eq.${knotId}` }, () => loadHangouts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `knot_id=eq.${knotId}` }, () => loadHangoutPosts())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [knotId, loadHangouts, loadHangoutPosts])

  useEffect(() => {
    if (!activeHangout?.id) { setMessages([]); return }
    let cancelled = false
    loadMessages(activeHangout.id)

    const channel = supabase
      .channel(`planning-thread:${activeHangout.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'hangout_messages', filter: `hangout_id=eq.${activeHangout.id}`,
      }, payload => { if (!cancelled) appendMessage(payload.new) })
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [activeHangout?.id, loadMessages, appendMessage])

  async function sendChat(overrideText?: string) {
    const text = (overrideText ?? chatInput).trim()
    if (!text || resolving || !knotId) return
    setChatInput('')
    setChatError('')
    setPendingChips(null)
    setPendingRevenue(null)
    setResolving(true)
    setResolvingLine(getRandomTagged(AGENT_RESOLVING_STATES))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setChatError('You need to be signed in.'); setResolving(false); return }

      const res = await fetch('/api/planning-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({
          message: text,
          hangout_id: activeHangout?.id || null,
          knot_id: knotId,
          current_plan_state: activeHangout ? {
            title: activeHangout.title,
            venue_name: activeHangout.venue_name,
            scheduled_for: activeHangout.scheduled_for,
            status: activeHangout.status,
          } : null,
        }),
      })
      const data = await res.json()
      if (data.hangout_id && data.hangout_id !== activeHangout?.id) await loadHangouts()
      if (data.hangout_id) await loadMessages(data.hangout_id)
      setPendingChips(data.chips ?? null)
      setPendingRevenue(data.revenue_suggestion ?? null)
    } catch {
      setChatError('Could not reach the planner. Try again.')
    }
    setResolving(false)
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMomentPhoto(file)
    setMomentPhotoPreview(URL.createObjectURL(file))
  }

  async function postMoment() {
    if ((!momentText.trim() && !momentPhoto) || momentPosting || !knotId) return
    setMomentPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMomentPosting(false); return }

    const { data: newPost, error: postError } = await supabase.from('posts').insert({
      knot_id: knotId, author_id: user.id, content: momentText.trim() || null, post_type: 'moment',
    }).select().single()

    if (!postError && newPost && momentPhoto) {
      const compressed = await compressImage(momentPhoto)
      const ext = compressed.name.split('.').pop()
      const storagePath = `${knotId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, compressed)
      if (!uploadError) {
        await supabase.from('photos').insert({
          knot_id: knotId, post_id: newPost.id, uploaded_by: user.id,
          storage_path: storagePath, file_name: compressed.name, file_size: compressed.size, media_type: 'image',
        })
      }
    }

    setMomentPosting(false)
    setMomentText('')
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setSheet(null)
  }

  function toggleBillMember(id: string) {
    setBillSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function postBill() {
    if (!billDesc.trim() || !billAmount || billPosting || !knotId) return
    const amount = parseFloat(billAmount)
    if (isNaN(amount) || amount <= 0) { setBillError('Enter a valid amount.'); return }
    const splitIds = billSelectedIds.size > 0 ? Array.from(billSelectedIds) : members.map(m => m.id)
    setBillPosting(true)
    setBillError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBillPosting(false); return }

    const share = amount / splitIds.length
    const { data: bill, error } = await supabase.from('bills').insert({
      knot_id: knotId, added_by: user.id, total_amount: amount, description: billDesc.trim(), split_type: 'equal',
    }).select().single()
    if (error || !bill) { setBillError('Could not add the bill.'); setBillPosting(false); return }

    await supabase.from('bill_splits').insert(
      splitIds.map((uid: string) => ({ bill_id: bill.id, user_id: uid, amount: parseFloat(share.toFixed(2)), settled: uid === user.id }))
    )
    await supabase.from('posts').insert({
      knot_id: knotId, author_id: user.id,
      content: `added a bill — $${amount.toFixed(2)} for ${billDesc.trim()}, split ${splitIds.length} ways`,
      post_type: 'bill',
    })

    setBillPosting(false)
    setBillDesc('')
    setBillAmount('')
    setBillSelectedIds(new Set())
    setSheet(null)
  }

  async function confirmPlan() {
    if (!activeHangout?.id) return
    await supabase.from('hangouts').update({ status: 'confirmed' }).eq('id', activeHangout.id)
  }

  async function tapChip(chip: { label: string; action: string; value: any }) {
    setPendingChips(null)
    setPendingRevenue(null)
    await sendChat(chip.label)
  }

  function revenueChipLabel(type: string): string {
    if (type === 'opentable') return getRandom(AGENT_MESSAGES.REVENUE_RESTAURANT)
    if (type === 'uber' || type === 'lyft') return getRandom(AGENT_MESSAGES.REVENUE_TRANSPORT)
    if (type === 'mixtiles') return getRandom(AGENT_MESSAGES.REVENUE_PRINTS)
    return ''
  }

  const todoCount = todoRsvps.length + todoPolls.length + todoBills.length
  const isCreator = activeHangout?.created_by === currentUser?.id
  const activeHasOpenPoll = !!(activeHangout && bundle?.pollByHangout?.get(activeHangout.id)?.status === 'open')
  const whenFieldLabel = activeHangout
    ? (formatWhen(activeHangout.scheduled_for) || (activeHasOpenPoll ? PLAN_FIELD_POLL_OPEN : PLAN_FIELD_TBD))
    : PLAN_FIELD_TBD

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 480 }}>

      {/* SURFACE 1: PLAN BOARD */}
      {activeHangout && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
          <div onClick={() => setBoardExpanded(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', minHeight: 80, boxSizing: 'border-box' }}>
            <KnotMark size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeHangout.title || 'Untitled plan'}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' as const }}>
                <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--text2)' }}>
                  {whenFieldLabel}
                </span>
                <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--text2)' }}>
                  {activeHangout.venue_name || PLAN_FIELD_NOT_BOOKED}
                </span>
                {activeHangout.is_live && (
                  <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: 11, fontWeight: 700 }}>{PLAN_BOARD_LIVE}</span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{PLAN_BOARD_HINT}</div>
          </div>

          {boardExpanded && (
            <div style={{ borderTop: '1px solid var(--border)', padding: 16, maxHeight: 420, overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>Status</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{stateLabel(activeHangout)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>{CHIP_WHEN}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{whenFieldLabel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>{CHIP_WHERE}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{activeHangout.venue_name || PLAN_FIELD_NOT_BOOKED}</span>
                </div>
                {activeHangout.brief && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8 }}>
                    {activeHangout.brief}
                  </div>
                )}
              </div>

              {isCreator && activeHangout.status !== 'confirmed' && activeHangout.status !== 'ended' && activeHangout.status !== 'cancelled' && (
                <button onClick={confirmPlan}
                  style={{ width: '100%', padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 10, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
                  {CTA_CONFIRM}
                </button>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Planner</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>All your hangouts, live and upcoming</div>

              {loadingHangouts ? (
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
              ) : posts.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' as const, padding: '20px 0' }}>Nothing planned yet.</div>
              ) : (
                posts.map((post: any) => {
                  const cardData = buildCardData(post)
                  if (!cardData || !cardData.hangout) return null
                  return (
                    <HangoutCard
                      key={post.id}
                      post={post}
                      data={cardData}
                      currentUser={currentUser}
                      knotId={knotId!}
                      members={members}
                      onRefresh={loadHangoutPosts}
                      onToggleReaction={(emoji) => toggleReaction(post.id, emoji)}
                    />
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* SURFACE 2: GROUP CHAT */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!activeHangout ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' as const, padding: '40px 20px' }}>
              Tell the group what you want to do below.
            </div>
          ) : loadingMessages ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' as const, padding: 20 }}>Loading...</div>
          ) : messages.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' as const, padding: '40px 20px' }}>No messages yet. Start the conversation.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(m => {
                const isAgent = agentId && m.author_id === agentId
                const isMine = m.author_id === currentUser?.id
                const name = isAgent ? 'Knot' : (m.author_id === currentUser?.id ? (currentUser?.name || 'You') : (members.find(mm => mm.id === m.author_id)?.name || 'Someone'))
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    {isAgent ? (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#FFFBEE', border: '1px solid rgba(248,189,3,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <KnotMark size={14} />
                      </div>
                    ) : (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--text)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                      {!isMine && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 2 }}>{name}</span>}
                      <div style={{
                        padding: m.photo_url ? 4 : '8px 12px', borderRadius: 12,
                        background: isAgent ? '#FFFBEE' : (isMine ? 'var(--yellow)' : 'var(--bg3)'),
                        border: isAgent ? '1px solid rgba(248,189,3,0.25)' : 'none',
                      }}>
                        {m.photo_url && <img src={m.photo_url} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginBottom: m.content ? 6 : 0 }} />}
                        {m.content && (
                          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)', whiteSpace: 'pre-wrap' as const, padding: m.photo_url ? '0 6px 4px' : 0, display: 'block' }}>
                            {m.content}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(m.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {(pendingChips || pendingRevenue) && !resolving && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, padding: '0 16px 10px' }}>
            {(pendingChips || []).slice(0, 3).map(chip => (
              <button key={chip.label} onClick={() => tapChip(chip)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(248,189,3,0.4)', background: '#FFFBEE', color: '#8a6500', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {chip.label}
              </button>
            ))}
            {pendingRevenue && (
              <button onClick={() => window.open(pendingRevenue.url, '_blank', 'noopener,noreferrer')}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(248,189,3,0.4)', background: '#FFFBEE', color: '#8a6500', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {revenueChipLabel(pendingRevenue.type)}
              </button>
            )}
          </div>
        )}

        {chatError && <div className="error-banner" style={{ margin: '0 16px 8px' }}>{chatError}</div>}
        {resolving && (
          <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text3)' }}>{resolvingLine}</div>
        )}
      </div>

      {/* SURFACE 3: TODO STRIP */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: 0, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: todoCount > 0 ? 8 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Your actions</span>
          {todoCount > 0 && (
            <span style={{ padding: '1px 7px', borderRadius: 20, background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700 }}>{todoCount}</span>
          )}
        </div>
        {todoCount === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{EMPTY_TODO}</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' as const, paddingBottom: 2 }}>
            {todoRsvps.map(h => (
              <div key={`rsvp-${h.id}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, minWidth: 180 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>RSVP · {h.title || 'Plan'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{(members.find(m => m.id === h.created_by)?.name || 'Organiser')} {TODO_RSVP_SUB}</div>
                </div>
                <button onClick={async () => { await supabase.from('hangout_rsvps').upsert({ hangout_id: h.id, user_id: currentUser.id, status: 'yes' }, { onConflict: 'hangout_id,user_id' }); loadTodos() }}
                  style={{ padding: '5px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {TODO_RSVP_ACTION}
                </button>
              </div>
            ))}
            {todoPolls.map(p => (
              <div key={`poll-${p.id}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, minWidth: 180 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {TODO_VOTE_LABEL} · {(p.title || 'Poll').slice(0, 30)}
                </div>
                <button onClick={() => setBoardExpanded(true)}
                  style={{ padding: '5px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {TODO_VOTE_ACTION}
                </button>
              </div>
            ))}
            {todoBills.map((s, i) => (
              <div key={`bill-${s.bill_id}-${i}`} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#fff', border: '1px solid var(--border)', borderRadius: 10, minWidth: 180 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {TODO_SETTLE_LABEL} · {s.bill?.description || 'Bill'} · ${parseFloat(s.amount).toFixed(2)}
                </div>
                <button onClick={() => setSheet(null)}
                  style={{ padding: '5px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {TODO_SETTLE_ACTION}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* COMPOSER BAR */}
      <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setSheet('plus')} aria-label="More options"
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 20, color: 'var(--text3)', fontFamily: 'inherit' }}>
          +
        </button>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) sendChat() }}
          placeholder={getRandom(COMPOSER_PLACEHOLDER)}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', caretColor: 'var(--yellow)' }}
        />
        <button
          onClick={() => { if (chatInput.trim()) sendChat(); else setSheet('moment') }}
          disabled={resolving}
          style={{ width: 34, height: 34, borderRadius: '50%', background: chatInput.trim() ? 'var(--yellow)' : 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: resolving ? 'not-allowed' : 'pointer', flexShrink: 0, fontSize: 15, color: '#111', opacity: resolving ? 0.6 : 1 }}
          aria-label="Send">
          ↑
        </button>
      </div>

      {/* PLUS SHEET */}
      {sheet === 'plus' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '10px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            <div onClick={() => setSheet('moment')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>📷</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Photo or video</span>
            </div>
            <div onClick={() => setSheet('bill')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <span style={{ fontSize: 20 }}>🧾</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Add a bill</span>
            </div>
          </div>
        </>
      )}

      {/* MOMENT SHEET */}
      {sheet === 'moment' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' as const }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {momentPhotoPreview && (
              <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 320 }}>
                <img src={momentPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = '' }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
              </div>
            )}
            <textarea value={momentText} onChange={e => setMomentText(e.target.value)} placeholder={getRandom(COMPOSER_PLACEHOLDER)} rows={3}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const, marginBottom: 10, boxSizing: 'border-box' as const }} />
            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => photoInputRef.current?.click()} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, padding: '9px 14px', cursor: 'pointer' }}>
                📷 {momentPhoto ? 'Change' : 'Add photo'}
              </button>
              <button onClick={postMoment} disabled={(!momentText.trim() && !momentPhoto) || momentPosting}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!momentText.trim() && !momentPhoto) || momentPosting ? 0.5 : 1 }}>
                {momentPosting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* BILL SHEET */}
      {sheet === 'bill' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' as const }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {billError && <div className="error-banner" style={{ marginBottom: 8 }}>{billError}</div>}
            <input value={billDesc} onChange={e => setBillDesc(e.target.value)} placeholder="What was the bill for?"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 8 }} />
            <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="Total amount ($)"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Split with (leave blank for everyone)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto', marginBottom: 10 }}>
              {members.map(m => {
                const checked = billSelectedIds.has(m.id)
                return (
                  <div key={m.id} onClick={() => toggleBillMember(m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: checked ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.name}</span>
                  </div>
                )
              })}
            </div>
            <button onClick={postBill} disabled={!billDesc.trim() || !billAmount || billPosting}
              style={{ width: '100%', padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !billDesc.trim() || !billAmount || billPosting ? 0.5 : 1 }}>
              {billPosting ? 'Posting…' : 'Post bill'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
