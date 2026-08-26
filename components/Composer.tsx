'use client'
import { useState, useReducer, useRef, useEffect } from 'react'
import { ImageIcon, Calendar, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notifyKnotMembers } from '@/lib/notifications'
import Discover from '@/components/Discover'
import { compressImage } from '@/lib/compressImage'
import DateTimePicker from '@/components/DateTimePicker'
import { useToast } from '@/components/ToastProvider'
import { getRandom, COMPOSER_PLACEHOLDER } from '@/lib/copy'
import { EVENT_RESTRICTION_OPTIONS } from '@/lib/constants'
import { track } from '@/lib/track'

type PostType = 'moment' | 'hangout'
type WhenType = 'now' | 'pick' | 'weekly'
type WhereMode = 'none' | 'tbd' | 'discover' | 'manual' | 'home' | 'search' | 'online' | 'cinema' | 'poll'

// Vibe pill -> venues API category id (see app/api/venues/route.ts CATEGORY_TO_TYPES).
const VIBE_TO_CATEGORY: Record<string, string> = {
  Foodie: '13000',
  Party: '13003',
  Chill: '13059',
  Culture: '10000',
  Outdoors: '18000',
  Active: '18008',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getNextWeekday(day: number, time: string): string {
  const now = new Date()
  const result = new Date()
  const daysUntil = (day - now.getDay() + 7) % 7 || 7
  result.setDate(now.getDate() + daysUntil)
  const [h, m] = time.split(':')
  result.setHours(parseInt(h), parseInt(m), 0, 0)
  return result.toISOString()
}

function formatDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Tonight · ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
}

// Hangout draft — everything that ends up in the create_hangout RPC's
// p_input, plus the picker fields that shape it (whereMode, dateMode).
// Consolidated into one reducer since this was 22+ separate useState hooks
// before — ephemeral/async UI state (search results, loading flags) stays
// as its own useState below since it never gets submitted.
type HangoutDraft = {
  whenType: WhenType
  scheduledFor: Date | null
  recurrenceDay: number
  recurrenceTime: string
  whereMode: WhereMode
  movieTitle: string
  movieShowtime: Date | null
  selectedVenue: any
  meetingUrl: string
  manualVenue: string
  manualAddress: string
  hangoutTitle: string
  briefNote: string
  briefVibe: string
  briefBudget: string
  dateMode: 'set' | 'poll'
  pollDates: string[]
  inviteMode: 'all' | 'selected'
  selectedMemberIds: Set<string>
  surpriseMode: boolean
  revealAt: Date | null
  surpriseMemberIds: Set<string>
  eventRestrictions: string[]
  venuePollOptions: any[]
}

const initialHangoutDraft: HangoutDraft = {
  whenType: 'pick',
  scheduledFor: null,
  recurrenceDay: 5,
  recurrenceTime: '19:00',
  whereMode: 'none',
  movieTitle: '',
  movieShowtime: null,
  selectedVenue: null,
  meetingUrl: '',
  manualVenue: '',
  manualAddress: '',
  hangoutTitle: '',
  briefNote: '',
  briefVibe: '',
  briefBudget: '',
  dateMode: 'set',
  pollDates: [],
  inviteMode: 'all',
  selectedMemberIds: new Set(),
  surpriseMode: false,
  revealAt: null,
  surpriseMemberIds: new Set(),
  eventRestrictions: [],
  venuePollOptions: [],
}

function isDraftEmpty(d: HangoutDraft): boolean {
  return (
    d.whenType === initialHangoutDraft.whenType &&
    d.scheduledFor === null &&
    d.recurrenceDay === initialHangoutDraft.recurrenceDay &&
    d.recurrenceTime === initialHangoutDraft.recurrenceTime &&
    d.whereMode === 'none' &&
    d.movieTitle === '' &&
    d.movieShowtime === null &&
    d.selectedVenue === null &&
    d.meetingUrl === '' &&
    d.manualVenue === '' &&
    d.manualAddress === '' &&
    d.hangoutTitle === '' &&
    d.briefNote === '' &&
    d.briefVibe === '' &&
    d.briefBudget === '' &&
    d.dateMode === initialHangoutDraft.dateMode &&
    d.pollDates.length === 0 &&
    d.inviteMode === 'all' &&
    d.selectedMemberIds.size === 0 &&
    !d.surpriseMode &&
    d.revealAt === null &&
    d.surpriseMemberIds.size === 0 &&
    d.eventRestrictions.length === 0 &&
    d.venuePollOptions.length === 0
  )
}

type HangoutDraftAction =
  | { type: 'set'; field: keyof HangoutDraft; value: any }
  | { type: 'toggle_member'; id: string }
  | { type: 'toggle_surprise_member'; id: string }
  | { type: 'toggle_restriction'; id: string }
  | { type: 'add_poll_date'; date: string }
  | { type: 'remove_poll_date'; date: string }
  | { type: 'select_venue'; venue: any; whereMode?: WhereMode }
  | { type: 'init_selected_members'; ids: string[] }
  | { type: 'reset' }

function hangoutDraftReducer(state: HangoutDraft, action: HangoutDraftAction): HangoutDraft {
  switch (action.type) {
    case 'set':
      return { ...state, [action.field]: action.value }
    case 'toggle_member': {
      const next = new Set(state.selectedMemberIds)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, selectedMemberIds: next }
    }
    case 'toggle_surprise_member': {
      const next = new Set(state.surpriseMemberIds)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, surpriseMemberIds: next }
    }
    case 'toggle_restriction':
      return {
        ...state,
        eventRestrictions: state.eventRestrictions.includes(action.id)
          ? state.eventRestrictions.filter(r => r !== action.id)
          : [...state.eventRestrictions, action.id],
      }
    case 'add_poll_date':
      if (state.pollDates.length >= 5 || state.pollDates.includes(action.date)) return state
      return { ...state, pollDates: [...state.pollDates, action.date].sort() }
    case 'remove_poll_date':
      return { ...state, pollDates: state.pollDates.filter(d => d !== action.date) }
    case 'select_venue':
      // whereMode is only set here when the caller wants to switch modes too
      // (e.g. picking from search) — venue-preserving navigation dispatches
      // a plain 'set' on whereMode instead, leaving selectedVenue untouched.
      return { ...state, selectedVenue: action.venue, ...(action.whereMode ? { whereMode: action.whereMode } : {}) }
    case 'init_selected_members':
      return { ...state, selectedMemberIds: new Set(action.ids) }
    case 'reset':
      return initialHangoutDraft
    default:
      return state
  }
}

export default function Composer({
  knotId,
  currentUser,
  members,
  onPosted,
}: {
  knotId: string
  currentUser: any
  members: any[]
  onPosted: () => void
}) {
  const toast = useToast()
  const [activeType, setActiveType] = useState<PostType | null>(null)
  const [momentPlaceholder] = useState(() => getRandom(COMPOSER_PLACEHOLDER))

  const [showQuickBill, setShowQuickBill]   = useState(false)
  const [quickBillDesc, setQuickBillDesc]   = useState('')
  const [quickBillAmount, setQuickBillAmount] = useState('')
  const [quickBillSelectedIds, setQuickBillSelectedIds] = useState<Set<string>>(new Set())
  const [quickBillPosting, setQuickBillPosting] = useState(false)
  const [quickBillError, setQuickBillError] = useState('')

  const [momentText, setMomentText] = useState('')
  const [posting, setPosting]       = useState(false)
  const [momentPhoto, setMomentPhoto]               = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentMediaType, setMomentMediaType] = useState<'image' | 'video'>('image')
  const [momentError, setMomentError] = useState('')
  const momentPhotoInputRef = useRef<HTMLInputElement>(null)

  const [draft, dispatchDraft] = useReducer(hangoutDraftReducer, initialHangoutDraft)

  const [cinemaSearch, setCinemaSearch]   = useState('')
  const [cinemaResults, setCinemaResults] = useState<any[]>([])
  const [searchingCinema, setSearchingCinema] = useState(false)
  const [venueSearch, setVenueSearch]     = useState('')
  const [venueResults, setVenueResults]   = useState<any[]>([])
  const [searchingVenue, setSearchingVenue] = useState(false)
  const [creating, setCreating]           = useState(false)
  const [hangoutError, setHangoutError]   = useState('')
  const [groupSuggestions, setGroupSuggestions] = useState<any>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [pollDateInput, setPollDateInput] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const [fetchingVenuePoll, setFetchingVenuePoll] = useState(false)
  const [venuePollPool, setVenuePollPool] = useState<any[]>([])
  const [venuePollPoolIndex, setVenuePollPoolIndex] = useState(0)

  useEffect(() => {
    if (draft.inviteMode === 'selected' && draft.selectedMemberIds.size === 0 && members.length > 0) {
      dispatchDraft({ type: 'init_selected_members', ids: members.map(m => m.id) })
    }
  }, [draft.inviteMode, members])

  useEffect(() => {
    if (showQuickBill && quickBillSelectedIds.size === 0 && members.length > 0) {
      setQuickBillSelectedIds(new Set(members.map(m => m.id)))
    }
  }, [showQuickBill, members])

  function reset() {
    setActiveType(null)
    setMomentText('')
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setMomentError('')
    dispatchDraft({ type: 'reset' })
    setHangoutError('')
    setPollDateInput('')
    setConfirmingDiscard(false)
    setVenuePollPool([])
    setVenuePollPoolIndex(0)
  }

  function handleCancelHangout() {
    if (isDraftEmpty(draft)) {
      reset()
      return
    }
    setConfirmingDiscard(true)
  }

  function addPollDate() {
    if (!pollDateInput || draft.pollDates.length >= 5 || draft.pollDates.includes(pollDateInput)) return
    dispatchDraft({ type: 'add_poll_date', date: pollDateInput })
    setPollDateInput('')
  }

  function removePollDate(d: string) {
    dispatchDraft({ type: 'remove_poll_date', date: d })
  }

  function toggleSelectedMember(id: string) {
    dispatchDraft({ type: 'toggle_member', id })
  }

  function toggleSurpriseMember(id: string) {
    dispatchDraft({ type: 'toggle_surprise_member', id })
  }

  function toggleEventRestriction(id: string) {
    dispatchDraft({ type: 'toggle_restriction', id })
  }

  function toggleQuickBillMember(id: string) {
    setQuickBillSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getVenueName() {
    if (draft.whereMode === 'home') return 'Someone\'s place'
    if (draft.whereMode === 'online') return 'Online hangout'
    if (draft.whereMode === 'manual') return draft.manualVenue
    return draft.selectedVenue?.name || ''
  }

  function getVenueAddress() {
    if (draft.whereMode === 'home') return draft.manualAddress
    if (draft.whereMode === 'manual') return draft.manualAddress
    return draft.selectedVenue?.location?.formatted_address || ''
  }

  function getVenueMapsUrl() {
    if (draft.selectedVenue?.google_maps_url) return draft.selectedVenue.google_maps_url
    const name = getVenueName()
    return name ? `https://www.google.com/maps/search/${encodeURIComponent(name)}` : null
  }

  function getVenueBookingUrl() {
    return draft.selectedVenue?.booking_url || null
  }

  function getVenueCoords(): { lat: number | null; lng: number | null } {
    return {
      lat: draft.selectedVenue?.lat || null,
      lng: draft.selectedVenue?.lng || null,
    }
  }

  async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`)
      const data = await res.json()
      if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch {}
    return null
  }

  async function fetchVenuePollSuggestions() {
    setFetchingVenuePoll(true)
    setHangoutError('')
    try {
      const category = VIBE_TO_CATEGORY[draft.briefVibe] || '13000'
      const groupSize = draft.inviteMode === 'selected' ? draft.selectedMemberIds.size : members.length
      const coords = (currentUser?.resident_city && await geocodeCity(currentUser.resident_city))
        || { lat: 43.5890, lng: -79.6441 } // Mississauga fallback, matches Discover.tsx

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setHangoutError('You need to be signed in to post.'); setFetchingVenuePoll(false); return }

      const params = new URLSearchParams({ ll: `${coords.lat},${coords.lng}`, categories: category })
      if (groupSize > 2) params.set('min_group', String(groupSize))
      const res = await fetch(`/api/venues?${params}`, { headers: { Authorization: 'Bearer ' + session.access_token } })
      const data = await res.json()
      const results = data.results || []
      if (results.length === 0) {
        setHangoutError('No venue suggestions found nearby. Try a different vibe.')
        setFetchingVenuePoll(false)
        return
      }
      setVenuePollPool(results)
      setVenuePollPoolIndex(Math.min(3, results.length))
      dispatchDraft({ type: 'set', field: 'venuePollOptions', value: results.slice(0, 3) })
    } catch {
      setHangoutError('Could not load venue suggestions. Please try again.')
    }
    setFetchingVenuePoll(false)
  }

  function swapVenuePollOption(index: number) {
    if (venuePollPoolIndex >= venuePollPool.length) return
    const next = venuePollPool[venuePollPoolIndex]
    setVenuePollPoolIndex(i => i + 1)
    const updated = draft.venuePollOptions.map((v: any, i: number) => (i === index ? next : v))
    dispatchDraft({ type: 'set', field: 'venuePollOptions', value: updated })
  }

  function handleMomentPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setMomentError('File is too large. Maximum size is 100 MB.')
      return
    }
    const isVideo = file.type.startsWith('video/')
    setMomentMediaType(isVideo ? 'video' : 'image')
    setMomentPhoto(file)
    setMomentPhotoPreview(URL.createObjectURL(file))
  }

  async function postMoment() {
    if ((!momentText.trim() && !momentPhoto) || posting) return
    setPosting(true)
    setMomentError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMomentError('You need to be signed in to post.'); setPosting(false); return }

    const { data: newPost, error: postError } = await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: momentText.trim() || null,
      post_type: 'moment',
    }).select().single()

    if (postError || !newPost) {
      setMomentError('Could not post. Please try again.')
      setPosting(false)
      return
    }

    if (momentPhoto) {
      const isVideo = momentMediaType === 'video'
      const uploadFile = isVideo ? momentPhoto : await compressImage(momentPhoto)
      const ext = uploadFile.name.split('.').pop()
      const storagePath = `${knotId}/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(storagePath, uploadFile)
      if (uploadError) {
        setMomentError('Post shared, but the media failed to upload.')
      } else {
        const { error: photoInsertError } = await supabase.from('photos').insert({
          knot_id:      knotId,
          post_id:      newPost.id,
          uploaded_by:  user.id,
          storage_path: storagePath,
          file_name:    uploadFile.name,
          file_size:    uploadFile.size,
          media_type:   momentMediaType,
        })
        if (photoInsertError) setMomentError('Post shared, but the media failed to save.')
      }
    }

    const actorName = currentUser?.name || 'Someone'
    await notifyKnotMembers({
      knotId,
      actorId: user.id,
      type: 'new_moment',
      message: `${actorName} posted${momentText.trim() ? `: "${momentText.trim().substring(0, 60)}"` : ' a photo'}`,
    })

    setPosting(false)
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setMomentMediaType('image')
    reset()
    onPosted()
  }

  async function postQuickBill() {
    if (!quickBillDesc.trim() || !quickBillAmount || quickBillPosting) return
    const amount = parseFloat(quickBillAmount)
    if (isNaN(amount) || amount <= 0) { setQuickBillError('Enter a valid amount.'); return }
    const splitIds = Array.from(quickBillSelectedIds)
    if (splitIds.length === 0) { setQuickBillError('Select at least one person to split with.'); return }
    setQuickBillPosting(true)
    setQuickBillError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQuickBillError('You need to be signed in to add a bill.'); setQuickBillPosting(false); return }

    const share = amount / splitIds.length
    const { data: bill, error } = await supabase.from('bills').insert({
      knot_id: knotId, added_by: user.id, total_amount: amount,
      description: quickBillDesc.trim(), split_type: 'equal',
    }).select().single()
    if (error || !bill) { setQuickBillError('Could not add the bill.'); setQuickBillPosting(false); return }

    const splits = splitIds.map((uid: string) => ({ bill_id: bill.id, user_id: uid, amount: parseFloat(share.toFixed(2)), settled: uid === user.id }))
    const { error: splitError } = await supabase.from('bill_splits').insert(splits)
    if (splitError) { setQuickBillError('Bill added, but the split failed to save.'); setQuickBillPosting(false); return }

    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: `added a bill — $${amount.toFixed(2)} for ${quickBillDesc.trim()}, split ${splitIds.length} ways`,
      post_type: 'bill',
    })

    toast.success('Bill added and split with the group.')
    setQuickBillPosting(false)
    setQuickBillDesc('')
    setQuickBillAmount('')
    setQuickBillSelectedIds(new Set())
    setShowQuickBill(false)
    onPosted()
  }

  async function searchVenueByName(query: string) {
    if (query.trim().length < 2) { setVenueResults([]); return }
    setSearchingVenue(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(query) + '&types=establishment', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      setVenueResults(data.suggestions || [])
    } catch {}
    setSearchingVenue(false)
  }

  async function selectVenueFromSearch(suggestion: any) {
    setSearchingVenue(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?place_id=' + suggestion.place_id, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      const place = data.place || {}
      dispatchDraft({
        type: 'select_venue',
        whereMode: 'search',
        venue: {
          name: suggestion.main_text,
          place_id: suggestion.place_id,
          fsq_id: suggestion.place_id,
          location: { formatted_address: suggestion.secondary_text || place.formatted_address || '' },
          lat: place.lat || null,
          lng: place.lng || null,
          google_maps_url: `https://www.google.com/maps/place/?q=place_id:${suggestion.place_id}`,
        },
      })
      setVenueResults([])
      setVenueSearch('')
    } catch {}
    setSearchingVenue(false)
  }

  async function searchCinemaByName(query: string) {
    if (query.trim().length < 2) { setCinemaResults([]); return }
    setSearchingCinema(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(query) + '&types=movie_theater', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      setCinemaResults(data.suggestions || [])
    } catch {}
    setSearchingCinema(false)
  }

  async function selectCinemaFromSearch(suggestion: any) {
    setSearchingCinema(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?place_id=' + suggestion.place_id, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      const place = data.place || {}
      dispatchDraft({
        type: 'select_venue',
        venue: {
          name: suggestion.main_text,
          place_id: suggestion.place_id,
          fsq_id: suggestion.place_id,
          location: { formatted_address: suggestion.secondary_text || place.formatted_address || '' },
          lat: place.lat || null,
          lng: place.lng || null,
          google_maps_url: `https://www.google.com/maps/place/?q=place_id:${suggestion.place_id}`,
        },
      })
      setCinemaResults([])
      setCinemaSearch('')
    } catch {}
    setSearchingCinema(false)
  }

  async function createDailyRoom(hangoutId: string): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null
      const res = await fetch('/api/daily/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ hangoutId }),
      })
      const data = await res.json()
      return data.url || null
    } catch {
      return null
    }
  }

  async function postHangout() {
    if (!currentUser || creating) return

    const isPollMode = draft.whenType === 'pick' && draft.dateMode === 'poll'
    if (isPollMode && draft.pollDates.length < 2) {
      setHangoutError('Add at least 2 dates to poll the group.')
      return
    }

    const isVenuePollMode = draft.whereMode === 'poll'
    if (isVenuePollMode && draft.venuePollOptions.length === 0) {
      setHangoutError('Fetch venue suggestions before posting, or pick a different location option.')
      return
    }

    setCreating(true)
    setHangoutError('')

    const venueName    = getVenueName()
    const venueAddress = getVenueAddress()
    const title        = draft.hangoutTitle.trim() || venueName || 'Hangout'

    let startTime: string | null = null
    let hangoutType = 'planned'

    if (draft.whenType === 'now') {
      startTime   = new Date().toISOString()
      hangoutType = 'spontaneous'
    } else if (draft.whenType === 'pick') {
      if (!isPollMode) {
        if (!draft.scheduledFor) { setHangoutError('Please pick a date and time.'); setCreating(false); return }
        startTime = draft.scheduledFor.toISOString()
      }
    } else if (draft.whenType === 'weekly') {
      startTime   = getNextWeekday(draft.recurrenceDay, draft.recurrenceTime)
      hangoutType = 'recurring'
    }

    if (draft.whereMode === 'cinema') hangoutType = 'planned'

    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setHangoutError('You need to be signed in to post.'); setCreating(false); return }

    const actorName = currentUser.name || 'Someone'
    let content = ''
    if (isPollMode) {
      content = `${actorName} is checking availability for ${title} — vote on your dates`
    } else if (isVenuePollMode) {
      content = `${actorName} wants the group to pick a venue for ${title} — vote now`
    } else if (draft.whenType === 'now') {
      content = `${actorName} is at ${venueName || title} — the night is on!`
    } else if (draft.whenType === 'weekly') {
      content = `${actorName} set up a weekly hangout — ${DAYS[draft.recurrenceDay]}s at ${draft.recurrenceTime}${venueName ? ' at ' + venueName : ''}`
    } else if (draft.whereMode === 'cinema' && draft.movieTitle.trim()) {
      content = `${actorName} planned a movie night — ${draft.movieTitle.trim()} at ${venueName}${draft.movieShowtime ? ' — ' + formatDate(draft.movieShowtime.toISOString()) : ''}`
    } else {
      content = `${actorName} planned a hangout${venueName ? ' at ' + venueName : ''}${startTime ? ' — ' + formatDate(startTime) : ''}`
    }

    const pInput: Record<string, any> = {
      knot_id:            knotId,
      title,
      type:                hangoutType,
      scheduled_for:       startTime,
      venue_name:          venueName || null,
      venue_address:       venueAddress || null,
      venue_place_id:      draft.selectedVenue?.place_id || draft.selectedVenue?.fsq_id || null,
      venue_lat:           getVenueCoords().lat,
      venue_lng:           getVenueCoords().lng,
      venue_category:      draft.selectedVenue?.category_id || null,
      venue_maps_url:      getVenueMapsUrl(),
      venue_booking_url:   getVenueBookingUrl(),
      meeting_url:         draft.whereMode === 'online' ? (draft.meetingUrl.trim() || null) : null,
      brief:               draft.briefNote.trim() || null,
      brief_vibe:          draft.briefVibe || null,
      brief_budget:        draft.briefBudget || null,
      movie_title:         draft.whereMode === 'cinema' ? (draft.movieTitle.trim() || null) : null,
      movie_showtime:      draft.whereMode === 'cinema' && draft.movieShowtime ? draft.movieShowtime.toISOString() : null,
      event_restrictions:  draft.eventRestrictions,
      invite_mode:         draft.inviteMode,
      is_surprise:         draft.surpriseMode,
      reveal_at:           draft.surpriseMode && draft.revealAt ? draft.revealAt.toISOString() : null,
      poll_mode:           isPollMode,
      poll_title:          title,
      is_standalone:       false,
      post_content:        content,
      post_type:           (isPollMode || isVenuePollMode) ? 'poll' : 'hangout',
    }

    if (draft.inviteMode === 'selected') {
      pInput.selected_member_ids = Array.from(draft.selectedMemberIds)
    }
    if (draft.surpriseMode && draft.revealAt && draft.surpriseMemberIds.size > 0) {
      pInput.surprise_member_ids = Array.from(draft.surpriseMemberIds)
    }
    if (isPollMode) {
      pInput.poll_options = draft.pollDates.map((d, i) => ({ date: d, sort_order: i }))
    }
    if (isVenuePollMode) {
      pInput.venue_options = draft.venuePollOptions.map((v: any) => ({
        venue_place_id:    v.fsq_id || null,
        venue_name:        v.name || null,
        venue_address:     v.location?.formatted_address || null,
        venue_lat:         v.lat ?? null,
        venue_lng:         v.lng ?? null,
        venue_category:    v.categories?.[0]?.name || null,
        venue_photo_url:   v.photo_url || null,
        venue_rating:      v.rating ?? null,
        price_level:       v.price ?? null,
        restriction_notes: draft.eventRestrictions.length > 0 ? draft.eventRestrictions.join(', ') : null,
      }))
    }

    const { data, error } = await supabase.rpc('create_hangout', { p_input: pInput })

    if (error || !data || data.error) {
      const code = data?.error
      const message =
        code === 'not_authenticated' ? 'You need to be signed in to post.' :
        code === 'not_member'        ? 'You are not a member of this Knot.' :
        'Could not create the hangout. Please try again.'
      toast.error(message)
      setCreating(false)
      return
    }

    const newHangoutId = data.hangout_id as string

    track(supabase, 'hangout_created', {
      hangout_id: newHangoutId,
      type: hangoutType,
      has_venue: !!venueName,
      poll_mode: isPollMode,
    }, knotId)

    if (draft.whereMode === 'online' && !draft.meetingUrl.trim()) {
      const dailyUrl = await createDailyRoom(newHangoutId)
      if (dailyUrl) {
        await supabase.from('hangouts').update({ meeting_url: dailyUrl }).eq('id', newHangoutId)
      }
    }

    await notifyKnotMembers({
      knotId,
      actorId:  authUser.id,
      type:     'new_hangout',
      message:  content,
      entityId: newHangoutId,
    })

    setCreating(false)
    reset()
    onPosted()
  }

  useEffect(() => {
    if (activeType !== 'hangout' || !knotId) return
    setLoadingSuggestions(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoadingSuggestions(false); return }
      fetch('/api/recommendations?knot_id=' + knotId, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
        .then(r => r.json())
        .then(data => { if (data.hasHistory) setGroupSuggestions(data) })
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false))
    })
  }, [activeType, knotId])

  const userName  = currentUser?.name || 'You'
  const userInitials = userName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  const [panel, setPanel] = useState<'feed'|'when'|'where'|'more'|'moment'|'bill'>('feed')

  function getWhenLabel(): string {
    if (draft.whenType === 'now') return 'Now'
    if (draft.whenType === 'weekly') return `Every ${DAYS[draft.recurrenceDay]}`
    if (draft.scheduledFor) return formatDate(draft.scheduledFor.toISOString())
    if (draft.dateMode === 'poll' && draft.pollDates.length > 0) return `${draft.pollDates.length} dates`
    return ''
  }

  function getWhereLabel(): string {
    if (draft.whereMode === 'home') return "Someone's place"
    if (draft.whereMode === 'online') return 'Online'
    if (draft.whereMode === 'tbd') return 'TBD'
    if (draft.whereMode === 'poll' && draft.venuePollOptions.length > 0) return 'Group poll'
    if (draft.selectedVenue?.name) return draft.selectedVenue.name
    if (draft.manualVenue) return draft.manualVenue
    return ''
  }

  const whenLabel = getWhenLabel()
  const whereLabel = getWhereLabel()
  const hasWhen = !!whenLabel
  const hasWhere = !!whereLabel
  const canPost = !!draft.hangoutTitle.trim() || hasWhen || hasWhere

  const chipBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    borderRadius: 8, padding: '6px 10px',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', border: 'none', transition: 'all 0.12s',
  }
  const chipOpen: React.CSSProperties = {
    ...chipBase, background: 'var(--bg3)',
    border: '1px dashed var(--border2)', color: 'var(--text3)',
  }
  const chipFilled: React.CSSProperties = {
    ...chipBase, background: '#111', color: 'var(--yellow)', border: '1px solid #111',
  }
  const btnYellow: React.CSSProperties = {
    background: 'var(--yellow)', border: 'none', borderRadius: 10,
    color: '#111', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
    padding: '11px 0', width: '100%', cursor: 'pointer',
  }
  const btnGhost: React.CSSProperties = {
    background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10,
    color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
    padding: '9px 14px', cursor: 'pointer',
  }
  const panelSheet: React.CSSProperties = {
    background: 'var(--bg2)', borderTop: '1px solid var(--border)',
    padding: '16px', maxHeight: 480, overflowY: 'auto',
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const, color: 'var(--text3)', marginBottom: 10,
  }
  const moreItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer',
  }
  const moreIcon: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, background: 'var(--bg3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>

      {/* FEED: chip strip + composer bar */}
      {panel === 'feed' && (
        <>
          {(draft.hangoutTitle.trim() || hasWhen || hasWhere) && (
            <div style={{ padding: '12px 14px 8px', borderBottom: '0.5px solid var(--border)' }}>
              {draft.hangoutTitle.trim() && (
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: -0.2 }}>
                  {draft.hangoutTitle}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setPanel('when')} style={hasWhen ? chipFilled : chipOpen}>
                  <span style={{ fontSize: 12 }}>📅</span>
                  {hasWhen ? whenLabel : 'When?'}
                </button>
                <button onClick={() => setPanel('where')} style={hasWhere ? chipFilled : chipOpen}>
                  <span style={{ fontSize: 12 }}>📍</span>
                  {hasWhere ? whereLabel : 'Where?'}
                </button>
                <button onClick={() => setPanel('more')} style={chipOpen}>
                  <span style={{ fontSize: 12 }}>⋯</span>
                  More
                </button>
              </div>
              {hangoutError && <div className="error-banner" style={{ marginTop: 8 }}>{hangoutError}</div>}
            </div>
          )}

          {groupSuggestions && groupSuggestions.topVenues?.length > 0 && !draft.hangoutTitle && (
            <div style={{ padding: '8px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 2 }}>Your crew loves</span>
              {groupSuggestions.topVenues.slice(0, 3).map((v: any) => (
                <button key={v.name}
                  onClick={() => dispatchDraft({ type: 'set', field: 'hangoutTitle', value: v.name })}
                  style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid var(--yellow-dim)', background: 'var(--yellow-soft)', color: 'var(--yellow)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {v.name}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {userInitials}
            </div>
            <input
              value={draft.hangoutTitle}
              onChange={e => {
                dispatchDraft({ type: 'set', field: 'hangoutTitle', value: e.target.value })
                if (activeType !== 'hangout') setActiveType('hangout')
              }}
              onFocus={() => { if (activeType !== 'hangout') setActiveType('hangout') }}
              placeholder={momentPlaceholder}
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 14px', fontSize: 13, color: 'var(--text)', outline: 'none', fontFamily: 'inherit', caretColor: 'var(--yellow)' }}
            />
            <button onClick={() => setPanel('more')}
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: 'var(--text3)', fontSize: 18 }}
              aria-label="More options">+
            </button>
            {canPost ? (
              <button onClick={postHangout} disabled={creating}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--yellow)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: creating ? 'not-allowed' : 'pointer', flexShrink: 0, fontSize: 15, opacity: creating ? 0.6 : 1 }}
                aria-label="Post hangout">{creating ? '…' : '↑'}
              </button>
            ) : (
              <button onClick={() => setPanel('moment')}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg3)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 15, color: 'var(--text3)' }}
                aria-label="Post moment">↑
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '2px 12px 10px', borderTop: '0.5px solid var(--border)' }}>
            <button onClick={() => setPanel('moment')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              📷 Moment
            </button>
            <button onClick={() => { setActiveType('hangout'); setPanel('when') }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--yellow-dim)', background: 'var(--yellow-soft)', color: 'var(--yellow)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              🗓 Plan a hangout
            </button>
            <button onClick={() => setPanel('bill')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              🧾 Bill
            </button>
          </div>
        </>
      )}

      {/* BACK BAR */}
      {panel !== 'feed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg2)' }}>
          <button onClick={() => setPanel('feed')}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
            ← Back
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {panel === 'when' ? 'When?' : panel === 'where' ? 'Where?' : panel === 'moment' ? 'Moment' : panel === 'bill' ? 'Add bill' : 'More options'}
          </span>
          {draft.hangoutTitle.trim() && (
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {draft.hangoutTitle}
            </span>
          )}
        </div>
      )}

      {/* WHEN PANEL */}
      {panel === 'when' && (
        <div style={panelSheet}>
          <div style={sectionLabel}>Type</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {([
              { id: 'now' as WhenType, label: 'Now' },
              { id: 'pick' as WhenType, label: 'Pick a time' },
              { id: 'weekly' as WhenType, label: 'Every week' },
            ]).map(({ id, label }) => (
              <button key={id} onClick={() => dispatchDraft({ type: 'set', field: 'whenType', value: id })}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${draft.whenType === id ? 'var(--yellow)' : 'var(--border2)'}`, background: draft.whenType === id ? 'var(--yellow-soft)' : 'transparent', color: draft.whenType === id ? 'var(--yellow)' : 'var(--text2)', fontSize: 12, fontWeight: draft.whenType === id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>

          {draft.whenType === 'pick' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {([{ id: 'set' as const, label: 'Set a date' }, { id: 'poll' as const, label: 'Poll the group' }]).map(({ id, label }) => (
                  <button key={id} onClick={() => dispatchDraft({ type: 'set', field: 'dateMode', value: id })}
                    style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${draft.dateMode === id ? 'var(--yellow)' : 'var(--border2)'}`, background: draft.dateMode === id ? 'var(--yellow-soft)' : 'transparent', color: draft.dateMode === id ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: draft.dateMode === id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {label}
                  </button>
                ))}
              </div>

              {draft.dateMode === 'set' && (
                <>
                  <div style={sectionLabel}>Date</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                    {[
                      { label: 'Today', date: new Date() },
                      { label: 'Tomorrow', date: new Date(Date.now() + 86400000) },
                      { label: 'This Friday', date: (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return d })() },
                      { label: 'This Saturday', date: (() => { const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d })() },
                    ].map(({ label, date }) => {
                      const isSelected = draft.scheduledFor?.toDateString() === date.toDateString()
                      return (
                        <button key={label}
                          onClick={() => {
                            const d = new Date(date)
                            if (draft.scheduledFor) { d.setHours(draft.scheduledFor.getHours(), draft.scheduledFor.getMinutes()) }
                            else { d.setHours(20, 0) }
                            dispatchDraft({ type: 'set', field: 'scheduledFor', value: d })
                          }}
                          style={{ padding: '9px 10px', borderRadius: 9, border: `1px solid ${isSelected ? 'var(--yellow)' : 'var(--border2)'}`, background: isSelected ? '#111' : 'var(--bg3)', color: isSelected ? 'var(--yellow)' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
                          <div style={{ fontSize: 10, color: isSelected ? 'rgba(248,189,3,0.7)' : 'var(--text3)', marginTop: 1 }}>
                            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <div style={sectionLabel}>Time</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                    {[
                      { label: '7 PM', h: 19 }, { label: '8 PM', h: 20 }, { label: '9 PM', h: 21 },
                      { label: '10 PM', h: 22 }, { label: '11 PM', h: 23 }, { label: 'TBD', h: null as null },
                    ].map(({ label, h }) => {
                      const isSelected = h !== null && draft.scheduledFor?.getHours() === h
                      return (
                        <button key={label}
                          onClick={() => {
                            if (h === null) { dispatchDraft({ type: 'set', field: 'scheduledFor', value: null }); return }
                            const d = draft.scheduledFor ? new Date(draft.scheduledFor) : new Date()
                            d.setHours(h, 0, 0, 0)
                            dispatchDraft({ type: 'set', field: 'scheduledFor', value: d })
                          }}
                          style={{ padding: '9px 6px', borderRadius: 9, border: `1px solid ${isSelected ? 'var(--yellow)' : 'var(--border2)'}`, background: isSelected ? '#111' : 'var(--bg3)', color: isSelected ? 'var(--yellow)' : 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: isSelected ? 700 : 500, textAlign: 'center' as const }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  <DateTimePicker value={draft.scheduledFor} onChange={date => dispatchDraft({ type: 'set', field: 'scheduledFor', value: date })} minDate={new Date()} />
                </>
              )}

              {draft.dateMode === 'poll' && (
                <div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input type="date" value={pollDateInput} onChange={e => setPollDateInput(e.target.value)} min={new Date().toISOString().split('T')[0]}
                      style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                    <button onClick={addPollDate} disabled={!pollDateInput || draft.pollDates.length >= 5}
                      style={{ padding: '9px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!pollDateInput || draft.pollDates.length >= 5) ? 0.5 : 1 }}>
                      Add
                    </button>
                  </div>
                  {draft.pollDates.map(d => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <button onClick={() => removePollDate(d)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{draft.pollDates.length}/5 dates added</div>
                </div>
              )}
            </>
          )}

          {draft.whenType === 'weekly' && (
            <div>
              <div style={sectionLabel}>Day</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {DAYS.map((d, i) => (
                  <button key={d} onClick={() => dispatchDraft({ type: 'set', field: 'recurrenceDay', value: i })}
                    style={{ flex: 1, padding: '8px 4px', border: `1px solid ${draft.recurrenceDay === i ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 6, cursor: 'pointer', background: draft.recurrenceDay === i ? 'var(--yellow-soft)' : 'transparent', color: draft.recurrenceDay === i ? 'var(--yellow)' : 'var(--text2)', fontSize: 11, fontWeight: draft.recurrenceDay === i ? 700 : 500, fontFamily: 'inherit' }}>
                    {d}
                  </button>
                ))}
              </div>
              <div style={sectionLabel}>Time</div>
              <input type="time" value={draft.recurrenceTime} onChange={e => dispatchDraft({ type: 'set', field: 'recurrenceTime', value: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
          )}

          <button onClick={() => setPanel('feed')} style={{ ...btnYellow, marginTop: 16 }}>
            {hasWhen ? `Set ${whenLabel}` : 'Done'}
          </button>
        </div>
      )}

      {/* WHERE PANEL */}
      {panel === 'where' && (
        <div style={panelSheet}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' as const }}>
            {([
              { id: 'search' as WhereMode, label: 'Find a spot' },
              { id: 'home' as WhereMode, label: "Someone's place" },
              { id: 'online' as WhereMode, label: 'Online' },
              { id: 'cinema' as WhereMode, label: String.fromCodePoint(0x1F3A5) + ' Movies' },
              { id: 'tbd' as WhereMode, label: 'TBD' },
            ]).map(({ id, label }) => (
              <button key={id} onClick={() => dispatchDraft({ type: 'set', field: 'whereMode', value: id })}
                style={{ padding: '6px 11px', borderRadius: 20, border: `1px solid ${draft.whereMode === id ? '#111' : 'var(--border2)'}`, background: draft.whereMode === id ? '#111' : 'transparent', color: draft.whereMode === id ? '#fff' : 'var(--text3)', fontSize: 11, fontWeight: draft.whereMode === id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>

          {(draft.whereMode === 'search' || draft.whereMode === 'discover') && !draft.selectedVenue && (
            <div>
              <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input value={venueSearch} onChange={e => { setVenueSearch(e.target.value); searchVenueByName(e.target.value) }}
                    placeholder="Bars, restaurants, venues..." autoFocus
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                  {venueResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                      {venueResults.map((s: any) => (
                        <div key={s.place_id} onClick={() => { selectVenueFromSearch(s); setPanel('feed') }}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.main_text}</div>
                          {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.secondary_text}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => { dispatchDraft({ type: 'set', field: 'whereMode', value: 'poll' }); fetchVenuePollSuggestions() }}
                  style={{ padding: '8px 10px', borderRadius: 9, border: '1px solid var(--yellow-dim)', background: 'var(--yellow-soft)', color: 'var(--yellow)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                  🗺 Fair spot
                </button>
              </div>
              <Discover members={members} currentUser={currentUser} onVenueSelect={(venue: any) => { dispatchDraft({ type: 'select_venue', venue, whereMode: 'discover' }); setPanel('feed') }} />
            </div>
          )}

          {draft.selectedVenue && (draft.whereMode === 'search' || draft.whereMode === 'discover') && (
            <div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {draft.selectedVenue.photo_url && <img src={draft.selectedVenue.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{draft.selectedVenue.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{draft.selectedVenue.location?.formatted_address}</div>
                </div>
                <button onClick={() => dispatchDraft({ type: 'set', field: 'selectedVenue', value: null })}
                  style={{ padding: '4px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
              </div>
              <button onClick={() => setPanel('feed')} style={btnYellow}>Use this spot</button>
            </div>
          )}

          {draft.whereMode === 'poll' && (
            <div>
              {fetchingVenuePoll && <div style={{ fontSize: 12, color: 'var(--text3)', padding: '10px 0' }}>Finding venues nearby…</div>}
              {!fetchingVenuePoll && draft.venuePollOptions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  <div style={sectionLabel}>Group will vote on</div>
                  {draft.venuePollOptions.map((v: any, i: number) => (
                    <div key={v.fsq_id || i} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      {v.photo_url ? <img src={v.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg2)', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{v.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{v.location?.formatted_address}</div>
                      </div>
                      <button onClick={() => swapVenuePollOption(i)} disabled={venuePollPoolIndex >= venuePollPool.length}
                        style={{ padding: '5px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: venuePollPoolIndex >= venuePollPool.length ? 0.4 : 1, flexShrink: 0 }}>
                        Swap
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { dispatchDraft({ type: 'set', field: 'whereMode', value: 'none' }); dispatchDraft({ type: 'set', field: 'venuePollOptions', value: [] }); setVenuePollPool([]); setVenuePollPoolIndex(0) }} style={btnGhost}>Cancel</button>
                {draft.venuePollOptions.length > 0 && <button onClick={() => setPanel('feed')} style={{ ...btnYellow, width: 'auto', flex: 1 }}>Post as poll</button>}
              </div>
            </div>
          )}

          {draft.whereMode === 'cinema' && !draft.selectedVenue && (
            <div style={{ position: 'relative' }}>
              <input value={cinemaSearch} onChange={e => { setCinemaSearch(e.target.value); searchCinemaByName(e.target.value) }} placeholder="Search for a cinema..." autoFocus
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
              {cinemaResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                  {cinemaResults.map((s: any) => (
                    <div key={s.place_id} onClick={() => { selectCinemaFromSearch(s); setCinemaSearch(''); setCinemaResults([]) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.main_text}</div>
                      {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.secondary_text}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {draft.whereMode === 'cinema' && draft.selectedVenue && (
            <div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{draft.selectedVenue.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{draft.selectedVenue.location?.formatted_address}</div>
                <button onClick={() => dispatchDraft({ type: 'set', field: 'selectedVenue', value: null })} style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Change cinema</button>
              </div>
              <input value={draft.movieTitle} onChange={e => dispatchDraft({ type: 'set', field: 'movieTitle', value: e.target.value })} placeholder="Movie title"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 10 }} />
              <DateTimePicker value={draft.movieShowtime} onChange={v => dispatchDraft({ type: 'set', field: 'movieShowtime', value: v })} minDate={new Date()} />
              <button onClick={() => setPanel('feed')} style={{ ...btnYellow, marginTop: 14 }}>Done</button>
            </div>
          )}

          {draft.whereMode === 'online' && (
            <div>
              <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Video call included</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>A Daily.co room will be created automatically. Members join directly inside the app.</div>
              </div>
              <button onClick={() => setPanel('feed')} style={btnYellow}>Done</button>
            </div>
          )}

          {draft.whereMode === 'home' && (
            <div>
              <input value={draft.manualAddress} onChange={e => dispatchDraft({ type: 'set', field: 'manualAddress', value: e.target.value })} placeholder="Address (optional — only shown to confirmed attendees)"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 12 }} />
              <button onClick={() => setPanel('feed')} style={btnYellow}>Done</button>
            </div>
          )}

          {draft.whereMode === 'tbd' && (
            <div>
              <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                No venue set — the group will figure it out later.
              </div>
              <button onClick={() => setPanel('feed')} style={btnYellow}>Done</button>
            </div>
          )}
        </div>
      )}

      {/* MORE PANEL */}
      {panel === 'more' && (
        <div style={panelSheet}>
          {(draft.hangoutTitle.trim() || hasWhen || hasWhere) && (
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 12px', marginBottom: 16, fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--yellow)', display: 'inline-block', flexShrink: 0 }} />
              {[draft.hangoutTitle.trim(), whenLabel, whereLabel].filter(Boolean).join(' · ') || 'New hangout'}
            </div>
          )}

          <div style={sectionLabel}>Guest list</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {([{ id: 'all' as const, label: 'All members' }, { id: 'selected' as const, label: 'Select members' }]).map(({ id, label }) => (
              <button key={id} onClick={() => dispatchDraft({ type: 'set', field: 'inviteMode', value: id })}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${draft.inviteMode === id ? 'var(--yellow)' : 'var(--border2)'}`, background: draft.inviteMode === id ? 'var(--yellow-soft)' : 'transparent', color: draft.inviteMode === id ? 'var(--yellow)' : 'var(--text2)', fontSize: 12, fontWeight: draft.inviteMode === id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
          </div>
          {draft.inviteMode === 'selected' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {members.map(m => {
                const checked = draft.selectedMemberIds.has(m.id)
                return (
                  <div key={m.id} onClick={() => toggleSelectedMember(m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: checked ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, cursor: 'pointer' }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, background: checked ? 'var(--yellow)' : 'transparent', color: '#111', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked ? '✓' : ''}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
                  </div>
                )
              })}
            </div>
          )}

          <div style={sectionLabel}>Restrictions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 16 }}>
            {EVENT_RESTRICTION_OPTIONS.map((opt: any) => {
              const selected = draft.eventRestrictions.includes(opt.id)
              return (
                <button key={opt.id} onClick={() => toggleEventRestriction(opt.id)}
                  style={{ padding: '5px 11px', borderRadius: 20, border: `1px solid ${selected ? 'var(--yellow)' : 'var(--border2)'}`, background: selected ? 'var(--yellow-soft)' : 'transparent', color: selected ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: selected ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div style={sectionLabel}>Surprise mode</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: draft.surpriseMode ? 10 : 16 }}>
            <button onClick={() => dispatchDraft({ type: 'set', field: 'surpriseMode', value: !draft.surpriseMode })}
              style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0, background: draft.surpriseMode ? 'var(--yellow)' : 'var(--border2)', position: 'relative', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: draft.surpriseMode ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
            </button>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>Hide from specific members until reveal date</span>
          </div>
          {draft.surpriseMode && (
            <div style={{ marginBottom: 16 }}>
              <DateTimePicker value={draft.revealAt} onChange={v => dispatchDraft({ type: 'set', field: 'revealAt', value: v })} minDate={new Date()} />
              <div style={{ marginTop: 10, marginBottom: 6, fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Hide from</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {members.map(m => {
                  const checked = draft.surpriseMemberIds.has(m.id)
                  return (
                    <div key={m.id} onClick={() => toggleSurpriseMember(m.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: checked ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, cursor: 'pointer' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, background: checked ? 'var(--yellow)' : 'transparent', color: '#111', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {checked ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={sectionLabel}>Group brief</div>
          <input value={draft.briefNote} onChange={e => dispatchDraft({ type: 'set', field: 'briefNote', value: e.target.value })} placeholder="Any context for the group..."
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: 8 }}>
            {['Chill', 'Active', 'Party', 'Foodie', 'Culture', 'Outdoors'].map(v => (
              <button key={v} onClick={() => dispatchDraft({ type: 'set', field: 'briefVibe', value: draft.briefVibe === v ? '' : v })}
                style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${draft.briefVibe === v ? 'var(--yellow)' : 'var(--border2)'}`, background: draft.briefVibe === v ? 'var(--yellow-soft)' : 'transparent', color: draft.briefVibe === v ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: draft.briefVibe === v ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {v}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
            {[{ id: 'free', label: 'Free' }, { id: 'cheap', label: 'Cheap' }, { id: 'mid', label: 'Mid' }, { id: 'splurge', label: 'Splurge' }].map(b => (
              <button key={b.id} onClick={() => dispatchDraft({ type: 'set', field: 'briefBudget', value: draft.briefBudget === b.id ? '' : b.id })}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${draft.briefBudget === b.id ? 'var(--yellow)' : 'var(--border2)'}`, background: draft.briefBudget === b.id ? 'var(--yellow-soft)' : 'transparent', color: draft.briefBudget === b.id ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: draft.briefBudget === b.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                {b.label}
              </button>
            ))}
          </div>

          {confirmingDiscard ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' as const }}>Discard this plan?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmingDiscard(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Keep editing</button>
                <button onClick={() => { setConfirmingDiscard(false); reset(); setPanel('feed') }} style={{ flex: 1, padding: '10px', background: 'var(--danger)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Discard</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCancelHangout} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => { postHangout(); setPanel('feed') }} disabled={creating}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: creating ? 0.6 : 1 }}>
                {creating ? 'Posting…' : 'Drop it in the group'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MOMENT PANEL */}
      {panel === 'moment' && (
        <div style={panelSheet}>
          {momentError && <div className="error-banner" style={{ marginBottom: 10 }}>{momentError}</div>}
          {momentPhotoPreview && (
            <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 320 }}>
              {momentMediaType === 'video'
                ? <video src={momentPhotoPreview} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <img src={momentPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); setMomentMediaType('image'); if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = '' }}
                style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
            </div>
          )}
          <textarea value={momentText} onChange={e => setMomentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postMoment() }}
            placeholder={momentPlaceholder} autoFocus rows={3}
            style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const, marginBottom: 10, lineHeight: 1.5, boxSizing: 'border-box' as const }} />
          <input type="file" accept="image/*,video/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => momentPhotoInputRef.current?.click()} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
              📷 {momentPhoto ? 'Change' : 'Add photo'}
            </button>
            <button onClick={async () => { await postMoment(); setPanel('feed') }} disabled={(!momentText.trim() && !momentPhoto) || posting}
              style={{ ...btnYellow, width: 'auto', flex: 1, opacity: (!momentText.trim() && !momentPhoto) || posting ? 0.5 : 1 }}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* BILL PANEL */}
      {panel === 'bill' && (
        <div style={panelSheet}>
          {quickBillError && <div className="error-banner" style={{ marginBottom: 8 }}>{quickBillError}</div>}
          <input value={quickBillDesc} onChange={e => setQuickBillDesc(e.target.value)} placeholder="What was the bill for?"
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 8 }} />
          <input type="number" value={quickBillAmount} onChange={e => setQuickBillAmount(e.target.value)} placeholder="Total amount ($)"
            style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, marginBottom: 10 }} />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Split with</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', marginBottom: 10 }}>
            {members.map(m => {
              const checked = quickBillSelectedIds.has(m.id)
              return (
                <div key={m.id} onClick={() => toggleQuickBillMember(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: checked ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, background: checked ? 'var(--yellow)' : 'transparent', color: '#111', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {checked ? '✓' : ''}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{m.name}</span>
                </div>
              )
            })}
          </div>
          {quickBillAmount && !isNaN(parseFloat(quickBillAmount)) && quickBillSelectedIds.size > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
              ${(parseFloat(quickBillAmount) / quickBillSelectedIds.size).toFixed(2)} each, split {quickBillSelectedIds.size} ways
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setPanel('feed'); setQuickBillError('') }} style={btnGhost}>Cancel</button>
            <button onClick={async () => { await postQuickBill(); setPanel('feed') }} disabled={!quickBillDesc.trim() || !quickBillAmount || quickBillSelectedIds.size === 0 || quickBillPosting}
              style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !quickBillDesc.trim() || !quickBillAmount || quickBillSelectedIds.size === 0 || quickBillPosting ? 0.5 : 1 }}>
              {quickBillPosting ? 'Posting…' : 'Post bill'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
