'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { notifyKnotMembers } from '@/lib/notifications'
import Discover from '@/components/Discover'
import DateTimePicker from '@/components/DateTimePicker'

type PostType = 'moment' | 'hangout' | 'bill'
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
  const [activeType, setActiveType] = useState<PostType | null>(null)

  // Moment state
  const [momentText, setMomentText] = useState('')
  const [posting, setPosting]       = useState(false)

  // Hangout state
  const [whenType, setWhenType]           = useState<WhenType>('pick')
  const [scheduledFor, setScheduledFor]   = useState<Date | null>(null)
  const [recurrenceDay, setRecurrenceDay] = useState(5)
  const [recurrenceTime, setRecurrenceTime] = useState('19:00')
  const [whereMode, setWhereMode]         = useState<'none' | 'tbd' | 'discover' | 'manual' | 'home'>('none')
  const [selectedVenue, setSelectedVenue] = useState<any>(null)
  const [manualVenue, setManualVenue]     = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [hangoutTitle, setHangoutTitle]   = useState('')
  const [creating, setCreating]           = useState(false)

  // Bill state
  const [billDesc, setBillDesc]       = useState('')
  const [billAmount, setBillAmount]   = useState('')
  const [billPosting, setBillPosting] = useState(false)

  function reset() {
    setActiveType(null)
    setMomentText('')
    setWhenType('pick')
    setScheduledFor(null)
    setRecurrenceDay(5)
    setRecurrenceTime('19:00')
    setWhereMode('none')
    setSelectedVenue(null)
    setManualVenue('')
    setManualAddress('')
    setHangoutTitle('')
    setBillDesc('')
    setBillAmount('')
  }

  function getVenueName() {
    if (whereMode === 'home') return 'Someone\'s place'
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

  async function postMoment() {
    if (!momentText.trim() || posting) return
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPosting(false); return }
    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: user.id,
      content: momentText.trim(),
      post_type: 'moment',
    })
    const actorName = currentUser?.name || 'Someone'
    await notifyKnotMembers({
      knotId,
      actorId: user.id,
      type: 'new_post',
      message: `${actorName} posted: "${momentText.trim().substring(0, 60)}"`,
    })
    setPosting(false)
    reset()
    onPosted()
  }

  async function postHangout() {
    if (!currentUser || creating) return
    setCreating(true)

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
      startTime = scheduledFor ? scheduledFor.toISOString() : null
    } else if (whenType === 'weekly') {
      startTime        = getNextWeekday(recurrenceDay, recurrenceTime)
      hangoutType      = 'recurring'
      recurrence       = 'weekly'
      recurrenceDay_   = recurrenceDay
      recurrenceTime_  = recurrenceTime
    }

    // Re-fetch authenticated user to ensure we have a valid session
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setCreating(false); return }

    const { data: h, error: hangoutError } = await supabase.from('hangouts').insert({
      knot_id:          knotId,
      created_by:       authUser.id,
      title,
      type:             hangoutType,
      venue_name:       venueName || null,
      venue_address:    venueAddress || null,
      venue_maps_url:   getVenueMapsUrl(),
      venue_booking_url: getVenueBookingUrl(),
      venue_place_id:   selectedVenue?.place_id || null,
      scheduled_for:    startTime,
      status:           whenType === 'now' ? 'live' : 'confirmed',
      is_live:          whenType === 'now',
      recurrence,
      recurrence_day:   recurrenceDay_,
      recurrence_time:  recurrenceTime_,
    }).select().single()

    if (h) {
      const actorName = currentUser.name || 'Someone'
      let content = ''
      if (whenType === 'now') {
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
        post_type:  'hangout',
      }).select('id').single()
      if (postError) {
        console.error('Post insert error:', JSON.stringify(postError))
      } else if (newPost) {
        const { error: updateError } = await supabase
          .from('hangouts')
          .update({ post_id: newPost.id })
          .eq('id', h.id)
        if (updateError) console.error('Hangout update error:', JSON.stringify(updateError))
      }

      await notifyKnotMembers({
        knotId,
        actorId:  authUser.id,
        type:     'new_poll',
        message:  content,
        entityId: h.id,
      })
    }

    setCreating(false)
    reset()
    onPosted()
  }

  async function postBill() {
    if (!billDesc.trim() || !billAmount || billPosting) return
    const amount = parseFloat(billAmount)
    if (isNaN(amount) || amount <= 0) return
    setBillPosting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setBillPosting(false); return }

    const { data: bill } = await supabase.from('bills').insert({
      knot_id:      knotId,
      added_by:     user.id,
      total_amount: amount,
      description:  billDesc.trim(),
      split_type:   'equal',
    }).select().single()

    if (bill && members.length > 0) {
      const share = amount / members.length
      await supabase.from('bill_splits').insert(
        members.map(m => ({
          bill_id:  bill.id,
          user_id:  m.id,
          amount:   parseFloat(share.toFixed(2)),
          settled:  m.id === user.id,
        }))
      )
      await supabase.from('posts').insert({
        knot_id:   knotId,
        author_id: user.id,
        content:   `${currentUser?.name || 'Someone'} added a bill \u2014 ${billDesc.trim()} ($${amount.toFixed(2)})`,
        post_type: 'bill',
      })
    }

    setBillPosting(false)
    reset()
    onPosted()
  }

  const userName  = currentUser?.name || 'You'
  const userInitials = userName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>

      {/* Post type selector */}
      <div style={{ display: 'flex', borderBottom: activeType ? '1px solid var(--border)' : 'none' }}>
        {([
          { type: 'moment' as PostType, label: 'Moment' },
          { type: 'hangout' as PostType, label: "Let's hang" },
          { type: 'bill' as PostType, label: 'Bill' },
        ]).map(({ type, label }) => (
          <button key={type}
            onClick={() => setActiveType(activeType === type ? null : type)}
            style={{
              flex: 1, padding: '14px 8px',
              background: activeType === type ? 'var(--yellow-soft)' : 'transparent',
              border: 'none',
              borderBottom: activeType === type ? '2px solid var(--yellow)' : '2px solid transparent',
              color: activeType === type ? 'var(--yellow)' : 'var(--text2)',
              fontSize: 13, fontWeight: activeType === type ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Moment form */}
      {activeType === 'moment' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {userInitials}
            </div>
            <input value={momentText} onChange={e => setMomentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && postMoment()}
              placeholder="Share a moment with the group..."
              autoFocus
              style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={postMoment} disabled={!momentText.trim() || posting}
              style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !momentText.trim() || posting ? 0.5 : 1 }}>
              {posting ? '...' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Hangout form */}
      {activeType === 'hangout' && (
        <div style={{ padding: 16 }}>

          {/* What */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What</div>
            <input value={hangoutTitle} onChange={e => setHangoutTitle(e.target.value)}
              placeholder="Birthday dinner, movie night, just vibes..."
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }} />
          </div>

          {/* When */}
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
                <DateTimePicker
                  value={scheduledFor}
                  onChange={date => setScheduledFor(date)}
                  minDate={new Date()}
                />
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

          {/* Where */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Where</div>

            {whereMode === 'none' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { id: 'tbd', label: 'Figure it out' },
                  { id: 'home', label: "Someone's place" },
                  { id: 'discover', label: 'Find a spot' },
                ] as { id: string, label: string }[]).map(({ id, label }) => (
                  <button key={id}
                    onClick={() => {
                      if (id === 'tbd') setWhereMode('tbd')
                      else if (id === 'home') setWhereMode('home')
                      else if (id === 'discover') setWhereMode('discover')
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

          {/* Post button */}
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

      {/* Bill form */}
      {activeType === 'bill' && (
        <div style={{ padding: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>What for</div>
            <input value={billDesc} onChange={e => setBillDesc(e.target.value)}
              placeholder="Dinner, drinks, Uber..."
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Total amount</div>
            <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)}
              placeholder="0.00"
              style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }} />
            {billAmount && !isNaN(parseFloat(billAmount)) && members.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                Split equally: ${(parseFloat(billAmount) / members.length).toFixed(2)} per person ({members.length} members)
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={postBill} disabled={!billDesc.trim() || !billAmount || billPosting}
              style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !billDesc.trim() || !billAmount || billPosting ? 0.5 : 1 }}>
              {billPosting ? 'Posting...' : 'Post bill'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
