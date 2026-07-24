'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export default function RewardsShop({ userId, userName, onClose, onRedeemed }: {
  userId: string, userName: string, onClose: () => void, onRedeemed: () => void
}) {
  const [rewards, setRewards] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: rewardsData }, { data: profileData }, { data: txData }] = await Promise.all([
      supabase.from('rewards').select('*').eq('active', true).order('point_cost', { ascending: true }),
      supabase.from('profiles').select('equipped_ring_color, equipped_title').eq('id', userId).single(),
      supabase.from('point_transactions').select('amount').eq('user_id', userId),
    ])
    setRewards(rewardsData || [])
    setProfile(profileData || null)
    setBalance((txData || []).reduce((s: number, t: any) => s + t.amount, 0))
    setLoading(false)
  }

  async function redeem(reward: any) {
    setRedeemingId(reward.id)
    setError('')
    const { error: err } = await supabase.from('redemptions').insert({
      user_id: userId, reward_id: reward.id, points_spent: 0, // server overwrites points_spent
    })
    if (err) {
      setError(err.message.includes('Insufficient') ? 'Not enough Vibes for that yet.' : 'Could not redeem. Please try again.')
      setRedeemingId(null)
      return
    }
    setRedeemingId(null)
    await load()
    onRedeemed()
  }

  const ringColors = rewards.filter(r => r.category === 'ring_color')
  const titles = rewards.filter(r => r.category === 'title')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>Vibes Shop</div>
            <div style={{ fontSize: 13, color: 'var(--yellow)', fontWeight: 700, marginTop: 2 }}>{balance} Vibes available</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg3)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text2)', fontFamily: 'inherit' }}>x</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Loading...</div>
          ) : (
            <>
              {/* Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: 'var(--yellow)', color: '#111',
                  fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: profile?.equipped_ring_color ? `3px solid ${profile.equipped_ring_color}` : '3px solid transparent',
                }}>
                  {getInitials(userName)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{userName}</div>
                  {profile?.equipped_title && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--yellow-soft)', color: 'var(--yellow)', fontWeight: 700, marginTop: 2, display: 'inline-block' }}>
                      {profile.equipped_title}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Avatar rings</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {ringColors.map(r => {
                  const isEquipped = profile?.equipped_ring_color === r.value
                  const canAfford = balance >= r.point_cost
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--bg2)', border: `1px solid ${isEquipped ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: r.value, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.point_cost} Vibes</div>
                      </div>
                      {isEquipped ? (
                        <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 700, flexShrink: 0 }}>Equipped</span>
                      ) : (
                        <button onClick={() => redeem(r)} disabled={!canAfford || redeemingId === r.id}
                          style={{ padding: '5px 10px', background: canAfford ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 6, color: canAfford ? '#111' : 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'inherit', flexShrink: 0 }}>
                          {redeemingId === r.id ? '...' : 'Get'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Titles</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {titles.map(r => {
                  const isEquipped = profile?.equipped_title === r.value
                  const canAfford = balance >= r.point_cost
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--bg2)', border: `1px solid ${isEquipped ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.description} \u00B7 {r.point_cost} Vibes</div>
                      </div>
                      {isEquipped ? (
                        <span style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 700, flexShrink: 0 }}>Equipped</span>
                      ) : (
                        <button onClick={() => redeem(r)} disabled={!canAfford || redeemingId === r.id}
                          style={{ padding: '5px 10px', background: canAfford ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 6, color: canAfford ? '#111' : 'var(--text3)', fontSize: 11, fontWeight: 700, cursor: canAfford ? 'pointer' : 'not-allowed', fontFamily: 'inherit', flexShrink: 0 }}>
                          {redeemingId === r.id ? '...' : 'Get'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
