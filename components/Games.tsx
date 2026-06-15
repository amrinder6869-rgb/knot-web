'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
      .from('games')
      .select('*, profiles:created_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
    if (data) setGames(data)
    setLoading(false)
  }

  async function createGame(type: 'most_likely' | 'ludo') {
    if (!knotId || !currentUser?.id) return
    const { data } = await supabase
      .from('games')
      .insert({ knot_id: knotId, created_by: currentUser.id, game_type: type, status: 'waiting' })
      .select().single()
    if (data) {
      await supabase.from('game_players').insert({ game_id: data.id, user_id: currentUser.id, color: '#6C63FF' })
      setActiveGame(data)
      loadGames()
    }
  }

  async function joinGame(game: any) {
    if (!currentUser?.id) return
    const colors = ['#6C63FF','#4CAF87','#E8624A','#F0A855']
    const { data: players } = await supabase.from('game_players').select('*').eq('game_id', game.id)
    const alreadyIn = players?.some((p: any) => p.user_id === currentUser.id)
    if (!alreadyIn) {
      const color = colors[players?.length || 0]
      await supabase.from('game_players').insert({ game_id: game.id, user_id: currentUser.id, color })
    }
    setActiveGame(game)
  }

  // Guards
  if (!currentUser || !knotId) return (
    <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
  )

  // Active game view
  if (activeGame?.id) return (
    <div>
      <button onClick={() => { setActiveGame(null); loadGames() }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16 }}>
        ← Back to games
      </button>
      {activeGame.game_type === 'most_likely' && (
        <MostLikelyTo
          game={activeGame}
          members={members}
          currentUser={currentUser}
          knotId={knotId}
          onEnd={() => { setActiveGame(null); loadGames() }}
        />
      )}
      {activeGame.game_type === 'ludo' && (
        <Ludo
          game={activeGame}
          members={members}
          currentUser={currentUser}
          knotId={knotId}
          onEnd={() => { setActiveGame(null); loadGames() }}
        />
      )}
    </div>
  )

  // Game lobby
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🎮 Games</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Play together inside your Knot.</div>

      {/* Game picker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onClick={() => createGame('most_likely')}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--indigo)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Most Likely To</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14 }}>
            Vote on who in the group is most likely to... Results revealed after everyone votes.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--indigo-soft)', color: 'var(--indigo)' }}>2–10 players</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Async</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}
          onClick={() => createGame('ludo')}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--indigo)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🎲</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ludo</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14 }}>
            Classic board game. Roll dice, race your pieces home, knock opponents back to start.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--indigo-soft)', color: 'var(--indigo)' }}>2–4 players</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--amber-soft)', color: 'var(--amber)' }}>Real-time</span>
          </div>
        </div>
      </div>

      {/* Recent games */}
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Loading games...</div>
      ) : games.length > 0 ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent games</div>
          {games.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{g.game_type === 'most_likely' ? '🤔' : '🎲'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.game_type === 'most_likely' ? 'Most Likely To' : 'Ludo'}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Started by {g.profiles?.name || 'someone'}</div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: g.status === 'active' ? 'var(--sage-soft)' : g.status === 'waiting' ? 'var(--amber-soft)' : 'var(--bg3)', color: g.status === 'active' ? 'var(--sage)' : g.status === 'waiting' ? 'var(--amber)' : 'var(--text3)' }}>
                {g.status === 'waiting' ? 'Waiting' : g.status === 'active' ? 'In progress' : 'Finished'}
              </span>
              {g.status !== 'finished' && (
                <button onClick={() => joinGame(g)}
                  style={{ padding: '6px 14px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {g.status === 'waiting' ? 'Join' : 'Rejoin'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎮</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No games yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Start a game above to play with your Knot.</div>
        </div>
      )}
    </div>
  )
}