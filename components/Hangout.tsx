'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { notifyKnotMembers } from '@/lib/notifications'

type HangoutType = 'spontaneous' | 'planned' | 'recurring'
type HangoutStatus = 'voting' | 'confirmed' | 'live' | 'locked' | 'ended'

export default function Hangout({ members, knotId }: { members: any[], knotId?: string }) {
  const [hangouts, setHangouts]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [user, setUser]             = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]     = useState(false)

  // Create form state
  const [createType, setCreateType]   = useState<HangoutType>('planned')
  const [venueName, setVenueName]     = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [recurrence, setRecurrence]   = useState('none')
  const [recurrenceDay, setRecurrenceDay] = useState(5) // Friday
  const [recurrenceTime, setRecurrenceTime] = useState('19:00')
  const [pollOptions, setPollOptions] = useState<string[]>([])
  const [selectedPollOptions, setSelectedPollOptions] = useState<string[]>([])

  const ACTIVITY_OPTIONS = ['Drinks & bar','Karaoke','Dinner out','Bowling','Movie','Arcade','Cafe','Outdoors','Games night','Walk','House party','Road trip']
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUser(data.user) })
    if (knotId) loadHangouts()
  }, [knotId])

  async function loadHangouts() {
    if (!knotId) return
    const { data } = await supabase
      .from('hangouts')
      .select('*, profiles:created_by(name)')
      .eq('knot_id', knotId)
      .neq('status', 'ended')
      .order('created_at', { ascending: false })

    if (data) {
      const withOptions = await Promise.all(data.map(async (h: any) => {
        if (h.status === 'voting') {
          const [{ data: opts }, { data: votes }] = await Promise.all([
            supabase.from('hangout_options').select('*').eq('hangout_id', h.id),
            supabase.from('hangout_votes').select('option_id').eq('hangout_id', h.id),
          ])
          const counted = (opts || []).map((o: any) => ({
            ...o,
            vote_count: (votes || []).filter((v: any) => v.option_id === o.id).length
          })).sort((a: any, b: any) => b.vote_count - a.vote_count)
          return { ...h, options: counted }
        }
        return { ...h, options: [] }
      }))
      setHangouts(withOptions)
    }
    setLoading(false)
  }

  async function createHangout() {
    if (!knotId || !user || creating) return
    setCreating(true)

    const insertData: any = {
      knot_id:    knotId,
      created_by: user.id,
      type:       createType,
      recurrence,
    }

    if (createType === 'spontaneous') {
      insertData.status    = 'live'
      insertData.is_live   = true
      insertData.title     = venueName || 'Spontaneous hangout'
      insertData.venue_name    = venueName
      insertData.venue_address = venueAddress
      insertData.scheduled_for = new Date().toISOString()
    } else if (createType === 'planned') {
      insertData.status       = selectedPollOptions.length > 0 ? 'voting' : 'confirmed'
      insertData.title        = venueName || 'Planned hangout'
      insertData.venue_name   = venueName
      insertData.venue_address = venueAddress
      insertData.scheduled_for = scheduledFor ? new Date(scheduledFor).toISOString() : null
    } else if (createType === 'recurring') {
      insertData.status           = 'confirmed'
      insertData.title            = venueName || 'Recurring hangout'
      insertData.recurrence       = recurrence === 'none' ? 'weekly' : recurrence
      insertData.recurrence_day   = recurrenceDay
      insertData.recurrence_time  = recurrenceTime
      insertData.scheduled_for    = getNextRecurrence(recurrenceDay, recurrenceTime)
    }

    const { data: h } = await supabase.from('hangouts').insert(insertData).select().single()

    if (h) {
      if (createType === 'planned' && selectedPollOptions.length > 0) {
        await supabase.from('hangout_options').insert(
          selectedPollOptions.map(label => ({ hangout_id: h.id, label, emoji: '', vote_count: 0 }))
        )
      }

      const actorName = members.find(m => m.id === user.id)?.name || 'Someone'
      const message = createType === 'spontaneous'
        ? `${actorName} is at ${venueName || 'a spot'} right now — come join!`
        : createType === 'recurring'
        ? `${actorName} set up a recurring hangout — ${DAYS[recurrenceDay]}s at ${recurrenceTime}`
        : `${actorName} planned a hangout${venueName ? ` at ${venueName}` : ''}`

      await supabase.from('posts').insert({
        knot_id: knotId, author_id: user.id,
        content: message, post_type: 'moment'
      })

      await notifyKnotMembers({
        knotId, actorId: user.id,
        type: createType === 'spontaneous' ? 'new_poll' : 'new_poll',
        message,
      })

      setShowCreate(false)
      resetForm()
      await loadHangouts()
    }
    setCreating(false)
  }

  function getNextRecurrence(day: number, time: string): string {
    const now = new Date()
    const result = new Date()
    const daysUntil = (day - now.getDay() + 7) % 7 || 7
    result.setDate(now.getDate() + daysUntil)
    const [h, m] = time.split(':')
    result.setHours(parseInt(h), parseInt(m), 0, 0)
    return result.toISOString()
  }

  function resetForm() {
    setCreateType('planned')
    setVenueName('')
    setVenueAddress('')
    setScheduledFor('')
    setRecurrence('none')
    setRecurrenceDay(5)
    setRecurrenceTime('19:00')
    setSelectedPollOptions([])
  }

  async function castVote(hangoutId: string, optionId: string) {
    if (!user) return
    const { error } = await supabase.from('hangout_votes').insert({
      hangout_id: hangoutId, option_id: optionId, user_id: user.id
    })
    if (!error) await loadHangouts()
  }

  async function lockPlan(h: any) {
    if (!user || h.created_by !== user.id) return
    const winner = h.options?.[0]
    await supabase.from('hangouts')
      .update({ status: 'confirmed', title: winner?.label || h.title })
      .eq('id', h.id)
    await supabase.from('posts').insert({
      knot_id: knotId, author_id: user.id,
      content: `locked in the plan — ${winner?.label || h.title}`,
      post_type: 'moment'
    })
    await loadHangouts()
  }

  async function goLive(h: any) {
    if (!user) return
    const actorName = members.find(m => m.id === user.id)?.name || 'Someone'
    await supabase.from('hangouts')
      .update({ status: 'live', is_live: true })
      .eq('id', h.id)
    await supabase.from('posts').insert({
      knot_id: knotId, author_id: user.id,
      content: `${actorName} is at ${h.venue_name || h.title} — the night is on!`,
      post_type: 'moment'
    })
    await notifyKnotMembers({
      knotId: knotId!, actorId: user.id,
      type: 'new_poll',
      message: `${actorName} just checked in at ${h.venue_name || h.title} — come join!`,
    })
    await loadHangouts()
  }

  async function endHangout(h: any) {
    if (!user) return
    const actorName = members.find(m => m.id === user.id)?.name || 'Someone'
    await supabase.from('hangouts')
      .update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() })
      .eq('id', h.id)
    await supabase.from('posts').insert({
      knot_id: knotId, author_id: user.id,
      content: `wrapped up a great night at ${h.venue_name || h.title}. Thanks everyone!`,
      post_type: 'moment'
    })
    await loadHangouts()
  }

  function formatDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (isToday) return `Tonight · ${time}`
    if (isTomorrow) return `Tomorrow · ${time}`
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`
  }

  const liveHangouts      = hangouts.filter(h => h.is_live)
  const votingHangouts    = hangouts.filter(h => h.status === 'voting')
  const confirmedHangouts = hangouts.filter(h => h.status === 'confirmed' && !h.is_live)
  const recurringHangouts = hangouts.filter(h => h.recurrence && h.recurrence !== 'none')

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Planner</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>What's the plan?</div>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Plan something
        </button>
      </div>

      {/* LIVE NOW */}
      {liveHangouts.map(h => (
        <div key={h.id} style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)', border: '2px solid var(--yellow)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live now</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{h.venue_name || h.title}</div>
          {h.venue_address && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>{h.venue_address}</div>}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>Started by {h.profiles?.name || 'someone'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {h.venue_address && (
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(h.venue_name || h.title)}`} target="_blank" rel="noreferrer"
                style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
                Get directions
              </a>
            )}
            {h.created_by === user?.id && (
              <button onClick={() => endHangout(h)}
                style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                End the night
              </button>
            )}
          </div>
        </div>
      ))}

      {/* VOTING */}
      {votingHangouts.map(h => (
        <div key={h.id} style={{ background: 'var(--bg2)', border: '1px solid var(--yellow)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Vote open</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{h.title}</div>
              {h.scheduled_for && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{formatDate(h.scheduled_for)}</div>}
            </div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--yellow-soft)', color: 'var(--yellow)', fontWeight: 600 }}>
              {h.options?.reduce((a: number, o: any) => a + o.vote_count, 0)} votes
            </span>
          </div>
          {h.options?.map((o: any) => {
            const maxVotes = Math.max(...h.options.map((x: any) => x.vote_count), 1)
            const isLeading = o.id === h.options[0]?.id && o.vote_count > 0
            return (
              <button key={o.id} onClick={() => castVote(h.id, o.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${isLeading ? 'var(--sage)' : 'var(--border2)'}`, borderRadius: 8, marginBottom: 8, cursor: 'pointer', background: isLeading ? 'var(--sage-dim)' : 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{o.label}</span>
                <div style={{ width: 80, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: isLeading ? 'var(--sage)' : 'var(--yellow)', width: `${Math.round(o.vote_count / maxVotes * 100)}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', width: 40, textAlign: 'right' }}>{o.vote_count}</span>
                {isLeading && o.vote_count > 0 && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>TOP</span>}
              </button>
            )
          })}
          {h.created_by === user?.id && h.options?.[0]?.vote_count > 0 && (
            <button onClick={() => lockPlan(h)}
              style={{ width: '100%', marginTop: 8, padding: '9px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 8, color: 'var(--sage)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Lock in: {h.options[0].label}
            </button>
          )}
        </div>
      ))}

      {/* CONFIRMED */}
      {confirmedHangouts.filter(h => h.recurrence === 'none' || !h.recurrence).map(h => (
        <div key={h.id} style={{ background: 'var(--bg2)', border: '1px solid var(--sage)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Confirmed</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{h.venue_name || h.title}</div>
              {h.venue_address && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{h.venue_address}</div>}
              {h.scheduled_for && <div style={{ fontSize: 13, color: 'var(--sage)', marginTop: 4, fontWeight: 600 }}>{formatDate(h.scheduled_for)}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => goLive(h)}
              style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              We're here!
            </button>
            {h.venue_name && (
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(h.venue_name)}`} target="_blank" rel="noreferrer"
                style={{ padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
                Maps
              </a>
            )}
          </div>
        </div>
      ))}

      {/* RECURRING */}
      {recurringHangouts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Recurring</div>
          {recurringHangouts.map(h => (
            <div key={h.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)' }}>{DAYS[h.recurrence_day || 5]}</div>
                <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>{h.recurrence_time?.slice(0,5) || '19:00'}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{h.venue_name || h.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Every {DAYS[h.recurrence_day || 5]} · {h.recurrence_time?.slice(0,5) || '19:00'}</div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 600 }}>
                {h.recurrence}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* EMPTY */}
      {hangouts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>??</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Nothing planned yet</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Be the first to suggest something for the crew.</div>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '10px 24px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Plan something
          </button>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Plan something</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>What kind of hangout?</div>

            {/* Type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {([
                { id: 'spontaneous', label: "I'm out now", desc: 'Announce you are somewhere right now' },
                { id: 'planned',     label: 'Plan ahead',  desc: 'Schedule something for later' },
                { id: 'recurring',   label: 'Recurring',   desc: 'Same time every week' },
              ] as {id: HangoutType, label: string, desc: string}[]).map(t => (
                <div key={t.id} onClick={() => setCreateType(t.id)}
                  style={{ padding: '12px 10px', border: `1.5px solid ${createType === t.id ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: createType === t.id ? 'var(--yellow-soft)' : 'transparent', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: createType === t.id ? 'var(--yellow)' : 'var(--text)', marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.4 }}>{t.desc}</div>
                </div>
              ))}
            </div>

            {/* Venue */}
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
              {createType === 'spontaneous' ? 'Where are you?' : 'Venue (optional)'}
            </div>
            <input value={venueName} onChange={e => setVenueName(e.target.value)}
              placeholder={createType === 'spontaneous' ? 'e.g. The Keg Mississauga' : 'e.g. The Keg, TBD'}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }} />
            <input value={venueAddress} onChange={e => setVenueAddress(e.target.value)}
              placeholder="Address (optional)"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }} />

            {/* Planned — date/time + optional poll */}
            {createType === 'planned' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>When?</div>
                <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }} />

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Add a vote for activity? (optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
                  {ACTIVITY_OPTIONS.map(o => (
                    <div key={o} onClick={() => setSelectedPollOptions(s => s.includes(o) ? s.filter(x => x !== o) : s.length < 5 ? [...s, o] : s)}
                      style={{ padding: '7px 8px', border: `1px solid ${selectedPollOptions.includes(o) ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 8, cursor: 'pointer', background: selectedPollOptions.includes(o) ? 'var(--yellow-soft)' : 'transparent', fontSize: 11, textAlign: 'center', color: selectedPollOptions.includes(o) ? 'var(--yellow)' : 'var(--text2)', fontWeight: selectedPollOptions.includes(o) ? 600 : 400 }}>
                      {o}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Recurring — day + time */}
            {createType === 'recurring' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Which day?</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {DAYS.map((d, i) => (
                    <div key={d} onClick={() => setRecurrenceDay(i)}
                      style={{ flex: 1, padding: '8px 4px', border: `1px solid ${recurrenceDay === i ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 8, cursor: 'pointer', background: recurrenceDay === i ? 'var(--yellow-soft)' : 'transparent', fontSize: 11, textAlign: 'center', color: recurrenceDay === i ? 'var(--yellow)' : 'var(--text2)', fontWeight: recurrenceDay === i ? 700 : 400 }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>What time?</div>
                <input type="time" value={recurrenceTime} onChange={e => setRecurrenceTime(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createHangout} disabled={creating}
                style={{ flex: 1, padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 10, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : createType === 'spontaneous' ? "I'm here!" : createType === 'recurring' ? 'Set recurring' : 'Plan it'}
              </button>
              <button onClick={() => { setShowCreate(false); resetForm() }}
                style={{ padding: '11px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
