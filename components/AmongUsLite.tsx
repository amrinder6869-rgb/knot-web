'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const FLAVOR_TASKS = [
  'Reply to the last message in the feed',
  'React to someone\'s post with a thumbs up',
  'Ask someone what they had for lunch',
  'Post a photo of something nearby',
  'Compliment another player out loud',
  'Name three things on the table in front of you',
  'Whisper the word "banana" to your neighbor',
  'Check the Bills tab and report the balance',
]

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export default function AmongUsLite({ game, members, currentUser, knotId, onEnd, onRefreshGame }: {
  game: any, members: any[], currentUser: any, knotId: string, onEnd: () => void, onRefreshGame: () => void
}) {
  const [players, setPlayers]     = useState<any[]>([])
  const [myRole, setMyRole]       = useState<string | null>(null)
  const [tasks, setTasks]         = useState<any[]>([])
  const [myCompletions, setMyCompletions] = useState<Set<string>>(new Set())
  const [round, setRound]         = useState<any | null>(null)
  const [votes, setVotes]         = useState<any[]>([])
  const [myVote, setMyVote]       = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [starting, setStarting]   = useState(false)
  const [calling, setCalling]     = useState(false)
  const [tallying, setTallying]   = useState(false)

  const isCreator = game.created_by === currentUser?.id

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`game:${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds', filter: `game_id=eq.${game.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_votes', filter: `game_id=eq.${game.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_task_completions', filter: `game_id=eq.${game.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [game.id])

  async function load() {
    const [
      { data: playerData },
      { data: roleData },
      { data: taskData },
      { data: completionData },
      { data: roundData },
    ] = await Promise.all([
      supabase.from('game_players').select('*, profiles:user_id(name)').eq('game_id', game.id),
      supabase.from('game_roles').select('*').eq('game_id', game.id),
      supabase.from('game_tasks').select('*').eq('game_id', game.id),
      supabase.from('game_task_completions').select('*').eq('game_id', game.id),
      supabase.from('game_rounds').select('*').eq('game_id', game.id).order('round_number', { ascending: false }).limit(1),
    ])

    setPlayers(playerData || [])
    setMyRole((roleData || [])[0]?.role || null)
    setTasks(taskData || [])
    setMyCompletions(new Set((completionData || []).filter((c: any) => c.user_id === currentUser?.id).map((c: any) => c.task_id)))

    const currentRound = (roundData || [])[0] || null
    setRound(currentRound)

    if (currentRound) {
      const { data: voteData } = await supabase.from('game_votes').select('*').eq('game_id', game.id).eq('round_number', currentRound.round_number)
      setVotes(voteData || [])
      setMyVote((voteData || []).find((v: any) => v.voter_id === currentUser?.id)?.voted_for_id || null)
    } else {
      setVotes([])
      setMyVote(null)
    }

    setLoading(false)
  }

  async function joinLobby() {
    if (!currentUser) return
    const already = players.some(p => p.user_id === currentUser.id)
    if (already) return
    const colors = ['#B85C38', '#6B705C', '#4A7C5F', '#C07A10', '#8B7355', '#7A6B5A']
    const { error: joinError } = await supabase.from('game_players').insert({ game_id: game.id, user_id: currentUser.id, color: colors[players.length % colors.length], alive: true })
    if (joinError) { setError('Could not join the lobby.'); return }
    load()
  }

  async function startGame() {
    if (players.length < 4) { setError('Need at least 4 players to start.'); return }
    setStarting(true)
    setError('')

    const impostorCount = players.length >= 7 ? 2 : 1
    const shuffled = [...players].sort(() => Math.random() - 0.5)
    const impostorIds = new Set(shuffled.slice(0, impostorCount).map(p => p.user_id))

    const roleRows = players.map(p => ({ game_id: game.id, user_id: p.user_id, role: impostorIds.has(p.user_id) ? 'impostor' : 'crewmate' }))
    const { error: rolesError } = await supabase.from('game_roles').insert(roleRows)
    if (rolesError) { setError('Could not assign roles. Please try again.'); setStarting(false); return }

    const taskPrompts = [...FLAVOR_TASKS].sort(() => Math.random() - 0.5).slice(0, 5)
    const { error: tasksError } = await supabase.from('game_tasks').insert(taskPrompts.map(prompt => ({ game_id: game.id, prompt })))
    if (tasksError) setError('Roles assigned, but tasks failed to load.')

    const { error: statusError } = await supabase.from('games').update({ status: 'active' }).eq('id', game.id)
    if (statusError) setError('Could not start the game.')

    await supabase.from('posts').insert({
      knot_id: knotId,
      author_id: currentUser.id,
      content: `started a game of Imposter with ${players.length} players`,
      post_type: 'moment',
    })

    setStarting(false)
    onRefreshGame()
    load()
  }

  async function toggleTask(taskId: string) {
    if (!currentUser) return
    if (myCompletions.has(taskId)) return
    const { error: err } = await supabase.from('game_task_completions').insert({ game_id: game.id, task_id: taskId, user_id: currentUser.id })
    if (err) { setError('Could not mark task complete.'); return }
    load()
  }

  async function callMeeting() {
    if (!currentUser) return
    setCalling(true)
    setError('')
    const nextRoundNumber = (round?.round_number || 0) + 1
    const { error: err } = await supabase.from('game_rounds').insert({ game_id: game.id, round_number: nextRoundNumber, status: 'voting', called_by: currentUser.id })
    if (err) { setError('Could not call a meeting.'); setCalling(false); return }
    await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser.id, content: 'called an emergency meeting', post_type: 'moment' })
    setCalling(false)
    load()
  }

  async function castVote(targetId: string | null) {
    if (!currentUser || !round || myVote) return
    const { error: err } = await supabase.from('game_votes').insert({ game_id: game.id, round_number: round.round_number, voter_id: currentUser.id, voted_for_id: targetId })
    if (err) { setError('Could not cast vote.'); return }
    load()
  }

  async function tallyVotes() {
    if (!round) return
    setTallying(true)
    setError('')

    const counts = new Map<string, number>()
    for (const v of votes) {
      const key = v.voted_for_id || 'skip'
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    let ejectedId: string | null = null
    let maxVotes = 0
    let tie = false
    for (const [key, count] of counts.entries()) {
      if (count > maxVotes) { maxVotes = count; ejectedId = key === 'skip' ? null : key; tie = false }
      else if (count === maxVotes) { tie = true }
    }
    if (tie) ejectedId = null

    const { error: roundError } = await supabase.from('game_rounds').update({ status: 'results', ejected_user_id: ejectedId }).eq('id', round.id)
    if (roundError) { setError('Could not finalize the vote.'); setTallying(false); return }

    if (ejectedId) {
      const { error: playerError } = await supabase.from('game_players').update({ alive: false }).eq('game_id', game.id).eq('user_id', ejectedId)
      if (playerError) setError('Vote tallied, but ejection failed to save.')
    }

    const updatedPlayers = players.map(p => p.user_id === ejectedId ? { ...p, alive: false } : p)
    const aliveImpostors = updatedPlayers.filter(p => p.alive).length // placeholder, recompute properly below

    // Recompute win condition using roles
    const { data: rolesData } = await supabase.from('game_roles').select('*').eq('game_id', game.id)
    const roleMap = new Map((rolesData || []).map((r: any) => [r.user_id, r.role]))
    const aliveList = updatedPlayers.filter(p => p.alive)
    const aliveImpostorCount = aliveList.filter(p => roleMap.get(p.user_id) === 'impostor').length
    const aliveCrewCount = aliveList.filter(p => roleMap.get(p.user_id) === 'crewmate').length

    if (aliveImpostorCount === 0) {
      await supabase.from('games').update({ status: 'finished', data: { winner: 'crewmates' } }).eq('id', game.id)
      await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser?.id, content: 'the crewmates won the game of Imposter!', post_type: 'moment' })
    } else if (aliveImpostorCount >= aliveCrewCount) {
      await supabase.from('games').update({ status: 'finished', data: { winner: 'impostors' } }).eq('id', game.id)
      await supabase.from('posts').insert({ knot_id: knotId, author_id: currentUser?.id, content: 'the impostors won the game of Imposter!', post_type: 'moment' })
    }

    setTallying(false)
    onRefreshGame()
    load()
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading...</div>

  const iAmIn = players.some(p => p.user_id === currentUser?.id)
  const alivePlayers = players.filter(p => p.alive)
  const votedCount = votes.length
  const canTally = round?.status === 'voting' && votedCount >= alivePlayers.length

  // FINISHED
  if (game.status === 'finished') {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ background: 'var(--bg2)', border: '2px solid var(--yellow)', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            {game.data?.winner === 'impostors' ? 'Impostors win' : 'Crewmates win'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Game over. Roles revealed below.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.map(p => (
            <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.color || 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getInitials(p.profiles?.name || 'U')}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: p.alive ? 'var(--text)' : 'var(--text3)', textDecoration: p.alive ? 'none' : 'line-through' }}>{p.profiles?.name || 'Someone'}</span>
            </div>
          ))}
        </div>
        <button onClick={onEnd} style={{ marginTop: 20, padding: '10px 20px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Back to games
        </button>
      </div>
    )
  }

  // LOBBY
  if (game.status === 'waiting') {
    return (
      <div style={{ maxWidth: 600 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Imposter — Lobby</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Waiting for players. Need at least 4 to start.</div>

        {error && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {players.map(p => (
            <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.color || 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {getInitials(p.profiles?.name || 'U')}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{p.profiles?.name || 'Someone'}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {!iAmIn && (
            <button onClick={joinLobby} style={{ padding: '10px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Join lobby
            </button>
          )}
          {isCreator && (
            <button onClick={startGame} disabled={starting || players.length < 4}
              style={{ flex: 1, padding: '10px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: players.length < 4 ? 0.5 : 1 }}>
              {starting ? 'Starting...' : `Start game (${players.length} joined)`}
            </button>
          )}
        </div>
        <button onClick={onEnd} style={{ marginTop: 12, padding: '8px 14px', background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Back to games
        </button>
      </div>
    )
  }

  // ACTIVE
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Imposter</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{alivePlayers.length} alive of {players.length}</div>
        </div>
        {myRole && (
          <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: myRole === 'impostor' ? 'var(--danger-soft, #fee)' : 'var(--sage-soft)', color: myRole === 'impostor' ? 'var(--danger, #c0392b)' : 'var(--sage)' }}>
            You are {myRole === 'impostor' ? 'the Impostor' : 'a Crewmate'}
          </span>
        )}
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* No active round: tasks + call meeting */}
      {(!round || round.status === 'results') && (
        <>
          {round?.status === 'results' && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Last meeting result</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {round.ejected_user_id
                  ? `${players.find(p => p.user_id === round.ejected_user_id)?.profiles?.name || 'Someone'} was ejected.`
                  : 'No one was ejected (tie or skip).'}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Tasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {tasks.map(t => (
              <button key={t.id} onClick={() => toggleTask(t.id)} disabled={myCompletions.has(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: `1px solid ${myCompletions.has(t.id) ? 'var(--sage-dim)' : 'var(--border)'}`, borderRadius: 10, textAlign: 'left', cursor: myCompletions.has(t.id) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${myCompletions.has(t.id) ? 'var(--sage)' : 'var(--border2)'}`, background: myCompletions.has(t.id) ? 'var(--sage)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#111' }}>
                  {myCompletions.has(t.id) ? <i className="ti ti-check" style={{ fontSize: 12, color: '#111' }} /> : ''}
                </span>
                <span style={{ fontSize: 13, color: myCompletions.has(t.id) ? 'var(--text3)' : 'var(--text)', textDecoration: myCompletions.has(t.id) ? 'line-through' : 'none' }}>{t.prompt}</span>
              </button>
            ))}
          </div>

          <button onClick={callMeeting} disabled={calling}
            style={{ width: '100%', padding: '12px', background: 'var(--yellow)', border: 'none', borderRadius: 10, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: calling ? 0.6 : 1 }}>
            {calling ? 'Calling...' : 'Call emergency meeting'}
          </button>
        </>
      )}

      {/* Voting round */}
      {round && round.status === 'voting' && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Vote to eject · {votedCount}/{alivePlayers.length} voted
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {alivePlayers.map(p => {
              const voteCount = votes.filter(v => v.voted_for_id === p.user_id).length
              const isMyVote = myVote === p.user_id
              return (
                <button key={p.user_id} onClick={() => castVote(p.user_id)} disabled={!!myVote || p.user_id === currentUser?.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isMyVote ? 'var(--yellow-soft)' : 'var(--bg2)', border: `1px solid ${isMyVote ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 10, textAlign: 'left', cursor: myVote ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: p.color || 'var(--yellow)', color: '#111', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getInitials(p.profiles?.name || 'U')}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{p.profiles?.name || 'Someone'}{p.user_id === currentUser?.id ? ' (you)' : ''}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{voteCount} vote{voteCount !== 1 ? 's' : ''}</span>
                </button>
              )
            })}
            <button onClick={() => castVote(null)} disabled={!!myVote}
              style={{ padding: '10px 14px', background: myVote === null && votes.some(v => v.voter_id === currentUser?.id) ? 'var(--yellow-soft)' : 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text2)', fontSize: 13, cursor: myVote ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              Skip vote
            </button>
          </div>

          {canTally && (
            <button onClick={tallyVotes} disabled={tallying}
              style={{ width: '100%', padding: '12px', background: 'var(--yellow)', border: 'none', borderRadius: 10, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: tallying ? 0.6 : 1 }}>
              {tallying ? 'Tallying...' : 'Reveal results'}
            </button>
          )}
        </div>
      )}

      <button onClick={onEnd} style={{ marginTop: 16, padding: '8px 14px', background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
        Back to games
      </button>
    </div>
  )
}
