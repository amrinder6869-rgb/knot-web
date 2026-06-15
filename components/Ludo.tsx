'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const PLAYER_COLORS = ['#E8624A', '#6C63FF', '#4CAF87', '#F0A855']
const PLAYER_LABELS = ['Red', 'Blue', 'Green', 'Yellow']

// Board path — 52 squares around the board
const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47]
const HOME_COLUMNS: Record<number, number[]> = {
  0: [52, 53, 54, 55, 56],  // Red home column
  1: [57, 58, 59, 60, 61],  // Blue
  2: [62, 63, 64, 65, 66],  // Green
  3: [67, 68, 69, 70, 71],  // Yellow
}
const START_POSITIONS = [0, 13, 26, 39]
const PIECES_PER_PLAYER = 4

function initialPieces() {
  return Array.from({ length: 4 }, (_, pi) =>
    Array.from({ length: PIECES_PER_PLAYER }, (_, i) => ({
      id: `p${pi}-${i}`, player: pi, pos: -1, home: false
    }))
  )
}

export default function Ludo({ game, members, currentUser, knotId, onEnd }: any) {
  const [players, setPlayers]     = useState<any[]>([])
  const [pieces, setPieces]       = useState(initialPieces())
  const [dice, setDice]           = useState<number|null>(null)
  const [myTurn, setMyTurn]       = useState(false)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [rolled, setRolled]       = useState(false)
  const [phase, setPhase]         = useState<'lobby'|'playing'|'finished'>('lobby')
  const [winner, setWinner]       = useState<number|null>(null)
  const [loading, setLoading]     = useState(true)
  const [myPlayerIndex, setMyPlayerIndex] = useState(-1)
  const [movablePieces, setMovablePieces] = useState<string[]>([])

  useEffect(() => {
    loadGame()
    const channel = supabase.channel(`ludo:${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_moves', filter: `game_id=eq.${game.id}` }, () => loadGame())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, () => loadGame())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, () => loadGame())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [game.id])

  async function loadGame() {
    const [{ data: gData }, { data: pData }, { data: mData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', game.id).single(),
      supabase.from('game_players').select('*, profiles:user_id(name)').eq('game_id', game.id),
      supabase.from('game_moves').select('*').eq('game_id', game.id).order('created_at', { ascending: true }),
    ])

    if (pData) {
      setPlayers(pData)
      const myIdx = pData.findIndex((p: any) => p.user_id === currentUser?.id)
      setMyPlayerIndex(myIdx)
    }

    if (gData) {
      setPhase(gData.status === 'finished' ? 'finished' : gData.status === 'active' ? 'playing' : 'lobby')
      if (gData.data?.pieces) setPieces(gData.data.pieces)
      if (gData.data?.currentTurn !== undefined) {
        setCurrentTurn(gData.data.currentTurn)
        if (pData) {
          const myIdx = pData.findIndex((p: any) => p.user_id === currentUser?.id)
          setMyTurn(myIdx === gData.data.currentTurn)
        }
      }
      if (gData.data?.winner !== undefined) setWinner(gData.data.winner)
      if (gData.data?.dice) setDice(gData.data.dice)
      if (gData.data?.rolled) setRolled(gData.data.rolled)
      if (gData.data?.movablePieces) setMovablePieces(gData.data.movablePieces)
    }
    setLoading(false)
  }

  async function startGame() {
    await supabase.from('games').update({
      status: 'active',
      data: { pieces: initialPieces(), currentTurn: 0, dice: null, rolled: false, movablePieces: [], winner: null }
    }).eq('id', game.id)
    setPhase('playing')
  }

  async function rollDice() {
    if (!myTurn || rolled) return
    const d = Math.floor(Math.random() * 6) + 1
    setDice(d)
    setRolled(true)

    // Find movable pieces
    const movable = pieces[myPlayerIndex].filter(p => {
      if (p.home) return false
      if (p.pos === -1) return d === 6
      return true
    }).map(p => p.id)

    setMovablePieces(movable)

    await supabase.from('games').update({
      data: { ...await getGameData(), dice: d, rolled: true, movablePieces: movable }
    }).eq('id', game.id)

    if (movable.length === 0) {
      // No moves — next turn
      await nextTurn(d === 6)
    }
  }

  async function getGameData() {
    const { data } = await supabase.from('games').select('data').eq('id', game.id).single()
    return data?.data || {}
  }

  async function movePiece(pieceId: string) {
    if (!myTurn || !rolled || !movablePieces.includes(pieceId)) return

    const newPieces = pieces.map(playerPieces =>
      playerPieces.map(p => {
        if (p.id !== pieceId) return p
        let newPos = p.pos
        if (p.pos === -1 && dice === 6) {
          newPos = START_POSITIONS[myPlayerIndex]
        } else if (p.pos !== -1) {
          newPos = p.pos + (dice || 0)
          if (newPos >= 52) {
            const homeCol = HOME_COLUMNS[myPlayerIndex]
            const homePos = newPos - 52
            if (homePos < homeCol.length) {
              newPos = homeCol[homePos]
            } else {
              return p // Can't move
            }
          }
        }
        const isHome = HOME_COLUMNS[myPlayerIndex].includes(newPos) &&
          newPos === HOME_COLUMNS[myPlayerIndex][HOME_COLUMNS[myPlayerIndex].length - 1]
        return { ...p, pos: newPos, home: isHome }
      })
    )

    // Check if knocked opponent
    const movedPiece = newPieces[myPlayerIndex].find(p => p.id === pieceId)
    if (movedPiece && !SAFE_SQUARES.includes(movedPiece.pos) && movedPiece.pos < 52) {
      newPieces.forEach((playerPieces, pi) => {
        if (pi !== myPlayerIndex) {
          playerPieces.forEach(p => {
            if (p.pos === movedPiece.pos) p.pos = -1
          })
        }
      })
    }

    // Check win
    const won = newPieces[myPlayerIndex].every(p => p.home)
    if (won) {
      await supabase.from('games').update({
        status: 'finished',
        data: { pieces: newPieces, currentTurn, dice, rolled: false, movablePieces: [], winner: myPlayerIndex }
      }).eq('id', game.id)
      setPhase('finished')
      setWinner(myPlayerIndex)
      return
    }

    await supabase.from('game_moves').insert({
      game_id: game.id, user_id: currentUser.id,
      move_data: { piece: pieceId, from: pieces[myPlayerIndex].find(p => p.id === pieceId)?.pos, to: movedPiece?.pos, dice }
    })

    setPieces(newPieces)
    await nextTurn(dice === 6, newPieces)
  }

  async function nextTurn(extraTurn: boolean, newPieces?: any) {
    const nextTurnIdx = extraTurn ? currentTurn : (currentTurn + 1) % players.length
    await supabase.from('games').update({
      data: { pieces: newPieces || pieces, currentTurn: nextTurnIdx, dice: null, rolled: false, movablePieces: [], winner: null }
    }).eq('id', game.id)
  }

  // Board rendering
  function renderBoard() {
    const CELL = 44
    const SIZE = CELL * 15
    const allPieces = pieces.flat()

    function getPiecesAt(pos: number) {
      return allPieces.filter(p => p.pos === pos && !p.home)
    }

    function cellColor(row: number, col: number): string {
      // Red zone (bottom left)
      if (row >= 9 && col <= 5) return PLAYER_COLORS[0] + '33'
      // Blue zone (top left)
      if (row <= 5 && col <= 5) return PLAYER_COLORS[1] + '33'
      // Green zone (top right)
      if (row <= 5 && col >= 9) return PLAYER_COLORS[2] + '33'
      // Yellow zone (bottom right)
      if (row >= 9 && col >= 9) return PLAYER_COLORS[3] + '33'
      // Home columns
      if (col === 7 && row >= 9) return PLAYER_COLORS[0] + '66'
      if (row === 7 && col <= 5) return PLAYER_COLORS[1] + '66'
      if (col === 7 && row <= 5) return PLAYER_COLORS[2] + '66'
      if (row === 7 && col >= 9) return PLAYER_COLORS[3] + '66'
      return 'var(--bg3)'
    }

    return (
      <svg width={SIZE} height={SIZE} style={{ border: '2px solid var(--border)', borderRadius: 12, background: 'var(--bg2)', maxWidth: '100%' }}>
        {/* Grid cells */}
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 15 }, (_, col) => {
            // Skip corner home areas (they're 6x6)
            const inCorner = (row < 6 && col < 6) || (row < 6 && col > 8) || (row > 8 && col < 6) || (row > 8 && col > 8)
            if (inCorner) return null
            const piecesHere = [] // simplified
            return (
              <rect key={`${row}-${col}`} x={col*CELL} y={row*CELL} width={CELL} height={CELL}
                fill={cellColor(row, col)} stroke="var(--border)" strokeWidth="0.5" />
            )
          })
        )}

        {/* Corner home areas */}
        {[
          { row: 0, col: 0, color: PLAYER_COLORS[0], label: 'R' },
          { row: 0, col: 9, color: PLAYER_COLORS[1], label: 'B' },
          { row: 9, col: 0, color: PLAYER_COLORS[2], label: 'G' },
          { row: 9, col: 9, color: PLAYER_COLORS[3], label: 'Y' },
        ].map(({ row, col, color, label }) => (
          <g key={label}>
            <rect x={col*CELL} y={row*CELL} width={CELL*6} height={CELL*6} fill={color + '33'} stroke={color} strokeWidth="2" rx="4" />
            <rect x={col*CELL+CELL} y={row*CELL+CELL} width={CELL*4} height={CELL*4} fill={color + '55'} rx="4" />
            <text x={col*CELL+CELL*3} y={row*CELL+CELL*3+6} textAnchor="middle" fill={color} fontSize="20" fontWeight="bold">{label}</text>
          </g>
        ))}

        {/* Center */}
        <polygon points={`${7*CELL},${7*CELL} ${8*CELL},${7*CELL} ${7.5*CELL},${7.5*CELL}`} fill={PLAYER_COLORS[0]} />
        <polygon points={`${7*CELL},${8*CELL} ${8*CELL},${8*CELL} ${7.5*CELL},${7.5*CELL}`} fill={PLAYER_COLORS[2]} />
        <polygon points={`${7*CELL},${7*CELL} ${7*CELL},${8*CELL} ${7.5*CELL},${7.5*CELL}`} fill={PLAYER_COLORS[1]} />
        <polygon points={`${8*CELL},${7*CELL} ${8*CELL},${8*CELL} ${7.5*CELL},${7.5*CELL}`} fill={PLAYER_COLORS[3]} />

        {/* Pieces in home bases */}
        {pieces.map((playerPieces, pi) =>
          playerPieces.filter(p => p.pos === -1).map((p, i) => {
            const corners = [[1,1],[1,3],[3,1],[3,3]]
            const baseRows = [9, 0, 9, 0] // which corner
            const baseCols = [0, 0, 9, 9]
            const [dr, dc] = corners[i]
            const bRow = baseRows[pi]
            const bCol = baseCols[pi]
            return (
              <circle key={p.id} cx={(bCol+dc)*CELL+CELL/2} cy={(bRow+dr)*CELL+CELL/2} r={CELL/3}
                fill={PLAYER_COLORS[pi]} stroke="#fff" strokeWidth="2"
                style={{ cursor: movablePieces.includes(p.id) && myTurn ? 'pointer' : 'default', filter: movablePieces.includes(p.id) && myTurn ? 'drop-shadow(0 0 6px #fff)' : 'none' }}
                onClick={() => movePiece(p.id)} />
            )
          })
        )}
      </svg>
    )
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13 }}>Loading Ludo...</div>

  if (phase === 'lobby') return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎲</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Ludo</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>2–4 players · Waiting for players to join...</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {players.map((p: any, i) => (
            <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: PLAYER_COLORS[i] + '22', border: `1px solid ${PLAYER_COLORS[i]}`, borderRadius: 20, fontSize: 13, color: PLAYER_COLORS[i] }}>
              ● {p.profiles?.name || 'Player'} ({PLAYER_LABELS[i]})
            </div>
          ))}
        </div>
        {currentUser?.id === game.created_by ? (
          <button onClick={startGame} disabled={players.length < 2}
            style={{ padding: '11px 28px', background: players.length >= 2 ? 'var(--indigo)' : 'var(--bg3)', border: 'none', borderRadius: 10, color: players.length >= 2 ? '#fff' : 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: players.length >= 2 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {players.length < 2 ? 'Need at least 2 players' : 'Start Ludo →'}
          </button>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Waiting for host to start...</div>
        )}
      </div>
    </div>
  )

  if (phase === 'finished') return (
    <div style={{ maxWidth: 400, textAlign: 'center' }}>
      <div style={{ background: 'var(--bg2)', border: `2px solid ${PLAYER_COLORS[winner || 0]}`, borderRadius: 16, padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          {players[winner || 0]?.profiles?.name || PLAYER_LABELS[winner || 0]} wins!
        </div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
          Playing as {PLAYER_LABELS[winner || 0]}
        </div>
        <button onClick={onEnd}
          style={{ padding: '11px 28px', background: 'var(--indigo)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Back to games
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20 }}>
        {/* Board */}
        <div>
          {renderBoard()}
        </div>

        {/* Controls */}
        <div style={{ width: 180 }}>
          {/* Players */}
          <div style={{ marginBottom: 16 }}>
            {players.map((p: any, i) => (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: i === currentTurn ? PLAYER_COLORS[i] + '22' : 'transparent', border: i === currentTurn ? `1px solid ${PLAYER_COLORS[i]}` : '1px solid transparent', marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: PLAYER_COLORS[i], flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: i === currentTurn ? 700 : 400, color: i === currentTurn ? PLAYER_COLORS[i] : 'var(--text2)' }}>
                  {p.profiles?.name || PLAYER_LABELS[i]}
                </span>
                {i === currentTurn && <span style={{ fontSize: 10, marginLeft: 'auto', color: PLAYER_COLORS[i] }}>▶</span>}
              </div>
            ))}
          </div>

          {/* Dice */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {dice ? ['⚀','⚁','⚂','⚃','⚄','⚅'][dice-1] : '🎲'}
            </div>
            {myTurn && !rolled && (
              <button onClick={rollDice}
                style={{ width: '100%', padding: '9px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Roll dice
              </button>
            )}
            {!myTurn && (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {players[currentTurn]?.profiles?.name || PLAYER_LABELS[currentTurn]}'s turn
              </div>
            )}
            {myTurn && rolled && movablePieces.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--sage)' }}>Pick a piece to move</div>
            )}
          </div>

          {dice === 6 && <div style={{ fontSize: 12, color: 'var(--amber)', textAlign: 'center' }}>🎉 Six! Roll again after moving.</div>}
        </div>
      </div>
    </div>
  )
}