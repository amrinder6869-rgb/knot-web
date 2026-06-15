'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

function getInitials(name: string) {
  return name?.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() || '?'
}

const COLORS = [
  { bg: '#2A2850', text: '#6C63FF' },
  { bg: '#1A3028', text: '#4CAF87' },
  { bg: '#2E1C18', text: '#E8624A' },
  { bg: '#2B2010', text: '#F0A855' },
  { bg: '#1e1528', text: '#C97BB2' },
  { bg: '#1A2535', text: '#7EB8F0' },
]

function getColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function Members({ members, knotId }: { members: any[], knotId?: string }) {
  const [knotMembers, setKnotMembers]   = useState<any[]>([])
  const [nominations, setNominations]   = useState<any[]>([])
  const [myVote, setMyVote]             = useState<Record<string, string>>({})
  const [anonNote, setAnonNote]         = useState<Record<string, string>>({})
  const [showNote, setShowNote]         = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted]       = useState<Record<string, boolean>>({})
  const [showSplinter, setShowSplinter] = useState<Record<string, boolean>>({})
  const [inviteLink, setInviteLink]     = useState('')
  const [generating, setGenerating]     = useState(false)
  const [user, setUser]                 = useState<any>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) setUser(u)
      if (knotId) {
        await loadMembers()
        await loadNominations()
      }
      setLoading(false)
    }
    init()
  }, [knotId])

  async function loadMembers() {
    const { data } = await supabase
      .from('knot_members')
      .select('user_id, role, joined_at, profiles:user_id(id, name, budget_tier)')
      .eq('knot_id', knotId)
    if (data) setKnotMembers(data)
  }

  async function loadNominations() {
    const { data } = await supabase
      .from('nominations')
      .select('*')
      .eq('knot_id', knotId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (data) setNominations(data)

    // Load my votes
    const { data: { user: u } } = await supabase.auth.getUser()
    if (u && data) {
      const votes: Record<string, string> = {}
      for (const nom of data) {
        const { data: v } = await supabase
          .from('nomination_votes')
          .select('vote')
          .eq('nomination_id', nom.id)
          .eq('voter_id', u.id)
          .single()
        if (v) votes[nom.id] = v.vote
      }
      setMyVote(votes)
    }
  }

  async function castVote(nominationId: string, vote: 'yes' | 'no') {
    if (!user) return
    setMyVote(prev => ({ ...prev, [nominationId]: vote }))
    if (vote === 'no') setShowNote(prev => ({ ...prev, [nominationId]: true }))
  }

  async function submitVote(nominationId: string) {
    if (!user) return
    const vote = myVote[nominationId]
    const note = anonNote[nominationId] || ''

    const { error } = await supabase.from('nomination_votes').upsert({
      nomination_id: nominationId, voter_id: user.id, vote, anon_note: note
    })

    if (error) { alert('Error: ' + error.message); return }

    setSubmitted(prev => ({ ...prev, [nominationId]: true }))
    setShowNote(prev => ({ ...prev, [nominationId]: false }))

    if (vote === 'no') setShowSplinter(prev => ({ ...prev, [nominationId]: true }))

    // Check if enough votes to decide
    const { data: votes } = await supabase
      .from('nomination_votes')
      .select('vote')
      .eq('nomination_id', nominationId)

    if (votes) {
      const yes = votes.filter(v => v.vote === 'yes').length
      const no  = votes.filter(v => v.vote === 'no').length
      const nom = nominations.find(n => n.id === nominationId)

      if (yes > no && yes >= Math.ceil(knotMembers.length / 2)) {
        // Accept — add to knot
        if (nom?.nominee_email) {
          await supabase.from('nominations').update({ status: 'accepted' }).eq('id', nominationId)
        }
      }
    }

    await loadNominations()
  }

  async function generateInvite() {
    if (!knotId || !user) { alert('No Knot selected'); return }
    setGenerating(true)

    const { data, error } = await supabase
      .from('invites')
      .insert({ knot_id: knotId, created_by: user.id })
      .select().single()

    if (error) { alert('Error: ' + error.message); setGenerating(false); return }

    const link = `${window.location.origin}/invite/${data.token}`
    setInviteLink(link)
    navigator.clipboard.writeText(link).catch(() => {})
    setGenerating(false)
  }

  async function startSplinter(nominationId: string) {
    if (!knotId || !user) return
    const nom = nominations.find(n => n.id === nominationId)

    // Create new knot
    const { data: newKnot } = await supabase
      .from('knots')
      .insert({ name: 'New Knot', emoji: '🔗', created_by: user.id })
      .select().single()

    if (newKnot) {
      await supabase.from('knot_members').insert({ knot_id: newKnot.id, user_id: user.id, role: 'founder' })
      alert(`New Knot created! Invite the others and ${nom?.nominee_name} to join.`)
      setShowSplinter(prev => ({ ...prev, [nominationId]: false }))
      window.location.reload()
    }
  }

  if (loading) return <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0' }}>Loading members...</div>

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT — Members */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>👥 Current members</div>
          {knotMembers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>No members yet.</div>
          ) : knotMembers.map((m: any) => {
            const name = m.profiles?.name || 'Unknown'
            const col  = getColor(m.user_id)
            const isMe = m.user_id === user?.id
            return (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: col.bg, color: col.text, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {getInitials(name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{name}{isMe ? <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> (you)</span> : ''}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, textTransform: 'capitalize' }}>
                    {m.role} · {m.profiles?.budget_tier || 'mid'}-range budget
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: m.role === 'founder' ? 'var(--indigo-soft)' : 'var(--sage-soft)', color: m.role === 'founder' ? 'var(--indigo)' : 'var(--sage)' }}>
                  {m.role === 'founder' ? 'Founder' : 'Member'}
                </span>
              </div>
            )
          })}
        </div>

        {/* RIGHT */}
        <div>
          {/* INVITE */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🔗 Invite someone</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>
              Generate a one-time link valid for 48 hours.
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

          {/* PENDING VOTES */}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🗳️ Pending votes</div>

          {nominations.length === 0 ? (
            <div style={{ padding: '16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
              No pending nominations
            </div>
          ) : nominations.map(nom => {
            const isSubmitted = submitted[nom.id]
            const myV         = myVote[nom.id]

            return (
              <div key={nom.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {getInitials(nom.nominee_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{nom.nominee_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>Nominated · pending vote</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'var(--amber-soft)', color: 'var(--amber)' }}>⏱ Open</span>
                </div>

                {nom.nominator_note && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 8, borderLeft: '2px solid var(--amber)', lineHeight: 1.6 }}>
                    {nom.nominator_note}
                  </div>
                )}

                {!isSubmitted ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <button onClick={() => castVote(nom.id, 'yes')}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${myV === 'yes' ? 'var(--sage)' : 'rgba(76,175,135,0.3)'}`, background: myV === 'yes' ? 'var(--sage)' : 'var(--sage-soft)', color: myV === 'yes' ? '#fff' : 'var(--sage)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        👍 Vote Yes
                      </button>
                      <button onClick={() => castVote(nom.id, 'no')}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${myV === 'no' ? 'var(--coral)' : 'rgba(232,98,74,0.3)'}`, background: myV === 'no' ? 'var(--coral)' : 'var(--coral-soft)', color: myV === 'no' ? '#fff' : 'var(--coral)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        👎 Vote No
                      </button>
                      <button onClick={() => submitVote(nom.id)}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg3)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Abstain
                      </button>
                    </div>

                    {showNote[nom.id] && (
                      <div style={{ background: 'var(--coral-soft)', border: '1px solid rgba(232,98,74,0.25)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--coral)', marginBottom: 6 }}>🔒 Anonymous note (optional)</div>
                        <textarea value={anonNote[nom.id] || ''} onChange={e => setAnonNote(prev => ({ ...prev, [nom.id]: e.target.value }))}
                          placeholder="Share why privately..."
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text2)', fontFamily: 'inherit', fontSize: 12, resize: 'none', outline: 'none', minHeight: 56, lineHeight: 1.5 }} />
                      </div>
                    )}

                    {myV && (
                      <button onClick={() => submitVote(nom.id)}
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

                {/* Splinter */}
                {showSplinter[nom.id] && (
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--indigo)', borderRadius: 12, padding: 14, marginTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo)', marginBottom: 6 }}>⑂ Start a new Knot?</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>
                      {nom.nominee_name} didn't pass. Want to start a new Knot with them? The original Knot stays unchanged.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => startSplinter(nom.id)}
                        style={{ flex: 1, padding: '8px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ⑂ Start new Knot
                      </button>
                      <button onClick={() => setShowSplinter(prev => ({ ...prev, [nom.id]: false }))}
                        style={{ padding: '8px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Not now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}>
            ℹ️ More Yes than No = accepted. Votes always anonymous. Rejected nominee sees: "This Knot isn't open right now."
          </div>
        </div>
      </div>
    </div>
  )
}