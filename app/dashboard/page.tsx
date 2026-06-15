'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Feed from '@/components/Feed'
import Hangout from '@/components/Hangout'
import BillSplit from '@/components/BillSplit'
import Members from '@/components/Members'
import Memories from '@/components/Memories'

const NAV = [
  { id: 'feed',    icon: '⚡', label: 'Feed' },
  { id: 'hangout', icon: '🗳️', label: 'Tonight' },
  { id: 'split',   icon: '💰', label: 'Bills' },
  { id: 'members', icon: '👥', label: 'Members' },
  { id: 'memories',icon: '📸', label: 'Memories' },
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
  const [active, setActive]       = useState('feed')
  const [activeKnot, setActiveKnot] = useState(KNOTS[0])
  const [user, setUser]           = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/'
      else setUser(data.user)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const s: Record<string, React.CSSProperties> = {
    app:     { display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' },
    sidebar: { width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', overflow: 'hidden' },
    main:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    topbar:  { padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0, background: 'var(--bg)' },
    content: { flex: 1, overflowY: 'auto', padding: 24 },
    navItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text2)', transition: 'all 0.15s' },
    knotItem:{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
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
          {KNOTS.map(k => (
            <div key={k.id} style={{ ...s.knotItem, background: activeKnot.id === k.id ? 'var(--indigo-soft)' : 'transparent' }} onClick={() => setActiveKnot(k)}>
              <span style={{ fontSize: 16 }}>{k.emoji}</span>
              <span style={{ flex: 1, color: activeKnot.id === k.id ? 'var(--indigo)' : 'var(--text)', fontWeight: activeKnot.id === k.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
            </div>
          ))}
          <div style={{ ...s.knotItem, border: '1px dashed var(--border2)', borderRadius: 8, marginTop: 4, color: 'var(--text3)', fontSize: 12 }} onClick={() => alert('Create a new Knot!')}>
            <span style={{ width: 20, height: 20, border: '1px dashed var(--border2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>+</span>
            <span>New Knot</span>
          </div>
        </div>

        {/* NAV */}
        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 6 }}>Navigate</div>
          {NAV.map(n => (
            <div key={n.id}
              style={{ ...s.navItem, background: active === n.id ? 'var(--indigo-soft)' : 'transparent', color: active === n.id ? 'var(--indigo)' : 'var(--text2)' }}
              onClick={() => setActive(n.id)}>
              <span style={{ fontSize: 15 }}>{n.icon}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>
              {n.id === 'split' && <span style={{ marginLeft: 'auto', background: 'var(--coral)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>2</span>}
            </div>
          ))}
        </nav>

        {/* PROFILE */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AM</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.user_metadata?.name || 'Amrinder'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mid-range</div>
            </div>
            <span style={{ fontSize: 16, cursor: 'pointer', color: 'var(--text3)' }} onClick={signOut} title="Sign out">↪</span>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={s.main}>
        {/* TOPBAR */}
        <div style={s.topbar}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: '4px', borderRadius: 6 }}>☰</button>
          <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>{activeKnot.emoji} {activeKnot.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{activeKnot.count} members</span>
        </div>

        {/* CONTENT */}
        <div style={s.content}>
          {active === 'feed'     && <Feed     members={MEMBERS} knotName={activeKnot.name} />}
          {active === 'hangout'  && <Hangout  members={MEMBERS} />}
          {active === 'split'    && <BillSplit members={MEMBERS} />}
          {active === 'members'  && <Members  members={MEMBERS} />}
          {active === 'memories' && <Memories members={MEMBERS} />}
        </div>
      </div>
    </div>
  )
}