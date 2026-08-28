'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import KnotIcon from '@/components/KnotIcon'

const BULLETS = [
  'Plan hangouts together',
  'Split bills automatically',
  'Build memories over time',
]

export default function OrientCard({ knotId, knotName, knotEmoji, userId, onDismiss }: {
  knotId: string
  knotName: string
  knotEmoji?: string
  userId: string
  onDismiss: () => void
}) {
  const [dismissing, setDismissing] = useState(false)

  async function gotIt() {
    setDismissing(true)
    await supabase.from('orient_card_seen').insert({ user_id: userId, knot_id: knotId })
    onDismiss()
  }

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--yellow-dim)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <KnotIcon value={knotEmoji} size={32} iconSize={16} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
          You are in. Here is how {knotName} works.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {BULLETS.map(b => (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--yellow)', flexShrink: 0 }} />
            {b}
          </div>
        ))}
      </div>
      <button onClick={gotIt} disabled={dismissing}
        style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: dismissing ? 0.6 : 1 }}>
        {dismissing ? '...' : 'Got it'}
      </button>
    </div>
  )
}
