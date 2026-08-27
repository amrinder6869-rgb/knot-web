'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'
import { useToast } from '@/components/ToastProvider'
import { ICON_SIZE } from '@/lib/constants'
import {
  getRandom,
  getRandomTagged,
  AGENT_RESOLVING_STATES,
  AGENT_MESSAGES,
  COMPOSER_PLACEHOLDER,
  PLANNING_CHAT_PLACEHOLDER,
  EMPTY_TODO,
  CTA_CONFIRM,
  PLAN_BOARD_HINT,
  PLAN_FIELD_NOT_BOOKED,
  PLAN_FIELD_TBD,
  TODO_RSVP_SUB,
  TODO_VOTE_LABEL,
  TODO_SETTLE_LABEL,
  TODO_RSVP_ACTION,
  TODO_VOTE_ACTION,
  TODO_SETTLE_ACTION,
  TOAST_ERROR,
  PLAN_UNTITLED,
  AGENT_TITLE_PROMPT,
  PLANNER_SECTION_PLANNING,
  PLANNER_SECTION_DRAFTS,
  PLANNER_SECTION_LOCKED,
  PLANNER_EMPTY_PLANNING,
  PLANNER_EMPTY_DRAFTS,
  PLANNER_EMPTY_LOCKED,
  PLANNER_CTA_SAVE,
  PLANNER_CTA_ABANDON,
  PLANNER_CTA_RESUME,
  PLANNER_VIEW_IN_FEED,
  PLANNER_CONFIRM_ABANDON,
  PLANNER_TOAST_LOCKED,
  PLANNER_TOAST_SAVED,
  PLANNER_TOAST_ABANDONED,
  PLANNER_TOAST_RESUMED,
  PLANNER_TODO_HEADER,
  BILL_DESC_PLACEHOLDER,
  BILL_AMOUNT_PLACEHOLDER,
} from '@/lib/copy'
import type { OpenChatOpts } from '@/components/AttentionStrip'

// TODO: replace with /public/knot-logo.png once the asset is exported.
function KnotMark({ size = 20 }: { size?: number }) {
  return (
    // Knot logomark — only permitted inline SVG in the codebase
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

const HOUR_MS = 60 * 60 * 1000

function dateDividerLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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

type VenueSuggestion = {
  place_id: string
  name: string
  formatted_address: string
  rating: number | null
  open_now: boolean | null
  photo_url: string | null
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

export default function PlanningView({ knotId, currentUser, members, onNavigateToFeed, onOpenChat }: {
  knotId?: string
  currentUser?: any
  members: any[]
  onNavigateToFeed?: () => void
  onOpenChat?: (opts: OpenChatOpts) => void
}) {
  const agentId = process.env.NEXT_PUBLIC_KNOT_AGENT_USER_ID || ''
  const toast = useToast()

  const [hangouts, setHangouts] = useState<any[]>([])
  const [loadingHangouts, setLoadingHangouts] = useState(true)
  const [boardExpanded, setBoardExpanded] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{ id: string; type: 'lock' | 'save' | 'abandon' | 'resume' } | null>(null)

  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolvingLine, setResolvingLine] = useState('')
  const [chatError, setChatError] = useState('')
  const [pendingChips, setPendingChips] = useState<{ label: string; action: string; value: any }[] | null>(null)
  const [pendingRevenue, setPendingRevenue] = useState<{ type: string; label: string; url: string } | null>(null)
  const [pendingVenues, setPendingVenues] = useState<VenueSuggestion[] | null>(null)
  const [confirmingVenueId, setConfirmingVenueId] = useState<string | null>(null)
  // Synchronous guard for sendChat — `resolving` state updates are batched/async,
  // so a fast double-tap (send button + Enter, or two quick taps) could slip a
  // second call through before `resolving` actually flips. The planning-agent
  // route must only ever be called from an explicit, single user send action:
  // never on mount, re-render, or Realtime message receipt.
  const sendingRef = useRef(false)
  // Computed once on mount — never rotate on re-render.
  const [chatPlaceholder] = useState(() => getRandom(PLANNING_CHAT_PLACEHOLDER))
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

  // The three Planner sections. Composer-created hangouts default to
  // planning_status='planning' too (the column predates that flow), but they
  // already have a post_id by the time anyone can see them — the post_id
  // guard is what actually keeps them out of the Planner, not planning_status.
  const planningHangouts = useMemo(() => hangouts
    .filter(h => h.planning_status === 'planning')
    .sort((a, b) => new Date(b.last_planning_activity_at || b.created_at).getTime() - new Date(a.last_planning_activity_at || a.created_at).getTime()),
    [hangouts])
  const draftHangouts = useMemo(() => hangouts
    .filter(h => h.planning_status === 'draft')
    .sort((a, b) => new Date(b.last_planning_activity_at || b.created_at).getTime() - new Date(a.last_planning_activity_at || a.created_at).getTime()),
    [hangouts])
  const lockedHangouts = useMemo(() => hangouts
    .filter(h => h.planning_status === 'locked')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [hangouts])

  // The chat thread (Surface 2) always follows whichever plan is actively
  // being negotiated — drafts and locked plans have no chat surface here.
  const activeHangout = (selectedPlanId && planningHangouts.find(h => h.id === selectedPlanId))
    || planningHangouts[0]
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
    // De-duped by id at the source — every consumer (Planner sections, the
    // TODO strip's RSVP prompts, activeHangout) reads from this one array, so
    // a duplicate row here would otherwise surface as a duplicate action.
    const seen = new Set<string>()
    const deduped = (data || []).filter(h => {
      if (seen.has(h.id)) return false
      seen.add(h.id)
      return true
    })
    setHangouts(deduped)
    setLoadingHangouts(false)
  }, [knotId])

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

  useEffect(() => { if (knotId) loadHangouts() }, [knotId, loadHangouts])
  useEffect(() => { loadTodos() }, [loadTodos])

  useEffect(() => {
    if (!knotId) return
    const channel = supabase
      .channel(`planning:${knotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangouts', filter: `knot_id=eq.${knotId}` }, () => loadHangouts())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [knotId, loadHangouts])

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
    if (!text || sendingRef.current || resolving || !knotId) return
    sendingRef.current = true
    setChatInput('')
    setChatError('')
    setPendingChips(null)
    setPendingRevenue(null)
    setPendingVenues(null)
    setResolving(true)
    setResolvingLine(getRandomTagged(AGENT_RESOLVING_STATES))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setChatError('You need to be signed in.'); sendingRef.current = false; setResolving(false); return }

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
      setPendingVenues(data.venue_suggestions ?? null)
    } catch {
      setChatError('Could not reach the planner. Try again.')
    }
    sendingRef.current = false
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
      bill_id: bill.id,
    })

    setBillPosting(false)
    setBillDesc('')
    setBillAmount('')
    setBillSelectedIds(new Set())
    setSheet(null)
  }

  // Planning-agent-created hangouts never go through create_hangout(), so
  // locking one in has to do that RPC's post-creation step itself: insert
  // the feed post, then point hangouts.post_id at it. Only then does the
  // plan leave the Planner and start living in the Feed like any other hangout.
  async function lockPlan(hangout: any) {
    if (!hangout || hangout.post_id || pendingAction || !currentUser?.id) return
    if (!hangout.title?.trim()) {
      await supabase.from('hangout_messages').insert({
        hangout_id: hangout.id,
        author_id: agentId,
        content: AGENT_TITLE_PROMPT,
      })
      setSelectedPlanId(hangout.id)
      return
    }
    setPendingAction({ id: hangout.id, type: 'lock' })
    const { data: newPost, error: postError } = await supabase
      .from('posts')
      .insert({ knot_id: hangout.knot_id, hangout_id: hangout.id, author_id: currentUser.id, content: 'locked in a plan', post_type: 'hangout' })
      .select('id')
      .single()
    if (postError || !newPost) { toast.error(TOAST_ERROR); setPendingAction(null); return }
    const { error: updateError } = await supabase
      .from('hangouts')
      .update({ post_id: newPost.id, planning_status: 'locked' })
      .eq('id', hangout.id)
    setPendingAction(null)
    if (updateError) { toast.error(TOAST_ERROR); return }
    toast.success(PLANNER_TOAST_LOCKED)
    await loadHangouts()
  }

  async function savePlan(hangout: any) {
    if (!hangout || pendingAction) return
    setPendingAction({ id: hangout.id, type: 'save' })
    const { error } = await supabase.from('hangouts').update({ planning_status: 'draft' }).eq('id', hangout.id)
    setPendingAction(null)
    if (error) { toast.error(TOAST_ERROR); return }
    toast.success(PLANNER_TOAST_SAVED)
    if (selectedPlanId === hangout.id) setSelectedPlanId(null)
    await loadHangouts()
  }

  async function abandonPlan(hangout: any) {
    if (!hangout || pendingAction) return
    if (!confirm(PLANNER_CONFIRM_ABANDON)) return
    setPendingAction({ id: hangout.id, type: 'abandon' })
    const { error } = await supabase.from('hangouts').update({ planning_status: 'abandoned' }).eq('id', hangout.id)
    setPendingAction(null)
    if (error) { toast.error(TOAST_ERROR); return }
    toast.success(PLANNER_TOAST_ABANDONED)
    if (selectedPlanId === hangout.id) setSelectedPlanId(null)
    await loadHangouts()
  }

  async function resumePlan(hangout: any) {
    if (!hangout || pendingAction) return
    setPendingAction({ id: hangout.id, type: 'resume' })
    const { error } = await supabase.from('hangouts').update({ planning_status: 'planning' }).eq('id', hangout.id)
    setPendingAction(null)
    if (error) { toast.error(TOAST_ERROR); return }
    toast.success(PLANNER_TOAST_RESUMED)
    setSelectedPlanId(hangout.id)
    await loadHangouts()
  }

  async function tapChip(chip: { label: string; action: string; value: any }) {
    setPendingChips(null)
    setPendingRevenue(null)
    await sendChat(chip.label)
  }

  // Tapping a venue card is itself the confirmation — no separate chip. Mirrors
  // the route's own venue_name/venue_address confirmation path (AGENT_MESSAGES.VENUE_CONFIRMED),
  // just triggered from the client instead of a tapped chip round-tripping the model.
  async function confirmVenue(venue: VenueSuggestion) {
    if (!activeHangout?.id || confirmingVenueId) return
    setConfirmingVenueId(venue.place_id)
    const currentTitle = activeHangout.title?.trim()
    const shouldSetTitle = !currentTitle || currentTitle === PLAN_UNTITLED
    const { error } = await supabase
      .from('hangouts')
      .update({
        venue_name: venue.name,
        venue_address: venue.formatted_address,
        venue_place_id: venue.place_id,
        ...(shouldSetTitle ? { title: venue.name } : {}),
      })
      .eq('id', activeHangout.id)
    setConfirmingVenueId(null)
    if (error) { toast.error(TOAST_ERROR); return }
    setPendingVenues(null)
    await supabase.from('hangout_messages').insert({
      hangout_id: activeHangout.id,
      author_id: agentId,
      content: getRandom(AGENT_MESSAGES.VENUE_CONFIRMED),
    })
    // Re-fetch immediately so the collapsed plan board pill and title reflect
    // the new venue within the same tick — never wait for the next realtime event.
    await loadHangouts()
  }

  function revenueChipLabel(type: string): string {
    if (type === 'opentable') return getRandom(AGENT_MESSAGES.REVENUE_RESTAURANT)
    if (type === 'uber' || type === 'lyft') return getRandom(AGENT_MESSAGES.REVENUE_TRANSPORT)
    if (type === 'mixtiles') return getRandom(AGENT_MESSAGES.REVENUE_PRINTS)
    return ''
  }

  const todoCount = todoRsvps.length + todoPolls.length + todoBills.length
  const whenFieldLabel = activeHangout ? (formatWhen(activeHangout.scheduled_for) || PLAN_FIELD_TBD) : PLAN_FIELD_TBD
  const totalPlans = planningHangouts.length + draftHangouts.length + lockedHangouts.length

  function renderPlanRow(h: any, kind: 'planning' | 'draft' | 'locked') {
    const isRowCreator = h.created_by === currentUser?.id
    const isActive = kind === 'planning' && h.id === activeHangout?.id
    const busy = pendingAction?.id === h.id
    return (
      <div key={h.id}
        onClick={kind === 'planning' ? () => setSelectedPlanId(h.id) : undefined}
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 6, padding: '6px 8px', borderRadius: 8, marginBottom: 6,
          background: isActive ? 'var(--yellow-soft)' : 'var(--bg3)',
          border: `1px solid ${isActive ? 'var(--yellow)' : 'var(--border2)'}`,
          cursor: kind === 'planning' ? 'pointer' : 'default',
        }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title || PLAN_UNTITLED}</div>
        <span style={{ padding: '2px 7px', borderRadius: 20, background: '#fff', border: '1px solid var(--border2)', fontSize: 10, color: 'var(--text2)' }}>
          {formatWhen(h.scheduled_for) || PLAN_FIELD_TBD}
        </span>
        <span style={{ padding: '2px 7px', borderRadius: 20, background: '#fff', border: '1px solid var(--border2)', fontSize: 10, color: 'var(--text2)' }}>
          {h.venue_name || PLAN_FIELD_NOT_BOOKED}
        </span>
        {h.brief && <div style={{ fontSize: 11, color: 'var(--text2)', flexBasis: '100%' }}>{h.brief}</div>}
        {isRowCreator && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
            {kind === 'planning' && (
              <>
                <button onClick={() => lockPlan(h)} disabled={busy}
                  style={{ padding: '4px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                  {CTA_CONFIRM}
                </button>
                <button onClick={() => savePlan(h)} disabled={busy}
                  style={{ padding: '4px 10px', background: '#fff', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                  {PLANNER_CTA_SAVE}
                </button>
                <button onClick={() => abandonPlan(h)} disabled={busy}
                  style={{ padding: '4px 10px', background: 'transparent', border: 'none', borderRadius: 6, color: 'var(--danger)', fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                  {PLANNER_CTA_ABANDON}
                </button>
              </>
            )}
            {kind === 'draft' && (
              <>
                <button onClick={() => resumePlan(h)} disabled={busy}
                  style={{ padding: '4px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                  {PLANNER_CTA_RESUME}
                </button>
                <button onClick={() => abandonPlan(h)} disabled={busy}
                  style={{ padding: '4px 10px', background: 'transparent', border: 'none', borderRadius: 6, color: 'var(--danger)', fontSize: 11, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
                  {PLANNER_CTA_ABANDON}
                </button>
              </>
            )}
          </div>
        )}
        {kind === 'locked' && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => onNavigateToFeed?.()}
              style={{ padding: '4px 10px', background: '#fff', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--yellow)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {PLANNER_VIEW_IN_FEED}
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderPlanSection(title: string, emptyLine: string, list: any[], kind: 'planning' | 'draft' | 'locked') {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
          {title}{list.length > 0 && ` · ${list.length}`}
        </div>
        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{emptyLine}</div>
        ) : (
          list.map(h => renderPlanRow(h, kind))
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 480 }}>

      {/* SURFACE 1: PLANNER — Planning now / Drafts / Locked in. Locked plans
          live in the Feed from here on; this panel never renders their
          HangoutCard, only a link back to it. */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
        <div onClick={() => setBoardExpanded(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer', minHeight: 80, boxSizing: 'border-box' }}>
          {/* Knot logomark — only permitted inline SVG in the codebase */}
          <KnotMark size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeHangout ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeHangout.title || PLAN_UNTITLED}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' as const }}>
                  <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--text2)' }}>
                    {whenFieldLabel}
                  </span>
                  <span style={{ padding: '3px 9px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', fontSize: 11, color: 'var(--text2)' }}>
                    {activeHangout.venue_name || PLAN_FIELD_NOT_BOOKED}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Planner</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                  {totalPlans > 0 ? `${lockedHangouts.length} locked in` : 'Nothing planned yet'}
                </div>
              </>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{PLAN_BOARD_HINT}</div>
        </div>

        {boardExpanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: 16, maxHeight: 420, overflowY: 'auto' }}>
            {loadingHangouts ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Loading...</div>
            ) : (
              <>
                {renderPlanSection(PLANNER_SECTION_PLANNING, PLANNER_EMPTY_PLANNING, planningHangouts, 'planning')}
                {renderPlanSection(PLANNER_SECTION_DRAFTS, PLANNER_EMPTY_DRAFTS, draftHangouts, 'draft')}
                {renderPlanSection(PLANNER_SECTION_LOCKED, PLANNER_EMPTY_LOCKED, lockedHangouts, 'locked')}
              </>
            )}
          </div>
        )}
      </div>

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
              {messages.map((m, i) => {
                const isAgent = agentId && m.author_id === agentId
                const isMine = m.author_id === currentUser?.id
                const name = isAgent ? 'Knot' : (m.author_id === currentUser?.id ? (currentUser?.name || 'You') : (members.find(mm => mm.id === m.author_id)?.name || 'Someone'))
                const showDateDivider = i > 0 && (new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime()) > HOUR_MS
                return (
                  <div key={m.id} style={{ display: 'contents' }}>
                  {showDateDivider && (
                    <div style={{ textAlign: 'center' as const, fontSize: 10, color: 'var(--text3)', margin: '4px 0' }}>
                      {dateDividerLabel(m.created_at)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    {isAgent ? (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#FFFBEE', border: '1px solid rgba(248,189,3,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {/* Knot logomark — only permitted inline SVG in the codebase */}
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
                  </div>
                )
              })}
              {/* Venue cards render as part of the thread, immediately after
                  the agent message that triggered them — not as a separate
                  strip below the whole message list. */}
              {pendingVenues && pendingVenues.length > 0 && !resolving && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto' as const, paddingLeft: 34 }}>
                  {pendingVenues.map(v => {
              const busy = confirmingVenueId === v.place_id
              return (
                <button key={v.place_id} onClick={() => confirmVenue(v)} disabled={busy}
                  style={{ flexShrink: 0, width: 168, textAlign: 'left' as const, background: '#fff', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', padding: 0, opacity: busy ? 0.6 : 1 }}>
                  <div style={{ width: '100%', height: 90, background: 'var(--bg3)' }}>
                    {v.photo_url && <img src={v.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{v.formatted_address}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {v.rating != null && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text2)' }}>
                          <i className="ti ti-star" style={{ fontSize: ICON_SIZE.inline, color: 'var(--yellow)' }} /> {v.rating}
                        </span>
                      )}
                      {v.open_now != null && (
                        <span style={{ fontSize: 10, fontWeight: 600, color: v.open_now ? 'var(--sage)' : 'var(--danger)' }}>{v.open_now ? 'Open now' : 'Closed'}</span>
                      )}
                    </div>
                  </div>
                </button>
                    )
                  })}
                </div>
              )}
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
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{PLANNER_TODO_HEADER}</span>
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
                <button onClick={() => {
                  if (onOpenChat) onOpenChat({ hangoutId: p.hangout_id, scrollTarget: 'poll' })
                  else setBoardExpanded(true)
                }}
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
                <button onClick={() => {
                  const billHangoutId = s.bill?.hangout_id || activeHangout?.id
                  if (onOpenChat && billHangoutId) onOpenChat({ hangoutId: billHangoutId, scrollTarget: 'bill' })
                  else setSheet('bill')
                }}
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
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
          <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
        </button>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) sendChat() }}
          placeholder={chatPlaceholder}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', caretColor: 'var(--yellow)' }}
        />
        <button
          onClick={() => { if (chatInput.trim()) sendChat(); else setSheet('moment') }}
          disabled={resolving}
          style={{ width: 34, height: 34, borderRadius: '50%', background: chatInput.trim() ? 'var(--yellow)' : 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: resolving ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: resolving ? 0.6 : 1 }}
          aria-label="Send">
          <i className="ti ti-send" style={{ fontSize: ICON_SIZE.nav, color: '#111' }} />
        </button>
      </div>

      {/* PLUS SHEET */}
      {sheet === 'plus' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 201, padding: '10px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            <div onClick={() => setSheet('moment')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <i className="ti ti-camera" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Photo or video</span>
            </div>
            <div onClick={() => setSheet('bill')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <i className="ti ti-receipt" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
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
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {/* Deliberate exception to the 3-color icon rule: a dismiss
                      control over an arbitrary user photo needs to stay legible
                      against unpredictable image content, not just the app's
                      own dark surfaces. */}
                  <i className="ti ti-x" style={{ fontSize: ICON_SIZE.inline, color: '#fff' }} />
                </button>
              </div>
            )}
            <textarea value={momentText} onChange={e => setMomentText(e.target.value)} placeholder={getRandom(COMPOSER_PLACEHOLDER)} rows={3}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const, marginBottom: 10, boxSizing: 'border-box' as const }} />
            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => photoInputRef.current?.click()} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-camera" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} /> {momentPhoto ? 'Change' : 'Add photo'}
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
            <input value={billDesc} onChange={e => setBillDesc(e.target.value)} placeholder={BILL_DESC_PLACEHOLDER}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 8 }} />
            <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder={BILL_AMOUNT_PLACEHOLDER}
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
