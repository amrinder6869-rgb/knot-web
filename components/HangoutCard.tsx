'use client'
import { useState, useEffect } from 'react'
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

type HangoutCardProps = {
  post: any
  currentUser: any
  knotId: string
  members: any[]
  onRefresh: () => void
}

export default function HangoutCard({ post, currentUser, knotId, members, onRefresh }: HangoutCardProps) {
  const [hangout, setHangout]       = useState<any>(null)
  const [options, setOptions]       = useState<any[]>([])
  const [rsvps, setRsvps]           = useState<any[]>([])
  const [myVote, setMyVote]         = useState<string | null>(null)
  const [myRsvp, setMyRsvp]         = useState<string | null>(null)
  const [comments, setComments]     = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (post.hangout_id) loadHangout()
  }, [post.hangout_id])

  async function loadHangout() {
    if (!post.hangout_id) return

    const [
      { data: h },
      { data: opts },
      { data: votes },
      { data: rsvpData },
      { data: commentData },
    ] = await Promise.all([
      supabase.from('hangouts').select('*, profiles:created_by(name)').eq('id', post.hangout_id).single(),
      supabase.from('hangout_options').select('*').eq('hangout_id', post.hangout_id),
      supabase.from('hangout_votes').select('option_id, user_id').eq('hangout_id', post.hangout_id),
      supabase.from('hangout_rsvps').select('*, profiles:user_id(name)').eq('hangout_id', post.hangout_id),
      supabase.from('comments').select('*, profiles:author_id(name)').eq('post_id', post.id).order('created_at', { ascending: true }),
    ])

    if (h) setHangout(h)

    const counted = (opts || []).map((o: any) => ({
      ...o,
      vote_count: (votes || []).filter((v: any) => v.option_id === o.id).length,
    })).sort((a: any, b: any) => b.vote_count - a.vote_count)
    setOptions(counted)

    const mine = (votes || []).find((v: any) => v.user_id === currentUser?.id)
    setMyVote(mine?.option_id || null)

    setRsvps(rsvpData || [])
    const myR = (rsvpData || []).find((r: any) => r.user_id === currentUser?.id)
    setMyRsvp(myR?.status || null)

    setComments(commentData || [])
    setLoading(false)
  }

  async function castVote(optionId: string) {
    if (!currentUser || myVote) return
    await supabase.from('hangout_votes').insert({
      hangout_id: post.hangout_id,
      option_id: optionId,
      user_id: currentUser.id,
    })
    setMyVote(optionId)
    setOptions(prev => prev.map(o => o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o).sort((a, b) => b.vote_count - a.vote_count))
  }

  async function lockPlan() {
    if (!currentUser || hangout?.created_by !== currentUser.id) return
    const winner = options[0]
    if (!winner) return
    await supabase.from('hangouts').update({ status: 'confirmed', title: winner.label }).eq('id', hangout.id)
    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: currentUser.id,
      content: `locked in the plan \u2014 ${winner.label}`,
      post_type: 'moment',
    })
    loadHangout()
    onRefresh()
  }

  async function rsvp(status: string) {
    if (!currentUser) return
    await supabase.from('hangout_rsvps').upsert(
      { hangout_id: post.hangout_id, user_id: currentUser.id, status },
      { onConflict: 'hangout_id,user_id' }
    )
    setMyRsvp(status)
    setRsvps(prev => {
      const others = prev.filter(r => r.user_id !== currentUser.id)
      return [...others, { user_id: currentUser.id, status, profiles: { name: currentUser.name } }]
    })
  }

  async function goLive() {
    if (!currentUser) return
    const actorName = currentUser.name || 'Someone'
    await supabase.from('hangouts').update({ status: 'live', is_live: true }).eq('id', hangout.id)
    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: currentUser.id,
      content: `${actorName} is at ${hangout.venue_name || hangout.title} \u2014 the night is on!`,
      post_type: 'moment',
    })
    loadHangout()
    onRefresh()
  }

  async function endHangout() {
    if (!currentUser) return
    const actorName = currentUser.name || 'Someone'
    const yesCount = rsvps.filter(r => r.status === 'yes').length
    await supabase.from('hangouts').update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() }).eq('id', hangout.id)
    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: currentUser.id,
      content: `wrapped up a great night at ${hangout.venue_name || hangout.title}${yesCount > 1 ? ` with ${yesCount} people` : ''}. Thanks everyone!`,
      post_type: 'moment',
    })
    loadHangout()
    onRefresh()
  }

  async function addComment() {
    if (!newComment.trim() || !currentUser || submitting) return
    setSubmitting(true)
    await supabase.from('comments').insert({
      post_id: post.id,
      author_id: currentUser.id,
      content: newComment.trim(),
    })
    setNewComment('')
    setSubmitting(false)
    loadHangout()
  }

  if (loading) return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16, height: 120, opacity: 0.5 }} />
  )

  if (!hangout) return null

  const isCreator  = hangout.created_by === currentUser?.id
  const isLive     = hangout.is_live
  const isVoting   = hangout.status === 'voting' && !isLive
  const isConfirmed = hangout.status === 'confirmed' && !isLive
  const isDone     = hangout.status === 'ended'
  const goingCount = rsvps.filter(r => r.status === 'yes').length
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length
  const authorName = post.profiles?.name || 'Someone'

  const borderColor = isLive ? '#4ade80' : isConfirmed ? 'var(--sage)' : isVoting ? 'var(--yellow)' : 'var(--border)'
  const statusLabel = isLive ? 'Live now' : isConfirmed ? 'Confirmed' : isVoting ? 'Vote open' : isDone ? 'Done' : 'Planning'
  const statusColor = isLive ? '#4ade80' : isConfirmed ? 'var(--sage)' : isVoting ? 'var(--yellow)' : 'var(--text3)'

  return (
    <div style={{
      background: isLive ? 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)' : 'var(--bg2)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 14,
      padding: 20,
      marginBottom: 16,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLive && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {statusLabel}
          </span>
        </div>
        <span style={{ fontSize: 11, color: isLive ? 'rgba(255,255,255,0.4)' : 'var(--text3)' }}>
          {timeAgo(post.created_at)}
        </span>
      </div>

      {/* Title and venue */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: isLive ? '#fff' : 'var(--text)', marginBottom: 4 }}>
          {hangout.venue_name || hangout.title}
        </div>
        {hangout.venue_address && (
          <div style={{ fontSize: 12, color: isLive ? 'rgba(255,255,255,0.45)' : 'var(--text3)', marginBottom: 4 }}>
            {hangout.venue_address}
          </div>
        )}
        {hangout.scheduled_for && !isLive && (
          <div style={{ fontSize: 13, color: isConfirmed ? 'var(--sage)' : 'var(--text2)', fontWeight: 600, marginTop: 4 }}>
            {formatDate(hangout.scheduled_for)}
          </div>
        )}
        <div style={{ fontSize: 11, color: isLive ? 'rgba(255,255,255,0.3)' : 'var(--text3)', marginTop: 4 }}>
          Started by {authorName}
        </div>
      </div>

      {/* Vote options */}
      {isVoting && options.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {options.map((o: any) => {
            const maxVotes = Math.max(...options.map((x: any) => x.vote_count), 1)
            const isLeading = o.id === options[0]?.id && o.vote_count > 0
            const isMyVote = myVote === o.id
            return (
              <button key={o.id}
                onClick={() => castVote(o.id)}
                disabled={!!myVote}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  border: `1px solid ${isMyVote ? 'var(--yellow)' : isLeading ? 'var(--sage)' : 'var(--border2)'}`,
                  borderRadius: 8, marginBottom: 6,
                  cursor: myVote ? 'default' : 'pointer',
                  background: isMyVote ? 'var(--yellow-dim)' : isLeading ? 'var(--sage-dim)' : 'transparent',
                  width: '100%', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{o.label}</span>
                <div style={{ width: 72, height: 3, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: isLeading ? 'var(--sage)' : 'var(--yellow)',
                    width: `${Math.round(o.vote_count / maxVotes * 100)}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', width: 20, textAlign: 'right' }}>{o.vote_count}</span>
                {isLeading && o.vote_count > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700, width: 28 }}>TOP</span>
                )}
              </button>
            )
          })}
          {isCreator && options[0]?.vote_count > 0 && (
            <button onClick={lockPlan} style={{
              width: '100%', marginTop: 4, padding: '9px',
              background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)',
              borderRadius: 8, color: 'var(--sage)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Lock in: {options[0].label}
            </button>
          )}
        </div>
      )}

      {/* RSVP */}
      {(isConfirmed || isLive) && (
        <div style={{ marginBottom: 14 }}>
          {rsvps.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              {rsvps.map((r: any) => (
                <div key={r.user_id} style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: r.status === 'yes'
                    ? isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)'
                    : r.status === 'maybe' ? 'var(--amber-soft)' : 'var(--bg3)',
                  border: `1px solid ${r.status === 'yes'
                    ? isLive ? 'rgba(74,222,128,0.3)' : 'var(--sage-dim)'
                    : 'var(--border)'}`,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: r.status === 'yes'
                      ? isLive ? '#4ade80' : 'var(--sage)'
                      : r.status === 'maybe' ? 'var(--amber)' : 'var(--text3)',
                  }}>
                    {r.profiles?.name?.split(' ')[0] || 'Someone'} {r.status === 'yes' ? 'in' : r.status === 'maybe' ? 'maybe' : 'out'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ s: 'yes', l: isLive ? 'On my way' : 'Going' }, { s: 'maybe', l: 'Maybe' }, { s: 'no', l: "Can't go" }].map(({ s, l }) => (
              <button key={s} onClick={() => rsvp(s)} style={{
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid ${myRsvp === s ? (s === 'yes' ? (isLive ? '#4ade80' : 'var(--sage)') : 'var(--border2)') : isLive ? 'rgba(255,255,255,0.2)' : 'var(--border2)'}`,
                background: myRsvp === s
                  ? s === 'yes' ? isLive ? 'rgba(74,222,128,0.15)' : 'var(--sage-soft)' : 'var(--bg3)'
                  : 'transparent',
                color: myRsvp === s
                  ? s === 'yes' ? isLive ? '#4ade80' : 'var(--sage)' : isLive ? 'rgba(255,255,255,0.7)' : 'var(--text2)'
                  : isLive ? 'rgba(255,255,255,0.6)' : 'var(--text2)',
                fontSize: 12, fontWeight: myRsvp === s ? 700 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: isLive ? 'rgba(255,255,255,0.35)' : 'var(--text3)', marginTop: 8 }}>
            {goingCount} going{maybeCount > 0 ? ` \u00B7 ${maybeCount} maybe` : ''}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {isConfirmed && isCreator && (
          <button onClick={goLive} style={{
            padding: '8px 16px', background: 'var(--yellow)', border: 'none',
            borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            We are here
          </button>
        )}
        {isLive && isCreator && (
          <button onClick={endHangout} style={{
            padding: '8px 14px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, color: 'rgba(255,255,255,0.65)', fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            End the night
          </button>
        )}
        {hangout.venue_maps_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_maps_url} target="_blank" rel="noreferrer" style={{
            padding: '8px 14px',
            background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)',
            border: `1px solid ${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}`,
            borderRadius: 8,
            color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)',
            fontSize: 12, textDecoration: 'none', fontFamily: 'inherit',
          }}>
            Directions
          </a>
        )}
        {hangout.venue_booking_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_booking_url} target="_blank" rel="noreferrer" style={{
            padding: '8px 14px',
            background: 'var(--yellow)', border: 'none',
            borderRadius: 8, color: '#111',
            fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit',
          }}>
            Book a table
          </a>
        )}
        {isDone && isCreator && (
          <button style={{
            padding: '8px 16px', background: 'var(--yellow)', border: 'none',
            borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Split the bill
          </button>
        )}
      </div>

      {/* Comments toggle */}
      <div style={{ borderTop: `1px solid ${isLive ? 'rgba(255,255,255,0.08)' : 'var(--border)'}`, paddingTop: 12 }}>
        <button
          onClick={() => setShowComments(s => !s)}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12, color: isLive ? 'rgba(255,255,255,0.4)' : 'var(--text3)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          {comments.length > 0
            ? `${comments.length} comment${comments.length > 1 ? 's' : ''}`
            : 'Add a comment'}
        </button>

        {showComments && (
          <div style={{ marginTop: 12 }}>
            {comments.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--yellow)', color: '#111',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {getInitials(c.profiles?.name || 'U')}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLive ? 'rgba(255,255,255,0.8)' : 'var(--text)' }}>
                    {c.profiles?.name || 'Someone'}
                  </span>
                  <span style={{ fontSize: 12, color: isLive ? 'rgba(255,255,255,0.55)' : 'var(--text2)', marginLeft: 6 }}>
                    {c.content}
                  </span>
                  <div style={{ fontSize: 10, color: isLive ? 'rgba(255,255,255,0.25)' : 'var(--text3)', marginTop: 2 }}>
                    {timeAgo(c.created_at)}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()}
                placeholder="Write a comment..."
                style={{
                  flex: 1, padding: '8px 12px',
                  background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)',
                  border: `1px solid ${isLive ? 'rgba(255,255,255,0.12)' : 'var(--border2)'}`,
                  borderRadius: 8, color: isLive ? '#fff' : 'var(--text)',
                  fontSize: 12, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={addComment} disabled={!newComment.trim() || submitting} style={{
                padding: '8px 14px', background: 'var(--yellow)', border: 'none',
                borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: !newComment.trim() || submitting ? 0.5 : 1,
              }}>
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
