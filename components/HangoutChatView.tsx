'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'
import { useToast } from '@/components/ToastProvider'
import DateTimePicker from '@/components/DateTimePicker'
import { DailyCall } from '@/components/DailyCall'
import AvailabilityPoll from '@/components/AvailabilityPoll'
import CoverImagePicker from '@/components/CoverImagePicker'
import VenuePoll from '@/components/VenuePoll'
import { ACTIVITY_ICONS, ICON_SIZE } from '@/lib/constants'
import { createNotification } from '@/lib/notify'
import { track } from '@/lib/track'
import { hangoutPhase, cardStateKey } from '@/lib/hangoutPhase'
import {
  getRandom,
  getRandomTagged,
  AGENT_RESOLVING_STATES,
  AGENT_MESSAGES,
  COMPOSER_PLACEHOLDER,
  PLANNING_CHAT_PLACEHOLDER,
  CTA_CONFIRM,
  CARD_STATE_COPY,
  CHIP_WHEN,
  CHIP_WHEN_DATE,
  CHIP_WHERE,
  TOAST_ERROR,
  PLAN_UNTITLED,
  AGENT_TITLE_PROMPT,
  CONFIRM_CANCEL_HANGOUT,
  STATE_LIVE,
  MENU_EDIT_HANGOUT,
  MENU_CANCEL_HANGOUT,
  MENU_SHARE_INVITE,
  MENU_JOIN_CALL,
  MENU_JOIN_CALL_STARTING,
  TOAST_INVITE_COPIED,
  TOAST_INVITE_COPY_FAILED,
  ERROR_SIGN_IN_FOR_CALL,
  ERROR_CANCEL_HANGOUT,
  ERROR_UPDATE_RSVP,
  ERROR_GO_LIVE,
  ERROR_UPDATE_HANGOUT,
  ERROR_START_CALL,
  ERROR_BILL_AMOUNT,
  ERROR_ADD_BILL,
  ERROR_MARK_PAID,
  ERROR_SEND_REMINDER,
  TOAST_HANGOUT_CONFIRMED,
  TOAST_DATE_CONFIRMED,
  TOAST_ALREADY_NUDGED,
  BILL_DESC_PLACEHOLDER,
  BILL_AMOUNT_PLACEHOLDER,
  LIVE_PHOTO_PROMPT,
  LIVE_RECEIPT_PROMPT,
  HERE_MESSAGE,
  CTA_WE_ARE_HERE,
  RSVP_LABEL_GOING,
  RSVP_LABEL_MAYBE,
  RSVP_LABEL_CANT_GO,
  CHIP_WHEN_TODAY,
  CHIP_WHEN_FRIDAY,
  CHIP_WHEN_WEEKEND,
  AGENT_WHEN_PROMPT,
  CHAT_LOADING,
  CHAT_EMPTY,
  CHAT_ERROR_SIGN_IN,
  CHAT_ERROR_PLANNER,
  SHEET_PHOTO,
  SHEET_ADD_BILL,
  SHEET_CARPOOL,
  SHEET_CHANGE_PHOTO,
  SHEET_ADD_PHOTO,
  SHEET_POSTING,
  SHEET_POST,
  SHEET_POST_BILL,
  SHEET_SPLIT_HINT,
  SHEET_CARPOOL_NO_VENUE,
  SHEET_EDIT_TITLE,
  SHEET_EDIT_TITLE_PLACEHOLDER,
  SHEET_EDIT_VENUE_PLACEHOLDER,
  SHEET_EDIT_ADDRESS_PLACEHOLDER,
  SHEET_EDIT_DATE_LABEL,
  SHEET_CANCEL,
  SHEET_SAVE,
  SHEET_SAVING,
  BILL_ALL_SETTLED,
  BILL_SETTLE_UP,
  BILL_REMIND,
  MEMORIES_TITLE,
  MEMORIES_EMPTY,
  VENUE_OPEN_NOW,
  VENUE_CLOSED,
} from '@/lib/copy'

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

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function dateDividerLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function activityIcon(hangout: any): string {
  const keys = [hangout?.activity_type, hangout?.occasion_type, hangout?.brief_vibe, hangout?.type, hangout?.movie_title ? 'movie' : null]
  for (const key of keys) {
    if (key && ACTIVITY_ICONS[String(key).toLowerCase()]) return ACTIVITY_ICONS[String(key).toLowerCase()]
  }
  return 'ti-calendar-event'
}

function fieldChipStyle(filled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: '#fff',
    border: `0.5px ${filled ? 'solid' : 'dashed'} rgba(248,189,3,0.25)`,
    borderRadius: 6, padding: '3px 8px', fontSize: 11,
    color: filled ? '#555' : '#aaa',
  }
}

function buildUberLink(venueName: string, venueAddress: string) {
  return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[nickname]=${encodeURIComponent(venueName)}&dropoff[formatted_address]=${encodeURIComponent(venueAddress)}`
}

function buildLyftLink(venueName: string, venueAddress: string) {
  const dest = encodeURIComponent(venueAddress || venueName)
  return `https://ride.lyft.com/ridetype?id=lyft&destination=${dest}`
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
}

export default function HangoutChatView({
  hangoutId,
  knotId: knotIdProp,
  currentUser,
  onClose,
  scrollToBottom = true,
  scrollTarget = null,
  autoJoinCall = false,
  onChanged,
}: {
  hangoutId: string
  knotId?: string
  currentUser: any
  onClose: () => void
  scrollToBottom?: boolean
  scrollTarget?: 'poll' | 'bill' | null
  autoJoinCall?: boolean
  onChanged?: () => void
}) {
  const agentId = process.env.NEXT_PUBLIC_KNOT_AGENT_USER_ID || ''
  const toast = useToast()

  const [hangout, setHangout] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [rsvps, setRsvps] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [options, setOptions] = useState<any[]>([])
  const [poll, setPoll] = useState<any | null>(null)
  const [photos, setPhotos] = useState<{ id: string; url: string; media_type: string }[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [boardExpanded, setBoardExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [sending, setSending] = useState(false)
  const [resolvingLine, setResolvingLine] = useState('')
  const [chatError, setChatError] = useState('')
  const [pendingChips, setPendingChips] = useState<{ label: string; action: string; value: any }[] | null>(null)
  const [pendingRevenue, setPendingRevenue] = useState<{ type: string; label: string; url: string } | null>(null)
  const [venuesByMessageId, setVenuesByMessageId] = useState<Record<string, VenueSuggestion[]>>({})
  const [confirmingVenueId, setConfirmingVenueId] = useState<string | null>(null)
  const sendingRef = useRef(false)
  const [chatPlaceholder] = useState(() => getRandom(PLANNING_CHAT_PLACEHOLDER))
  const listRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<HTMLDivElement>(null)
  const billRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const livePromptedRef = useRef(false)
  const welcomeStartedRef = useRef<string | null>(null)

  const [sheet, setSheet] = useState<null | 'plus' | 'moment' | 'bill' | 'carpool' | 'edit'>(null)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
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
  const [remindingId, setRemindingId] = useState<string | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editScheduledFor, setEditScheduledFor] = useState<Date | null>(null)
  const [editVenueName, setEditVenueName] = useState('')
  const [editVenueAddress, setEditVenueAddress] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [joiningCall, setJoiningCall] = useState(false)
  const [showDailyCall, setShowDailyCall] = useState(false)
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  const knotId = (hangout?.knot_id || knotIdProp) as string | undefined
  const phase = hangoutPhase(hangout)
  const isCreator = hangout?.created_by === currentUser?.id
  const myRsvp = rsvps.find((r: any) => r.user_id === currentUser?.id)
  const myRsvpStatus = myRsvp?.status || null
  const goingCount = rsvps.filter((r: any) => r.status === 'yes').length
  const isVenuePoll = options.some((o: any) => o.venue_name || o.is_none_of_these)
  const isTreasurer = roles.includes('treasurer')
  const checkedIn = messages.some(m => m.author_id === currentUser?.id && m.content === HERE_MESSAGE)
  const showRsvpPills = (phase === 'planning' || phase === 'confirmed') && myRsvpStatus !== 'yes'
  const dateChipLabel = hangout?.scheduled_for
    ? new Date(hangout.scheduled_for).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : CHIP_WHEN_DATE
  const timeChipLabel = hangout?.scheduled_for
    ? new Date(hangout.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : CHIP_WHEN
  const venueChipLabel = hangout?.venue_name || CHIP_WHERE
  const stateCopy = CARD_STATE_COPY[hangout ? cardStateKey(hangout) : 'voting'] || CARD_STATE_COPY.voting
  const planIcon = activityIcon(hangout)

  function scrollThreadToBottom() {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
  }

  const loadHangout = useCallback(async () => {
    const { data } = await supabase.from('hangouts').select('*, profiles:created_by(name)').eq('id', hangoutId).maybeSingle()
    if (!data) { setLoading(false); return }
    setHangout(data)

    const [{ data: memberRows }, { data: rsvpRows }, { data: billRows }, { data: optionRows }, { data: pollRows }, { data: photoRows }, { data: roleRows }] = await Promise.all([
      supabase.from('knot_members').select('user_id, profiles:user_id(id, name, avatar_url, username, dietary_restrictions, accessibility_needs)').eq('knot_id', data.knot_id),
      supabase.from('hangout_rsvps').select('*, profiles:user_id(name, username, avatar_url)').eq('hangout_id', hangoutId),
      supabase.from('bills').select('*, bill_splits(*, profiles:user_id(name))').eq('hangout_id', hangoutId),
      supabase.from('hangout_options').select('*').eq('hangout_id', hangoutId),
      supabase.from('availability_polls').select('*').eq('hangout_id', hangoutId).eq('status', 'open'),
      supabase.from('photos').select('id, storage_path, media_type').eq('hangout_id', hangoutId).order('created_at', { ascending: false }).limit(24),
      supabase.from('hangout_member_roles').select('role').eq('hangout_id', hangoutId).eq('user_id', currentUser?.id || ''),
    ])

    setMembers((memberRows || []).map((m: any) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      return {
        id: m.user_id,
        name: profile?.name || 'Unknown',
        avatar_url: profile?.avatar_url || null,
        username: profile?.username || null,
        dietary_restrictions: profile?.dietary_restrictions || [],
        accessibility_needs: profile?.accessibility_needs || [],
      }
    }))
    setRsvps(rsvpRows || [])
    setBills(billRows || [])
    setOptions(optionRows || [])
    setPoll(pollRows?.[0] || null)
    setRoles((roleRows || []).map((r: any) => r.role))
    const withUrls = await Promise.all((photoRows || []).map(async (p: any) => {
      const url = await getSignedUrl(p.storage_path)
      return { id: p.id, url: url ?? '', media_type: p.media_type ?? 'image' }
    }))
    setPhotos(withUrls.filter(p => p.url))
    setLoading(false)
  }, [hangoutId, currentUser?.id])

  const loadMessages = useCallback(async () => {
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
    if (scrollToBottom) scrollThreadToBottom()
    if (currentUser?.id) {
      await supabase.from('hangout_message_reads').upsert(
        { hangout_id: hangoutId, user_id: currentUser.id, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,hangout_id' }
      )
    }
    return withUrls
  }, [hangoutId, currentUser?.id, scrollToBottom])

  const attachVenueSuggestions = useCallback((freshMessages: ThreadMessage[], venues: VenueSuggestion[] | null | undefined) => {
    if (!venues || venues.length === 0) return
    const lastAgentMessage = [...freshMessages].reverse().find(m => agentId && m.author_id === agentId)
    if (!lastAgentMessage) return
    setVenuesByMessageId(prev => ({ ...prev, [lastAgentMessage.id]: venues }))
  }, [agentId])

  const appendMessage = useCallback(async (raw: any) => {
    let photo_url: string | undefined
    if (raw.photo_path) photo_url = (await getSignedUrl(raw.photo_path)) ?? ''
    setMessages(prev => {
      if (prev.some(m => m.id === raw.id)) return prev
      return [...prev, { ...raw, photo_url }]
    })
    if (scrollToBottom) scrollThreadToBottom()
  }, [scrollToBottom])

  const ensureAndJoinCall = useCallback(async () => {
    if (joiningCall || !hangout) return
    setJoiningCall(true)
    setActionError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setActionError(ERROR_SIGN_IN_FOR_CALL); setJoiningCall(false); return }
      const res = await fetch('/api/daily/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ hangoutId: hangout.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { setActionError(data.error || ERROR_START_CALL); setJoiningCall(false); return }
      if (data.url !== hangout.meeting_url) {
        await supabase.from('hangouts').update({ meeting_url: data.url }).eq('id', hangout.id)
        setHangout((h: any) => ({ ...h, meeting_url: data.url }))
      }
      setCallRoomUrl(data.url)
      setShowDailyCall(true)
    } catch {
      setActionError(ERROR_START_CALL)
    } finally {
      setJoiningCall(false)
    }
  }, [joiningCall, hangout])

  useEffect(() => { loadHangout() }, [loadHangout])

  useEffect(() => {
    let cancelled = false
    loadMessages()
    const channel = supabase
      .channel(`chat-view:${hangoutId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hangout_messages', filter: `hangout_id=eq.${hangoutId}` }, payload => {
        if (!cancelled) appendMessage(payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangouts', filter: `id=eq.${hangoutId}` }, () => { if (!cancelled) loadHangout() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangout_rsvps' }, () => { if (!cancelled) loadHangout() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => { if (!cancelled) loadHangout() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bill_splits' }, () => { if (!cancelled) loadHangout() })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [hangoutId, loadMessages, appendMessage, loadHangout])

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  useEffect(() => {
    if (loading || loadingMessages) return
    if (scrollTarget === 'poll' && pollRef.current) {
      setBoardExpanded(true)
      pollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    if (scrollTarget === 'bill' && billRef.current) {
      billRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, loadingMessages, scrollTarget, poll?.id, bills.length])

  const autoJoinStartedRef = useRef(false)
  useEffect(() => {
    autoJoinStartedRef.current = false
  }, [hangoutId])

  useEffect(() => {
    if (!autoJoinCall || loading || !hangout || autoJoinStartedRef.current) return
    if (phase !== 'confirmed' && phase !== 'live') return
    autoJoinStartedRef.current = true
    ensureAndJoinCall()
  }, [autoJoinCall, loading, hangout, phase, ensureAndJoinCall])

  useEffect(() => {
    if (phase !== 'live' || !agentId || loadingMessages || livePromptedRef.current) return
    const hasPhoto = messages.some(m => m.author_id === agentId && m.content === LIVE_PHOTO_PROMPT)
    const hasReceipt = messages.some(m => m.author_id === agentId && m.content === LIVE_RECEIPT_PROMPT)
    livePromptedRef.current = true
    ;(async () => {
      if (!hasPhoto) await supabase.from('hangout_messages').insert({ hangout_id: hangoutId, author_id: agentId, content: LIVE_PHOTO_PROMPT })
      if (!hasReceipt) await supabase.from('hangout_messages').insert({ hangout_id: hangoutId, author_id: agentId, content: LIVE_RECEIPT_PROMPT })
    })()
  }, [phase, agentId, hangoutId, loadingMessages, messages])

  useEffect(() => {
    welcomeStartedRef.current = null
  }, [hangoutId])

  useEffect(() => {
    if (!hangout || loading || loadingMessages) return
    if (messages.length > 0) return
    if (welcomeStartedRef.current === hangout.id) return
    if (!currentUser?.id) return
    welcomeStartedRef.current = hangout.id
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        welcomeStartedRef.current = null
        return
      }
      try {
        const res = await fetch('/api/planning-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            message: '__init__',
            hangout_id: hangout.id,
            knot_id: hangout.knot_id,
            sender_id: currentUser.id,
            current_plan_state: {
              title: hangout.title,
              planning_status: hangout.planning_status,
              scheduled_for: hangout.scheduled_for,
              venue_name: hangout.venue_name,
            },
          }),
        })
        const data = await res.json()
        const freshMessages = await loadMessages()
        setPendingChips(data.chips ?? null)
        attachVenueSuggestions(freshMessages, data.venue_suggestions)
      } catch {
        welcomeStartedRef.current = null
      }
    })()
  }, [hangout, loading, loadingMessages, messages.length, currentUser?.id, loadMessages, attachVenueSuggestions])

  async function sendChat(overrideText?: string) {
    const text = (overrideText ?? chatInput).trim()
    if (!text || sendingRef.current || resolving || sending || !knotId || !currentUser?.id) return
    sendingRef.current = true
    setSending(true)
    try {
      setChatError('')
      setPendingChips(null)
      setPendingRevenue(null)

      const { error: msgError } = await supabase
        .from('hangout_messages')
        .insert({ hangout_id: hangoutId, author_id: currentUser.id, content: text })
      if (msgError) {
        toast.error(TOAST_ERROR)
        return
      }
      setChatInput('')

      setResolving(true)
      setResolvingLine(getRandomTagged(AGENT_RESOLVING_STATES))
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setChatError(CHAT_ERROR_SIGN_IN); return }
        const res = await fetch('/api/planning-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({
            message: text,
            hangout_id: hangoutId,
            knot_id: knotId,
            current_plan_state: hangout ? {
              title: hangout.title,
              venue_name: hangout.venue_name,
              scheduled_for: hangout.scheduled_for,
              status: hangout.status,
            } : null,
          }),
        })
        const data = await res.json()
        await loadHangout()
        const freshMessages = await loadMessages()
        setPendingChips(data.chips ?? null)
        setPendingRevenue(data.revenue_suggestion ?? null)
        attachVenueSuggestions(freshMessages, data.venue_suggestions)
      } catch {
        setChatError(CHAT_ERROR_PLANNER)
      } finally {
        setResolving(false)
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  async function rsvp(status: string) {
    if (!currentUser) return
    setActionError('')
    const { error } = await supabase.from('hangout_rsvps').upsert(
      { hangout_id: hangoutId, user_id: currentUser.id, status },
      { onConflict: 'hangout_id,user_id' }
    )
    if (error) { setActionError(ERROR_UPDATE_RSVP); return }
    track(supabase, 'hangout_rsvp', { hangout_id: hangoutId, status })
    await loadHangout()
    onChanged?.()
  }

  async function lockPlan() {
    if (!hangout || pendingAction || !currentUser?.id) return
    if (!hangout.title?.trim() || hangout.title === PLAN_UNTITLED) {
      await supabase.from('hangout_messages').insert({ hangout_id: hangoutId, author_id: agentId, content: AGENT_TITLE_PROMPT })
      return
    }
    setPendingAction('lock')
    let postId = hangout.post_id
    if (!postId) {
      const { data: newPost, error: postError } = await supabase
        .from('posts')
        .insert({ knot_id: hangout.knot_id, hangout_id: hangout.id, author_id: currentUser.id, content: 'locked in a plan', post_type: 'hangout' })
        .select('id')
        .single()
      if (postError || !newPost) { toast.error(TOAST_ERROR); setPendingAction(null); return }
      postId = newPost.id
    }
    const { error } = await supabase.from('hangouts').update({ post_id: postId, planning_status: 'locked', status: 'confirmed' }).eq('id', hangout.id)
    setPendingAction(null)
    if (error) { toast.error(TOAST_ERROR); return }
    toast.success(TOAST_HANGOUT_CONFIRMED)
    await loadHangout()
    onChanged?.()
  }

  async function goLive() {
    if (!currentUser) return
    setActionError('')
    const actorName = currentUser.name || 'Someone'
    const { error } = await supabase.from('hangouts').update({ status: 'live', is_live: true }).eq('id', hangout.id)
    if (error) { setActionError(ERROR_GO_LIVE); return }
    await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser.id, content: `${actorName} is at ${hangout.venue_name || hangout.title} \u2014 the night is on!`, post_type: 'moment' })
    await loadHangout()
    onChanged?.()
  }

  async function checkIn() {
    if (!currentUser?.id || checkedIn) return
    await supabase.from('hangout_messages').insert({ hangout_id: hangoutId, author_id: currentUser.id, content: HERE_MESSAGE })
  }

  async function cancelHangout() {
    if (!currentUser || hangout.created_by !== currentUser.id) return
    if (!confirm(CONFIRM_CANCEL_HANGOUT)) return
    setPendingAction('cancel')
    const { error } = await supabase.from('hangouts').update({ status: 'cancelled', is_live: false, planning_status: 'abandoned' }).eq('id', hangout.id).eq('created_by', currentUser.id)
    setPendingAction(null)
    setMenuOpen(false)
    if (error) { toast.error(ERROR_CANCEL_HANGOUT); return }
    await loadHangout()
    onChanged?.()
  }

  async function saveEditHangout() {
    if (!currentUser || hangout.created_by !== currentUser.id || editSaving) return
    setEditSaving(true)
    const updates = {
      title: editTitle.trim() || hangout.title,
      scheduled_for: editScheduledFor ? editScheduledFor.toISOString() : null,
      venue_name: editVenueName.trim() || null,
      venue_address: editVenueAddress.trim() || null,
    }
    const { error } = await supabase.from('hangouts').update(updates).eq('id', hangout.id).eq('created_by', currentUser.id)
    setEditSaving(false)
    if (error) { toast.error(ERROR_UPDATE_HANGOUT); return }
    setSheet(null)
    await loadHangout()
    onChanged?.()
  }

  async function shareInvite() {
    setMenuOpen(false)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = hangout.standalone_token ? `${origin}/event/${hangout.standalone_token}` : `${origin}/dashboard`
    try {
      await navigator.clipboard.writeText(link)
      toast.success(TOAST_INVITE_COPIED)
    } catch {
      toast.error(TOAST_INVITE_COPY_FAILED)
    }
  }

  async function confirmVenue(venue: VenueSuggestion, triggerMessageId: string) {
    if (!hangout?.id || confirmingVenueId) return
    setConfirmingVenueId(venue.place_id)
    const currentTitle = hangout.title?.trim()
    const shouldSetTitle = !currentTitle || currentTitle === PLAN_UNTITLED
    const wasDateOpen = !hangout.scheduled_for
    const { error } = await supabase.from('hangouts').update({
      venue_name: venue.name,
      venue_address: venue.formatted_address,
      venue_place_id: venue.place_id,
      ...(shouldSetTitle ? { title: venue.name } : {}),
    }).eq('id', hangout.id)
    setConfirmingVenueId(null)
    if (error) { toast.error(TOAST_ERROR); return }
    setVenuesByMessageId(prev => {
      const next = { ...prev }
      delete next[triggerMessageId]
      return next
    })
    await supabase.from('hangout_messages').insert({
      hangout_id: hangout.id,
      author_id: agentId,
      content: `${getRandom(AGENT_MESSAGES.VENUE_CONFIRMED)} ${venue.name} locked in.`,
    })
    if (wasDateOpen) {
      await supabase.from('hangout_messages').insert({ hangout_id: hangout.id, author_id: agentId, content: AGENT_WHEN_PROMPT })
      setPendingChips([
        { label: CHIP_WHEN_TODAY, action: 'when', value: 'today' },
        { label: CHIP_WHEN_FRIDAY, action: 'when', value: 'friday' },
        { label: CHIP_WHEN_WEEKEND, action: 'when', value: 'weekend' },
      ])
    }
    await loadHangout()
    await loadMessages()
  }

  async function tapChip(chip: { label: string; action?: string; value?: any }) {
    setPendingChips(null)
    setPendingRevenue(null)
    if (chip.action === 'camera') {
      setSheet('moment')
      photoInputRef.current?.click()
      return
    }
    if (chip.action === 'lock') {
      await lockPlan()
      return
    }
    await sendChat(chip.label)
  }

  function revenueChipLabel(type: string): string {
    if (type === 'opentable') return getRandom(AGENT_MESSAGES.REVENUE_RESTAURANT)
    if (type === 'uber' || type === 'lyft') return getRandom(AGENT_MESSAGES.REVENUE_TRANSPORT)
    if (type === 'mixtiles') return getRandom(AGENT_MESSAGES.REVENUE_PRINTS)
    return ''
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

    let chatPhotoPath: string | null = null
    if (momentPhoto) {
      const compressed = await compressImage(momentPhoto)
      const ext = compressed.name.split('.').pop()
      chatPhotoPath = `threads/${hangoutId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(chatPhotoPath, compressed)
      if (uploadError) { setMomentPosting(false); return }
    }

    const { data: newPost, error: postError } = await supabase.from('posts').insert({
      knot_id: knotId, author_id: user.id, content: momentText.trim() || null, post_type: 'moment', hangout_id: hangoutId,
    }).select().single()
    if (!postError && newPost && chatPhotoPath) {
      await supabase.from('photos').insert({
        knot_id: knotId, post_id: newPost.id, hangout_id: hangoutId, uploaded_by: user.id,
        storage_path: chatPhotoPath, file_name: momentPhoto!.name, file_size: momentPhoto!.size, media_type: 'image',
      })
    }
    if (chatPhotoPath) {
      await supabase.from('hangout_messages').insert({
        hangout_id: hangoutId,
        author_id: user.id,
        content: momentText.trim() || null,
        photo_path: chatPhotoPath,
      })
      await loadMessages()
    }
    setMomentPosting(false)
    setMomentText('')
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setSheet(null)
    await loadHangout()
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
    if (isNaN(amount) || amount <= 0) { setBillError(ERROR_BILL_AMOUNT); return }
    const splitIds = billSelectedIds.size > 0 ? Array.from(billSelectedIds) : members.map(m => m.id)
    setBillPosting(true)
    setBillError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBillPosting(false); return }
    const share = amount / splitIds.length
    const { data: bill, error } = await supabase.from('bills').insert({
      knot_id: knotId, hangout_id: hangoutId, added_by: user.id, total_amount: amount, description: billDesc.trim(), split_type: 'equal',
    }).select().single()
    if (error || !bill) { setBillError(ERROR_ADD_BILL); setBillPosting(false); return }
    await supabase.from('bill_splits').insert(
      splitIds.map((uid: string) => ({ bill_id: bill.id, user_id: uid, amount: parseFloat(share.toFixed(2)), settled: uid === user.id }))
    )
    setBillPosting(false)
    setBillDesc('')
    setBillAmount('')
    setBillSelectedIds(new Set())
    setSheet(null)
    await loadHangout()
    onChanged?.()
  }

  async function markSplitSettled(splitId: string) {
    const { error } = await supabase.from('bill_splits').update({ settled: true, settled_at: new Date().toISOString() }).eq('id', splitId)
    if (error) { toast.error(ERROR_MARK_PAID); return }
    await loadHangout()
  }

  async function remindSplit(split: any) {
    if (!currentUser?.id || remindingId) return
    const lastRaw = split.last_reminded_at || split.reminder_sent_at
    const last = lastRaw ? new Date(lastRaw).getTime() : 0
    if (last && Date.now() - last < DAY_MS) {
      toast.success(TOAST_ALREADY_NUDGED)
      return
    }
    setRemindingId(split.id)
    const now = new Date().toISOString()
    let { error } = await supabase.from('bill_splits').update({ last_reminded_at: now }).eq('id', split.id)
    if (error) {
      const retry = await supabase.from('bill_splits').update({ reminder_sent_at: now }).eq('id', split.id)
      error = retry.error
    }
    if (error) { toast.error(ERROR_SEND_REMINDER); setRemindingId(null); return }
    const creditorName = currentUser.name || 'a friend'
    const amount = parseFloat(split.amount).toFixed(2)
    const title = hangout.title || hangout.venue_name || 'this hangout'
    await createNotification(supabase, {
      userId: split.user_id,
      knotId,
      type: 'bill_reminder',
      actorId: currentUser.id,
      entityId: split.id,
      message: `You owe ${creditorName} $${amount} from ${title}. Settle up in Knot.`,
    })
    if (agentId) {
      await supabase.from('hangout_messages').insert({
        hangout_id: hangoutId,
        author_id: agentId,
        content: getRandom(AGENT_MESSAGES.BILL_REMINDER),
      })
    }
    setRemindingId(null)
    await loadHangout()
    await loadMessages()
  }

  async function submitRating(value: number) {
    if (ratingSubmitted || !currentUser?.id || !knotId) return
    setRating(value)
    const scheduledAt = hangout.scheduled_for ? new Date(hangout.scheduled_for) : new Date()
    await supabase.from('hangout_signals').upsert({
      hangout_id: hangout.id,
      user_id: currentUser.id,
      knot_id: knotId,
      rating: value,
      venue_name: hangout.venue_name ?? hangout.title ?? null,
      venue_place_id: hangout.venue_place_id ?? null,
      group_size: goingCount,
      scheduled_at: scheduledAt.toISOString(),
      day_of_week: scheduledAt.getDay(),
      hour_of_day: scheduledAt.getHours(),
    }, { onConflict: 'hangout_id,user_id' })
    setRatingSubmitted(true)
  }

  async function handlePollDateSelected(date: string, time: string | null) {
    const scheduledIso = new Date(time ? `${date}T${time}` : `${date}T00:00:00`).toISOString()
    await supabase.from('hangouts').update({ scheduled_for: scheduledIso, status: 'confirmed', planning_status: 'locked' }).eq('id', hangout.id)
    if (poll) await supabase.from('availability_polls').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', poll.id)
    toast.success(TOAST_DATE_CONFIRMED)
    await loadHangout()
  }

  const totalSpend = useMemo(() => bills.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0), [bills])
  const durationLabel = useMemo(() => {
    if (!hangout?.scheduled_for || !hangout?.ended_at) return null
    const ms = new Date(hangout.ended_at).getTime() - new Date(hangout.scheduled_for).getTime()
    if (ms <= 0) return null
    const hours = Math.round(ms / 3600000)
    return hours <= 1 ? 'About an hour' : `${hours} hours`
  }, [hangout])

  const unsettled = bills.flatMap((b: any) => (b.bill_splits || []).filter((s: any) => !s.settled).map((s: any) => ({ ...s, bill: b })))

  if (loading || !hangout) {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', background: '#F5F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
        {CHAT_LOADING}
      </div>
    )
  }

  const title = hangout.title || hangout.venue_name || PLAN_UNTITLED

  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', background: '#F5F3EE', display: 'flex', flexDirection: 'column', fontFamily: 'Manrope, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))', borderBottom: '1px solid var(--border)', background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', flexShrink: 0 }}>
        <button type="button" onClick={onClose} aria-label="Back" style={{ width: 36, height: 36, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
          <i className="ti ti-arrow-left" style={{ fontSize: ICON_SIZE.header, color: 'var(--text)' }} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button type="button" aria-label="Hangout menu" onClick={() => setMenuOpen(v => !v)}
            style={{ width: 36, height: 36, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
            <i className="ti ti-dots" style={{ fontSize: ICON_SIZE.card, color: 'var(--text3)' }} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 180, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
              {isCreator && (
                <button type="button" onClick={() => { setMenuOpen(false); setEditTitle(hangout.title || ''); setEditScheduledFor(hangout.scheduled_for ? new Date(hangout.scheduled_for) : null); setEditVenueName(hangout.venue_name || ''); setEditVenueAddress(hangout.venue_address || ''); setSheet('edit') }}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {MENU_EDIT_HANGOUT}
                </button>
              )}
              {isCreator && phase !== 'ended' && phase !== 'cancelled' && (
                <button type="button" onClick={cancelHangout}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--danger)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {MENU_CANCEL_HANGOUT}
                </button>
              )}
              {(phase === 'confirmed' || phase === 'live') && (
                <button type="button" onClick={() => { setMenuOpen(false); ensureAndJoinCall() }} disabled={joiningCall}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: joiningCall ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {joiningCall ? MENU_JOIN_CALL_STARTING : MENU_JOIN_CALL}
                </button>
              )}
              <button type="button" onClick={shareInvite}
                style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                {MENU_SHARE_INVITE}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div onClick={() => setBoardExpanded(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', background: 'rgba(248,189,3,0.06)', borderBottom: '1px solid rgba(248,189,3,0.18)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(248,189,3,0.12)', border: '1px solid rgba(248,189,3,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className={`ti ${planIcon}`} style={{ fontSize: 20, color: '#b38c00' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {phase === 'live' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{STATE_LIVE}</span>
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#b38c00', fontWeight: 600, marginTop: 2 }}>{stateCopy.subtitle}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={fieldChipStyle(!!hangout.scheduled_for)}>
                <i className="ti ti-calendar" style={{ fontSize: 11 }} /> {dateChipLabel}
              </span>
              <span style={fieldChipStyle(!!hangout.scheduled_for)}>
                <i className="ti ti-clock" style={{ fontSize: 11 }} /> {timeChipLabel}
              </span>
              <span style={fieldChipStyle(!!hangout.venue_name)}>
                <i className="ti ti-map-pin" style={{ fontSize: 11 }} /> {venueChipLabel}
              </span>
            </div>
          </div>
          {isCreator && (
            <button type="button" onClick={e => { e.stopPropagation(); setShowCoverPicker(true) }} aria-label="Change cover photo"
              style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <i className="ti ti-camera" style={{ fontSize: 13, color: 'var(--text3)' }} />
            </button>
          )}
          <i className="ti ti-chevron-down" style={{ fontSize: 14, color: '#b38c00', flexShrink: 0 }} />
        </div>
        {boardExpanded && (
          <>
          {hangout.cover_image_url && (
            <div style={{ position: 'relative', width: '100%', height: 200 }}>
              <img src={hangout.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {isCreator && (
                <button type="button" onClick={() => setShowCoverPicker(true)} aria-label="Change cover photo"
                  style={{ position: 'absolute', bottom: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <i className="ti ti-camera" style={{ fontSize: ICON_SIZE.card, color: '#fff' }} />
                </button>
              )}
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--border)', padding: 16, maxHeight: 360, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{hangout.brief || ''}</div>
            {hangout.venue_address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
                <i className="ti ti-map-pin" style={{ fontSize: 13, color: 'var(--text3)' }} />
                {hangout.venue_address}
              </div>
            )}
            {phase === 'planning' && isCreator && (
              <button type="button" onClick={lockPlan} disabled={!!pendingAction}
                style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: pendingAction ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {CTA_CONFIRM}
              </button>
            )}
            {phase === 'confirmed' && isCreator && (
              <button type="button" onClick={goLive}
                style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {CTA_WE_ARE_HERE}
              </button>
            )}
            {phase === 'live' && !checkedIn && (
              <button type="button" onClick={checkIn}
                style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {CTA_WE_ARE_HERE}
              </button>
            )}
            {(phase === 'confirmed' || phase === 'live') && (
              <button type="button" onClick={ensureAndJoinCall} disabled={joiningCall}
                style={{ padding: '8px 14px', marginLeft: 8, background: 'var(--sage-soft)', border: 'none', borderRadius: 8, color: 'var(--sage)', fontSize: 13, fontWeight: 700, cursor: joiningCall ? 'wait' : 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {joiningCall ? MENU_JOIN_CALL_STARTING : MENU_JOIN_CALL}
              </button>
            )}
            {pendingRevenue && (
              <button type="button" onClick={() => window.open(pendingRevenue.url, '_blank', 'noopener,noreferrer')}
                style={{ display: 'block', padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(248,189,3,0.4)', background: '#FFFBEE', color: '#8a6500', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
                {revenueChipLabel(pendingRevenue.type)}
              </button>
            )}
            <div ref={pollRef}>
              {poll && knotId && (
                <AvailabilityPoll pollId={poll.id} knotId={knotId} currentUser={currentUser} members={members} onDateSelected={handlePollDateSelected} />
              )}
              {phase === 'planning' && isVenuePoll && (
                <VenuePoll hangoutId={hangout.id} options={options} currentUser={currentUser} isCreator={isCreator} members={members} onRefresh={loadHangout} />
              )}
            </div>
            {phase !== 'cancelled' && bills.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Bills · ${totalSpend.toFixed(2)} total</div>
                {unsettled.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--sage)' }}>{BILL_ALL_SETTLED}</div>
                ) : unsettled.map((s: any) => {
                  const canRemind = (isTreasurer || s.bill?.added_by === currentUser?.id) && s.user_id !== currentUser?.id
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>{s.profiles?.name || 'Someone'} owes ${parseFloat(s.amount).toFixed(2)}</span>
                      {canRemind && (
                        <button type="button" disabled={remindingId === s.id} onClick={() => remindSplit(s)}
                          style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: remindingId === s.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                          {BILL_REMIND}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {actionError && <div className="error-banner" style={{ margin: '8px 16px 0' }}>{actionError}</div>}

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, background: '#fff' }}>
        {loadingMessages ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>{CHAT_LOADING}</div>
        ) : messages.length === 0 && phase === 'planning' ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '40px 20px' }}>{CHAT_EMPTY}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => {
              const isAgent = !!(agentId && m.author_id === agentId)
              const isMine = m.author_id === currentUser?.id
              const name = isAgent ? 'Knot' : (isMine ? (currentUser?.name || 'You') : (members.find(mm => mm.id === m.author_id)?.name || 'Someone'))
              const avatarUrl = isAgent ? null : (isMine ? (currentUser?.avatar_url || null) : (members.find(mm => mm.id === m.author_id)?.avatar_url || null))
              const venueOptions = venuesByMessageId[m.id]
              const showDateDivider = i > 0 && (new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime()) > HOUR_MS
              return (
                <div key={m.id} style={{ display: 'contents' }}>
                  {showDateDivider && (
                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', margin: '4px 0' }}>{dateDividerLabel(m.created_at)}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                    {isAgent ? (
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#FFFBEE', border: '1px solid rgba(248,189,3,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <KnotMark size={14} />
                      </div>
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--text)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                      {!isMine && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 2 }}>{name}</span>}
                      <div style={{
                        padding: m.photo_url ? 4 : '8px 12px', borderRadius: 12,
                        background: isAgent ? '#FFFBEE' : (isMine ? '#111' : '#fff'),
                        border: isAgent ? '1px solid rgba(248,189,3,0.25)' : (isMine ? 'none' : '0.5px solid rgba(0,0,0,0.08)'),
                        color: isAgent ? '#111' : (isMine ? '#fff' : 'var(--text)'),
                      }}>
                        {m.photo_url && <img src={m.photo_url} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginBottom: m.content ? 6 : 0 }} />}
                        {m.content && (
                          <span style={{ fontSize: 13, lineHeight: 1.4, color: isAgent ? '#111' : (isMine ? '#fff' : 'var(--text)'), whiteSpace: 'pre-wrap', padding: m.photo_url ? '0 6px 4px' : 0, display: 'block' }}>{m.content}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(m.created_at)}</span>
                    </div>
                  </div>
                  {venueOptions && venueOptions.length > 0 && !resolving && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginLeft: 36 }}>
                      {venueOptions.map(v => {
                        const busy = confirmingVenueId === v.place_id
                        return (
                          <button key={v.place_id} type="button" onClick={() => confirmVenue(v, m.id)} disabled={busy}
                            style={{ flexShrink: 0, width: 140, textAlign: 'left', background: '#fff', border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', padding: 0, opacity: busy ? 0.6 : 1 }}>
                            <div style={{ width: '100%', height: 80, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {v.photo_url ? (
                                <img src={v.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              ) : (
                                <i className="ti ti-building-store" style={{ fontSize: 22, color: 'var(--text3)' }} />
                              )}
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{v.formatted_address}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                {v.rating != null && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--text2)' }}>
                                    <i className="ti ti-star-filled" style={{ fontSize: 10, color: 'var(--yellow)' }} /> {v.rating}
                                  </span>
                                )}
                                {v.open_now != null && (
                                  <span style={{ fontSize: 10, color: v.open_now ? 'var(--sage)' : 'var(--danger)' }}>
                                    {v.open_now ? VENUE_OPEN_NOW : VENUE_CLOSED}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {phase !== 'cancelled' && bills.length > 0 && (
              <div ref={billRef} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--bg3)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Bills · ${totalSpend.toFixed(2)}</div>
                {bills.map((b: any) => (
                  <div key={b.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{b.description}</div>
                    {(b.bill_splits || []).map((s: any) => {
                      const canRemind = !s.settled && (isTreasurer || b.added_by === currentUser?.id) && s.user_id !== currentUser?.id
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 0' }}>
                          <span style={{ fontSize: 12, color: 'var(--text)' }}>{s.profiles?.name || 'Someone'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: s.settled ? 'var(--sage)' : 'var(--text2)' }}>${parseFloat(s.amount).toFixed(2)}</span>
                            {!s.settled && s.user_id === currentUser?.id && (
                              <button type="button" onClick={() => markSplitSettled(s.id)}
                                style={{ padding: '3px 8px', background: 'var(--yellow)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                {BILL_SETTLE_UP}
                              </button>
                            )}
                            {canRemind && (
                              <button type="button" disabled={remindingId === s.id} onClick={() => remindSplit(s)}
                                style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: remindingId === s.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                                {BILL_REMIND}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
                {phase === 'ended' && unsettled.length > 0 && (
                  <button type="button" onClick={() => window.open('https://www.mixtiles.com', '_blank', 'noopener,noreferrer')}
                    style={{ marginTop: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(248,189,3,0.4)', background: '#FFFBEE', color: '#8a6500', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {getRandom(AGENT_MESSAGES.REVENUE_PRINTS)}
                  </button>
                )}
              </div>
            )}

            {phase === 'ended' && hangout.venue_name && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Rate {hangout.venue_name}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" disabled={ratingSubmitted} onClick={() => submitRating(n)}
                      style={{ background: 'none', border: 'none', cursor: ratingSubmitted ? 'default' : 'pointer', padding: 0, fontFamily: 'inherit' }}>
                      <i className={n <= (rating || 0) ? 'ti ti-star-filled' : 'ti ti-star'} style={{ fontSize: ICON_SIZE.nav, color: n <= (rating || 0) ? 'var(--yellow)' : 'var(--text3)' }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === 'ended' && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{MEMORIES_TITLE}</div>
                {photos.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 10 }}>
                    {photos.map(p => (
                      <div key={p.id} style={{ aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#000' }}>
                        {p.media_type === 'video' ? (
                          <video src={p.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{MEMORIES_EMPTY}</div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {goingCount} attendee{goingCount === 1 ? '' : 's'}
                  {hangout.venue_name ? ` · ${hangout.venue_name}` : ''}
                  {durationLabel ? ` · ${durationLabel}` : ''}
                  {totalSpend > 0 ? ` · $${totalSpend.toFixed(2)}` : ''}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(pendingChips || pendingRevenue) && !resolving && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px 10px', background: '#fff' }}>
          {(pendingChips || []).slice(0, 3).map(chip => (
            <button key={chip.label} type="button" onClick={() => tapChip(chip)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(248,189,3,0.4)', background: '#FFFBEE', color: '#8a6500', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {chip.label}
            </button>
          ))}
          {pendingRevenue && (
            <button type="button" onClick={() => window.open(pendingRevenue.url, '_blank', 'noopener,noreferrer')}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(248,189,3,0.4)', background: '#FFFBEE', color: '#8a6500', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {revenueChipLabel(pendingRevenue.type)}
            </button>
          )}
        </div>
      )}

      {chatError && <div className="error-banner" style={{ margin: '0 16px 8px' }}>{chatError}</div>}
      {resolving && <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--text3)', background: '#fff' }}>{resolvingLine}</div>}

      {showRsvpPills && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px', background: '#fff', borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={() => rsvp('yes')}
            style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--yellow)', border: 'none', color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {RSVP_LABEL_GOING}
          </button>
          <button type="button" onClick={() => rsvp('maybe')}
            style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {RSVP_LABEL_MAYBE}
          </button>
          <button type="button" onClick={() => rsvp('no')}
            style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {RSVP_LABEL_CANT_GO}
          </button>
        </div>
      )}

      {phase !== 'cancelled' && (
        <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)', padding: '10px 12px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => setSheet('plus')} aria-label="More options"
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
            <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
          </button>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!sending && chatInput.trim()) sendChat()
              }
            }}
            placeholder={chatPlaceholder}
            style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', caretColor: 'var(--yellow)' }}
          />
          <button type="button" onClick={() => { if (chatInput.trim()) sendChat(); else setSheet('moment') }} disabled={resolving || sending}
            style={{ width: 34, height: 34, borderRadius: '50%', background: chatInput.trim() ? 'var(--yellow)' : 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (resolving || sending) ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: (resolving || sending) ? 0.5 : 1 }}
            aria-label="Send">
            {sending
              ? <i className="ti ti-loader-2" style={{ fontSize: ICON_SIZE.nav, color: '#888', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              : <i className="ti ti-send" style={{ fontSize: ICON_SIZE.nav, color: '#111' }} />
            }
          </button>
        </div>
      )}

      {showDailyCall && (callRoomUrl || hangout.meeting_url) && (
        <DailyCall key={callRoomUrl || hangout.meeting_url} roomUrl={callRoomUrl || hangout.meeting_url} onLeave={() => { setShowDailyCall(false); setCallRoomUrl(null) }} />
      )}

      {sheet === 'plus' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 410 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 411, padding: '10px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            <div onClick={() => setSheet('moment')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <i className="ti ti-camera" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{SHEET_PHOTO}</span>
            </div>
            <div onClick={() => setSheet('bill')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <i className="ti ti-receipt" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{SHEET_ADD_BILL}</span>
            </div>
            <div onClick={() => setSheet('carpool')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', cursor: 'pointer' }}>
              <i className="ti ti-car" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{SHEET_CARPOOL}</span>
            </div>
          </div>
        </>
      )}

      {sheet === 'moment' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 410 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 411, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {momentPhotoPreview && (
              <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 320 }}>
                <img src={momentPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button type="button" onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = '' }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-x" style={{ fontSize: ICON_SIZE.inline, color: '#fff' }} />
                </button>
              </div>
            )}
            <textarea value={momentText} onChange={e => setMomentText(e.target.value)} placeholder={getRandom(COMPOSER_PLACEHOLDER)} rows={3}
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }} />
            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => photoInputRef.current?.click()} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, padding: '9px 14px', cursor: 'pointer' }}>
                {momentPhoto ? SHEET_CHANGE_PHOTO : SHEET_ADD_PHOTO}
              </button>
              <button type="button" onClick={postMoment} disabled={(!momentText.trim() && !momentPhoto) || momentPosting}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!momentText.trim() && !momentPhoto) || momentPosting ? 0.5 : 1 }}>
                {momentPosting ? SHEET_POSTING : SHEET_POST}
              </button>
            </div>
          </div>
        </>
      )}

      {sheet === 'bill' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 410 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 411, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {billError && <div className="error-banner" style={{ marginBottom: 8 }}>{billError}</div>}
            <input value={billDesc} onChange={e => setBillDesc(e.target.value)} placeholder={BILL_DESC_PLACEHOLDER}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
            <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder={BILL_AMOUNT_PLACEHOLDER}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{SHEET_SPLIT_HINT}</div>
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
            <button type="button" onClick={postBill} disabled={!billDesc.trim() || !billAmount || billPosting}
              style={{ width: '100%', padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !billDesc.trim() || !billAmount || billPosting ? 0.5 : 1 }}>
              {billPosting ? SHEET_POSTING : SHEET_POST_BILL}
            </button>
          </div>
        </>
      )}

      {sheet === 'carpool' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 410 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 411, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '4px auto 12px' }} />
            {(hangout.venue_name || hangout.venue_address) ? (
              <>
                <a href={buildUberLink(hangout.venue_name || '', hangout.venue_address || '')} target="_blank" rel="noreferrer"
                  style={{ display: 'block', padding: '12px 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>Uber</a>
                <a href={buildLyftLink(hangout.venue_name || '', hangout.venue_address || '')} target="_blank" rel="noreferrer"
                  style={{ display: 'block', padding: '12px 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>Lyft</a>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 4px' }}>{SHEET_CARPOOL_NO_VENUE}</div>
            )}
          </div>
        </>
      )}

      {sheet === 'edit' && (
        <>
          <div onClick={() => setSheet(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 410 }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 32px rgba(0,0,0,0.18)', zIndex: 411, padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxWidth: 480, margin: '0 auto', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{SHEET_EDIT_TITLE}</div>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder={SHEET_EDIT_TITLE_PLACEHOLDER}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }} />
            <input value={editVenueName} onChange={e => setEditVenueName(e.target.value)} placeholder={SHEET_EDIT_VENUE_PLACEHOLDER}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }} />
            <input value={editVenueAddress} onChange={e => setEditVenueAddress(e.target.value)} placeholder={SHEET_EDIT_ADDRESS_PLACEHOLDER}
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{SHEET_EDIT_DATE_LABEL}</div>
              <DateTimePicker value={editScheduledFor} onChange={setEditScheduledFor} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setSheet(null)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{SHEET_CANCEL}</button>
              <button type="button" onClick={saveEditHangout} disabled={editSaving}
                style={{ padding: '8px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: editSaving ? 0.5 : 1 }}>
                {editSaving ? SHEET_SAVING : SHEET_SAVE}
              </button>
            </div>
          </div>
        </>
      )}

      {showCoverPicker && (
        <CoverImagePicker
          hangoutId={hangout.id}
          knotId={knotId as string}
          currentUser={currentUser}
          onClose={() => setShowCoverPicker(false)}
          onSet={url => setHangout((h: any) => ({ ...h, cover_image_url: url }))}
        />
      )}
    </div>
  )
}
