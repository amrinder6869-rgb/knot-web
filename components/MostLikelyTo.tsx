'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/Skeleton'

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

export default function MostLikelyTo({ game, members, currentUser, knotId, onEnd }: any) {
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

  if (loading) return (
    <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={200} borderRadius={16} />
    </div>
  )

  // LOBBY
  if (phase === 'lobby') return (
    <div style={{ maxWidth: 500 }}>
      <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--olive-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9" stroke="var(--olive)" strokeWidth="2"/><path d="M7 11l3 3 5-5" stroke="var(--olive)" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>Most Likely To</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>Waiting for players to join...</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {players.map((p: any) => (
            <span key={p.user_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--sage-soft)', borderRadius: 20, fontSize: 12, color: 'var(--sage)', fontWeight: 600 }}>
              {p.profiles?.name || 'Player'}
            </span>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          {players.length} player{players.length !== 1 ? 's' : ''} joined
        </div>

        {currentUser?.id === game.created_by ? (
          <button className="btn btn-primary" onClick={startGame} disabled={players.length < 2} style={{ fontSize: 14, padding: '11px 28px' }}>
            {players.length < 2 ? 'Need at least 2 players' : 'Start game'}
          </button>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Waiting for the host to start...</div>
        )}
      </div>
    </div>
  )

  // RESULTS
  if (phase === 'results') return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: 'center', letterSpacing: '-0.3px' }}>Results</div>
      {questions.map((q, i) => {
        const tally = getTallies(i)
        const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1])
        const winner = sorted[0]
        return (
          <div key={i} className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Q{i+1}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{q}</div>
            {winner ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rust)', marginBottom: 10 }}>
                  {getMemberName(winner[0])} — {winner[1]} vote{winner[1] !== 1 ? 's' : ''}
                </div>
                {sorted.map(([id, count]) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, flex: 1, color: 'var(--text2)' }}>{getMemberName(id)}</span>
                    <div style={{ width: 120, height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--rust)', width: `${Math.round(count / players.length * 100)}%`, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text3)', width: 32, textAlign: 'right' }}>{count}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>No votes</div>
            )}
          </div>
        )
      })}
      <button className="btn btn-primary" onClick={onEnd} style={{ width: '100%', fontSize: 14, padding: '11px', marginTop: 8 }}>
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
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= currentQ ? 'var(--rust)' : 'var(--bg4)', transition: 'background 0.3s', opacity: i === currentQ ? 1 : i < currentQ ? 0.6 : 1 }} />
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginBottom: 8 }}>Question {currentQ + 1} of {questions.length}</div>

      <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, lineHeight: 1.5, letterSpacing: '-0.3px' }}>{q}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map((m: any) => {
            const isVoted   = myVoteThisQ === m.id
            const voteCount = tallies[m.id] || 0
            return (
              <button key={m.id} onClick={() => !myVoteThisQ && castVote(m.id)} disabled={!!myVoteThisQ}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: `1px solid ${isVoted ? 'var(--rust)' : 'var(--border2)'}`, borderRadius: 10, background: isVoted ? 'var(--rust-soft)' : 'var(--bg3)', cursor: myVoteThisQ ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color || 'var(--olive-soft)', color: m.text || 'var(--olive)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.initials}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                {isVoted && <span style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 600 }}>Your pick</span>}
                {revealed && voteCount > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{voteCount}</span>
                )}
              </button>
            )
          })}
        </div>

        {!myVoteThisQ && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12, textAlign: 'center' }}>Select someone to vote</div>}
        {myVoteThisQ && !revealed && (
          <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 12, textAlign: 'center', fontWeight: 500 }}>
            Voted — {votes.filter((v: any) => v.move_data.question_index === currentQ).length}/{players.length} votes in
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8 }}>
        {myVoteThisQ && !revealed && allVotedCurrent && (
          <button className="btn btn-primary" onClick={() => setRevealed(true)} style={{ flex: 1, fontSize: 13, padding: '10px', background: 'var(--sage)' }}>
            Reveal results
          </button>
        )}
        {revealed && currentQ < questions.length - 1 && (
          <button className="btn btn-primary" onClick={() => { setCurrentQ(q => q + 1); setRevealed(false) }} style={{ flex: 1, fontSize: 13, padding: '10px' }}>
            Next question
          </button>
        )}
        {revealed && currentQ === questions.length - 1 && (
          <button className="btn btn-primary" onClick={endGame} style={{ flex: 1, fontSize: 13, padding: '10px', background: 'var(--sage)' }}>
            See final results
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