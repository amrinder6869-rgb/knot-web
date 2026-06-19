'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/Skeleton'
import MostLikelyTo from '@/components/MostLikelyTo'
import Ludo from '@/components/Ludo'

export default function Games({ members, knotId, currentUser }: { members: any[], knotId?: string, currentUser?: any }) {
  const [games, setGames]           = useState<any[]>([])
  const [activeGame, setActiveGame] = useState<any>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (knotId && currentUser) loadGames()
  }, [knotId, currentUser])

  async function loadGames() {
    const { data } = await supabase
      .from('games').select('*, profiles:created_by(name)')
      .eq('knot_id', knotId).order('created_at', { ascending: false })
    if (data) setGames(data)
    setLoading(false)
  }

  async function createGame(type: 'most_likely' | 'ludo') {
    if (!knotId || !currentUser?.id) return
    const { data } = await supabase.from('games')
      .insert({ knot_id: knotId, created_by: currentUser.id, game_type: type, status: 'waiting' })
      .select().single()
    if (data) {
      await supabase.from('game_players').insert({ game_id: data.id, user_id: currentUser.id, color: '#B85C38' })
      setActiveGame(data); loadGames()
    }
  }

  async function joinGame(game: any) {
    if (!currentUser?.id) return
    const colors = ['#B85C38', '#6B705C', '#4A7C5F', '#C07A10']
    const { data: players } = await supabase.from('game_players').select('*').eq('game_id', game.id)
    const alreadyIn = players?.some((p: any) => p.user_id === currentUser.id)
    if (!alreadyIn) {
      await supabase.from('game_players').insert({ game_id: game.id, user_id: currentUser.id, color: colors[players?.length || 0] })
    }
    setActiveGame(game)
  }

  if (!currentUser || !knotId) return (
    <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Skeleton height={160} borderRadius={16} />
        <Skeleton height={160} borderRadius={16} />
      </div>
    </div>
  )

  if (activeGame?.id) return (
    <div>
      <button className="btn btn-secondary" onClick={() => { setActiveGame(null); loadGames() }} style={{ marginBottom: 16, fontSize: 13, padding: '7px 14px' }}>
        ← Back to games
      </button>
      {activeGame.game_type === 'most_likely' && (
        <MostLikelyTo game={activeGame} members={members} currentUser={currentUser} knotId={knotId} onEnd={() => { setActiveGame(null); loadGames() }} />
      )}
      {activeGame.game_type === 'ludo' && (
        <Ludo game={activeGame} members={members} currentUser={currentUser} knotId={knotId} onEnd={() => { setActiveGame(null); loadGames() }} />
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>Games</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>Play together inside your Knot.</div>

      {/* Game picker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {[
          {
            type: 'most_likely' as const,
            title: 'Most Likely To',
            desc: 'Vote on who in the group is most likely to... Results revealed after everyone votes.',
            tags: [{ label: '2–10 players', color: 'var(--rust)', bg: 'var(--rust-soft)' }, { label: 'Async', color: 'var(--olive)', bg: 'var(--olive-soft)' }],
          },
          {
            type: 'ludo' as const,
            title: 'Ludo',
            desc: 'Classic board game. Roll dice, race your pieces home, knock opponents back to start.',
            tags: [{ label: '2–4 players', color: 'var(--rust)', bg: 'var(--rust-soft)' }, { label: 'Real-time', color: 'var(--amber)', bg: 'var(--amber-soft)' }],
          },
        ].map(g => (
          <div key={g.type}
            className="card-hover"
            onClick={() => createGame(g.type)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--rust)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>{g.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14 }}>{g.desc}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {g.tags.map(t => (
                <span key={t.label} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: t.bg, color: t.color, fontWeight: 600 }}>{t.label}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent games */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <Skeleton width={36} height={36} borderRadius={8} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}><Skeleton height={13} width="40%" /><Skeleton height={11} width="55%" /></div>
              <Skeleton height={24} width={64} borderRadius={20} />
            </div>
          ))}
        </div>
      ) : games.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Recent games</div>
          {games.map(g => (
            <div key={g.id} className="card-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text3)', flexShrink: 0, letterSpacing: '0.04em' }}>
                {g.game_type === 'most_likely' ? 'MLT' : 'LUDO'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.game_type === 'most_likely' ? 'Most Likely To' : 'Ludo'}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Started by {g.profiles?.name || 'someone'}</div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: g.status === 'active' ? 'var(--sage-soft)' : g.status === 'waiting' ? 'var(--amber-soft)' : 'var(--bg3)', color: g.status === 'active' ? 'var(--sage)' : g.status === 'waiting' ? 'var(--amber)' : 'var(--text3)', fontWeight: 600 }}>
                {g.status === 'waiting' ? 'Waiting' : g.status === 'active' ? 'In progress' : 'Finished'}
              </span>
              {g.status !== 'finished' && (
                <button className="btn btn-primary" onClick={() => joinGame(g)} style={{ fontSize: 12, padding: '5px 14px' }}>
                  {g.status === 'waiting' ? 'Join' : 'Rejoin'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 16, opacity: 0.2 }}>
            <rect x="4" y="12" width="32" height="22" rx="4" stroke="var(--text)" strokeWidth="2"/>
            <circle cx="14" cy="23" r="3" stroke="var(--text)" strokeWidth="2"/>
            <circle cx="26" cy="23" r="3" stroke="var(--text)" strokeWidth="2"/>
            <path d="M14 8h12" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>No games started.</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>Kick off a game with your group above.</div>
        </div>
      )}
    </div>
  )
}
