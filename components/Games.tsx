'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AmongUsLite from '@/components/AmongUsLite'

// Registry of games available in the Knot. Adding a future game is just a new
// entry here plus its own component — no changes needed to this hub.
const GAMES_REGISTRY = [
  {
    id: 'among_us',
    name: 'Imposter',
    description: 'Secret roles, shared tasks, and emergency meetings. Vote out the impostor before they win.',
    players: '4\u201310 players',
    mode: 'Async rounds',
    status: 'available' as const,
  },
  // Future games go here, e.g.:
  // { id: 'live_among_us', name: 'Imposter Live', description: '...', players: '4-10', mode: 'Real-time', status: 'coming_soon' as const },
]

export default function Games({ members, knotId, currentUser }: { members: any[], knotId?: string, currentUser?: any }) {
  const [games, setGames]           = useState<any[]>([])
  const [activeGame, setActiveGame] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (knotId && currentUser) loadGames()
  }, [knotId, currentUser])

  async function loadGames() {
    const { data, error: fetchError } = await supabase
      .from('games')
      .select('*, profiles:created_by(name)')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
    if (fetchError) { setError('Could not load games.'); setLoading(false); return }
    if (data) setGames(data)
    setLoading(false)
  }

  async function refreshActiveGame() {
    if (!activeGame) return
    const { data } = await supabase.from('games').select('*, profiles:created_by(name)').eq('id', activeGame.id).single()
    if (data) setActiveGame(data)
  }

  async function createGame(gameId: string) {
    if (!knotId || !currentUser?.id) return
    setError('')
    const { data, error: insertError } = await supabase
      .from('games')
      .insert({ knot_id: knotId, created_by: currentUser.id, game_type: gameId, status: 'waiting' })
      .select().single()

    if (insertError || !data) { setError('Could not create the game. Please try again.'); return }

    const { error: joinError } = await supabase.from('game_players').insert({ game_id: data.id, user_id: currentUser.id, color: 'var(--yellow)', alive: true })
    if (joinError) { setError('Game created, but you could not be added as a player.'); return }

    setActiveGame(data)
    loadGames()
  }

  async function joinGame(game: any) {
    if (!currentUser?.id) return
    setError('')
    const colors = ['#B85C38', '#6B705C', '#4A7C5F', '#C07A10', '#8B7355', '#7A6B5A']
    const { data: existingPlayers } = await supabase.from('game_players').select('*').eq('game_id', game.id)
    const alreadyIn = existingPlayers?.some((p: any) => p.user_id === currentUser.id)
    if (!alreadyIn) {
      const color = colors[(existingPlayers?.length || 0) % colors.length]
      const { error: joinError } = await supabase.from('game_players').insert({ game_id: game.id, user_id: currentUser.id, color, alive: true })
      if (joinError) { setError('Could not join the game.'); return }
    }
    setActiveGame(game)
  }

  if (!currentUser || !knotId) return (
    <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
  )

  if (activeGame?.id) return (
    <div>
      <AmongUsLite
        game={activeGame}
        members={members}
        currentUser={currentUser}
        knotId={knotId}
        onEnd={() => { setActiveGame(null); loadGames() }}
        onRefreshGame={refreshActiveGame}
      />
    </div>
  )

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Games</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Play together inside your Knot.</div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--yellow-soft)', border: '1px solid var(--yellow-dim)', borderRadius: 8, fontSize: 13, color: 'var(--yellow)', marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {GAMES_REGISTRY.map(g => {
          const isAvailable = g.status === 'available'
          return (
            <div key={g.id}
              onClick={() => isAvailable && createGame(g.id)}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20,
                cursor: isAvailable ? 'pointer' : 'not-allowed',
                opacity: isAvailable ? 1 : 0.5,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (isAvailable) e.currentTarget.style.borderColor = 'var(--yellow)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</div>
                {!isAvailable && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 600 }}>Coming soon</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14 }}>{g.description}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--yellow-soft)', color: 'var(--yellow)' }}>{g.players}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--olive-soft)', color: 'var(--olive)' }}>{g.mode}</span>
              </div>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Loading games...</div>
      ) : games.length > 0 ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Recent games</div>
          {games.map(g => {
            const registryEntry = GAMES_REGISTRY.find(r => r.id === g.game_type)
            return (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text3)', flexShrink: 0 }}>
                  {(registryEntry?.name || g.game_type || '?').substring(0, 3).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{registryEntry?.name || g.game_type}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>Started by {g.profiles?.name || 'someone'}</div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: g.status === 'active' ? 'var(--sage-soft)' : g.status === 'waiting' ? 'var(--amber-soft)' : 'var(--bg3)', color: g.status === 'active' ? 'var(--sage)' : g.status === 'waiting' ? 'var(--amber)' : 'var(--text3)' }}>
                  {g.status === 'waiting' ? 'Waiting' : g.status === 'active' ? 'In progress' : 'Finished'}
                </span>
                {g.status !== 'finished' && (
                  <button onClick={() => joinGame(g)}
                    style={{ padding: '6px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {g.status === 'waiting' ? 'Join' : 'Rejoin'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No games yet</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Start a game above to play with your Knot.</div>
        </div>
      )}
    </div>
  )
}
