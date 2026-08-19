'use client'
import { useState, useEffect, useRef } from 'react'
import { ImageIcon, MapPin, ChevronDown, Navigation } from 'lucide-react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { compressImage } from '@/lib/compressImage'
import DateTimePicker from '@/components/DateTimePicker'
import BillSplitForm from '@/components/BillSplitForm'
import { CrewSection } from '@/components/CrewSection'
import { PostHangoutLoop } from '@/components/PostHangoutLoop'
import { PreOrderCard } from '@/components/PreOrderCard'
import { DailyCall } from '@/components/DailyCall'
import HangoutThread from '@/components/HangoutThread'
import AvailabilityPoll from '@/components/AvailabilityPoll'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/ToastProvider'
import ReactionBar from '@/components/ReactionBar'
import { type ReactionCount } from '@/lib/reactions'
import {
  commentReactionsSupported,
  loadCommentReactions,
  toggleCommentReactionRemote,
} from '@/lib/commentReactions'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatShowtime(d: string) {
  const date = new Date(d)
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

function formatDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Tonight \u00B7 ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow \u00B7 ${time}`
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` \u00B7 ${time}`
}


function buildUberLink(venueName: string, venueAddress: string) {
  const dest = encodeURIComponent((venueName + ' ' + venueAddress).trim())
  return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[nickname]=${encodeURIComponent(venueName)}&dropoff[formatted_address]=${encodeURIComponent(venueAddress)}`
}

function buildLyftLink(venueName: string, venueAddress: string) {
  const dest = encodeURIComponent(venueAddress || venueName)
  return `https://ride.lyft.com/ridetype?id=lyft&destination=${dest}`
}

function buildOpenTableLink(venueName: string) {
  const q = encodeURIComponent(venueName)
  return `https://www.opentable.com/s?term=${q}`
}

function buildResyLink(venueName: string) {
  const q = encodeURIComponent(venueName)
  return `https://resy.com/cities?query=${q}`
}

function isActivityVenue(category: string | null | undefined) {
  const activityIds = ['10000', '18000', '10032']
  return category ? activityIds.includes(category) : false
}

function buildViatorLink(venueName: string) {
  const q = encodeURIComponent(venueName)
  return `https://www.viator.com/searchResults/all?text=${q}`
}

function buildGetYourGuideLink(venueName: string) {
  const q = encodeURIComponent(venueName)
  return `https://www.getyourguide.com/s/?q=${q}`
}

const BRIEF_BUDGET_LABELS: Record<string, string> = {
  free: 'Free',
  cheap: 'Cheap',
  mid: 'Mid',
  splurge: 'Splurge',
}

const EVENT_RESTRICTION_LABELS: Record<string, string> = {
  'female-only':  'Female only',
  'male-only':    'Male only',
  'adults-only':  'Adults only',
  'kids-welcome': 'Kids welcome',
  'couples-only': 'Couples only',
}

const DIETARY_LABELS: Record<string, string> = {
  vegetarian:     'Vegetarian',
  vegan:          'Vegan',
  halal:          'Halal',
  kosher:         'Kosher',
  'gluten-free':  'Gluten-free',
  'nut allergy':  'Nut allergy',
  'dairy-free':   'Dairy-free',
  other:          'Other',
}

const ACCESSIBILITY_LABELS: Record<string, string> = {
  'wheelchair-access':  'Wheelchair access',
  'step-free-entry':    'Step-free entry',
  'accessible-parking': 'Accessible parking',
  'hearing-loop':       'Hearing loop',
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

type HangoutCardData = {
  hangout: any
  options: any[]
  rsvps: any[]
  comments: any[]
  bills: any[]
  invites: any[]
  poll: any | null
}

type HangoutCardProps = {
  post: any
  data: HangoutCardData
  currentUser: any
  knotId: string
  members: any[]
  onRefresh: () => void
  onToggleReaction?: (emoji: string) => void
}

export default function HangoutCard({ post, data, currentUser, knotId, members, onRefresh, onToggleReaction }: HangoutCardProps) {
  const toast = useToast()
  const [hangout, setHangout]   = useState<any>(data.hangout)
  const [options, setOptions]   = useState<any[]>(data.options ?? [])
  const [rsvps, setRsvps]       = useState<any[]>(data.rsvps ?? [])
  const [comments, setComments] = useState<any[]>(data.comments ?? [])
  const [bills, setBills]       = useState<any[]>(data.bills ?? [])
  const [invites, setInvites]   = useState<any[]>(data.invites ?? [])
  const [poll, setPoll]         = useState<any | null>(data.poll ?? null)
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionCount[]>>({})
  const [commentReactionsEnabled, setCommentReactionsEnabled] = useState(commentReactionsSupported())

  const [newComment, setNewComment]     = useState('')
  const [showComments, setShowComments] = useState((data.comments || []).length > 0)
  const [submitting, setSubmitting]     = useState(false)
  const [actionError, setActionError]   = useState('')

  const [showBill, setShowBill]       = useState(false)
  const [billDesc, setBillDesc]       = useState('')
  const [billAmount, setBillAmount]   = useState('')
  const [billPosting, setBillPosting] = useState(false)

  const [commentPhoto, setCommentPhoto]             = useState<File | null>(null)
  const [commentPhotoPreview, setCommentPhotoPreview] = useState<string | null>(null)
  const [commentLocation, setCommentLocation]       = useState<string>('')
  const [showLocationInput, setShowLocationInput]   = useState(false)
  const [detectingLocation, setDetectingLocation]   = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText]   = useState('')
  const [editCommentSaving, setEditCommentSaving] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)

  const [editingHangout, setEditingHangout] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editScheduledFor, setEditScheduledFor] = useState<Date | null>(null)
  const [editVenueName, setEditVenueName] = useState('')
  const [editVenueAddress, setEditVenueAddress] = useState('')
  const [editHangoutSaving, setEditHangoutSaving] = useState(false)
  const [cancellingHangout, setCancellingHangout] = useState(false)

  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [editBillSubmitting, setEditBillSubmitting] = useState(false)
  const [editBillError, setEditBillError] = useState('')
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null)
  const [memberBriefs, setMemberBriefs] = useState<any[]>([])
  const [myBriefNote, setMyBriefNote] = useState('')
  const [briefSubmitting, setBriefSubmitting] = useState(false)
  const [myBriefId, setMyBriefId] = useState<string | null>(null)
  const [livePhotoPosted, setLivePhotoPosted] = useState(false)
  const [showDailyCall, setShowDailyCall] = useState(false)
  const [showTravelMenu, setShowTravelMenu] = useState(false)
  const [joiningCall, setJoiningCall] = useState(false)
  const [convertingToKnot, setConvertingToKnot] = useState(false)
  const [convertedKnotId, setConvertedKnotId] = useState<string | null>(null)
  const [callRoomUrl, setCallRoomUrl] = useState<string | null>(null)
  const [showThread, setShowThread] = useState(false)
  const [hasUnreadThread, setHasUnreadThread] = useState(false)
  const [showGuestStep, setShowGuestStep] = useState(false)
  const [guestType, setGuestType] = useState<'just_me' | 'plus_one' | 'family'>('just_me')
  const [familyCount, setFamilyCount] = useState(2)
  const [guestDietary, setGuestDietary] = useState<string[]>([])
  const [guestAccessibility, setGuestAccessibility] = useState<string[]>([])

  // Re-sync local state whenever fresh bundle data arrives from the parent
  useEffect(() => {
    setHangout(data.hangout)
    setOptions(data.options ?? [])
    setRsvps(data.rsvps ?? [])
    setComments(data.comments ?? [])
    setBills(data.bills ?? [])
    setInvites(data.invites ?? [])
    setPoll(data.poll ?? null)
    if ((data.comments || []).length > 0) setShowComments(true)
  }, [data])

  useEffect(() => {
    const ids = comments.map(c => c.id).filter(Boolean)
    if (ids.length === 0) { setCommentReactions({}); return }
    let cancelled = false
    async function load() {
      const next = await loadCommentReactions(ids, currentUser?.id)
      if (cancelled) return
      setCommentReactionsEnabled(commentReactionsSupported())
      setCommentReactions(next)
    }
    load()
    return () => { cancelled = true }
  }, [comments, currentUser?.id])

  async function toggleCommentReaction(commentId: string, emoji: string) {
    if (!currentUser?.id) return
    const current = commentReactions[commentId] || []
    const result = await toggleCommentReactionRemote(commentId, emoji, currentUser.id, current)
    setCommentReactionsEnabled(commentReactionsSupported())
    if (!result.ok) {
      setActionError(result.error || 'Could not save reaction.')
      return
    }
    setCommentReactions(prev => ({ ...prev, [commentId]: result.next }))
  }

  useEffect(() => {
    async function fetchBriefs() {
      const { data } = await supabase
        .from('hangout_briefs')
        .select('id, user_id, note, profiles:user_id(name)')
        .eq('hangout_id', hangout.id)
        .order('created_at', { ascending: true })
      if (!data) return
      setMemberBriefs(data)
      const mine = data.find((b: any) => b.user_id === currentUser?.id)
      if (mine) { setMyBriefId(mine.id); setMyBriefNote(mine.note || '') }
    }
    fetchBriefs()
  }, [hangout.id, currentUser?.id])

  useEffect(() => {
    const eligible = hangout.status === 'confirmed' || hangout.is_live
    if (!currentUser?.id || !eligible) return
    let cancelled = false
    async function checkUnread() {
      const [{ data: latest }, { data: read }] = await Promise.all([
        supabase.from('hangout_messages').select('created_at').eq('hangout_id', hangout.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('hangout_message_reads').select('last_read_at').eq('hangout_id', hangout.id).eq('user_id', currentUser.id).limit(1),
      ])
      if (cancelled) return
      const latestAt = latest?.[0]?.created_at
      const readAt = read?.[0]?.last_read_at
      setHasUnreadThread(!!latestAt && (!readAt || new Date(latestAt) > new Date(readAt)))
    }
    checkUnread()
    return () => { cancelled = true }
  }, [hangout.id, hangout.status, hangout.is_live, currentUser?.id])

  const myVoteOptionId = options.find(o => o._myVote)?.id || null
  const myRsvpStatus = rsvps.find(r => r.user_id === currentUser?.id)?.status || null

  async function ensureAndJoinCall() {
    if (joiningCall) return
    setJoiningCall(true)
    setActionError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setActionError('Sign in to join the call.')
        return
      }
      const res = await fetch('/api/daily/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ hangoutId: hangout.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setActionError(data.error || 'Could not start the call room. Try again.')
        return
      }
      if (data.url !== hangout.meeting_url) {
        await supabase.from('hangouts').update({ meeting_url: data.url }).eq('id', hangout.id)
        setHangout((h: any) => ({ ...h, meeting_url: data.url }))
      }
      setCallRoomUrl(data.url)
      setShowDailyCall(true)
    } catch {
      setActionError('Could not start the call room. Try again.')
    } finally {
      setJoiningCall(false)
    }
  }

  async function castVote(optionId: string) {
    if (!currentUser || myVoteOptionId) return
    setActionError('')
    const { error } = await supabase.from('hangout_votes').insert({ hangout_id: post.hangout_id, option_id: optionId, user_id: currentUser.id })
    if (error) { setActionError('Could not cast vote. Try again.'); return }
    setOptions(prev => prev
      .map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1, _myVote: true } : o)
      .sort((a, b) => b.vote_count - a.vote_count))
    onRefresh()
  }

  async function lockPlan() {
    if (!currentUser || hangout?.created_by !== currentUser.id) return
    const winner = options[0]
    if (!winner) return
    setActionError('')
    const { error } = await supabase.from('hangouts').update({ status: 'confirmed', title: winner.label }).eq('id', hangout.id)
    if (error) { setActionError('Could not lock in the plan.'); return }
    await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser.id, content: `locked in the plan \u2014 ${winner.label}`, post_type: 'moment' })
    setHangout((prev: any) => ({ ...prev, status: 'confirmed', title: winner.label }))
    onRefresh()
  }

  async function rsvp(status: string, guestInfo?: { guest_type: 'just_me' | 'plus_one' | 'family'; guest_count: number; guest_dietary?: string[]; guest_accessibility?: string[] }) {
    if (!currentUser) return
    setActionError('')
    const payload: any = { hangout_id: post.hangout_id, user_id: currentUser.id, status }
    if (guestInfo) {
      payload.guest_type = guestInfo.guest_type
      payload.guest_count = guestInfo.guest_count
      payload.guest_dietary = guestInfo.guest_dietary || []
      payload.guest_accessibility = guestInfo.guest_accessibility || []
    }
    const { error } = await supabase.from('hangout_rsvps').upsert(payload, { onConflict: 'hangout_id,user_id' })
    if (error) { setActionError('Could not update RSVP.'); return }
    setRsvps(prev => [...prev.filter(r => r.user_id !== currentUser.id), { user_id: currentUser.id, status, profiles: { name: currentUser.name }, ...(guestInfo || {}) }])
    onRefresh()
  }

  function openGuestStep() {
    const mine = rsvps.find(r => r.user_id === currentUser?.id)
    setGuestType(mine?.guest_type || 'just_me')
    setFamilyCount(mine?.guest_type === 'family' && mine?.guest_count ? mine.guest_count : 2)
    setGuestDietary(mine?.guest_dietary?.length ? mine.guest_dietary : (currentUser?.dietary_restrictions || []))
    setGuestAccessibility(mine?.guest_accessibility?.length ? mine.guest_accessibility : (currentUser?.accessibility_needs || []))
    setShowGuestStep(true)
  }

  function handleRsvpClick(status: string) {
    if (status === 'yes') { openGuestStep(); return }
    setShowGuestStep(false)
    rsvp(status)
  }

  function toggleGuestDietary(id: string) {
    setGuestDietary(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  function toggleGuestAccessibility(id: string) {
    setGuestAccessibility(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  function confirmGoing() {
    const guest_count = guestType === 'just_me' ? 1 : guestType === 'plus_one' ? 2 : familyCount
    rsvp('yes', { guest_type: guestType, guest_count, guest_dietary: guestDietary, guest_accessibility: guestAccessibility })
    setShowGuestStep(false)
  }

  async function goLive() {
    if (!currentUser) return
    setActionError('')
    const actorName = currentUser.name || 'Someone'
    const { error } = await supabase.from('hangouts').update({ status: 'live', is_live: true }).eq('id', hangout.id)
    if (error) { setActionError('Could not go live.'); return }
    await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser.id, content: `${actorName} is at ${hangout.venue_name || hangout.title} \u2014 the night is on!`, post_type: 'moment' })
    setHangout((prev: any) => ({ ...prev, status: 'live', is_live: true }))
    onRefresh()
  }

  async function endHangout() {
    if (!currentUser) return
    setActionError('')
    const actorName = currentUser.name || 'Someone'
    const yesCount = rsvps.filter(r => r.status === 'yes').length
    const { error } = await supabase.from('hangouts').update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() }).eq('id', hangout.id)
    if (error) { setActionError('Could not end the hangout.'); return }
    await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser.id, content: `wrapped up a great night at ${hangout.venue_name || hangout.title}${yesCount > 1 ? ` with ${yesCount} people` : ''}. Thanks everyone!`, post_type: 'moment' })
    setHangout((prev: any) => ({ ...prev, status: 'ended', is_live: false }))
    onRefresh()
  }

  async function postBill() {
    if (!billDesc.trim() || !billAmount || billPosting || !currentUser) return
    const amount = parseFloat(billAmount)
    if (isNaN(amount) || amount <= 0) return
    setBillPosting(true)
    setActionError('')
    const goingIds = rsvps.filter(r => r.status === 'yes').map(r => r.user_id)
    const splitIds = goingIds.length > 0 ? goingIds : members.map(m => m.id)
    const share = amount / splitIds.length
    const { data: bill, error } = await supabase.from('bills').insert({ knot_id: knotId, hangout_id: hangout.id, added_by: currentUser.id, total_amount: amount, description: billDesc.trim(), split_type: 'equal' }).select().single()
    if (error || !bill) { setActionError('Could not post the bill.'); setBillPosting(false); return }
    const splits = splitIds.map((uid: string) => ({ bill_id: bill.id, user_id: uid, amount: parseFloat(share.toFixed(2)), settled: uid === currentUser.id }))
    const { error: splitError } = await supabase.from('bill_splits').insert(splits)
    if (splitError) { setActionError('Bill posted but splits failed to save.') }
    setBills(prev => [...prev, { ...bill, bill_splits: splits.map(s => ({ ...s, profiles: members.find(m => m.id === s.user_id) })) }])
    setBillDesc('')
    setBillAmount('')
    setBillPosting(false)
    setShowBill(false)
    onRefresh()
  }

  async function markSplitSettled(splitId: string) {
    setActionError('')
    const { error } = await supabase.from('bill_splits').update({ settled: true, settled_at: new Date().toISOString() }).eq('id', splitId)
    if (error) { setActionError('Could not mark as paid.'); return }
    setBills(prev => prev.map(b => ({
      ...b,
      bill_splits: b.bill_splits?.map((s: any) => s.id === splitId ? { ...s, settled: true } : s),
    })))
    onRefresh()
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCommentPhoto(file)
    setCommentPhotoPreview(URL.createObjectURL(file))
  }

  async function detectLocation() {
    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const geo = await res.json()
          const addr = geo.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          setCommentLocation(addr)
        } catch {
          setCommentLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        }
        setDetectingLocation(false)
      },
      () => setDetectingLocation(false)
    )
  }

  async function addComment() {
    if ((!newComment.trim() && !commentPhoto && !commentLocation) || !currentUser || submitting) return
    setSubmitting(true)
    setActionError('')
    let photoPath: string | null = null
    let photoUrl: string | null = null
    if (commentPhoto) {
      const compressed = await compressImage(commentPhoto)
      const ext = compressed.name.split('.').pop()
      const path = `comments/${post.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, compressed)
      if (uploadError) {
        setActionError('Photo upload failed. Comment not posted.')
        setSubmitting(false)
        return
      }
      photoPath = path
      const signedUrl = await getSignedUrl(path)
      photoUrl = signedUrl ?? ''
    }
    const parts = [newComment.trim(), commentLocation ? `${commentLocation}` : ''].filter(Boolean)
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, author_id: currentUser.id, content: parts.join(' ') || null, photo_path: photoPath })
    if (error) {
      setActionError('Could not post comment.')
      setSubmitting(false)
      return
    }
    setComments(prev => [...prev, { id: crypto.randomUUID(), post_id: post.id, author_id: currentUser.id, content: parts.join(' ') || null, photo_path: photoPath, created_at: new Date().toISOString(), photo_url: photoUrl, profiles: { name: currentUser.name } }])
    setNewComment('')
    setCommentPhoto(null)
    setCommentPhotoPreview(null)
    setCommentLocation('')
    setShowLocationInput(false)
    setSubmitting(false)
    onRefresh()
  }

  function startEditComment(c: any) {
    setEditingCommentId(c.id)
    setEditCommentText(c.content || '')
    setActionError('')
  }

  function cancelEditComment() {
    setEditingCommentId(null)
    setEditCommentText('')
  }

  async function saveEditComment(commentId: string) {
    if (!currentUser || editCommentSaving) return
    setEditCommentSaving(true)
    setActionError('')
    const { error } = await supabase
      .from('comments')
      .update({ content: editCommentText.trim() || null })
      .eq('id', commentId)
      .eq('author_id', currentUser.id)
    if (error) {
      setActionError('Could not save comment.')
      setEditCommentSaving(false)
      return
    }
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editCommentText.trim() || null } : c))
    setEditingCommentId(null)
    setEditCommentText('')
    setEditCommentSaving(false)
    onRefresh()
  }

  async function deleteComment(c: any) {
    if (!currentUser) return
    if (!confirm('Delete this comment? This cannot be undone.')) return
    setDeletingCommentId(c.id)
    setActionError('')
    if (c.photo_path) {
      const { error: storageError } = await supabase.storage.from('knot-photos').remove([c.photo_path])
      if (storageError) {
        setActionError('Could not delete the comment photo. Comment was not removed.')
        setDeletingCommentId(null)
        return
      }
    }
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', c.id)
      .eq('author_id', currentUser.id)
    if (error) {
      setActionError('Could not delete comment.')
      setDeletingCommentId(null)
      return
    }
    setComments(prev => prev.filter(x => x.id !== c.id))
    if (editingCommentId === c.id) cancelEditComment()
    setDeletingCommentId(null)
    onRefresh()
  }

  function startEditHangout() {
    setEditingHangout(true)
    setEditTitle(hangout.title || '')
    setEditScheduledFor(hangout.scheduled_for ? new Date(hangout.scheduled_for) : null)
    setEditVenueName(hangout.venue_name || '')
    setEditVenueAddress(hangout.venue_address || '')
    setActionError('')
  }

  function cancelEditHangout() {
    setEditingHangout(false)
    setEditTitle('')
    setEditScheduledFor(null)
    setEditVenueName('')
    setEditVenueAddress('')
  }

  async function saveEditHangout() {
    if (!currentUser || hangout.created_by !== currentUser.id || editHangoutSaving) return
    setEditHangoutSaving(true)
    setActionError('')
    const updates = {
      title: editTitle.trim() || hangout.title,
      scheduled_for: editScheduledFor ? editScheduledFor.toISOString() : null,
      venue_name: editVenueName.trim() || null,
      venue_address: editVenueAddress.trim() || null,
    }
    const { error } = await supabase
      .from('hangouts')
      .update(updates)
      .eq('id', hangout.id)
      .eq('created_by', currentUser.id)
    if (error) {
      setActionError('Could not update hangout details.')
      setEditHangoutSaving(false)
      return
    }
    setHangout((prev: any) => ({ ...prev, ...updates }))
    setEditingHangout(false)
    setEditHangoutSaving(false)
    onRefresh()
  }

  async function cancelHangout() {
    if (!currentUser || hangout.created_by !== currentUser.id) return
    if (!confirm('Cancel this hangout? This cannot be undone.')) return
    setCancellingHangout(true)
    setActionError('')
    const { error } = await supabase
      .from('hangouts')
      .update({ status: 'cancelled', is_live: false })
      .eq('id', hangout.id)
      .eq('created_by', currentUser.id)
    if (error) {
      setActionError('Could not cancel the hangout.')
      setCancellingHangout(false)
      return
    }
    setHangout((prev: any) => ({ ...prev, status: 'cancelled', is_live: false }))
    setEditingHangout(false)
    setCancellingHangout(false)
    onRefresh()
  }

  async function handleEditBill(billId: string, desc: string, amount: number, splits: { user_id: string; amount: number }[]) {
    if (!currentUser) return
    setEditBillSubmitting(true)
    setEditBillError('')
    const { error: updateError } = await supabase
      .from('bills')
      .update({ description: desc, total_amount: amount })
      .eq('id', billId)
      .eq('added_by', currentUser.id)
    if (updateError) {
      setEditBillError('Could not update the bill. Please try again.')
      setEditBillSubmitting(false)
      return
    }
    const { error: deleteSplitsError } = await supabase.from('bill_splits').delete().eq('bill_id', billId)
    if (deleteSplitsError) {
      setEditBillError('Bill updated, but the old split could not be replaced.')
      setEditBillSubmitting(false)
      return
    }
    const { error: insertSplitsError } = await supabase.from('bill_splits').insert(
      splits.map(s => ({ bill_id: billId, user_id: s.user_id, amount: s.amount, settled: s.user_id === currentUser.id }))
    )
    if (insertSplitsError) setEditBillError('Bill updated, but the new split failed to save.')
    setEditBillSubmitting(false)
    if (!insertSplitsError) setEditingBillId(null)
    onRefresh()
  }

  async function handleDeleteBill(billId: string) {
    if (!confirm('Delete this bill? This cannot be undone.')) return
    setDeletingBillId(billId)
    setActionError('')
    const { error } = await supabase.from('bills').delete().eq('id', billId).eq('added_by', currentUser?.id)
    if (error) {
      setActionError('Could not delete the bill. Please try again.')
      setDeletingBillId(null)
      return
    }
    setBills(prev => prev.filter(b => b.id !== billId))
    setDeletingBillId(null)
    if (editingBillId === billId) setEditingBillId(null)
    onRefresh()
  }

  async function handleLivePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    if (file.size > 100 * 1024 * 1024) return
    try {
      const isVideo = file.type.startsWith('video/')
      const uploadFile = isVideo ? file : await compressImage(file)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = `moments/${knotId}/${hangout.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, uploadFile)
      if (uploadError) return
      await supabase.from('photos').insert({ knot_id: knotId, hangout_id: hangout.id, uploaded_by: currentUser.id, storage_path: storagePath, media_type: isVideo ? 'video' : 'image', caption: `Live from ${hangout.venue_name || hangout.title}` })
      await supabase.from('posts').insert({ knot_id: knotId, hangout_id: hangout.id, author_id: currentUser.id, content: `Capturing the night at ${hangout.venue_name || hangout.title}`, post_type: 'moment' })
      setLivePhotoPosted(true)
      onRefresh()
    } catch (err) { console.error('Live media error:', err) }
  }


  async function submitBrief() {
    if (!myBriefNote.trim() || !currentUser || briefSubmitting) return
    setBriefSubmitting(true)
    try {
      if (myBriefId) {
        await supabase.from('hangout_briefs').update({ note: myBriefNote.trim() }).eq('id', myBriefId)
        setMemberBriefs(prev => prev.map(b => b.id === myBriefId ? { ...b, note: myBriefNote.trim() } : b))
      } else {
        const { data } = await supabase.from('hangout_briefs')
          .insert({ hangout_id: hangout.id, user_id: currentUser.id, knot_id: knotId, note: myBriefNote.trim() })
          .select('id, user_id, note, profiles:user_id(name)')
          .single()
        if (data) { setMyBriefId(data.id); setMemberBriefs(prev => [...prev, data]) }
      }
    } catch (err) { console.error('Brief submit error:', err) }
    setBriefSubmitting(false)
  }

  async function convertToKnot() {
    if (convertingToKnot) return
    setConvertingToKnot(true)
    setActionError('')
    const { data, error } = await supabase.rpc('convert_standalone_event_to_knot', {
      p_hangout_id: hangout.id,
      p_knot_name:  hangout.title,
    })
    if (error || !data?.knot_id) {
      setActionError(
        data?.error === 'already_converted' ? 'This event already has a Knot.' : 'Could not create the Knot. Try again.'
      )
      setConvertingToKnot(false)
      return
    }
    setConvertedKnotId(data.knot_id)
    setHangout((prev: any) => ({ ...prev, converted_to_knot_id: data.knot_id }))
    toast.success('Knot created — the crew is in.')
    setConvertingToKnot(false)
    onRefresh()
  }

  async function handlePollDateSelected(date: string, time: string | null) {
    if (!poll) return
    setActionError('')
    const scheduledIso = new Date(time ? `${date}T${time}` : `${date}T00:00:00`).toISOString()
    const { error: hangoutUpdateError } = await supabase
      .from('hangouts')
      .update({ scheduled_for: scheduledIso, status: 'confirmed' })
      .eq('id', hangout.id)
    if (hangoutUpdateError) { setActionError('Could not confirm the date. Try again.'); return }
    const { error: pollUpdateError } = await supabase
      .from('availability_polls')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', poll.id)
    if (pollUpdateError) setActionError('Date confirmed, but the poll failed to close.')
    setHangout((prev: any) => ({ ...prev, scheduled_for: scheduledIso, status: 'confirmed' }))
    setPoll(null)
    toast.success('Date confirmed!')
    onRefresh()
  }

  if (!hangout) return null

  // Surprise mode: hide this card entirely from anyone on the hidden invite
  // list until their own reveal_at has passed.
  const myInvite = invites.find((inv: any) => inv.user_id === currentUser?.id)
  const revealPending = !!(hangout.is_surprise && myInvite?.is_surprise && myInvite.reveal_at && new Date(myInvite.reveal_at) > new Date())
  if (revealPending) return null

  const isCreator   = hangout.created_by === currentUser?.id
  const isCancelled = hangout.status === 'cancelled'
  const isLive      = hangout.is_live && !isCancelled
  const isVoting    = hangout.status === 'voting' && !isLive && !isCancelled
  const isConfirmed = hangout.status === 'confirmed' && !isLive && !isCancelled
  const isDone      = hangout.status === 'ended'
  const canEditHangout = isCreator && (hangout.status === 'voting' || hangout.status === 'confirmed')
  const canCancelHangout = isCreator && !isDone && !isCancelled
  const goingCount  = rsvps.filter(r => r.status === 'yes').length
  const maybeCount  = rsvps.filter(r => r.status === 'maybe').length
  const totalHeadcount = rsvps.filter(r => r.status === 'yes').reduce((sum, r) => sum + (r.guest_count || 1), 0)
  const authorName  = post.profiles?.name || 'Someone'
  const memberList  = members.map(m => ({ id: m.id, name: m.name }))

  const dotColor    = isLive ? 'var(--danger)' : isConfirmed ? 'var(--sage)' : isVoting ? '#F8BD03' : null
  const borderColor = isLive ? '#111' : (isDone || isCancelled) ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.08)'
  const borderWidth = isLive ? 1.5 : 0.5
  const boxShadow   = isConfirmed ? '0 0 0 2px #F8BD03' : isVoting ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
  const statusLabel = isCancelled ? 'Cancelled' : isLive ? 'Live now' : isConfirmed ? 'Confirmed' : isVoting ? 'Vote open' : isDone ? 'Done' : 'Planning'
  const statusColor = isCancelled ? 'var(--text3)' : isLive ? 'var(--sage)' : isConfirmed ? 'var(--sage)' : isVoting ? 'var(--yellow)' : 'var(--text3)'
  const cardBg      = isLive ? 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' : '#ffffff'
  const textColor   = isLive ? '#fff' : 'var(--text)'
  const subColor    = isLive ? 'rgba(255,255,255,0.45)' : 'var(--text3)'
  const borderSep   = isLive ? 'rgba(255,255,255,0.08)' : 'var(--border)'
  const cardOpacity = isCancelled ? 0.5 : isDone ? 0.75 : 1

  return (
    <div style={{ background: cardBg, border: `${borderWidth}px solid ${borderColor}`, borderRadius: 12, padding: 20, marginBottom: 16, opacity: cardOpacity, boxShadow }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isCreator && hangout.is_surprise ? 6 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dotColor && <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}`, flexShrink: 0, animation: isLive ? 'pulse-dot 1.2s ease-in-out infinite' : 'none' }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{statusLabel}</span>
        </div>
        <span style={{ fontSize: 11, color: subColor }}>{timeAgo(post.created_at)}</span>
      </div>

      {isCreator && hangout.is_surprise && (
        <div style={{ marginBottom: 14 }}>
          <span style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', fontSize: 10, fontWeight: 700, color: 'var(--yellow)' }}>
            Surprise mode{hangout.reveal_at ? ` · reveals ${formatDate(hangout.reveal_at)}` : ''}
          </span>
        </div>
      )}

      {editingHangout ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: textColor, marginBottom: 10 }}>Edit hangout</div>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title"
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
          <input value={editVenueName} onChange={e => setEditVenueName(e.target.value)} placeholder="Venue name"
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
          <input value={editVenueAddress} onChange={e => setEditVenueAddress(e.target.value)} placeholder="Venue address"
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 }} />
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Date and time</div>
            <DateTimePicker value={editScheduledFor} onChange={setEditScheduledFor} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={cancelEditHangout}
              style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={saveEditHangout} disabled={editHangoutSaving}
              style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: editHangoutSaving ? 0.5 : 1 }}>
              {editHangoutSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: textColor, marginBottom: 4 }}>{hangout.venue_name || hangout.title}</div>
          {hangout.event_restrictions?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {hangout.event_restrictions.map((r: string) => (
                <span key={r} style={{ padding: '2px 9px', borderRadius: 999, background: 'var(--bg2)', color: 'var(--text2)', fontSize: 10, fontWeight: 600 }}>
                  {EVENT_RESTRICTION_LABELS[r] || r}
                </span>
              ))}
            </div>
          )}
          {hangout.movie_title && (
            <div style={{ fontSize: 13, color: textColor, fontWeight: 600, marginBottom: 6 }}>
              {String.fromCodePoint(0x1F3AC)} {hangout.movie_title}
              {hangout.movie_showtime && <span style={{ color: subColor, fontWeight: 500 }}> · {formatShowtime(hangout.movie_showtime)}</span>}
            </div>
          )}
          {hangout.venue_address && <div style={{ fontSize: 12, color: subColor, marginBottom: 4 }}>{hangout.venue_address}</div>}
          {hangout.scheduled_for && !isLive && (
            <div style={{ fontSize: 13, color: isConfirmed ? 'var(--sage)' : 'var(--text2)', fontWeight: 600, marginTop: 4 }}>{formatDate(hangout.scheduled_for)}</div>
          )}
          <div style={{ fontSize: 11, color: subColor, marginTop: 4 }}>Started by {authorName}</div>
        </div>
      )}

      {onToggleReaction && (
        <div style={{ marginBottom: 12 }}>
          <ReactionBar
            dark={isLive}
            reactions={post.reactions || []}
            onToggle={onToggleReaction}
          />
        </div>
      )}

      {actionError && (
        <div className="error-banner" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {!isCancelled && (isVoting || isConfirmed) && (hangout.brief || hangout.brief_vibe || hangout.brief_budget) && (
        <div style={{ padding: '10px 12px', background: isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Brief</div>
          {hangout.brief && <div style={{ fontSize: 13, color: textColor, marginBottom: 6, lineHeight: 1.5 }}>{hangout.brief}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hangout.brief_vibe && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', fontSize: 11, fontWeight: 600, color: 'var(--yellow)' }}>{hangout.brief_vibe}</span>}
            {hangout.brief_budget && <span style={{ padding: '3px 8px', borderRadius: 20, background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{BRIEF_BUDGET_LABELS[hangout.brief_budget] || hangout.brief_budget}</span>}
          </div>
        </div>
      )}

      {!isCancelled && (isVoting || isConfirmed) && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: subColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Group input</div>
          {memberBriefs.filter(b => b.user_id !== currentUser?.id).map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--text)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {(b.profiles?.name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, background: 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: textColor, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, color: subColor, marginRight: 6 }}>{b.profiles?.name?.split(' ')[0] || 'Member'}</span>
                {b.note}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={myBriefNote}
              onChange={e => setMyBriefNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitBrief()}
              placeholder={myBriefId ? 'Update your note...' : 'Add a note for the group...'}
              style={{ flex: 1, padding: '7px 10px', background: 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={submitBrief}
              disabled={!myBriefNote.trim() || briefSubmitting}
              style={{ padding: '7px 14px', background: myBriefNote.trim() ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 8, color: myBriefNote.trim() ? 'var(--text)' : subColor, fontSize: 12, fontWeight: 700, cursor: myBriefNote.trim() ? 'pointer' : 'default', fontFamily: 'inherit', opacity: briefSubmitting ? 0.5 : 1 }}
            >
              {myBriefId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {!isCancelled && poll && (
        <AvailabilityPoll
          pollId={poll.id}
          knotId={knotId}
          currentUser={currentUser}
          members={members}
          onDateSelected={handlePollDateSelected}
        />
      )}

      {!isCancelled && isVoting && options.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {options.map((o: any) => {
            const maxVotes = Math.max(...options.map((x: any) => x.vote_count), 1)
            const isLeading = o.id === options[0]?.id && o.vote_count > 0
            const isMyVote = myVoteOptionId === o.id
            return (
              <button key={o.id} onClick={() => castVote(o.id)} disabled={!!myVoteOptionId}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${isMyVote ? 'var(--yellow)' : isLeading ? 'var(--sage)' : 'var(--border2)'}`, borderRadius: 8, marginBottom: 6, cursor: myVoteOptionId ? 'default' : 'pointer', background: isMyVote ? 'var(--yellow-dim)' : isLeading ? 'var(--sage-dim)' : 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{o.label}</span>
                <div style={{ width: 72, height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: isLeading ? 'var(--sage)' : 'var(--yellow)', width: `${Math.round(o.vote_count / maxVotes * 100)}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', width: 20, textAlign: 'right' }}>{o.vote_count}</span>
                {isLeading && o.vote_count > 0 && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700, width: 28 }}>TOP</span>}
              </button>
            )
          })}
          {isCreator && options[0]?.vote_count > 0 && (
            <button onClick={lockPlan} style={{ width: '100%', marginTop: 4, padding: '9px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 8, color: 'var(--sage)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Lock in: {options[0].label}
            </button>
          )}
        </div>
      )}

      {!isCancelled && (isVoting || isConfirmed || isLive) && (
        <div style={{ marginBottom: 14 }}>
          {rsvps.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {rsvps.map((r: any) => (
                <div key={r.user_id} style={{ padding: '3px 8px', borderRadius: 6, background: r.status === 'yes' ? isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)' : r.status === 'maybe' ? 'var(--amber-soft)' : 'var(--bg3)', border: `1px solid ${r.status === 'yes' ? isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)' : 'var(--border)'}` }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: r.status === 'yes' ? 'var(--sage)' : r.status === 'maybe' ? 'var(--amber)' : 'var(--text3)' }}>
                    {r.profiles?.name?.split(' ')[0] || 'Someone'} {r.status === 'yes' ? 'in' : r.status === 'maybe' ? 'maybe' : 'out'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ s: 'yes', l: isLive ? 'On my way' : 'Going' }, { s: 'maybe', l: 'Maybe' }, { s: 'no', l: "Can't go" }].map(({ s, l }) => (
              <button key={s} onClick={() => handleRsvpClick(s)} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${myRsvpStatus === s ? s === 'yes' ? 'var(--sage)' : 'var(--border2)' : isLive ? 'rgba(255,255,255,0.2)' : 'var(--border2)'}`, background: myRsvpStatus === s ? s === 'yes' ? isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)' : 'var(--bg3)' : 'transparent', color: myRsvpStatus === s ? s === 'yes' ? 'var(--sage)' : isLive ? 'rgba(255,255,255,0.7)' : 'var(--text2)' : isLive ? 'rgba(255,255,255,0.6)' : 'var(--text2)', fontSize: 12, fontWeight: myRsvpStatus === s ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {l}
              </button>
            ))}
          </div>

          {showGuestStep && (
            <div style={{ marginTop: 10, padding: 12, background: isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: textColor, marginBottom: 8 }}>Who is coming with you?</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: guestType === 'family' ? 10 : 0 }}>
                {[{ v: 'just_me', l: 'Just me' }, { v: 'plus_one', l: 'Plus one' }, { v: 'family', l: 'Family' }].map(opt => (
                  <button key={opt.v} onClick={() => setGuestType(opt.v as 'just_me' | 'plus_one' | 'family')}
                    style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${guestType === opt.v ? 'var(--yellow)' : borderSep}`, background: guestType === opt.v ? 'var(--yellow-soft)' : 'transparent', color: guestType === opt.v ? 'var(--yellow)' : subColor, fontSize: 12, fontWeight: guestType === opt.v ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {opt.l}
                  </button>
                ))}
              </div>
              {guestType === 'family' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: subColor }}>Party size</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setFamilyCount(c => Math.max(2, c - 1))}
                      style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${borderSep}`, background: 'none', color: textColor, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>-</button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: textColor, minWidth: 16, textAlign: 'center' }}>{familyCount}</span>
                    <button onClick={() => setFamilyCount(c => Math.min(8, c + 1))}
                      style={{ width: 26, height: 26, borderRadius: '50%', border: `1px solid ${borderSep}`, background: 'none', color: textColor, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>+</button>
                  </div>
                </div>
              )}

              {guestType !== 'just_me' && (
                <div style={{ marginTop: 4, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: textColor, marginBottom: 6 }}>Guest restrictions</div>
                  <div style={{ fontSize: 11, color: subColor, marginBottom: 6 }}>Dietary</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {Object.entries(DIETARY_LABELS).map(([id, label]) => {
                      const selected = guestDietary.includes(id)
                      return (
                        <button key={id} onClick={() => toggleGuestDietary(id)}
                          style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${selected ? 'var(--yellow)' : borderSep}`, background: selected ? 'var(--yellow-soft)' : 'transparent', color: selected ? 'var(--yellow)' : subColor, fontSize: 11, fontWeight: selected ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: subColor, marginBottom: 6 }}>Accessibility</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(ACCESSIBILITY_LABELS).map(([id, label]) => {
                      const selected = guestAccessibility.includes(id)
                      return (
                        <button key={id} onClick={() => toggleGuestAccessibility(id)}
                          style={{ padding: '5px 10px', borderRadius: 20, border: `1px solid ${selected ? 'var(--yellow)' : borderSep}`, background: selected ? 'var(--yellow-soft)' : 'transparent', color: selected ? 'var(--yellow)' : subColor, fontSize: 11, fontWeight: selected ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowGuestStep(false)}
                  style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={confirmGoing}
                  style={{ padding: '7px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Confirm
                </button>
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: subColor, marginTop: 8 }}>
            {goingCount} going{maybeCount > 0 ? ` \u00B7 ${maybeCount} maybe` : ''}
          </div>
          {isConfirmed && totalHeadcount > 0 && (
            <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>
              {totalHeadcount} people coming
            </div>
          )}
        </div>
      )}

      {!isCancelled && (
      <div style={{ display: 'flex', gap: 8, marginBottom: isDone || bills.length > 0 || canEditHangout || canCancelHangout ? 14 : 0, flexWrap: 'wrap', alignItems: 'center' }}>
        {(isConfirmed || isLive) && hangout.movie_title && (
          // Static Cineplex search URL for now — Rakuten affiliate params to
          // be added post-registration.
          <a href={`https://www.cineplex.com/Search?q=${encodeURIComponent(hangout.movie_title)}`} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#111', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
            {String.fromCodePoint(0x1F3AC)} Get tickets
          </a>
        )}
        {(isConfirmed || isLive) && (
          <button onClick={() => { setShowThread(true); setHasUnreadThread(false) }}
            style={{ position: 'relative', padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.85)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Thread
            {hasUnreadThread && (
              <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--yellow)', border: `2px solid ${isLive ? '#111' : '#ffffff'}` }} />
            )}
          </button>
        )}
        {isConfirmed && isCreator && (
          <button onClick={goLive} style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>We are here</button>
        )}
        {isLive && isCreator && (
          <button onClick={endHangout} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>End the night</button>
        )}

        {(isConfirmed || isLive) && hangout.meeting_url && (
          <button
            onClick={ensureAndJoinCall}
            disabled={joiningCall}
            style={{ padding: '8px 14px', background: isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)', border: `1px solid ${isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)'}`, borderRadius: 8, color: 'var(--sage)', fontSize: 12, fontWeight: 700, cursor: joiningCall ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: joiningCall ? 0.7 : 1 }}>
            {joiningCall ? 'Starting call...' : 'Join call'}
          </button>
        )}

        {(isConfirmed || isLive) && !hangout.meeting_url && (hangout.venue_maps_url || hangout.venue_name || hangout.venue_address) && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTravelMenu(v => !v)}
              style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.85)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={13} strokeWidth={2} />
              Get there
              <ChevronDown size={13} strokeWidth={2} />
            </button>
            {showTravelMenu && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 40, minWidth: 180, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                {hangout.venue_maps_url && (
                  <a href={hangout.venue_maps_url} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                    style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>Directions</a>
                )}
                {(hangout.venue_name || hangout.venue_address) && (
                  <>
                    <a href={buildUberLink(hangout.venue_name || '', hangout.venue_address || '')} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                      style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>Uber</a>
                    <a href={buildLyftLink(hangout.venue_name || '', hangout.venue_address || '')} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                      style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>Lyft</a>
                  </>
                )}
                {hangout.venue_name && (
                  <>
                    <a href={buildOpenTableLink(hangout.venue_name) + (totalHeadcount > 0 ? `&covers=${totalHeadcount}` : '')} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                      style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>OpenTable{totalHeadcount > 0 ? ` · Book for ${totalHeadcount}` : ''}</a>
                    <a href={buildResyLink(hangout.venue_name)} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                      style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>Resy{totalHeadcount > 0 ? ` · Book for ${totalHeadcount}` : ''}</a>
                    {isActivityVenue(hangout.venue_category) && (
                      <>
                        <a href={buildViatorLink(hangout.venue_name)} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                          style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>Viator</a>
                        <a href={buildGetYourGuideLink(hangout.venue_name)} target="_blank" rel="noreferrer" onClick={() => setShowTravelMenu(false)}
                          style={{ display: 'block', padding: '8px 10px', borderRadius: 8, color: 'var(--text)', fontSize: 13, textDecoration: 'none' }}>GetYourGuide</a>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {(isConfirmed || isLive) && hangout.meeting_url && (
          <a href="https://www.viator.com/searchResults/all?text=virtual+experiences" target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Virtual experiences</a>
        )}
        {isDone && !showBill && bills.length === 0 && (
          <button onClick={() => setShowBill(true)} style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Split the bill</button>
        )}
        {isDone && bills.length > 0 && !showBill && (
          <button onClick={() => setShowBill(true)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Add another bill</button>
        )}
        {canEditHangout && !editingHangout && (
          <button onClick={startEditHangout}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Edit
          </button>
        )}
        {canCancelHangout && (
          <button onClick={cancelHangout} disabled={cancellingHangout}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: cancellingHangout ? 0.5 : 1 }}>
            {cancellingHangout ? 'Cancelling...' : 'Cancel hangout'}
          </button>
        )}
      </div>
      )}

      {(isConfirmed || isLive) && !isCancelled && hangout.venue_place_id && (
        <PreOrderCard
          hangout={hangout}
          knotId={knotId}
          currentUserId={currentUser?.id || ''}
          isLive={isLive}
        />
      )}

      {showDailyCall && (callRoomUrl || hangout.meeting_url) && (
        <DailyCall
          key={callRoomUrl || hangout.meeting_url}
          roomUrl={callRoomUrl || hangout.meeting_url}
          onLeave={() => { setShowDailyCall(false); setCallRoomUrl(null) }}
        />
      )}

      {isLive && !isCancelled && !livePhotoPosted && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Capture the night</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Add photo / video
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleLivePhotoUpload} />
          </label>
        </div>
      )}
      {isLive && !isCancelled && livePhotoPosted && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--sage)' }}>Added to Memories</span>
        </div>
      )}

      {isDone && !isCancelled && hangout.is_standalone && !hangout.converted_to_knot_id && isCreator && (
        <div style={{ padding: 16, background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Turn this into a Knot?</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>Keep the crew together.</div>
          {convertedKnotId ? (
            <a href="/dashboard" style={{ display: 'inline-block', padding: '9px 16px', background: 'var(--yellow)', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              Open your new Knot →
            </a>
          ) : (
            <button onClick={convertToKnot} disabled={convertingToKnot}
              style={{ padding: '9px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: convertingToKnot ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: convertingToKnot ? 0.6 : 1 }}>
              {convertingToKnot ? 'Creating Knot...' : 'Create Knot from this event'}
            </button>
          )}
        </div>
      )}

      {isDone && !isCancelled && (
        <PostHangoutLoop
          hangout={hangout}
          knotId={knotId}
          currentUserId={currentUser?.id || ''}
          goingCount={goingCount}
          onPhotoPosted={onRefresh}
        />
      )}

      {(bills.length > 0 || (showBill && !isCancelled)) && (
        <div style={{ borderTop: `1px solid ${borderSep}`, paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Bill</div>
          {bills.map((b: any) => {
            const totalSplits = b.bill_splits?.length || 0
            const settledCount = b.bill_splits?.filter((s: any) => s.settled).length || 0
            const isMine = b.added_by === currentUser?.id
            const isEditing = editingBillId === b.id
            return (
              <div key={b.id} style={{ background: isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                {isEditing && !isCancelled ? (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textColor, marginBottom: 10 }}>Edit bill</div>
                    <BillSplitForm
                      members={memberList}
                      defaultSelectedIds={b.bill_splits?.map((s: any) => s.user_id)}
                      defaultDesc={b.description}
                      defaultAmount={parseFloat(b.total_amount)}
                      expectedHeadcount={totalHeadcount}
                      submitLabel="Save changes"
                      submitting={editBillSubmitting}
                      error={editBillError}
                      onSubmit={(desc, amount, splits) => handleEditBill(b.id, desc, amount, splits)}
                      onCancel={() => { setEditingBillId(null); setEditBillError('') }}
                      theme={isLive ? 'dark' : 'light'}
                    />
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: textColor }}>{b.description}</div>
                        <div style={{ fontSize: 12, color: subColor, marginTop: 2 }}>${parseFloat(b.total_amount).toFixed(2)} total</div>
                      </div>
                      <div style={{ fontSize: 11, color: settledCount === totalSplits ? 'var(--sage)' : subColor, fontWeight: 600 }}>{settledCount}/{totalSplits} settled</div>
                    </div>
                    <div style={{ width: '100%', height: 3, background: isLive ? 'rgba(255,255,255,0.1)' : 'var(--bg4)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${totalSplits > 0 ? (settledCount / totalSplits) * 100 : 0}%`, height: '100%', background: 'var(--sage)', borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    {b.bill_splits?.map((s: any) => {
                      const isMe = s.user_id === currentUser?.id
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${borderSep}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--text)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(s.profiles?.name || 'U')}</div>
                            <span style={{ fontSize: 12, color: textColor }}>{s.profiles?.name || 'Someone'}{isMe ? ' (you)' : ''}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: s.settled ? 'var(--sage)' : subColor, fontWeight: 600 }}>${parseFloat(s.amount).toFixed(2)}</span>
                            {!isCancelled && !s.settled && isMe && (
                              <button onClick={() => markSplitSettled(s.id)} style={{ padding: '3px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: 'var(--text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Mark paid</button>
                            )}
                            {s.settled && <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600 }}>Paid</span>}
                          </div>
                        </div>
                      )
                    })}
                    {isMine && !isCancelled && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => { setEditingBillId(b.id); setEditBillError('') }}
                          style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteBill(b.id)} disabled={deletingBillId === b.id}
                          style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--danger-dim)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingBillId === b.id ? 0.5 : 1 }}>
                          {deletingBillId === b.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
          {showBill && !isCancelled && (
            <div style={{ background: isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: subColor, marginBottom: 10 }}>
                Split between {rsvps.filter(r => r.status === 'yes').length > 0 ? `${rsvps.filter(r => r.status === 'yes').length} people who went` : `${members.length} members`}
              </div>
              <input value={billDesc} onChange={e => setBillDesc(e.target.value)} placeholder="What was the bill for?"
                style={{ width: '100%', padding: '9px 12px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg2)', border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
              <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="Total amount"
                style={{ width: '100%', padding: '9px 12px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg2)', border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
              {billAmount && !isNaN(parseFloat(billAmount)) && (
                <div style={{ fontSize: 11, color: subColor, marginBottom: 10 }}>
                  ${(parseFloat(billAmount) / Math.max(rsvps.filter(r => r.status === 'yes').length || members.length, 1)).toFixed(2)} each
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowBill(false)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={postBill} disabled={!billDesc.trim() || !billAmount || billPosting}
                  style={{ flex: 1, padding: '8px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !billDesc.trim() || !billAmount || billPosting ? 0.5 : 1 }}>
                  {billPosting ? 'Posting...' : 'Post bill'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <CrewSection
        hangoutId={hangout.id}
        knotId={knotId}
        currentUserId={currentUser?.id || ''}
        isPlanner={hangout.created_by === currentUser?.id}
        isLive={isLive}
      />

      <div style={{ borderTop: `1px solid ${borderSep}`, paddingTop: 12 }}>
        <button onClick={() => setShowComments(s => !s)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: subColor, cursor: 'pointer', fontFamily: 'inherit' }}>
          {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Add a comment'}
        </button>

        {showComments && (
          <div style={{ marginTop: 12 }}>
            {comments.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--yellow)', color: 'var(--text)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(c.profiles?.name || 'U')}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLive ? 'rgba(255,255,255,0.8)' : 'var(--text)' }}>{c.profiles?.name || 'Someone'}</span>
                  {editingCommentId === c.id ? (
                    <div style={{ marginTop: 6 }}>
                      <input
                        value={editCommentText}
                        onChange={e => setEditCommentText(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={cancelEditComment}
                          style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 6, color: subColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                        <button onClick={() => saveEditComment(c.id)} disabled={editCommentSaving}
                          style={{ padding: '5px 12px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: 'var(--text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: editCommentSaving ? 0.5 : 1 }}>
                          {editCommentSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {c.content && <span style={{ fontSize: 12, color: isLive ? 'rgba(255,255,255,0.55)' : 'var(--text2)', marginLeft: 6 }}>{c.content}</span>}
                      {c.photo_url && (
                        <div style={{ marginTop: 6 }}>
                          <img src={c.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 10, color: subColor }}>{timeAgo(c.created_at)}</div>
                        {commentReactionsEnabled && (
                          <ReactionBar
                            compact
                            dark={isLive}
                            reactions={commentReactions[c.id] || []}
                            onToggle={(emoji) => toggleCommentReaction(c.id, emoji)}
                          />
                        )}
                        {c.author_id === currentUser?.id && (
                          <>
                            <button onClick={() => startEditComment(c)}
                              style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: subColor, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Edit
                            </button>
                            <button onClick={() => deleteComment(c)} disabled={deletingCommentId === c.id}
                              style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', opacity: deletingCommentId === c.id ? 0.5 : 1 }}>
                              {deletingCommentId === c.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            <div style={{ marginTop: 8 }}>
              {commentPhotoPreview && (
                <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
                  <img src={commentPhotoPreview} alt="" style={{ height: 80, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                  <button onClick={() => { setCommentPhoto(null); setCommentPhotoPreview(null) }}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                    x
                  </button>
                </div>
              )}
              {showLocationInput && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input value={commentLocation} onChange={e => setCommentLocation(e.target.value)} placeholder="Enter an address or place name..."
                    style={{ flex: 1, padding: '7px 10px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={detectLocation} disabled={detectingLocation}
                    style={{ padding: '7px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {detectingLocation ? '...' : 'Use GPS'}
                  </button>
                  <button onClick={() => { setShowLocationInput(false); setCommentLocation('') }}
                    style={{ padding: '7px 10px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 8, color: subColor, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Clear
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()} placeholder="Write a comment..."
                  style={{ flex: 1, padding: '8px 12px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${isLive ? 'rgba(255,255,255,0.12)' : 'var(--border2)'}`, borderRadius: 8, color: textColor, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />
                <button onClick={() => photoInputRef.current?.click()}
                  style={{ width: 34, height: 34, borderRadius: 8, background: commentPhoto ? 'var(--yellow-soft)' : isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${commentPhoto ? 'var(--yellow)' : borderSep}`, color: commentPhoto ? 'var(--yellow)' : subColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
                  title="Add photo"
                  aria-label="Add photo">
                  <ImageIcon size={15} strokeWidth={2} />
                </button>
                <button onClick={() => setShowLocationInput(s => !s)}
                  style={{ width: 34, height: 34, borderRadius: 8, background: commentLocation ? 'var(--yellow-soft)' : isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${commentLocation ? 'var(--yellow)' : borderSep}`, color: commentLocation ? 'var(--yellow)' : subColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
                  title="Add location"
                  aria-label="Add location">
                  <MapPin size={15} strokeWidth={2} />
                </button>
                <button onClick={addComment} disabled={(!newComment.trim() && !commentPhoto && !commentLocation) || submitting}
                  style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!newComment.trim() && !commentPhoto && !commentLocation) || submitting ? 0.5 : 1, flexShrink: 0 }}>
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showThread && (
        <>
          {/* Mobile: bottom sheet */}
          <div className="mobile-only" style={{ display: 'none', position: 'fixed', inset: 0, zIndex: 300 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowThread(false)} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80vh', background: '#ffffff', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Thread</span>
                <button onClick={() => setShowThread(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <HangoutThread hangoutId={hangout.id} currentUser={currentUser} members={members} />
              </div>
            </div>
          </div>

          {/* Desktop: modal overlay */}
          <div className="desktop-only" style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 300, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowThread(false)} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: 560, background: '#ffffff', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Thread</span>
                <button onClick={() => setShowThread(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <HangoutThread hangoutId={hangout.id} currentUser={currentUser} members={members} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function HangoutCardSkeleton() {
  return (
    <div style={{ background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Skeleton width={8} height={8} borderRadius={999} />
        <Skeleton width={70} height={10} />
      </div>
      <Skeleton width="65%" height={18} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={12} style={{ marginBottom: 18 }} />
      <div style={{ padding: 12, borderRadius: 10, background: 'var(--yellow-soft)' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Skeleton width={64} height={26} borderRadius={6} />
          <Skeleton width={64} height={26} borderRadius={6} />
          <Skeleton width={64} height={26} borderRadius={6} />
        </div>
      </div>
    </div>
  )
}
