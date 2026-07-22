'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const QUESTIONS = [
  "Most likely to show up late tonight?",
  "Most likely to forget their wallet?",
  "Most likely to start dancing first?",
  "Most likely to order the most expensive thing?",
  "Most likely to fall asleep first?",
  "Most likely to get lost?",
  "Most likely to go back for seconds?",
  "Most likely to suggest karaoke?",
  "Most likely to befriend a stranger?",
  "Most likely to cancel last minute?",
  "Most likely to overshare?",
  "Most likely to win a dance-off?",
  "Most likely to eat everyone else's food?",
  "Most likely to be the last one standing?",
  "Most likely to forget the plan?",
]

export default function MostLikelyTo({ game, members, currentUser, knotId: _knotId, onEnd }: any) {
  const [questions, setQuestions]   = useState<string[]>([])
  const [currentQ, setCurrentQ]     = useState(0)
  const [votes, setVotes]           = useState<any[]>([])
  const [myVotes, setMyVotes]       = useState<Record<number, string>>({})
  const [revealed, setRevealed]     = useState(false)
  const [players, setPlayers]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [phase, setPhase]           = useState<'lobby'|'playing'|'results'>('lobby')

  useEffect(() => {
    loadGame()
    const channel = supabase.channel(`game:${game.id}`)
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
      supabase.from('game_moves').select('*').eq('game_id', game.id),
    ])

    if (pData) setPlayers(pData)
    if (mData) setVotes(mData)

    if (gData?.data?.questions) {
      setQuestions(gData.data.questions)
      setPhase(gData.status === 'finished' ? 'results' : gData.status === 'active' ? 'playing' : 'lobby')
    }

    // Load my votes
    if (mData && currentUser) {
      const mine: Record<number, string> = {}
      mData.filter((m: any) => m.user_id === currentUser.id).forEach((m: any) => {
        mine[m.move_data.question_index] = m.move_data.voted_for
      })
      setMyVotes(mine)
    }
    setLoading(false)
  }

  async function startGame() {
    const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 8)
    await supabase.from('games').update({
      status: 'active',
      data: { questions: shuffled }
    }).eq('id', game.id)
    setQuestions(shuffled)
    setPhase('playing')
  }

  async function castVote(memberId: string) {
    if (myVotes[currentQ] || submitting) return
    setSubmitting(true)

    await supabase.from('game_moves').insert({
      game_id: game.id,
      user_id: currentUser.id,
      move_data: { question_index: currentQ, voted_for: memberId, question: questions[currentQ] }
    })

    setMyVotes(prev => ({ ...prev, [currentQ]: memberId }))
    setSubmitting(false)
  }

  async function endGame() {
    await supabase.from('games').update({ status: 'finished' }).eq('id', game.id)
    setPhase('results')
  }

  // Get vote tallies for current question
  function getTallies(qIndex: number) {
    const qVotes = votes.filter((v: any) => v.move_data.question_index === qIndex)
    const tally: Record<string, number> = {}
    qVotes.forEach((v: any) => {
      tally[v.move_data.voted_for] = (tally[v.move_data.voted_for] || 0) + 1
    })
    return tally
  }

  function getMemberName(id: string) {
    const m = members.find((m: any) => m.id === id)
    return m?.name || 'Unknown'
  }

  const allVotedCurrent = players.length > 0 && players.every((p: any) =>
    votes.some((v: any) => v.user_id === p.user_id && v.move_data.question_index === currentQ)
  )

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13 }}>Loading game...</div>

  // LOBBY
  if (phase === 'lobby') return (
    <div style={{ maxWidth: 500 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🤔</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Most Likely To</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Waiting for players to join...</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {players.map((p: any) => (
            <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--sage-soft)', borderRadius: 20, fontSize: 13, color: 'var(--sage)' }}>
              ✓ {p.profiles?.name || 'Player'}
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          {players.length} player{players.length !== 1 ? 's' : ''} joined · Share this Knot to invite more
        </div>

        {currentUser?.id === game.created_by && (
          <button onClick={startGame} disabled={players.length < 2}
            style={{ padding: '11px 28px', background: players.length >= 2 ? 'var(--indigo)' : 'var(--bg3)', border: 'none', borderRadius: 10, color: players.length >= 2 ? '#fff' : 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: players.length >= 2 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            {players.length < 2 ? 'Need at least 2 players' : 'Start game →'}
          </button>
        )}
        {currentUser?.id !== game.created_by && (
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Waiting for the host to start...</div>
        )}
      </div>
    </div>
  )

  // RESULTS
  if (phase === 'results') return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>🏆 Game Results</div>
      {questions.map((q, i) => {
        const tally = getTallies(i)
        const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
        const winner = sorted[0]
        return (
          <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text2)' }}>Q{i+1}: {q}</div>
            {winner ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--indigo)', marginBottom: 8 }}>
                  🏆 {getMemberName(winner[0])} ({winner[1]} vote{winner[1] !== 1 ? 's' : ''})
                </div>
                {sorted.map(([id, count]) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, flex: 1 }}>{getMemberName(id)}</span>
                    <div style={{ width: 120, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--indigo)', width: `${Math.round(count / players.length * 100)}%`, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text3)', width: 40, textAlign: 'right' }}>{count}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>No votes</div>
            )}
          </div>
        )
      })}
      <button onClick={onEnd}
        style={{ width: '100%', padding: '11px', background: 'var(--indigo)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
        Back to games
      </button>
    </div>
  )

  // PLAYING
  const q = questions[currentQ]
  const myVoteThisQ = myVotes[currentQ]
  const tallies = revealed ? getTallies(currentQ) : {}

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {questions.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < currentQ ? 'var(--indigo)' : i === currentQ ? 'var(--indigo)' : 'var(--bg3)', opacity: i === currentQ ? 1 : i < currentQ ? 0.6 : 0.3 }} />
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Question {currentQ + 1} of {questions.length}</div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, lineHeight: 1.4 }}>🤔 {q}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m: any) => {
            const isVoted  = myVoteThisQ === m.id
            const voteCount = tallies[m.id] || 0
            return (
              <button key={m.id} onClick={() => !myVoteThisQ && castVote(m.id)} disabled={!!myVoteThisQ}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1px solid ${isVoted ? 'var(--indigo)' : 'var(--border2)'}`, borderRadius: 10, background: isVoted ? 'var(--indigo-dim)' : 'var(--bg3)', cursor: myVoteThisQ ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, color: m.text, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.initials}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.name}</span>
                {isVoted && <span style={{ fontSize: 12, color: 'var(--indigo)' }}>✓ Your pick</span>}
                {revealed && voteCount > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                )}
              </button>
            )
          })}
        </div>

        {!myVoteThisQ && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, textAlign: 'center' }}>Tap someone to vote</div>
        )}
        {myVoteThisQ && !revealed && (
          <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 12, textAlign: 'center' }}>
            ✓ Voted! Waiting for others... ({votes.filter((v: any) => v.move_data.question_index === currentQ).length}/{players.length})
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8 }}>
        {myVoteThisQ && !revealed && allVotedCurrent && (
          <button onClick={() => setRevealed(true)}
            style={{ flex: 1, padding: '10px', background: 'var(--sage)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Reveal results 👀
          </button>
        )}
        {revealed && currentQ < questions.length - 1 && (
          <button onClick={() => { setCurrentQ(q => q + 1); setRevealed(false) }}
            style={{ flex: 1, padding: '10px', background: 'var(--indigo)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Next question →
          </button>
        )}
        {revealed && currentQ === questions.length - 1 && (
          <button onClick={endGame}
            style={{ flex: 1, padding: '10px', background: 'var(--sage)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            See final results 🏆
          </button>
        )}
        {myVoteThisQ && !revealed && !allVotedCurrent && (
          <div style={{ flex: 1, padding: '10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
            Waiting for all votes...
          </div>
        )}
      </div>
    </div>
  )
}
