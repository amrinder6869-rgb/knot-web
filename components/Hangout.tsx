'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/Skeleton'

const ACTIVITY_OPTIONS = [
  { label: 'Drinks & bar' },
  { label: 'Karaoke' },
  { label: 'Dinner out' },
  { label: 'Bowling' },
  { label: 'Movie' },
  { label: 'Arcade' },
  { label: 'Cafe' },
  { label: 'Outdoors' },
]

const BUDGETS = [
  { id: 1, label: 'Casual',  symbol: '$' },
  { id: 2, label: 'Mid',     symbol: '$$' },
  { id: 3, label: 'Nice',    symbol: '$$$' },
  { id: 4, label: 'Splurge', symbol: '$$$$' },
]

export default function Hangout({ members, knotId }: { members: any[], knotId?: string }) {
  const [hangout, setHangout]       = useState<any>(null)
  const [options, setOptions]       = useState<any[]>([])
  const [myVote, setMyVote]         = useState<string|null>(null)
  const [budget, setBudget]         = useState(2)
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [voting, setVoting]         = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]     = useState<string[]>([])

  useEffect(() => {
    if (knotId) {
      setHangout(null); setOptions([]); setMyVote(null); setLoading(true)
      loadHangout()
    }
  }, [knotId])

  async function loadHangout() {
    if (!knotId) return
    const { data } = await supabase
      .from('hangouts').select('*')
      .eq('knot_id', knotId).eq('status', 'voting')
      .order('created_at', { ascending: false }).limit(1).single()
    if (data) { setHangout(data); await loadOptions(data.id) }
    setLoading(false)
  }

  async function loadOptions(hangoutId: string) {
    const [{ data: opts }, { data: allVotes }] = await Promise.all([
      supabase.from('hangout_options').select('*').eq('hangout_id', hangoutId),
      supabase.from('hangout_votes').select('option_id').eq('hangout_id', hangoutId),
    ])
    if (opts && allVotes) {
      const counted = opts.map(o => ({
        ...o,
        vote_count: allVotes.filter((v: any) => v.option_id === o.id).length,
      })).sort((a, b) => b.vote_count - a.vote_count)
      setOptions(counted)
    }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u) {
      const { data: vote } = await supabase.from('hangout_votes')
        .select('option_id').eq('hangout_id', hangoutId).eq('user_id', u.id).single()
      if (vote) setMyVote(vote.option_id)
    }
  }

  async function createPoll() {
    if (!knotId || selected.length === 0) return
    setCreating(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setCreating(false); return }
    const { data: h } = await supabase.from('hangouts')
      .insert({ knot_id: knotId, created_by: u.id, status: 'voting', budget_sweet_spot: String(budget) })
      .select().single()
    if (h) {
      await supabase.from('hangout_options').insert(selected.map(label => ({ hangout_id: h.id, label, emoji: '', vote_count: 0 })))
      await supabase.from('posts').insert({ knot_id: knotId, author_id: u.id, content: `started a hangout poll — vote on what to do tonight`, post_type: 'moment' })
      setHangout(h); await loadOptions(h.id); setShowCreate(false); setSelected([])
    }
    setCreating(false)
  }

  async function castVote(optionId: string) {
    if (!hangout || myVote || voting) return
    setVoting(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { setVoting(false); return }
    const { error } = await supabase.from('hangout_votes').insert({ hangout_id: hangout.id, option_id: optionId, user_id: u.id })
    if (!error) { setMyVote(optionId); await loadOptions(hangout.id) }
    setVoting(false)
  }

  async function lockPlan() {
    if (!hangout) return
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u || u.id !== hangout.created_by) return
    const winner = options[0]
    await supabase.from('hangouts').update({ status: 'locked', title: winner.label }).eq('id', hangout.id).eq('created_by', u.id)
    await supabase.from('posts').insert({ knot_id: knotId, author_id: u.id, content: `locked in tonight's plan — ${winner.label}`, post_type: 'moment' })
    setHangout({ ...hangout, status: 'locked', title: winner.label })
  }

  if (loading) return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={14} width="60%" />
          {[0,1,2,3].map(i => <Skeleton key={i} height={44} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton height={14} width="50%" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[0,1,2,3].map(i => <Skeleton key={i} height={56} />)}
          </div>
        </div>
      </div>
    </div>
  )

  const maxVotes = Math.max(...options.map(o => o.vote_count), 1)

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Left — Poll */}
        <div>
          {hangout && hangout.status === 'locked' ? (
            <div className="card-hover" style={{ background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sage)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Tonight is locked in</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.3px' }}>{hangout.title}</div>
              <button className="btn btn-secondary" onClick={() => { setHangout(null); setOptions([]); setMyVote(null) }} style={{ fontSize: 12, padding: '6px 14px' }}>
                Start new poll
              </button>
            </div>
          ) : hangout ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>Tonight&apos;s vote</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
                {options.reduce((a, o) => a + o.vote_count, 0)} vote{options.reduce((a, o) => a + o.vote_count, 0) !== 1 ? 's' : ''} so far
              </div>

              {options.map(o => {
                const isWinner = o.id === options[0]?.id && o.vote_count > 0
                const isMyVote = myVote === o.id
                return (
                  <button key={o.id}
                    onClick={() => castVote(o.id)}
                    disabled={!!myVote || voting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                      border: `1px solid ${isWinner ? 'var(--sage)' : isMyVote ? 'var(--rust)' : 'var(--border2)'}`,
                      borderRadius: 8, marginBottom: 8,
                      cursor: myVote || voting ? 'default' : 'pointer',
                      background: isWinner ? 'var(--sage-dim)' : isMyVote ? 'var(--rust-dim)' : 'transparent',
                      transition: 'all 0.15s', width: '100%', fontFamily: 'inherit', textAlign: 'left',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{o.label}</span>
                    <div style={{ width: 80, height: 4, background: 'var(--bg4)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: isWinner ? 'var(--sage)' : 'var(--rust)', width: `${Math.round(o.vote_count / maxVotes * 100)}%`, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text3)', width: 48, textAlign: 'right' }}>
                      {o.vote_count} vote{o.vote_count !== 1 ? 's' : ''}
                    </span>
                    {isWinner && o.vote_count > 0 && <span style={{ fontSize: 10, color: 'var(--sage)', fontWeight: 700, letterSpacing: '0.06em' }}>TOP</span>}
                  </button>
                )
              })}

              {myVote && options.length > 0 && options[0].vote_count > 0 && (
                <div className="card-hover" style={{ background: 'var(--bg2)', border: '1px solid var(--sage-dim)', borderRadius: 10, padding: 14, marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sage)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Leading</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{options[0].label}</div>
                  <button className="btn btn-secondary" onClick={lockPlan} style={{ fontSize: 12, padding: '7px 14px', color: 'var(--sage)', borderColor: 'var(--sage-dim)' }}>
                    Lock in this plan
                  </button>
                </div>
              )}
              {!myVote && !voting && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Select an option to cast your vote</div>}
              {voting && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Saving vote...</div>}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ marginBottom: 16, opacity: 0.2 }}>
                <rect x="6" y="10" width="32" height="24" rx="4" stroke="var(--text)" strokeWidth="2"/>
                <line x1="14" y1="18" x2="30" y2="18" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
                <line x1="14" y1="22" x2="26" y2="22" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>No poll running.</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>Start one to decide what to do tonight.</div>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ fontSize: 13 }}>
                Start a poll
              </button>
            </div>
          )}

          {showCreate && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--rust-dim)', borderRadius: 12, padding: 16, marginTop: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, letterSpacing: '-0.3px' }}>Pick activities to vote on</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Choose up to 5</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                {ACTIVITY_OPTIONS.map(o => (
                  <div key={o.label}
                    onClick={() => setSelected(s => s.includes(o.label) ? s.filter(x => x !== o.label) : s.length < 5 ? [...s, o.label] : s)}
                    style={{ padding: '9px 10px', border: `1px solid ${selected.includes(o.label) ? 'var(--rust)' : 'var(--border2)'}`, borderRadius: 8, cursor: 'pointer', background: selected.includes(o.label) ? 'var(--rust-soft)' : 'var(--bg3)', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: selected.includes(o.label) ? 'var(--rust)' : 'var(--text2)' }}>{o.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={createPoll} disabled={creating || selected.length === 0} style={{ flex: 1, fontSize: 13, padding: '9px' }}>
                  {creating ? 'Creating...' : `Start poll (${selected.length} option${selected.length !== 1 ? 's' : ''})`}
                </button>
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: 13, padding: '9px 14px' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right — Budget */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Budget tonight</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            {BUDGETS.map(b => (
              <div key={b.id} onClick={() => setBudget(b.id)}
                className="card-hover"
                style={{ padding: '10px 8px', border: `${budget === b.id ? '1.5px solid var(--rust)' : '1px solid var(--border2)'}`, borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: budget === b.id ? 'var(--rust-soft)' : 'var(--bg2)', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: budget === b.id ? 'var(--rust)' : 'var(--text)' }}>{b.symbol}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.6 }}>
            Your budget is never shown to others
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Members</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {members.map(m => (
              <div key={m.id} style={{ width: 32, height: 32, borderRadius: '50%', background: m.color, color: m.text, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>
                {m.initials}
              </div>
            ))}
          </div>

          {!hangout && (
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ width: '100%', fontSize: 13 }}>
                Start tonight&apos;s poll
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
