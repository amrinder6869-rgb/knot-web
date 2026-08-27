'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

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

type KnotRef = { id: string; name: string; emoji?: string }

function EventsSection({
  title,
  items,
  color,
  knotById,
  onOpenKnotTab,
}: {
  title: string
  items: any[]
  color: string
  knotById: Map<string, KnotRef>
  onOpenKnotTab: (knot: KnotRef, tabId: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(h => {
          const knot = knotById.get(h.knot_id)
          return (
            <div key={h.id} onClick={() => knot && onOpenKnotTab(knot, 'hangout')}
              style={{ background: 'var(--bg2)', border: `1px solid ${color}`, borderRadius: 12, padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em' }}>{knot?.emoji} {knot?.name}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{h.venue_name || h.title}</div>
              {h.venue_address && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{h.venue_address}</div>}
              {h.scheduled_for && <div style={{ fontSize: 13, color, fontWeight: 600, marginTop: 4 }}>{formatDate(h.scheduled_for)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HomeEvents({ knots, onOpenKnotTab }: { knots: KnotRef[]; onOpenKnotTab: (knot: KnotRef, tabId: string) => void }) {
  const [hangouts, setHangouts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (knots.length > 0) load()
    else setLoading(false)
  }, [knots.map(k => k.id).join(',')])

  async function load() {
    setError('')
    const knotIds = knots.map(k => k.id)
    const { data, error: fetchError } = await supabase
      .from('hangouts')
      .select('*')
      .in('knot_id', knotIds)
      .order('scheduled_for', { ascending: true })

    if (fetchError) { setError('Could not load your events.'); setLoading(false); return }
    setHangouts(data || [])
    setLoading(false)
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
  if (error) return <div className="error-banner">{error}</div>

  const live       = hangouts.filter(h => h.is_live)
  const upcoming   = hangouts.filter(h => !h.is_live && h.status === 'confirmed')
  const suggested  = hangouts.filter(h => !h.is_live && h.status === 'voting')

  const knotById = new Map(knots.map(k => [k.id, k]))

  if (hangouts.length === 0 || (live.length === 0 && upcoming.length === 0 && suggested.length === 0)) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Nothing planned yet</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Hangouts from all your Knots will show up here.</div>
      </div>
    )
  }

  return (
    <div>
      <EventsSection title="Live now" items={live} color="#4ade80" knotById={knotById} onOpenKnotTab={onOpenKnotTab} />
      <EventsSection title="Upcoming" items={upcoming} color="var(--sage)" knotById={knotById} onOpenKnotTab={onOpenKnotTab} />
      <EventsSection title="Suggested" items={suggested} color="var(--yellow)" knotById={knotById} onOpenKnotTab={onOpenKnotTab} />
    </div>
  )
}
