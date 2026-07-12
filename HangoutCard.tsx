'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
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

function getInitials(name: string) {
  return (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()
}

type HangoutCardData = {
  hangout: any
  options: any[]
  rsvps: any[]
  comments: any[]
  bills: any[]
}

type HangoutCardProps = {
  post: any
  data: HangoutCardData
  currentUser: any
  knotId: string
  members: any[]
  onRefresh: () => void
}

export default function HangoutCard({ post, data, currentUser, knotId, members, onRefresh }: HangoutCardProps) {
  const [hangout, setHangout]   = useState<any>(data.hangout)
  const [options, setOptions]   = useState<any[]>(data.options)
  const [rsvps, setRsvps]       = useState<any[]>(data.rsvps)
  const [comments, setComments] = useState<any[]>(data.comments)
  const [bills, setBills]       = useState<any[]>(data.bills)

  const [newComment, setNewComment]     = useState('')
  const [showComments, setShowComments] = useState(false)
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

  // Re-sync local state whenever fresh bundle data arrives from the parent
  useEffect(() => {
    setHangout(data.hangout)
    setOptions(data.options)
    setRsvps(data.rsvps)
    setComments(data.comments)
    setBills(data.bills)
  }, [data])

  const myVoteOptionId = options.find(o => o._myVote)?.id || null
  const myRsvpStatus = rsvps.find(r => r.user_id === currentUser?.id)?.status || null

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

  async function rsvp(status: string) {
    if (!currentUser) return
    setActionError('')
    const { error } = await supabase.from('hangout_rsvps').upsert({ hangout_id: post.hangout_id, user_id: currentUser.id, status }, { onConflict: 'hangout_id,user_id' })
    if (error) { setActionError('Could not update RSVP.'); return }
    setRsvps(prev => [...prev.filter(r => r.user_id !== currentUser.id), { user_id: currentUser.id, status, profiles: { name: currentUser.name } }])
    onRefresh()
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
      const ext = commentPhoto.name.split('.').pop()
      const path = `comments/${post.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('knot-photos').upload(path, commentPhoto)
      if (uploadError) {
        setActionError('Photo upload failed. Comment not posted.')
        setSubmitting(false)
        return
      }
      photoPath = path
      const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }
    const parts = [newComment.trim(), commentLocation ? `${commentLocation}` : ''].filter(Boolean)
    const { data: newC, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, author_id: currentUser.id, content: parts.join(' ') || null, photo_path: photoPath })
      .select()
      .single()
    if (error) {
      setActionError('Could not post comment.')
      setSubmitting(false)
      return
    }
    setComments(prev => [...prev, { ...newC, photo_url: photoUrl, profiles: { name: currentUser.name } }])
    setNewComment('')
    setCommentPhoto(null)
    setCommentPhotoPreview(null)
    setCommentLocation('')
    setShowLocationInput(false)
    setSubmitting(false)
    onRefresh()
  }

  if (!hangout) return null

  const isCreator   = hangout.created_by === currentUser?.id
  const isLive      = hangout.is_live
  const isVoting    = hangout.status === 'voting' && !isLive
  const isConfirmed = hangout.status === 'confirmed' && !isLive
  const isDone      = hangout.status === 'ended'
  const goingCount  = rsvps.filter(r => r.status === 'yes').length
  const maybeCount  = rsvps.filter(r => r.status === 'maybe').length
  const authorName  = post.profiles?.name || 'Someone'

  const borderColor = isLive ? '#4ade80' : isConfirmed ? 'var(--sage)' : isVoting ? 'var(--yellow)' : 'var(--border)'
  const statusLabel = isLive ? 'Live now' : isConfirmed ? 'Confirmed' : isVoting ? 'Vote open' : isDone ? 'Done' : 'Planning'
  const statusColor = isLive ? '#4ade80' : isConfirmed ? 'var(--sage)' : isVoting ? 'var(--yellow)' : 'var(--text3)'
  const cardBg      = isLive ? 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' : 'var(--bg2)'
  const textColor   = isLive ? '#fff' : 'var(--text)'
  const subColor    = isLive ? 'rgba(255,255,255,0.45)' : 'var(--text3)'
  const borderSep   = isLive ? 'rgba(255,255,255,0.08)' : 'var(--border)'

  return (
    <div style={{ background: cardBg, border: `1.5px solid ${borderColor}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />}
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{statusLabel}</span>
        </div>
        <span style={{ fontSize: 11, color: subColor }}>{timeAgo(post.created_at)}</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: textColor, marginBottom: 4 }}>{hangout.venue_name || hangout.title}</div>
        {hangout.venue_address && <div style={{ fontSize: 12, color: subColor, marginBottom: 4 }}>{hangout.venue_address}</div>}
        {hangout.scheduled_for && !isLive && (
          <div style={{ fontSize: 13, color: isConfirmed ? 'var(--sage)' : 'var(--text2)', fontWeight: 600, marginTop: 4 }}>{formatDate(hangout.scheduled_for)}</div>
        )}
        <div style={{ fontSize: 11, color: subColor, marginTop: 4 }}>Started by {authorName}</div>
      </div>

      {actionError && (
        <div style={{ padding: '8px 12px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 12, color: 'var(--yellow)', marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {isVoting && options.length > 0 && (
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

      {(isConfirmed || isLive) && (
        <div style={{ marginBottom: 14 }}>
          {rsvps.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {rsvps.map((r: any) => (
                <div key={r.user_id} style={{ padding: '3px 8px', borderRadius: 6, background: r.status === 'yes' ? isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)' : r.status === 'maybe' ? 'var(--amber-soft)' : 'var(--bg3)', border: `1px solid ${r.status === 'yes' ? isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)' : 'var(--border)'}` }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: r.status === 'yes' ? isLive ? '#4ade80' : 'var(--sage)' : r.status === 'maybe' ? 'var(--amber)' : 'var(--text3)' }}>
                    {r.profiles?.name?.split(' ')[0] || 'Someone'} {r.status === 'yes' ? 'in' : r.status === 'maybe' ? 'maybe' : 'out'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ s: 'yes', l: isLive ? 'On my way' : 'Going' }, { s: 'maybe', l: 'Maybe' }, { s: 'no', l: "Can't go" }].map(({ s, l }) => (
              <button key={s} onClick={() => rsvp(s)} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${myRsvpStatus === s ? s === 'yes' ? isLive ? '#4ade80' : 'var(--sage)' : 'var(--border2)' : isLive ? 'rgba(255,255,255,0.2)' : 'var(--border2)'}`, background: myRsvpStatus === s ? s === 'yes' ? isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)' : 'var(--bg3)' : 'transparent', color: myRsvpStatus === s ? s === 'yes' ? isLive ? '#4ade80' : 'var(--sage)' : isLive ? 'rgba(255,255,255,0.7)' : 'var(--text2)' : isLive ? 'rgba(255,255,255,0.6)' : 'var(--text2)', fontSize: 12, fontWeight: myRsvpStatus === s ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: subColor, marginTop: 8 }}>
            {goingCount} going{maybeCount > 0 ? ` \u00B7 ${maybeCount} maybe` : ''}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: isDone || bills.length > 0 ? 14 : 0, flexWrap: 'wrap' }}>
        {isConfirmed && isCreator && (
          <button onClick={goLive} style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>We are here</button>
        )}
        {isLive && isCreator && (
          <button onClick={endHangout} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>End the night</button>
        )}
        {hangout.venue_maps_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_maps_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Directions</a>
        )}
        {hangout.venue_booking_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_booking_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>Book a table</a>
        )}
        {isDone && !showBill && bills.length === 0 && (
          <button onClick={() => setShowBill(true)} style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Split the bill</button>
        )}
        {isDone && bills.length > 0 && !showBill && (
          <button onClick={() => setShowBill(true)} style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${borderSep}`, borderRadius: 8, color: subColor, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Add another bill</button>
        )}
      </div>

      {(showBill || bills.length > 0) && (
        <div style={{ borderTop: `1px solid ${borderSep}`, paddingTop: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Bill</div>
          {bills.map((b: any) => {
            const totalSplits = b.bill_splits?.length || 0
            const settledCount = b.bill_splits?.filter((s: any) => s.settled).length || 0
            return (
              <div key={b.id} style={{ background: isLive ? 'rgba(255,255,255,0.04)' : 'var(--bg3)', border: `1px solid ${borderSep}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
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
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(s.profiles?.name || 'U')}</div>
                        <span style={{ fontSize: 12, color: textColor }}>{s.profiles?.name || 'Someone'}{isMe ? ' (you)' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: s.settled ? 'var(--sage)' : subColor, fontWeight: 600 }}>${parseFloat(s.amount).toFixed(2)}</span>
                        {!s.settled && isMe && (
                          <button onClick={() => markSplitSettled(s.id)} style={{ padding: '3px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 6, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Mark paid</button>
                        )}
                        {s.settled && <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600 }}>Paid</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {showBill && (
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
                  style={{ flex: 1, padding: '8px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !billDesc.trim() || !billAmount || billPosting ? 0.5 : 1 }}>
                  {billPosting ? 'Posting...' : 'Post bill'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${borderSep}`, paddingTop: 12 }}>
        <button onClick={() => setShowComments(s => !s)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: subColor, cursor: 'pointer', fontFamily: 'inherit' }}>
          {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? 's' : ''}` : 'Add a comment'}
        </button>

        {showComments && (
          <div style={{ marginTop: 12 }}>
            {comments.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{getInitials(c.profiles?.name || 'U')}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLive ? 'rgba(255,255,255,0.8)' : 'var(--text)' }}>{c.profiles?.name || 'Someone'}</span>
                  {c.content && <span style={{ fontSize: 12, color: isLive ? 'rgba(255,255,255,0.55)' : 'var(--text2)', marginLeft: 6 }}>{c.content}</span>}
                  {c.photo_url && (
                    <div style={{ marginTop: 6 }}>
                      <img src={c.photo_url} alt="" style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: subColor, marginTop: 3 }}>{timeAgo(c.created_at)}</div>
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
                    style={{ padding: '7px 10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
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
                  style={{ width: 34, height: 34, borderRadius: 8, background: commentPhoto ? 'var(--yellow-soft)' : isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${commentPhoto ? 'var(--yellow)' : borderSep}`, color: commentPhoto ? 'var(--yellow)' : subColor, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
                  title="Add photo">
                  P
                </button>
                <button onClick={() => setShowLocationInput(s => !s)}
                  style={{ width: 34, height: 34, borderRadius: 8, background: commentLocation ? 'var(--yellow-soft)' : isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: `1px solid ${commentLocation ? 'var(--yellow)' : borderSep}`, color: commentLocation ? 'var(--yellow)' : subColor, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
                  title="Add location">
                  L
                </button>
                <button onClick={addComment} disabled={(!newComment.trim() && !commentPhoto && !commentLocation) || submitting}
                  style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!newComment.trim() && !commentPhoto && !commentLocation) || submitting ? 0.5 : 1, flexShrink: 0 }}>
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
