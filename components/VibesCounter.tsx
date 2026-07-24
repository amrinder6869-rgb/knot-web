'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import RewardsShop from '@/components/RewardsShop'

const REASON_LABELS: Record<string, string> = {
  moment_post: 'Posted a moment',
  hangout_created: 'Planned a hangout',
  hangout_attended: 'Showed up to a hangout',
  bill_settled: 'Settled a bill',
  game_won: 'Won a game',
  streak_bonus: 'Streak bonus',
  redemption: 'Redeemed',
}

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function VibesCounter({ userId, userName }: { userId?: string, userName?: string }) {
  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(true)
  const [justEarned, setJustEarned] = useState(false)
  const [showShop, setShowShop] = useState(false)

  useEffect(() => {
    if (!userId) return
    load()

    const channel = supabase
      .channel(`vibes:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'point_transactions', filter: `user_id=eq.${userId}` }, () => {
        setJustEarned(true)
        setTimeout(() => setJustEarned(false), 900)
        load()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function load() {
    if (!userId) return
    const { data, error } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) { setLoading(false); return }
    setHistory(data || [])
    const total = (data || []).reduce((sum: number, t: any) => sum + t.amount, 0)
    setBalance(total)
    setLoading(false)
  }

  if (!userId) return null

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setShowPanel(s => !s)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px', borderRadius: 20,
          background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)',
          color: 'var(--yellow)', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          transform: justEarned ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.2s',
        }}>
        {loading ? '...' : balance ?? 0}
        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>Vibes</span>
      </button>

      {showPanel && (
        <>
          <div onClick={() => setShowPanel(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 8,
            width: 300, maxHeight: 400, overflowY: 'auto',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
          }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Your Vibes</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--yellow)' }}>{balance ?? 0}</div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {history.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
                  Post, plan, show up, and win games to start earning Vibes.
                </div>
              ) : (
                history.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)' }}>{REASON_LABELS[t.reason] || t.reason}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{timeAgo(t.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.amount >= 0 ? 'var(--sage)' : 'var(--text3)' }}>
                      {t.amount >= 0 ? '+' : ''}{t.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { setShowShop(true); setShowPanel(false) }}
                style={{ width: '100%', padding: '9px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Open Vibes Shop
              </button>
            </div>
          </div>
        </>
      )}

      {showShop && userId && (
        <RewardsShop
          userId={userId}
          userName={userName || 'You'}
          onClose={() => setShowShop(false)}
          onRedeemed={load}
        />
      )}
    </div>
  )
}
