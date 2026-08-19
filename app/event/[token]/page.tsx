'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Calendar, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type StandaloneEvent = {
  found: boolean
  id: string
  title: string
  status: string
  scheduled_at: string | null
  scheduled_for: string | null
  venue_name: string | null
  venue_address: string | null
  meeting_url: string | null
  brief: string | null
  organizer_name: string | null
  organizer_id: string
  attendee_count: number
  converted_to_knot_id: string | null
}

type RsvpStatus = 'going' | 'maybe' | 'declined'

function formatDate(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function StandaloneEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [event, setEvent] = useState<StandaloneEvent | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [signedIn, setSignedIn] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null)
  const [rsvping, setRsvping] = useState<RsvpStatus | null>(null)
  const [rsvpError, setRsvpError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (cancelled) return
      setSignedIn(!!auth.user)
      setCurrentUserId(auth.user?.id ?? null)

      const { data, error } = await supabase.rpc('get_standalone_event', { p_token: token })
      if (cancelled) return

      if (error) { setStatus('error'); return }

      const row = data as StandaloneEvent | null
      if (!row || !row.found) { setStatus('notfound'); return }

      setEvent(row)

      if (auth.user) {
        const { data: mine } = await supabase
          .from('standalone_attendees')
          .select('status')
          .eq('hangout_id', row.id)
          .eq('user_id', auth.user.id)
          .limit(1)
        if (!cancelled && mine && mine[0]) setMyStatus(mine[0].status as RsvpStatus)
      }

      setStatus('ready')
    }

    load()
    return () => { cancelled = true }
  }, [token])

  async function rsvp(next: RsvpStatus) {
    if (!currentUserId || !event || rsvping) return
    setRsvping(next)
    setRsvpError('')
    const { error } = await supabase.from('standalone_attendees').upsert(
      { hangout_id: event.id, user_id: currentUserId, status: next },
      { onConflict: 'hangout_id,user_id' }
    )
    if (error) {
      setRsvpError('Could not save your RSVP. Try again.')
      setRsvping(null)
      return
    }
    setMyStatus(next)
    setEvent(e => e ? { ...e, attendee_count: myStatus ? e.attendee_count : e.attendee_count + 1 } : e)
    setRsvping(null)
  }

  if (status === 'loading') return <Centered>Loading…</Centered>

  if (status === 'error') return (
    <Centered>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Something went wrong</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>We couldn&apos;t load this event. Try again in a moment.</div>
    </Centered>
  )

  if (status === 'notfound' || !event) return (
    <Centered>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No such event</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>This event link doesn&apos;t exist, or it&apos;s been removed.</div>
    </Centered>
  )

  const scheduledLabel = formatDate(event.scheduled_for ?? event.scheduled_at)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif', display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', fontSize: 11, fontWeight: 700, color: 'var(--yellow)', marginBottom: 14 }}>
            One-time event
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 6 }}>{event.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
            Organized by {event.organizer_name || 'someone'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {scheduledLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <Calendar size={15} color="var(--text3)" />
                {scheduledLabel}
              </div>
            )}
            {(event.venue_name || event.venue_address) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <MapPin size={15} color="var(--text3)" />
                {[event.venue_name, event.venue_address].filter(Boolean).join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
              <Users size={15} color="var(--text3)" />
              {event.attendee_count} attending
            </div>
          </div>

          {event.brief && (
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.6, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
              {event.brief}
            </p>
          )}

          {event.converted_to_knot_id && (
            <div style={{ padding: '14px 16px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sage)', marginBottom: 6 }}>This event has a Knot now</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>
                The crew kept it going. If you attended, you should already be a member.
              </div>
              <Link href="/dashboard" style={{ display: 'inline-block', padding: '8px 16px', background: 'var(--yellow)', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Open Knot →
              </Link>
            </div>
          )}

          {rsvpError && (
            <div className="error-banner" style={{ marginBottom: 14 }}>{rsvpError}</div>
          )}

          {signedIn ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Your RSVP</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { id: 'going' as RsvpStatus, label: 'Going' },
                  { id: 'maybe' as RsvpStatus, label: 'Maybe' },
                  { id: 'declined' as RsvpStatus, label: "Can't go" },
                ]).map(({ id, label }) => (
                  <button key={id} onClick={() => rsvp(id)} disabled={!!rsvping}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 8,
                      border: `1px solid ${myStatus === id ? 'var(--yellow)' : 'var(--border2)'}`,
                      background: myStatus === id ? 'var(--yellow-soft)' : 'transparent',
                      color: myStatus === id ? 'var(--yellow)' : 'var(--text2)',
                      fontSize: 13, fontWeight: myStatus === id ? 700 : 500,
                      cursor: rsvping ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    }}>
                    {rsvping === id ? '...' : label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>Sign in to RSVP to this event.</div>
              <Link href="/" style={{ display: 'inline-block', padding: '9px 18px', background: 'var(--yellow)', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>
      {children}
    </div>
  )
}
