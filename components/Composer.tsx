'use client'
import { useState, useRef, useEffect } from 'react'
import { ImageIcon, Calendar, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { notifyKnotMembers } from '@/lib/notifications'
import Discover from '@/components/Discover'
import { compressImage } from '@/lib/compressImage'
import DateTimePicker from '@/components/DateTimePicker'
import { useToast } from '@/components/ToastProvider'

type PostType = 'moment' | 'hangout'
type WhenType = 'now' | 'pick' | 'weekly'

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
  if (date.toDateString() === now.toDateString()) return `Tonight \u00B7 ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow \u00B7 ${time}`
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` \u00B7 ${time}`
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

  const [showQuickBill, setShowQuickBill]   = useState(false)
  const [quickBillDesc, setQuickBillDesc]   = useState('')
  const [quickBillAmount, setQuickBillAmount] = useState('')
  const [quickBillPosting, setQuickBillPosting] = useState(false)
  const [quickBillError, setQuickBillError] = useState('')

  const [momentText, setMomentText] = useState('')
  const [posting, setPosting]       = useState(false)
  const [momentPhoto, setMomentPhoto]               = useState<File | null>(null)
  const [momentPhotoPreview, setMomentPhotoPreview] = useState<string | null>(null)
  const [momentMediaType, setMomentMediaType] = useState<'image' | 'video'>('image')
  const [momentError, setMomentError] = useState('')
  const momentPhotoInputRef = useRef<HTMLInputElement>(null)

  const [whenType, setWhenType]           = useState<WhenType>('pick')
  const [scheduledFor, setScheduledFor]   = useState<Date | null>(null)
  const [recurrenceDay, setRecurrenceDay] = useState(5)
  const [recurrenceTime, setRecurrenceTime] = useState('19:00')
  const [whereMode, setWhereMode]         = useState<'none' | 'tbd' | 'discover' | 'manual' | 'home' | 'search' | 'online'>('none')
  const [selectedVenue, setSelectedVenue] = useState<any>(null)
  const [meetingUrl, setMeetingUrl] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [manualVenue, setManualVenue]     = useState('')
  const [venueSearch, setVenueSearch]     = useState('')
  const [venueResults, setVenueResults]   = useState<any[]>([])
  const [searchingVenue, setSearchingVenue] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [hangoutTitle, setHangoutTitle]   = useState('')
  const [creating, setCreating]           = useState(false)
  const [hangoutError, setHangoutError]   = useState('')
  const [briefNote, setBriefNote]         = useState('')
  const [briefVibe, setBriefVibe]         = useState('')
  const [briefBudget, setBriefBudget]     = useState('')
  const [groupSuggestions, setGroupSuggestions] = useState<any>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const [dateMode, setDateMode]           = useState<'set' | 'poll'>('set')
  const [pollDates, setPollDates]         = useState<string[]>([])
  const [pollDateInput, setPollDateInput] = useState('')

  const [inviteMode, setInviteMode]       = useState<'all' | 'selected'>('all')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [surpriseMode, setSurpriseMode]   = useState(false)
  const [revealAt, setRevealAt]           = useState<Date | null>(null)

  useEffect(() => {
    if (inviteMode === 'selected' && selectedMemberIds.size === 0 && members.length > 0) {
      setSelectedMemberIds(new Set(members.map(m => m.id)))
    }
  }, [inviteMode, members])

  function reset() {
    setActiveType(null)
    setMomentText('')
    setMomentPhoto(null)
    setMomentPhotoPreview(null)
    setMomentError('')
    setWhenType('pick')
    setScheduledFor(null)
    setRecurrenceDay(5)
    setRecurrenceTime('19:00')
    setWhereMode('none')
    setSelectedVenue(null)
    setManualVenue('')
    setManualAddress('')
    setVenueSearch('')
    setVenueResults([])
    setHangoutTitle('')
    setHangoutError('')
    setMeetingUrl('')
    setBriefNote('')
    setBriefVibe('')
    setBriefBudget('')
    setInviteMode('all')
    setSelectedMemberIds(new Set())
    setSurpriseMode(false)
    setRevealAt(null)
    setDateMode('set')
    setPollDates([])
    setPollDateInput('')
  }

  function addPollDate() {
    if (!pollDateInput || pollDates.length >= 5 || pollDates.includes(pollDateInput)) return
    setPollDates(prev => [...prev, pollDateInput].sort())
    setPollDateInput('')
  }

  function removePollDate(d: string) {
    setPollDates(prev => prev.filter(x => x !== d))
  }

  function toggleSelectedMember(id: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getVenueName() {
    if (whereMode === 'home') return 'Someone\'s place'
    if (whereMode === 'online') return 'Online hangout'
    if (whereMode === 'manual') return manualVenue
    return selectedVenue?.name || ''
  }

  function getVenueAddress() {
    if (whereMode === 'home') return manualAddress
    if (whereMode === 'manual') return manualAddress
    return selectedVenue?.location?.formatted_address || ''
  }

  function getVenueMapsUrl() {
    if (selectedVenue?.google_maps_url) return selectedVenue.google_maps_url
    const name = getVenueName()
    return name ? `https://www.google.com/maps/search/${encodeURIComponent(name)}` : null
  }

  function getVenueBookingUrl() {
    return selectedVenue?.booking_url || null
  }

  function getVenueCoords(): { lat: number | null; lng: number | null } {
    return {
      lat: selectedVenue?.lat || null,
      lng: selectedVenue?.lng || null,
    }
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
    setQuickBillPosting(true)
    setQuickBillError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQuickBillError('You need to be signed in to add a bill.'); setQuickBillPosting(false); return }

    const splitIds = members.map(m => m.id)
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
      content: `added a bill — $${amount.toFixed(2)} for ${quickBillDesc.trim()}, split ${splitIds.length} ways`,
      post_type: 'bill',
    })

    toast.success('Bill added and split with the group.')
    setQuickBillPosting(false)
    setQuickBillDesc('')
    setQuickBillAmount('')
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
      setSelectedVenue({
        name: suggestion.main_text,
        place_id: suggestion.place_id,
        fsq_id: suggestion.place_id,
        location: { formatted_address: suggestion.secondary_text || place.formatted_address || '' },
        lat: place.lat || null,
        lng: place.lng || null,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${suggestion.place_id}`,
      })
      setWhereMode('search')
      setVenueResults([])
      setVenueSearch('')
    } catch {}
    setSearchingVenue(false)
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

    const isPollMode = whenType === 'pick' && dateMode === 'poll'
    if (isPollMode && pollDates.length < 2) {
      setHangoutError('Add at least 2 dates to poll the group.')
      return
    }

    setCreating(true)
    setHangoutError('')

    const venueName    = getVenueName()
    const venueAddress = getVenueAddress()
    const title        = hangoutTitle.trim() || venueName || 'Hangout'

    let startTime: string | null = null
    let hangoutType = 'planned'
    let recurrence  = 'none'
    let recurrenceDay_: number | null = null
    let recurrenceTime_: string | null = null

    if (whenType === 'now') {
      startTime   = new Date().toISOString()
      hangoutType = 'spontaneous'
    } else if (whenType === 'pick') {
      if (!isPollMode) {
        if (!scheduledFor) { setHangoutError('Please pick a date and time.'); setCreating(false); return }
        startTime = scheduledFor.toISOString()
      }
    } else if (whenType === 'weekly') {
      startTime        = getNextWeekday(recurrenceDay, recurrenceTime)
      hangoutType      = 'recurring'
      recurrence       = 'weekly'
      recurrenceDay_   = recurrenceDay
      recurrenceTime_  = recurrenceTime
    }

    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setHangoutError('You need to be signed in to post.'); setCreating(false); return }

    const { data: h, error: hangoutInsertError } = await supabase.from('hangouts').insert({
      knot_id:           knotId,
      created_by:        authUser.id,
      title,
      type:              hangoutType,
      venue_name:        venueName || null,
      venue_address:     venueAddress || null,
      venue_maps_url:    getVenueMapsUrl(),
      venue_booking_url: getVenueBookingUrl(),
      venue_place_id:    selectedVenue?.place_id || selectedVenue?.fsq_id || null,
      venue_category:     selectedVenue?.category_id || null,
      meeting_url:       whereMode === 'online' ? (meetingUrl.trim() || null) : null,
      venue_lat:         getVenueCoords().lat,
      venue_lng:         getVenueCoords().lng,
      scheduled_for:     startTime,
      brief:             briefNote.trim() || null,
      brief_vibe:        briefVibe || null,
      brief_budget:      briefBudget || null,
      status:            isPollMode ? 'voting' : (whenType === 'now' ? 'live' : 'confirmed'),
      is_live:           whenType === 'now',
      recurrence,
      recurrence_day:    recurrenceDay_,
      recurrence_time:   recurrenceTime_,
      invite_mode:       inviteMode,
      is_surprise:       surpriseMode,
      reveal_at:         surpriseMode && revealAt ? revealAt.toISOString() : null,
    }).select().single()

    if (hangoutInsertError || !h) {
      setHangoutError('Could not create the hangout. Please try again.')
      setCreating(false)
      return
    }

    if (inviteMode === 'selected') {
      const includedIds = members.map(m => m.id).filter(id => selectedMemberIds.has(id))
      const excludedIds = members.map(m => m.id).filter(id => !selectedMemberIds.has(id))

      const includedRows = includedIds.map(uid => ({
        hangout_id:  h.id,
        user_id:     uid,
        invited_by:  authUser.id,
        status:      'pending',
        is_surprise: false,
        reveal_at:   null,
      }))

      const excludedRows = surpriseMode && revealAt
        ? excludedIds.map(uid => ({
            hangout_id:  h.id,
            user_id:     uid,
            invited_by:  authUser.id,
            status:      'pending',
            is_surprise: true,
            reveal_at:   revealAt.toISOString(),
          }))
        : []

      const inviteRows = [...includedRows, ...excludedRows]
      if (inviteRows.length > 0) {
        const { error: inviteError } = await supabase.from('hangout_invites').insert(inviteRows)
        if (inviteError) setHangoutError('Hangout created, but the guest list failed to save.')
      }
    }

    if (isPollMode) {
      const { data: poll, error: pollError } = await supabase.from('availability_polls').insert({
        hangout_id: h.id,
        knot_id:    knotId,
        created_by: authUser.id,
        title,
        status:     'open',
      }).select().single()

      if (pollError || !poll) {
        setHangoutError('Hangout created, but the poll failed to save.')
      } else {
        const optionRows = pollDates.map((d, i) => ({ poll_id: poll.id, date_option: d, sort_order: i }))
        const { error: optionsError } = await supabase.from('availability_poll_options').insert(optionRows)
        if (optionsError) setHangoutError('Poll created, but the date options failed to save.')
      }
    }

    if (whereMode === 'online' && !meetingUrl.trim()) {
      const dailyUrl = await createDailyRoom(h.id)
      if (dailyUrl) {
        await supabase.from('hangouts').update({ meeting_url: dailyUrl }).eq('id', h.id)
      }
    }

    const actorName = currentUser.name || 'Someone'
    let content = ''
    if (isPollMode) {
      content = `${actorName} is checking availability for ${title} \u2014 vote on your dates`
    } else if (whenType === 'now') {
      content = `${actorName} is at ${venueName || title} \u2014 the night is on!`
    } else if (whenType === 'weekly') {
      content = `${actorName} set up a weekly hangout \u2014 ${DAYS[recurrenceDay]}s at ${recurrenceTime}${venueName ? ' at ' + venueName : ''}`
    } else {
      content = `${actorName} planned a hangout${venueName ? ' at ' + venueName : ''}${startTime ? ' \u2014 ' + formatDate(startTime) : ''}`
    }

    const { data: newPost, error: postError } = await supabase.from('posts').insert({
      knot_id:    knotId,
      author_id:  authUser.id,
      hangout_id: h.id,
      content,
      post_type:  isPollMode ? 'poll' : 'hangout',
    }).select('id').single()

    if (postError || !newPost) {
      setHangoutError('Hangout created, but it could not be posted to the feed.')
    } else {
      const { error: updateError } = await supabase
        .from('hangouts')
        .update({ post_id: newPost.id })
        .eq('id', h.id)
      if (updateError) setHangoutError('Hangout posted, but a link-back step failed.')
    }

    await notifyKnotMembers({
      knotId,
      actorId:  authUser.id,
      type:     'new_hangout',
      message:  content,
      entityId: h.id,
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

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>

      <div style={{ display: 'flex', gap: 4, padding: 4, borderBottom: activeType ? '1px solid var(--border)' : 'none' }}>
        {([
          { type: 'moment' as PostType, label: 'Moment' },
          { type: 'hangout' as PostType, label: "Let's hang" },
        ]).map(({ type, label }) => (
          <button key={type}
            onClick={() => setActiveType(activeType === type ? null : type)}
            style={{
              flex: 1, padding: '14px 8px',
              background: activeType === type ? '#111' : 'transparent',
              border: 'none',
              borderRadius: 999,
              color: activeType === type ? '#fff' : 'var(--text2)',
              fontSize: 13, fontWeight: activeType === type ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {activeType === 'moment' && (
        <div style={{ padding: 16 }}>
          {momentError && (
            <div className="error-banner" style={{ marginBottom: 10 }}>
              {momentError}
            </div>
          )}
          {momentPhotoPreview && (
            <div style={{ position: 'relative', marginBottom: 10, borderRadius: 10, overflow: 'hidden', aspectRatio: '4/5', background: '#000', maxWidth: 320 }}>
              {momentMediaType === 'video' ? (
                <video src={momentPhotoPreview} controls style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <img src={momentPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
              <button onClick={() => { setMomentPhoto(null); setMomentPhotoPreview(null); setMomentMediaType('image'); if (momentPhotoInputRef.current) momentPhotoInputRef.current.value = '' }}
                style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                x
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
              {userInitials}
            </div>
            <textarea value={momentText} onChange={e => setMomentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postMoment() }}
              placeholder="Share a moment with the group..."
              autoFocus
              rows={2}
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 44, lineHeight: 1.45 }} />
            <input type="file" accept="image/*,video/*" ref={momentPhotoInputRef} onChange={handleMomentPhotoSelect} style={{ display: 'none' }} />
            <button onClick={() => momentPhotoInputRef.current?.click()}
              style={{ width: 38, height: 38, borderRadius: 8, background: momentPhoto ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${momentPhoto ? 'var(--yellow)' : 'var(--border2)'}`, color: momentPhoto ? 'var(--yellow)' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
              title="Add photo or video"
              aria-label="Add photo or video">
              <ImageIcon size={16} strokeWidth={2} />
            </button>
            <button onClick={postMoment} disabled={(!momentText.trim() && !momentPhoto) || posting}
              style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!momentText.trim() && !momentPhoto) || posting ? 0.5 : 1 }}>
              {posting ? '...' : 'Post'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => momentPhotoInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <ImageIcon size={14} strokeWidth={2} />
              Photo
            </button>
            <button onClick={() => setActiveType('hangout')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: '#FFFBEE', color: 'var(--yellow)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Calendar size={14} strokeWidth={2} />
              Plan a hangout
            </button>
            <button onClick={() => setShowQuickBill(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: `1px solid ${showQuickBill ? 'var(--yellow)' : 'var(--border)'}`, background: showQuickBill ? 'var(--yellow-soft)' : 'transparent', color: showQuickBill ? 'var(--yellow)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Receipt size={14} strokeWidth={2} />
              Add bill
            </button>
          </div>

          {showQuickBill && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10 }}>
              {quickBillError && (
                <div className="error-banner" style={{ marginBottom: 8 }}>
                  {quickBillError}
                </div>
              )}
              <input value={quickBillDesc} onChange={e => setQuickBillDesc(e.target.value)} placeholder="What was the bill for?"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
              <input type="number" value={quickBillAmount} onChange={e => setQuickBillAmount(e.target.value)} placeholder="Total amount"
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }} />
              {quickBillAmount && !isNaN(parseFloat(quickBillAmount)) && members.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                  ${(parseFloat(quickBillAmount) / members.length).toFixed(2)} each, split {members.length} ways
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowQuickBill(false); setQuickBillError('') }}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
                <button onClick={postQuickBill} disabled={!quickBillDesc.trim() || !quickBillAmount || quickBillPosting}
                  style={{ flex: 1, padding: '8px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !quickBillDesc.trim() || !quickBillAmount || quickBillPosting ? 0.5 : 1 }}>
                  {quickBillPosting ? 'Posting...' : 'Post bill'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeType === 'hangout' && (
        <div style={{ padding: 16 }}>

          {hangoutError && (
            <div className="error-banner" style={{ marginBottom: 12 }}>
              {hangoutError}
            </div>
          )}

          {groupSuggestions && groupSuggestions.topVenues?.length > 0 && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Your group loves
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {groupSuggestions.topVenues.map((v: any) => (
                  <button key={v.name}
                    onClick={() => setHangoutTitle(v.name)}
                    style={{ padding: '5px 10px', borderRadius: 20, border: '1px solid var(--yellow)', background: 'transparent', color: 'var(--yellow)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v.name}
                  </button>
                ))}
              </div>
              {groupSuggestions.preferredDay && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
                  Your group usually hangs on {groupSuggestions.preferredDay}s
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What</div>
            <input value={hangoutTitle} onChange={e => setHangoutTitle(e.target.value)}
              placeholder="Birthday dinner, movie night, just vibes..."
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }} />
          </div>

          {/* GROUP BRIEF */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Brief</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Give the group context before they RSVP</div>
            <input
              value={briefNote}
              onChange={e => setBriefNote(e.target.value)}
              placeholder="What is the plan exactly? Any details to know..."
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {['Chill', 'Active', 'Party', 'Foodie', 'Culture', 'Outdoors'].map(v => (
                <button key={v} onClick={() => setBriefVibe(briefVibe === v ? '' : v)}
                  style={{ padding: '5px 10px', borderRadius: 20, border: briefVibe === v ? '1px solid var(--yellow)' : '1px solid var(--border2)', background: briefVibe === v ? 'var(--yellow-soft)' : 'transparent', color: briefVibe === v ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: briefVibe === v ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {v}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: 'free', label: 'Free' }, { id: 'cheap', label: 'Cheap' }, { id: 'mid', label: 'Mid' }, { id: 'splurge', label: 'Splurge' }].map(b => (
                <button key={b.id} onClick={() => setBriefBudget(briefBudget === b.id ? '' : b.id)}
                  style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: briefBudget === b.id ? '1px solid var(--yellow)' : '1px solid var(--border2)', background: briefBudget === b.id ? 'var(--yellow-soft)' : 'transparent', color: briefBudget === b.id ? 'var(--yellow)' : 'var(--text3)', fontSize: 11, fontWeight: briefBudget === b.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>When</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: whenType !== 'pick' ? 0 : 10 }}>
              {([
                { id: 'now' as WhenType, label: 'Now' },
                { id: 'pick' as WhenType, label: 'Pick a time' },
                { id: 'weekly' as WhenType, label: 'Every week' },
              ]).map(({ id, label }) => (
                <button key={id} onClick={() => setWhenType(id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: `1px solid ${whenType === id ? 'var(--yellow)' : 'var(--border2)'}`,
                    background: whenType === id ? 'var(--yellow-soft)' : 'transparent',
                    color: whenType === id ? 'var(--yellow)' : 'var(--text2)',
                    fontSize: 12, fontWeight: whenType === id ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {label}
                </button>
              ))}
            </div>
            {whenType === 'pick' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {([
                    { id: 'set' as const, label: 'Set a date' },
                    { id: 'poll' as const, label: 'Poll the group' },
                  ]).map(({ id, label }) => (
                    <button key={id} onClick={() => setDateMode(id)}
                      style={{
                        padding: '5px 12px', borderRadius: 20,
                        border: `1px solid ${dateMode === id ? 'var(--yellow)' : 'var(--border2)'}`,
                        background: dateMode === id ? 'var(--yellow-soft)' : 'transparent',
                        color: dateMode === id ? 'var(--yellow)' : 'var(--text3)',
                        fontSize: 11, fontWeight: dateMode === id ? 700 : 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {dateMode === 'set' ? (
                  <DateTimePicker
                    value={scheduledFor}
                    onChange={date => setScheduledFor(date)}
                    minDate={new Date()}
                  />
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input type="date" value={pollDateInput} onChange={e => setPollDateInput(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      <button onClick={addPollDate} disabled={!pollDateInput || pollDates.length >= 5}
                        style={{ padding: '9px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!pollDateInput || pollDates.length >= 5) ? 0.5 : 1 }}>
                        Add
                      </button>
                    </div>
                    {pollDates.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
                        {pollDates.map(d => (
                          <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8 }}>
                            <span style={{ fontSize: 13, color: 'var(--text)' }}>
                              {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <button onClick={() => removePollDate(d)}
                              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{pollDates.length}/5 dates added</div>
                  </div>
                )}
              </div>
            )}
            {whenType === 'weekly' && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {DAYS.map((d, i) => (
                    <button key={d} onClick={() => setRecurrenceDay(i)}
                      style={{
                        flex: 1, padding: '8px 4px',
                        border: `1px solid ${recurrenceDay === i ? 'var(--yellow)' : 'var(--border2)'}`,
                        borderRadius: 6, cursor: 'pointer',
                        background: recurrenceDay === i ? 'var(--yellow-soft)' : 'transparent',
                        color: recurrenceDay === i ? 'var(--yellow)' : 'var(--text2)',
                        fontSize: 11, fontWeight: recurrenceDay === i ? 700 : 500,
                        fontFamily: 'inherit',
                      }}>
                      {d}
                    </button>
                  ))}
                </div>
                <input type="time" value={recurrenceTime} onChange={e => setRecurrenceTime(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }} />
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Where</div>

            {whereMode === 'none' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { id: 'tbd', label: 'Figure it out' },
                  { id: 'home', label: "Someone's place" },
                  { id: 'search', label: 'Search a place' },
                  { id: 'discover', label: 'Browse Discover' },
                  { id: 'online', label: 'Online / Virtual' },
                ] as { id: string, label: string }[]).map(({ id, label }) => (
                  <button key={id}
                    onClick={() => {
                      if (id === 'tbd') setWhereMode('tbd')
                      else if (id === 'home') setWhereMode('home')
                      else if (id === 'search') setWhereMode('search')
                      else if (id === 'discover') setWhereMode('discover')
                      else if (id === 'online') setWhereMode('online')
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 6,
                      border: '1px solid var(--border2)',
                      background: 'transparent',
                      color: 'var(--text2)',
                      fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {whereMode === 'search' && !selectedVenue && (
              <div style={{ position: 'relative' }}>
                <input
                  value={venueSearch}
                  onChange={e => { setVenueSearch(e.target.value); searchVenueByName(e.target.value) }}
                  placeholder="e.g. Sooper Tiffin, Yogurty's..."
                  autoFocus
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                {searchingVenue && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Searching...</div>}
                {venueResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                    {venueResults.map((s: any) => (
                      <div key={s.place_id} onClick={() => selectVenueFromSearch(s)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.main_text}</div>
                        {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.secondary_text}</div>}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { setWhereMode('none'); setVenueSearch(''); setVenueResults([]) }}
                  style={{ width: '100%', marginTop: 8, padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}

            {whereMode === 'search' && selectedVenue && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selectedVenue.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selectedVenue.location?.formatted_address}</div>
                </div>
                <button onClick={() => { setSelectedVenue(null); setWhereMode('search') }}
                  style={{ padding: '4px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Change
                </button>
              </div>
            )}

            {whereMode === 'tbd' && (
              <div style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>No venue set — you will figure it out</span>
                <button onClick={() => setWhereMode('none')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
              </div>
            )}

            {whereMode === 'discover' && !selectedVenue && (
              <div>
                <Discover members={members} onVenueSelect={(venue: any) => { setSelectedVenue(venue); setWhereMode('discover') }} />
                <button onClick={() => setWhereMode('none')} style={{ marginTop: 8, width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}

            {whereMode === 'discover' && selectedVenue && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                {selectedVenue.photo_url && (
                  <img src={selectedVenue.photo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selectedVenue.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selectedVenue.location?.formatted_address}</div>
                </div>
                <button onClick={() => { setSelectedVenue(null); setWhereMode('discover') }} style={{ padding: '4px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Change
                </button>
              </div>
            )}


            {whereMode === 'online' && (
              <div>
                <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Video call included</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>A Daily.co room will be created automatically. Members join directly inside the app.</div>
                </div>
                <button onClick={() => { setWhereMode('none'); setMeetingUrl('') }} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}

            {whereMode === 'home' && (
              <div>
                <input value={manualAddress} onChange={e => setManualAddress(e.target.value)}
                  placeholder="Address (optional)"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 6 }} />
                <button onClick={() => { setWhereMode('none'); setManualAddress('') }} style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* GUEST LIST */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Guest list</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: inviteMode === 'selected' ? 10 : 0 }}>
              {([
                { id: 'all' as const, label: 'All members' },
                { id: 'selected' as const, label: 'Selected members' },
              ]).map(({ id, label }) => (
                <button key={id} onClick={() => setInviteMode(id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: `1px solid ${inviteMode === id ? 'var(--yellow)' : 'var(--border2)'}`,
                    background: inviteMode === id ? 'var(--yellow-soft)' : 'transparent',
                    color: inviteMode === id ? 'var(--yellow)' : 'var(--text2)',
                    fontSize: 12, fontWeight: inviteMode === id ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {inviteMode === 'selected' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {members.map(m => {
                  const checked = selectedMemberIds.has(m.id)
                  return (
                    <div key={m.id} onClick={() => toggleSelectedMember(m.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: checked ? 'var(--yellow-soft)' : 'var(--bg3)', border: `1px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, cursor: 'pointer' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${checked ? 'var(--yellow)' : 'var(--border2)'}`, background: checked ? 'var(--yellow)' : 'transparent', color: '#111', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {checked ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8 }}>
              <button onClick={() => setSurpriseMode(v => !v)}
                style={{ width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0, background: surpriseMode ? 'var(--yellow)' : 'var(--border2)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: surpriseMode ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text)' }}>Surprise mode</span>
            </div>

            {surpriseMode && (
              <div style={{ marginTop: 8 }}>
                <DateTimePicker value={revealAt} onChange={setRevealAt} minDate={new Date()} />
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)' }}>
                  Hidden from selected members until reveal date
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={postHangout} disabled={creating}
              style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Posting...' : whenType === 'now' ? 'Post now' : 'Post hangout'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
