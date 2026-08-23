'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const half  = rating % 1 >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <span style={{ fontSize: 11, letterSpacing: 1 }}>
      <span style={{ color: 'var(--amber)' }}>{String.fromCodePoint(0x2605).repeat(full)}{half ? String.fromCodePoint(0xBD) : ''}</span>
      <span style={{ color: 'var(--border2)' }}>{String.fromCodePoint(0x2606).repeat(empty)}</span>
    </span>
  )
}

const PRICE_MAP: Record<number, string> = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

type VenuePollProps = {
  hangoutId: string
  options: any[]
  currentUser: any
  isCreator: boolean
  members: any[]
  onRefresh: () => void
}

export default function VenuePoll({ hangoutId, options, currentUser, isCreator, members, onRefresh }: VenuePollProps) {
  const [localOptions, setLocalOptions] = useState<any[]>(options)
  const [votes, setVotes] = useState<{ id: string; option_id: string; user_id: string }[]>([])
  const [voting, setVoting] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [keepVotingNote, setKeepVotingNote] = useState(false)

  useEffect(() => { setLocalOptions(options) }, [options])

  useEffect(() => {
    let cancelled = false

    async function loadVotes() {
      const { data } = await supabase
        .from('hangout_option_votes')
        .select('id, option_id, user_id')
        .eq('hangout_id', hangoutId)
      if (!cancelled) setVotes(data || [])
    }
    loadVotes()

    const channel = supabase
      .channel(`hangout_option_votes:${hangoutId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hangout_option_votes', filter: `hangout_id=eq.${hangoutId}` }, loadVotes)
      .subscribe()

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [hangoutId])

  const venueOptions = localOptions.filter(o => !o.is_none_of_these)
  const noneOption = localOptions.find(o => o.is_none_of_these) || null
  const myVote = votes.find(v => v.user_id === currentUser?.id) || null
  const voteCount = (optionId: string) => votes.filter(v => v.option_id === optionId).length
  const maxVotes = Math.max(...venueOptions.map(o => voteCount(o.id)), noneOption ? voteCount(noneOption.id) : 0, 1)
  const distinctVoters = new Set(votes.map(v => v.user_id)).size

  async function vote(optionId: string) {
    if (!currentUser?.id || voting) return
    setVoting(true)
    setError('')
    const { error: err } = await supabase
      .from('hangout_option_votes')
      .upsert({ hangout_id: hangoutId, option_id: optionId, user_id: currentUser.id }, { onConflict: 'hangout_id,user_id' })
    if (err) setError('Could not save your vote. Please try again.')
    setVoting(false)
  }

  async function voteNoneOfThese() {
    if (!currentUser?.id || voting) return
    setVoting(true)
    setError('')
    let noneId = noneOption?.id
    if (!noneId) {
      const { data: newOpt, error: insErr } = await supabase
        .from('hangout_options')
        .insert({ hangout_id: hangoutId, label: 'None of these', is_none_of_these: true })
        .select('*')
        .single()
      if (insErr || !newOpt) { setError('Could not save your vote. Please try again.'); setVoting(false); return }
      noneId = newOpt.id
      setLocalOptions(prev => [...prev, newOpt])
    }
    const { error: err } = await supabase
      .from('hangout_option_votes')
      .upsert({ hangout_id: hangoutId, option_id: noneId, user_id: currentUser.id }, { onConflict: 'hangout_id,user_id' })
    if (err) setError('Could not save your vote. Please try again.')
    setVoting(false)
  }

  async function pickVenue(option: any) {
    if (pickingId) return
    setPickingId(option.id)
    setError('')
    const { error: err } = await supabase.from('hangouts').update({
      status: 'confirmed',
      venue_name: option.venue_name,
      venue_address: option.venue_address,
      venue_place_id: option.venue_place_id,
      venue_lat: option.venue_lat,
      venue_lng: option.venue_lng,
      venue_category: option.venue_category,
    }).eq('id', hangoutId)
    setPickingId(null)
    if (err) { setError('Could not confirm this venue. Please try again.'); return }
    onRefresh()
  }

  function keepVotingOpen() {
    setKeepVotingNote(true)
    setTimeout(() => setKeepVotingNote(false), 2500)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Where should we go?
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 10 }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {venueOptions.map(o => {
          const count = voteCount(o.id)
          const isMyPick = myVote?.option_id === o.id
          return (
            <div key={o.id} style={{ border: `1px solid ${isMyPick ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 10, padding: 10, background: isMyPick ? 'var(--yellow-dim)' : 'var(--bg3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {o.venue_photo_url ? (
                  <img src={o.venue_photo_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg2)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.venue_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {o.venue_category && (
                      <span style={{ padding: '2px 7px', borderRadius: 20, background: 'var(--bg2)', border: '1px solid var(--border2)', fontSize: 10, fontWeight: 600, color: 'var(--text3)' }}>{o.venue_category}</span>
                    )}
                    {typeof o.venue_rating === 'number' && <StarRating rating={o.venue_rating} />}
                    {o.price_level != null && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{PRICE_MAP[o.price_level] || ''}</span>}
                  </div>
                </div>
                {isMyPick && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', flexShrink: 0 }}>Your pick</span>
                )}
              </div>

              {o.restriction_notes && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>{o.restriction_notes}</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--yellow)', width: `${Math.round(count / maxVotes * 100)}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)', width: 14, textAlign: 'right' }}>{count}</span>
                <button onClick={() => vote(o.id)} disabled={voting || isMyPick}
                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--yellow)', background: isMyPick ? 'transparent' : 'var(--yellow)', color: isMyPick ? 'var(--yellow)' : '#111', fontSize: 11, fontWeight: 700, cursor: isMyPick ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {isMyPick ? 'Voted' : "I'm in for this"}
                </button>
              </div>

              {isCreator && (
                <button onClick={() => pickVenue(o)} disabled={pickingId === o.id}
                  style={{ width: '100%', marginTop: 8, padding: '7px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 8, color: 'var(--sage)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: pickingId === o.id ? 0.6 : 1 }}>
                  {pickingId === o.id ? 'Confirming...' : 'Pick this'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isCreator ? 8 : 0 }}>
        <button onClick={voteNoneOfThese} disabled={voting || myVote?.option_id === noneOption?.id}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border2)', background: myVote && noneOption && myVote.option_id === noneOption.id ? 'var(--bg4)' : 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          {myVote && noneOption && myVote.option_id === noneOption.id ? 'Voted: None of these' : 'None of these'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{distinctVoters} of {members.length} voted</span>
      </div>

      {isCreator && (
        <div>
          <button onClick={keepVotingOpen}
            style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Let the group decide more
          </button>
          {keepVotingNote && (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 6 }}>Keeping the poll open — no rush.</div>
          )}
        </div>
      )}
    </div>
  )
}
