'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  GAMES_CANCEL_LOBBY,
  GAMES_COMING_SOON,
  GAMES_EMPTY_SUB,
  GAMES_EMPTY_TITLE,
  GAMES_ERROR_CANCEL,
  GAMES_ERROR_CREATE,
  GAMES_ERROR_JOIN,
  GAMES_ERROR_JOIN_PLAYER,
  GAMES_ERROR_LOAD,
  GAMES_JOIN,
  GAMES_LOADING,
  GAMES_NEED_MEMBERS,
  GAMES_RECENT,
  GAMES_REJOIN,
  GAMES_STATUS_ACTIVE,
  GAMES_STATUS_FINISHED,
  GAMES_STATUS_WAITING,
  GAMES_SUBTITLE,
  GAMES_TITLE,
} from '@/lib/copy'
import AmongUsLite from '@/components/AmongUsLite'
import MostLikelyTo from '@/components/MostLikelyTo'
import Ludo from '@/components/Ludo'
import Snake from '@/components/Snake'
import Tetris from '@/components/Tetris'

// Registry of games available in the Knot. Adding a future game is just a new
// entry here plus its own component — no changes needed to this hub.
const GAMES_REGISTRY = [
  {
    id: 'among_us',
    name: 'Imposter',
    description: 'Secret roles, shared tasks, and emergency meetings. Vote out the impostor before they win.',
    players: '4\u201310 players',
    minPlayers: 4,
    mode: 'Async rounds',
    status: 'available' as const,
    kind: 'lobby' as const,
  },
  {
    id: 'most_likely_to',
    name: 'Most Likely To',
    description: 'Vote on who in the group is most likely to do something ridiculous.',
    players: '2+ players',
    minPlayers: 2,
    mode: 'Async rounds',
    status: 'available' as const,
    kind: 'lobby' as const,
  },
  {
    id: 'ludo',
    name: 'Ludo',
    description: 'Classic board game. Roll the dice, race your pieces home, and block your friends.',
    players: '2\u20134 players',
    minPlayers: 2,
    mode: 'Turn-based',
    status: 'available' as const,
    kind: 'lobby' as const,
  },
  {
    id: 'snake',
    name: 'Snake',
    description: 'Classic snake. Chase the highest score and climb your Knot\'s leaderboard.',
    players: 'Solo',
    minPlayers: 1,
    mode: 'Instant play',
    status: 'available' as const,
    kind: 'instant' as const,
  },
  {
    id: 'tetris',
    name: 'Tetris',
    description: 'Clear lines, chase combos, and top your Knot\'s leaderboard.',
    players: 'Solo',
    minPlayers: 1,
    mode: 'Instant play',
    status: 'available' as const,
    kind: 'instant' as const,
  },
  // Future games go here, e.g.:
  // { id: 'live_among_us', name: 'Imposter Live', description: '...', players: '4-10', mode: 'Real-time', status: 'coming_soon' as const, kind: 'lobby' as const },
]

export default function Games({ members, knotId, currentUser }: { members: any[], knotId?: string, currentUser?: any }) {
  const [games, setGames]           = useState<any[]>([])
  const [activeGame, setActiveGame] = useState<any>(null)
  const [instantGame, setInstantGame] = useState<string | null>(null)
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
    if (fetchError) { setError(GAMES_ERROR_LOAD); setLoading(false); return }
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

    const registryEntry = GAMES_REGISTRY.find(g => g.id === gameId)
    if (registryEntry?.kind === 'instant') {
      setInstantGame(gameId)
      return
    }

    const { data, error: insertError } = await supabase
      .from('games')
      .insert({ knot_id: knotId, created_by: currentUser.id, game_type: gameId, status: 'waiting' })
      .select().single()

    if (insertError || !data) { setError(GAMES_ERROR_CREATE); return }

    const { error: joinError } = await supabase.from('game_players').insert({ game_id: data.id, user_id: currentUser.id, color: 'var(--yellow)', alive: true })
    if (joinError) { setError(GAMES_ERROR_JOIN_PLAYER); return }

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
      if (joinError) { setError(GAMES_ERROR_JOIN); return }
    }
    setActiveGame(game)
  }

  async function cancelLobby(game: any) {
    if (!currentUser?.id || game.created_by !== currentUser.id || game.status !== 'waiting') return
    if (!confirm('Cancel this lobby? This cannot be undone.')) return
    setError('')
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .eq('id', game.id)
      .eq('created_by', currentUser.id)
      .eq('status', 'waiting')
    if (deleteError) {
      setError(GAMES_ERROR_CANCEL)
      return
    }
    if (activeGame?.id === game.id) setActiveGame(null)
    await loadGames()
  }

  if (!currentUser || !knotId) return (
    <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>
  )

  if (instantGame === 'snake') return (
    <Snake knotId={knotId} currentUser={currentUser} onBack={() => setInstantGame(null)} />
  )

  if (instantGame === 'tetris') return (
    <Tetris knotId={knotId} currentUser={currentUser} onBack={() => setInstantGame(null)} />
  )

  if (activeGame?.id) {
    if (activeGame.game_type === 'most_likely_to') {
      return (
        <MostLikelyTo
          game={activeGame}
          members={members}
          currentUser={currentUser}
          onEnd={() => { setActiveGame(null); loadGames() }}
        />
      )
    }
    if (activeGame.game_type === 'ludo') {
      return (
        <Ludo
          game={activeGame}
          currentUser={currentUser}
          onEnd={() => { setActiveGame(null); loadGames() }}
        />
      )
    }
    return (
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
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{GAMES_TITLE}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>{GAMES_SUBTITLE}</div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {GAMES_REGISTRY.map(g => {
          const isAvailable = g.status === 'available'
          const minPlayers = g.minPlayers ?? 1
          const shortBy = g.kind === 'lobby' ? minPlayers - members.length : 0
          const blocked = isAvailable && shortBy > 0
          return (
            <div key={g.id}
              onClick={() => isAvailable && !blocked && createGame(g.id)}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20,
                cursor: isAvailable && !blocked ? 'pointer' : 'not-allowed',
                opacity: isAvailable ? 1 : 0.5,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (isAvailable && !blocked) e.currentTarget.style.borderColor = 'var(--yellow)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</div>
                {!isAvailable && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 600 }}>{GAMES_COMING_SOON}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14 }}>{g.description}</div>
              {blocked && (
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>
                  {GAMES_NEED_MEMBERS.replace('{n}', String(shortBy))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--yellow-soft)', color: 'var(--yellow)' }}>{g.players}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--olive-soft)', color: 'var(--olive)' }}>{g.mode}</span>
              </div>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{GAMES_LOADING}</div>
      ) : games.length > 0 ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{GAMES_RECENT}</div>
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
                  {g.status === 'waiting' ? GAMES_STATUS_WAITING : g.status === 'active' ? GAMES_STATUS_ACTIVE : GAMES_STATUS_FINISHED}
                </span>
                {g.status !== 'finished' && (
                  <button onClick={() => joinGame(g)}
                    style={{ padding: '6px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {g.status === 'waiting' ? GAMES_JOIN : GAMES_REJOIN}
                  </button>
                )}
                {g.status === 'waiting' && g.created_by === currentUser?.id && (
                  <button onClick={() => cancelLobby(g)}
                    style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--danger-dim)', borderRadius: 8, color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {GAMES_CANCEL_LOBBY}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{GAMES_EMPTY_TITLE}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{GAMES_EMPTY_SUB}</div>
        </div>
      )}
    </div>
  )
}
