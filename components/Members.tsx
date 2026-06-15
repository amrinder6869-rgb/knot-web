'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Members({ members, knotId }: { members: any[], knotId?: string }) {
  const [myVote, setMyVote]             = useState<'yes'|'no'|null>(null)
  const [anonNote, setAnonNote]         = useState('')
  const [showNote, setShowNote]         = useState(false)
  const [showSplinter, setShowSplinter] = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [yesCount, setYesCount]         = useState(2)
  const [noCount, setNoCount]           = useState(1)
  const [inviteLink, setInviteLink]     = useState('')
  const [generating, setGenerating]     = useState(false)

  const total = 5
  const yPct  = Math.round(yesCount / total * 100)
  const nPct  = Math.round(noCount  / total * 100)

  function castVote(v: 'yes'|'no') {
    setMyVote(v)
    if (v === 'yes') setYesCount(c => c + 1)
    if (v === 'no')  { setNoCount(c => c + 1); setShowNote(true) }
  }

  function submitVote() {
    setSubmitted(true)
    setShowNote(false)
    if (myVote === 'no') setShowSplinter(true)
  }

  async function generateInvite() {
    if (!knotId) { alert('No Knot selected'); return }
    setGenerating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    const { data, error } = await supabase
      .from('invites')
      .insert({ knot_id: knotId, created_by: user.id })
      .select()
      .single()

    if (error) { alert('Error: ' + error.message); setGenerating(false); return }

    const link = `${window.location.origin}/invite/${data.token}`
    setInviteLink(link)
    navigator.clipboard.writeText(link).catch(() => {})
    setGenerating(false)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT — Members */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👥 Current members</div>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.color, color: m.text, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}{m.you ? <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> (you)</span> : ''}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{m.you ? 'Founder · Mid-range budget' : `Member · ${m.budget} budget`}</div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: m.you ? 'var(--indigo-soft)' : 'var(--sage-soft)', color: m.you ? 'var(--indigo)' : 'var(--sage)' }}>
                {m.you ? 'Founder' : 'Active'}
              </span>
            </div>
          ))}
        </div>

        {/* RIGHT */}
        <div>

          {/* INVITE */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔗 Invite someone</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>
              Generate a one-time link valid for 48 hours. The group votes before they're fully in.
            </div>
            {inviteLink ? (
              <div>
                <div style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11, color: 'var(--sage)', wordBreak: 'break-all', marginBottom: 8 }}>
                  {inviteLink}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sage)', marginBottom: 8 }}>✓ Copied to clipboard!</div>
                <button onClick={() => setInviteLink('')}
                  style={{ fontSize: 12, padding: '5px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Generate new link
                </button>
              </div>
            ) : (
              <button onClick={generateInvite} disabled={generating}
                style={{ padding: '8px 16px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1 }}>
                {generating ? 'Generating...' : '+ Generate invite link'}
              </button>
            )}
          </div>

          {/* PENDING VOTE */}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🗳️ Pending vote</div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>JA</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Jamie T.</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Nominated by Priya · 48 hrs remaining</div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'var(--amber-soft)', color: 'var(--amber)' }}>⏱ 72h vote</span>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, borderLeft: '2px solid var(--amber)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Priya says:</strong> "Jamie and I went to school together — super fun person, always down for a night out."
            </div>

            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg4)', display: 'flex', marginBottom: 6 }}>
              <div style={{ width: `${yPct}%`, background: 'var(--sage)', transition: 'width 0.4s' }} />
              <div style={{ width: `${nPct}%`, background: 'var(--coral)', transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
              <span style={{ color: 'var(--sage)' }}>■ {yesCount} yes</span>
              <span style={{ color: 'var(--coral)' }}>■ {noCount} no</span>
              <span>■ {total - yesCount - noCount} not voted</span>
            </div>

            {!submitted ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button onClick={() => castVote('yes')}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${myVote === 'yes' ? 'var(--sage)' : 'rgba(76,175,135,0.3)'}`, background: myVote === 'yes' ? 'var(--sage)' : 'var(--sage-soft)', color: myVote === 'yes' ? '#fff' : 'var(--sage)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    👍 Vote Yes
                  </button>
                  <button onClick={() => castVote('no')}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${myVote === 'no' ? 'var(--coral)' : 'rgba(232,98,74,0.3)'}`, background: myVote === 'no' ? 'var(--coral)' : 'var(--coral-soft)', color: myVote === 'no' ? '#fff' : 'var(--coral)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    👎 Vote No
                  </button>
                  <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Abstain
                  </button>
                </div>

                {showNote && (
                  <div style={{ background: 'var(--coral-soft)', border: '1px solid rgba(232,98,74,0.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', marginBottom: 6 }}>🔒 Anonymous note (optional)</div>
                    <textarea value={anonNote} onChange={e => setAnonNote(e.target.value)}
                      placeholder="Share why privately — only shown to Yes voters if it doesn't pass..."
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, resize: 'none', outline: 'none', minHeight: 56, lineHeight: 1.5 }} />
                  </div>
                )}

                {myVote && (
                  <button onClick={submitVote}
                    style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: 'var(--indigo)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Submit vote
                  </button>
                )}
              </>
            ) : (
              <div style={{ padding: '10px 12px', background: 'var(--sage-soft)', border: '1px solid rgba(76,175,135,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--sage)' }}>
                ✓ Vote submitted anonymously
              </div>
            )}
          </div>

          {/* SPLINTER */}
          {showSplinter && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--indigo)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo)', marginBottom: 6 }}>⑂ Start a new Knot?</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>
                Jamie didn't pass this time. You voted Yes — want to start a new Knot with the other Yes voters + Jamie? The original Knot continues unchanged.
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {['AM', 'PR', 'JA'].map((i, idx) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: idx === 2 ? 'var(--amber-soft)' : 'var(--indigo-soft)', color: idx === 2 ? 'var(--amber)' : 'var(--indigo)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i}</div>
                ))}
                <span style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'center', marginLeft: 4 }}>you + Priya + Jamie</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowSplinter(false); alert('New Knot created with Priya + Jamie! 🎉') }}
                  style={{ flex: 1, padding: '8px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ⑂ Start new Knot
                </button>
                <button onClick={() => setShowSplinter(false)}
                  style={{ padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Not now
                </button>
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            ℹ️ More Yes than No = accepted. Votes always anonymous. Rejected nominee sees: "This Knot isn't open right now." 60-day cooldown applies.
          </div>
        </div>
      </div>
    </div>
  )
}