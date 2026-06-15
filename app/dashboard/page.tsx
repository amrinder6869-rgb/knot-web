'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Feed from '@/components/Feed'
import Hangout from '@/components/Hangout'
import BillSplit from '@/components/BillSplit'
import Members from '@/components/Members'
import Memories from '@/components/Memories'

const NAV = [
  { id: 'feed',     icon: '⚡', label: 'Feed' },
  { id: 'hangout',  icon: '🗳️', label: 'Tonight' },
  { id: 'split',    icon: '💰', label: 'Bills' },
  { id: 'members',  icon: '👥', label: 'Members' },
  { id: 'memories', icon: '📸', label: 'Memories' },
]

const KNOTS = [
  { id: '1', name: 'The Brampton Crew', emoji: '🍻', count: 5 },
  { id: '2', name: 'Sunday Ballers',    emoji: '🏀', count: 8 },
  { id: '3', name: 'Work Crew',         emoji: '💼', count: 6 },
]

const MEMBERS = [
  { id: '1', name: 'Amrinder', initials: 'AM', color: '#2A2850', text: '#6C63FF', budget: 'mid',    you: true  },
  { id: '2', name: 'Priya',    initials: 'PR', color: '#1A3028', text: '#4CAF87', budget: 'casual', you: false },
  { id: '3', name: 'Karan',    initials: 'KA', color: '#2E1C18', text: '#E8624A', budget: 'mid',    you: false },
  { id: '4', name: 'Sofia',    initials: 'SO', color: '#2B2010', text: '#F0A855', budget: 'nice',   you: false },
  { id: '5', name: 'Dev',      initials: 'DE', color: '#1e1528', text: '#C97BB2', budget: 'casual', you: false },
]

export default function Dashboard() {
  const [active, setActive]           = useState('feed')
  const [activeKnot, setActiveKnot]   = useState(KNOTS[0])
  const [user, setUser]               = useState<any>(null)
  const [profile, setProfile]         = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showNewKnot, setShowNewKnot] = useState(false)
  const [newKnotName, setNewKnotName] = useState('')
  const [newKnotEmoji, setNewKnotEmoji] = useState('🔗')
  const [knots, setKnots]             = useState(KNOTS)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/'; return }
      setUser(data.user)
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      if (prof) setProfile(prof)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function createKnot() {
    if (!newKnotName.trim()) return
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return

    const { data: knot, error } = await supabase
      .from('knots')
      .insert({ name: newKnotName.trim(), emoji: newKnotEmoji, created_by: u.id })
      .select()
      .single()

    if (knot) {
      await supabase.from('knot_members').insert({ knot_id: knot.id, user_id: u.id, role: 'founder' })
      const newK = { id: knot.id, name: knot.name, emoji: knot.emoji, count: 1 }
      setKnots(k => [...k, newK])
      setActiveKnot(newK)
      setNewKnotName('')
      setShowNewKnot(false)
    }
  }

  const initials = (profile?.name || user?.user_metadata?.name || 'U')
    .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  const s: Record<string, React.CSSProperties> = {
    app:      { display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' },
    sidebar:  { width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', overflow: 'hidden' },
    main:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    topbar:   { padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0, background: 'var(--bg)' },
    content:  { flex: 1, overflowY: 'auto', padding: 24 },
    navItem:  { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text2)', transition: 'all 0.15s' },
    knotItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  }

  return (
    <div style={s.app}>

      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="26" viewBox="0 0 44 44" fill="none">
              <circle cx="17" cy="17" r="10" stroke="#6C63FF" strokeWidth="3" fill="none"/>
              <circle cx="27" cy="27" r="10" stroke="#4CAF87" strokeWidth="3" fill="none"/>
            </svg>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
              kn<span style={{ color: 'var(--indigo)' }}>o</span>t
            </span>
          </div>
        </div>

        {/* KNOTS */}
        <div style={{ padding: '10px 10px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 6 }}>Your Knots</div>
          {knots.map(k => (
            <div key={k.id} onClick={() => setActiveKnot(k)}
              style={{ ...s.knotItem, background: activeKnot.id === k.id ? 'var(--indigo-soft)' : 'transparent' }}>
              <span style={{ fontSize: 16 }}>{k.emoji}</span>
              <span style={{ flex: 1, color: activeKnot.id === k.id ? 'var(--indigo)' : 'var(--text)', fontWeight: activeKnot.id === k.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
            </div>
          ))}
          <div onClick={() => setShowNewKnot(true)}
            style={{ ...s.knotItem, border: '1px dashed var(--border2)', borderRadius: 8, marginTop: 4, color: 'var(--text3)', fontSize: 12 }}>
            <span style={{ width: 20, height: 20, border: '1px dashed var(--border2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>+</span>
            <span>New Knot</span>
          </div>
        </div>

        {/* NAV */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 6 }}>Navigate</div>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setActive(n.id)}
              style={{ ...s.navItem, background: active === n.id ? 'var(--indigo-soft)' : 'transparent', color: active === n.id ? 'var(--indigo)' : 'var(--text2)' }}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>
              {n.id === 'split' && <span style={{ marginLeft: 'auto', background: 'var(--coral)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>2</span>}
            </div>
          ))}
        </nav>

        {/* PROFILE */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.name || user?.user_metadata?.name || 'Loading...'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>
                {profile?.budget_tier || 'mid'}-range
              </div>
            </div>
            <span style={{ fontSize: 16, cursor: 'pointer', color: 'var(--text3)' }} onClick={signOut} title="Sign out">↪</span>
          </div>
        </div>
      </aside>

      {/* NEW KNOT MODAL */}
      {showNewKnot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, width: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Create a new Knot</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Invite only. Your friends need a vote to join.</div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an emoji</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['🍻','🏀','💼','🎮','🎵','🌍','🏕️','🎉','❤️','🔗'].map(e => (
                <span key={e} onClick={() => setNewKnotEmoji(e)}
                  style={{ fontSize: 20, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${newKnotEmoji === e ? 'var(--indigo)' : 'var(--border)'}`, background: newKnotEmoji === e ? 'var(--indigo-soft)' : 'transparent' }}>
                  {e}
                </span>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Knot name</div>
            <input value={newKnotName} onChange={e => setNewKnotName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKnot()}
              placeholder="e.g. The Brampton Crew"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createKnot}
                style={{ flex: 1, padding: '10px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Create Knot
              </button>
              <button onClick={() => { setShowNewKnot(false); setNewKnotName('') }}
                style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={s.main}>
        <div style={s.topbar}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: '4px', borderRadius: 6 }}>☰</button>
          <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{activeKnot.emoji} {activeKnot.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{activeKnot.count} members</span>
        </div>

        <div style={s.content}>
          {active === 'feed'     && <Feed      members={MEMBERS} knotName={activeKnot.name} />}
          {active === 'hangout'  && <Hangout   members={MEMBERS} />}
          {active === 'split'    && <BillSplit  members={MEMBERS} />}
          {active === 'members'  && <Members   members={MEMBERS} />}
          {active === 'memories' && <Memories  members={MEMBERS} />}
        </div>
      </div>
    </div>
  )
}