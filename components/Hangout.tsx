'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { notifyKnotMembers } from '@/lib/notifications'
import Discover from '@/components/Discover'

type HangoutType = 'spontaneous' | 'planned' | 'recurring'
type WizardStep = 'type' | 'when' | 'where' | 'poll' | 'review'

const ACTIVITY_OPTIONS = ['Drinks & bar','Karaoke','Dinner out','Bowling','Movie','Arcade','Cafe','Outdoors','Games night','Walk','House party','Road trip']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DURATIONS = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: 'All night', minutes: 360 },
]

export default function Hangout({ members, knotId }: { members: any[], knotId?: string }) {
  const [hangouts, setHangouts]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [user, setUser]             = useState<any>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [myRsvps, setMyRsvps]       = useState<Record<string, string>>({})

  // Wizard state
  const [step, setStep]                       = useState<WizardStep>('type')
  const [createType, setCreateType]           = useState<HangoutType>('planned')
  const [scheduledFor, setScheduledFor]       = useState('')
  const [durationMinutes, setDurationMinutes] = useState(120)
  const [recurrenceDay, setRecurrenceDay]     = useState(5)
  const [recurrenceTime, setRecurrenceTime]   = useState('19:00')
  const [selectedVenue, setSelectedVenue]     = useState<any>(null)
  const [manualVenue, setManualVenue]         = useState('')
  const [manualAddress, setManualAddress]     = useState('')
  const [useManualVenue, setUseManualVenue]   = useState(false)
  const [pollOptions, setPollOptions]         = useState<string[]>([])
  const [hasPoll, setHasPoll]                 = useState(false)

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
      const withDetails = await Promise.all(data.map(async (h: any) => {
        const [{ data: opts }, { data: votes }, { data: rsvps }] = await Promise.all([
          supabase.from('hangout_options').select('*').eq('hangout_id', h.id),
          supabase.from('hangout_votes').select('option_id, user_id').eq('hangout_id', h.id),
          supabase.from('hangout_rsvps').select('*, profiles:user_id(name)').eq('hangout_id', h.id),
        ])
        const counted = (opts || []).map((o: any) => ({
          ...o,
          vote_count: (votes || []).filter((v: any) => v.option_id === o.id).length
        })).sort((a: any, b: any) => b.vote_count - a.vote_count)
        const myVote = (votes || []).find((v: any) => v.user_id === user?.id)?.option_id || null
        return { ...h, options: counted, rsvps: rsvps || [], myVote }
      }))
      setHangouts(withDetails)
      const rsvpMap: Record<string, string> = {}
      for (const h of withDetails) {
        const mine = h.rsvps.find((r: any) => r.user_id === user?.id)
        if (mine) rsvpMap[h.id] = mine.status
      }
      setMyRsvps(rsvpMap)
    }
    setLoading(false)
  }

  function resetWizard() {
    setStep('type')
    setCreateType('planned')
    setScheduledFor('')
    setDurationMinutes(120)
    setRecurrenceDay(5)
    setRecurrenceTime('19:00')
    setSelectedVenue(null)
    setManualVenue('')
    setManualAddress('')
    setUseManualVenue(false)
    setPollOptions([])
    setHasPoll(false)
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

  function getEndTime(start: string, minutes: number): string {
    const d = new Date(start)
    d.setMinutes(d.getMinutes() + minutes)
    return d.toISOString()
  }

  function getVenueName() { return useManualVenue ? manualVenue : (selectedVenue?.name || '') }
  function getVenueAddress() { return useManualVenue ? manualAddress : (selectedVenue?.location?.formatted_address || '') }
  function getVenueMapsUrl() {
    if (selectedVenue?.google_maps_url) return selectedVenue.google_maps_url
    const name = getVenueName()
    return name ? `https://www.google.com/maps/search/${encodeURIComponent(name)}` : null
  }

  const STEPS: WizardStep[] = createType === 'spontaneous'
    ? ['type', 'where']
    : ['type', 'when', 'where', 'poll', 'review']

  function nextStep() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
    else createHangout()
  }

  function prevStep() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
    else { setShowWizard(false); resetWizard() }
  }

  function canProceed(): boolean {
    if (step === 'type') return true
    if (step === 'when') return createType === 'recurring' || !!scheduledFor
    if (step === 'where') return true
    if (step === 'poll') return true
    if (step === 'review') return true
    return true
  }

  function nextLabel(): string {
    if (step === 'where' && createType === 'spontaneous') return creating ? 'Posting...' : "I'm here â€” post it!"
    if (step === 'review') return creating ? 'Creating...' : 'Confirm hangout'
    return 'Next'
  }

  async function createHangout() {
    if (!knotId || !user || creating) return
    setCreating(true)
    const venueName    = getVenueName()
    const venueAddress = getVenueAddress()
    const startTime    = createType === 'spontaneous'
      ? new Date().toISOString()
      : createType === 'recurring'
      ? getNextRecurrence(recurrenceDay, recurrenceTime)
      : scheduledFor ? new Date(scheduledFor).toISOString() : null

    const insertData: any = {
      knot_id: knotId, created_by: user.id,
      type: createType,
      title: venueName || (createType === 'recurring' ? 'Recurring hangout' : 'Hangout'),
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      venue_maps_url: getVenueMapsUrl(),
      scheduled_for: startTime,
      end_time: startTime ? getEndTime(startTime, durationMinutes) : null,
      duration_minutes: durationMinutes,
      recurrence: createType === 'recurring' ? 'weekly' : 'none',
      recurrence_day: createType === 'recurring' ? recurrenceDay : null,
      recurrence_time: createType === 'recurring' ? recurrenceTime : null,
      status: createType === 'spontaneous' ? 'live' : hasPoll ? 'voting' : 'confirmed',
      is_live: createType === 'spontaneous',
    }

    const { data: h } = await supabase.from('hangouts').insert(insertData).select().single()
    if (h) {
      if (hasPoll && pollOptions.length > 0) {
        await supabase.from('hangout_options').insert(
          pollOptions.map(label => ({ hangout_id: h.id, label, emoji: '', vote_count: 0 }))
        )
      }
      const actorName = members.find(m => m.id === user.id)?.name || 'Someone'
      const message = createType === 'spontaneous'
        ? `${actorName} is at ${venueName || 'a spot'} right now â€” come join!`
        : createType === 'recurring'
        ? `${actorName} set up a recurring hangout â€” ${DAYS[recurrenceDay]}s at ${recurrenceTime}${venueName ? ' at ' + venueName : ''}`
        : `${actorName} planned a hangout${venueName ? ' at ' + venueName : ''}${startTime ? ' â€” ' + formatDate(startTime) : ''}`

      await supabase.from('posts').insert({ knot_id: knotId, author_id: user.id, content: message, post_type: 'moment' })
      await notifyKnotMembers({ knotId, actorId: user.id, type: 'new_poll', message, entityId: h.id })
      setShowWizard(false)
      resetWizard()
      await loadHangouts()
    }
    setCreating(false)
  }

  async function castVote(hangoutId: string, optionId: string, myVote: string | null) {
    if (!user || myVote) return
    await supabase.from('hangout_votes').insert({ hangout_id: hangoutId, option_id: optionId, user_id: user.id })
    await loadHangouts()
  }

  async function lockPlan(h: any) {
    if (!user || h.created_by !== user.id) return
    const winner = h.options?.[0]
    await supabase.from('hangouts').update({ status: 'confirmed', title: winner?.label || h.title }).eq('id', h.id)
    await supabase.from('posts').insert({ knot_id: knotId, author_id: user.id, content: `locked in the plan â€” ${winner?.label || h.title}`, post_type: 'moment' })
    await loadHangouts()
  }

  async function rsvp(hangoutId: string, status: string) {
    if (!user) return
    await supabase.from('hangout_rsvps').upsert({ hangout_id: hangoutId, user_id: user.id, status }, { onConflict: 'hangout_id,user_id' })
    setMyRsvps(prev => ({ ...prev, [hangoutId]: status }))
    await loadHangouts()
  }

  async function goLive(h: any) {
    if (!user) return
    const actorName = members.find(m => m.id === user.id)?.name || 'Someone'
    await supabase.from('hangouts').update({ status: 'live', is_live: true }).eq('id', h.id)
    await supabase.from('posts').insert({ knot_id: knotId, author_id: user.id, content: `${actorName} is at ${h.venue_name || h.title} â€” the night is on!`, post_type: 'moment' })
    await notifyKnotMembers({ knotId: knotId!, actorId: user.id, type: 'new_poll', message: `${actorName} just checked in at ${h.venue_name || h.title} â€” come join!`, entityId: h.id })
    await loadHangouts()
  }

  async function endHangout(h: any) {
    if (!user) return
    const actorName = members.find(m => m.id === user.id)?.name || 'Someone'
    const yesRsvps = h.rsvps?.filter((r: any) => r.status === 'yes').length || 0
    await supabase.from('hangouts').update({ status: 'ended', is_live: false, ended_at: new Date().toISOString() }).eq('id', h.id)
    await supabase.from('posts').insert({ knot_id: knotId, author_id: user.id, content: `wrapped up a great night at ${h.venue_name || h.title}${yesRsvps > 1 ? ` with ${yesRsvps} people` : ''}. Thanks everyone!`, post_type: 'moment' })
    await loadHangouts()
  }

  function formatDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    if (isToday) return `Tonight Â· ${time}`
    if (isTomorrow) return `Tomorrow Â· ${time}`
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` Â· ${time}`
  }

  const liveHangouts      = hangouts.filter(h => h.is_live)
  const votingHangouts    = hangouts.filter(h => h.status === 'voting' && !h.is_live)
  const confirmedHangouts = hangouts.filter(h => h.status === 'confirmed' && !h.is_live && (h.recurrence === 'none' || !h.recurrence))
  const recurringHangouts = hangouts.filter(h => h.recurrence && h.recurrence !== 'none' && !h.is_live)

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Planner</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>What is the plan?</div>
        </div>
        <button onClick={() => setShowWizard(true)}
          style={{ background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Plan something
        </button>
      </div>

      {/* LIVE */}
      {liveHangouts.map(h => (
        <div key={h.id} style={{ background: 'linear-gradient(135deg, #111 0%, #1e1e1e 100%)', border: '2px solid var(--yellow)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live now</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>{h.rsvps?.filter((r: any) => r.status === 'yes').length || 0} going</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{h.venue_name || h.title}</div>
          {h.venue_address && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{h.venue_address}</div>}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Started by {h.profiles?.name || 'someone'}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{s:'yes',l:"On my way"},{s:'maybe',l:'Maybe'},{s:'no',l:"Can't make it"}].map(({s,l}) => (
              <button key={s} onClick={() => rsvp(h.id, s)}
                style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${myRsvps[h.id] === s ? 'var(--yellow)' : 'rgba(255,255,255,0.2)'}`, background: myRsvps[h.id] === s ? 'var(--yellow)' : 'transparent', color: myRsvps[h.id] === s ? '#111' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {h.venue_maps_url && <a href={h.venue_maps_url} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', background: 'var(--yellow)', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Get directions</a>}
            {h.created_by === user?.id && <button onClick={() => endHangout(h)} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>End the night</button>}
          </div>
        </div>
      ))}

      {/* VOTING */}
      {votingHangouts.map(h => (
        <div key={h.id} style={{ background: 'var(--bg2)', border: '1.5px solid var(--yellow)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Vote open</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{h.options?.reduce((a: number, o: any) => a + o.vote_count, 0)} votes</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{h.title}</div>
          {h.scheduled_for && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{formatDate(h.scheduled_for)}</div>}
          {h.options?.map((o: any) => {
            const maxVotes = Math.max(...h.options.map((x: any) => x.vote_count), 1)
            const isLeading = o.id === h.options[0]?.id && o.vote_count > 0
            return (
              <button key={o.id} onClick={() => castVote(h.id, o.id, h.myVote)} disabled={!!h.myVote}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${h.myVote === o.id ? 'var(--yellow)' : isLeading ? 'var(--sage)' : 'var(--border2)'}`, borderRadius: 8, marginBottom: 8, cursor: h.myVote ? 'default' : 'pointer', background: h.myVote === o.id ? 'var(--yellow-dim)' : isLeading ? 'var(--sage-dim)' : 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{o.label}</span>
                <div style={{ width: 80, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: isLeading ? 'var(--sage)' : 'var(--yellow)', width: `${Math.round(o.vote_count / maxVotes * 100)}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text3)', width: 24, textAlign: 'right' }}>{o.vote_count}</span>
                {isLeading && o.vote_count > 0 && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700 }}>TOP</span>}
              </button>
            )
          })}
          {h.created_by === user?.id && h.options?.[0]?.vote_count > 0 && (
            <button onClick={() => lockPlan(h)} style={{ width: '100%', marginTop: 4, padding: '9px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 8, color: 'var(--sage)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Lock in: {h.options[0].label}
            </button>
          )}
        </div>
      ))}

      {/* CONFIRMED */}
      {confirmedHangouts.map(h => {
        const yesCount = h.rsvps?.filter((r: any) => r.status === 'yes').length || 0
        const maybeCount = h.rsvps?.filter((r: any) => r.status === 'maybe').length || 0
        const myRsvp = myRsvps[h.id]
        return (
          <div key={h.id} style={{ background: 'var(--bg2)', border: '1.5px solid var(--sage)', borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Confirmed</span>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{h.venue_name || h.title}</div>
                {h.venue_address && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{h.venue_address}</div>}
                {h.scheduled_for && <div style={{ fontSize: 13, color: 'var(--sage)', marginTop: 6, fontWeight: 600 }}>{formatDate(h.scheduled_for)}</div>}
                {h.duration_minutes && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Duration: {h.duration_minutes >= 360 ? 'All night' : `${h.duration_minutes / 60}h`}</div>}
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text3)' }}>
                <div style={{ color: 'var(--sage)', fontWeight: 700 }}>{yesCount} going</div>
                {maybeCount > 0 && <div>{maybeCount} maybe</div>}
              </div>
            </div>
            {h.rsvps?.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
                {h.rsvps.map((r: any) => (
                  <div key={r.user_id} style={{ padding: '3px 8px', borderRadius: 20, background: r.status === 'yes' ? 'var(--sage-soft)' : r.status === 'maybe' ? 'var(--amber-soft)' : 'var(--bg3)', border: `1px solid ${r.status === 'yes' ? 'var(--sage-dim)' : 'var(--border)'}` }}>
                    <span style={{ fontSize: 11, color: r.status === 'yes' ? 'var(--sage)' : r.status === 'maybe' ? 'var(--amber)' : 'var(--text3)', fontWeight: 500 }}>
                      {r.profiles?.name?.split(' ')[0] || 'Someone'} {r.status === 'yes' ? 'in' : r.status === 'maybe' ? '?' : 'out'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[{s:'yes',l:'Going'},{s:'maybe',l:'Maybe'},{s:'no',l:"Can't go"}].map(({s,l}) => (
                <button key={s} onClick={() => rsvp(h.id, s)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${myRsvp === s ? (s === 'yes' ? 'var(--sage)' : 'var(--border2)') : 'var(--border2)'}`, background: myRsvp === s ? (s === 'yes' ? 'var(--sage-soft)' : s === 'maybe' ? 'var(--amber-soft)' : 'var(--bg3)') : 'transparent', color: myRsvp === s ? (s === 'yes' ? 'var(--sage)' : s === 'maybe' ? 'var(--amber)' : 'var(--text2)') : 'var(--text2)', fontSize: 12, fontWeight: myRsvp === s ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => goLive(h)} style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>We are here!</button>
              {h.venue_maps_url && <a href={h.venue_maps_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, textDecoration: 'none' }}>Maps</a>}
            </div>
          </div>
        )
      })}

      {/* RECURRING */}
      {recurringHangouts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Recurring</div>
          {recurringHangouts.map(h => (
            <div key={h.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)' }}>{DAYS[h.recurrence_day || 5]}</div>
                <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600 }}>{h.recurrence_time?.slice(0,5) || '19:00'}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{h.venue_name || h.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Every {DAYS[h.recurrence_day || 5]} Â· {h.recurrence_time?.slice(0,5) || '19:00'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hangouts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Nothing planned yet. Be the first to suggest something.</div>
          <button onClick={() => setShowWizard(true)} style={{ padding: '10px 24px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Plan something</button>
        </div>
      )}

      {/* WIZARD */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 20, width: '100%', maxWidth: 580, height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Fixed header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>
                  {step === 'type' ? 'What kind of hangout?' : step === 'when' ? 'When?' : step === 'where' ? 'Where?' : step === 'poll' ? 'Activity vote?' : 'Review'}
                </div>
                <button onClick={() => { setShowWizard(false); resetWizard() }}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg3)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                  x
                </button>
              </div>
              {/* Step dots */}
              <div style={{ display: 'flex', gap: 4 }}>
                {STEPS.map((s, i) => (
                  <div key={s} style={{ height: 4, borderRadius: 2, flex: step === s ? 2 : 1, background: step === s ? 'var(--yellow)' : STEPS.indexOf(step) > i ? 'var(--sage)' : 'var(--border2)', transition: 'all 0.2s' }} />
                ))}
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* TYPE */}
              {step === 'type' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { id: 'spontaneous', label: "I'm out right now", desc: 'Announce you are at a spot â€” others can join' },
                    { id: 'planned', label: 'Plan ahead', desc: 'Schedule a hangout for a future date' },
                    { id: 'recurring', label: 'Recurring', desc: 'Same time every week â€” games night, walks' },
                  ] as {id: HangoutType, label: string, desc: string}[]).map(t => (
                    <div key={t.id} onClick={() => setCreateType(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', border: `1.5px solid ${createType === t.id ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 14, cursor: 'pointer', background: createType === t.id ? 'var(--yellow-soft)' : 'var(--bg2)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t.desc}</div>
                      </div>
                      {createType === t.id && <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--yellow)', flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              )}

              {/* WHEN */}
              {step === 'when' && (
                <div>
                  {createType === 'recurring' ? (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Which day?</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                        {DAYS.map((d, i) => (
                          <div key={d} onClick={() => setRecurrenceDay(i)}
                            style={{ flex: 1, padding: '10px 4px', border: `1.5px solid ${recurrenceDay === i ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: recurrenceDay === i ? 'var(--yellow-soft)' : 'var(--bg2)', fontSize: 11, textAlign: 'center', color: recurrenceDay === i ? 'var(--yellow)' : 'var(--text2)', fontWeight: recurrenceDay === i ? 700 : 400 }}>
                            {d}
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>What time?</div>
                      <input type="time" value={recurrenceTime} onChange={e => setRecurrenceTime(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 20, boxSizing: 'border-box' }} />
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>Pick a date and time</div>
                      <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 20, boxSizing: 'border-box' }} />
                    </>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>How long?</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {DURATIONS.map(d => (
                      <div key={d.minutes} onClick={() => setDurationMinutes(d.minutes)}
                        style={{ padding: '10px 6px', border: `1.5px solid ${durationMinutes === d.minutes ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: durationMinutes === d.minutes ? 'var(--yellow-soft)' : 'var(--bg2)', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: durationMinutes === d.minutes ? 'var(--yellow)' : 'var(--text)' }}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WHERE */}
              {step === 'where' && (
                <div>
                  {selectedVenue && !useManualVenue ? (
                    <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--sage)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {selectedVenue.photo_url && <img src={selectedVenue.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedVenue.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{selectedVenue.location?.formatted_address}</div>
                          {selectedVenue.rating && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>{selectedVenue.rating.toFixed(1)} stars</div>}
                        </div>
                        <button onClick={() => setSelectedVenue(null)} style={{ padding: '5px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
                      </div>
                    </div>
                  ) : useManualVenue ? (
                    <div style={{ marginBottom: 14 }}>
                      <input value={manualVenue} onChange={e => setManualVenue(e.target.value)} placeholder="Venue name (e.g. The Keg)"
                        style={{ width: '100%', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }} />
                      <input value={manualAddress} onChange={e => setManualAddress(e.target.value)} placeholder="Address (optional)"
                        style={{ width: '100%', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }} />
                      <button onClick={() => setUseManualVenue(false)} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 10, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Search with Discover instead
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14 }}>
                      <Discover members={members} onVenueSelect={(venue) => { setSelectedVenue(venue); setUseManualVenue(false) }} />
                    </div>
                  )}
                  {!selectedVenue && !useManualVenue && (
                    <button onClick={() => setUseManualVenue(true)} style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 10, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
                      Enter venue manually instead
                    </button>
                  )}
                </div>
              )}

              {/* POLL */}
              {step === 'poll' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <div onClick={() => setHasPoll(false)} style={{ flex: 1, padding: '14px', border: `1.5px solid ${!hasPoll ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: !hasPoll ? 'var(--yellow-soft)' : 'var(--bg2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: !hasPoll ? 'var(--yellow)' : 'var(--text)' }}>No vote needed</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Plan is set</div>
                    </div>
                    <div onClick={() => setHasPoll(true)} style={{ flex: 1, padding: '14px', border: `1.5px solid ${hasPoll ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: hasPoll ? 'var(--yellow-soft)' : 'var(--bg2)', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: hasPoll ? 'var(--yellow)' : 'var(--text)' }}>Add activity vote</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Let them choose</div>
                    </div>
                  </div>
                  {hasPoll && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {ACTIVITY_OPTIONS.map(o => (
                        <div key={o} onClick={() => setPollOptions(s => s.includes(o) ? s.filter(x => x !== o) : s.length < 5 ? [...s, o] : s)}
                          style={{ padding: '8px', border: `1px solid ${pollOptions.includes(o) ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 8, cursor: 'pointer', background: pollOptions.includes(o) ? 'var(--yellow-soft)' : 'transparent', fontSize: 11, textAlign: 'center', color: pollOptions.includes(o) ? 'var(--yellow)' : 'var(--text2)', fontWeight: pollOptions.includes(o) ? 600 : 400 }}>
                          {o}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* REVIEW */}
              {step === 'review' && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Row label="Type" value={createType === 'spontaneous' ? "I'm out now" : createType === 'planned' ? 'Planned hangout' : 'Recurring'} />
                    {getVenueName() && <Row label="Where" value={`${getVenueName()}${getVenueAddress() ? ' Â· ' + getVenueAddress() : ''}`} />}
                    {createType === 'planned' && scheduledFor && <Row label="When" value={formatDate(new Date(scheduledFor).toISOString())} />}
                    {createType === 'recurring' && <Row label="When" value={`Every ${DAYS[recurrenceDay]} at ${recurrenceTime}`} />}
                    <Row label="Duration" value={DURATIONS.find(d => d.minutes === durationMinutes)?.label || '2 hours'} />
                    {hasPoll && pollOptions.length > 0 && <Row label="Vote on" value={pollOptions.join(', ')} />}
                  </div>
                </div>
              )}
            </div>

            {/* Fixed footer â€” always visible */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10, background: 'var(--bg)' }}>
              <button onClick={prevStep}
                style={{ padding: '12px 20px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                {step === 'type' ? 'Cancel' : 'Back'}
              </button>
              <button onClick={nextStep} disabled={!canProceed() || creating}
                style={{ flex: 1, padding: '12px', background: canProceed() ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 10, color: canProceed() ? '#111' : 'var(--text3)', fontSize: 14, fontWeight: 800, cursor: canProceed() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: creating ? 0.7 : 1 }}>
                {nextLabel()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string, value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, width: 72, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
