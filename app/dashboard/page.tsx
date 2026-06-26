'use client'

import HomeFeed from '@/components/HomeFeed'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Feed from '@/components/Feed'
import Hangout from '@/components/Hangout'
import BillSplit from '@/components/BillSplit'
import Members from '@/components/Members'
import Memories from '@/components/Memories'
import Discover from '@/components/Discover'
import Games from '@/components/Games'
import Notifications from '@/components/Notifications'

const TABS = [
  { id: 'feed',     label: 'Discussion' },
  { id: 'hangout',  label: 'Tonight' },
  { id: 'memories', label: 'Media' },
  { id: 'members',  label: 'Members' },
  { id: 'discover', label: 'Discover' },
]

const BOTTOM_NAV = [
  { id: 'feed',     label: 'Discussion' },
  { id: 'hangout',  label: 'Tonight' },
  { id: 'memories', label: 'Media' },
  { id: 'members',  label: 'Members' },
  { id: 'more',     label: 'More' },
]

const MEMBER_COLORS = [
  { bg: '#2A2A2A', text: '#F8BD03' },
  { bg: '#1A1A1A', text: '#F8BD03' },
  { bg: '#222222', text: '#F8BD03' },
  { bg: '#2E2E2E', text: '#F8BD03' },
  { bg: '#1E1E1E', text: '#F8BD03' },
]

export default function Dashboard() {
  const [active, setActive]                 = useState('feed')
  const [activeKnot, setActiveKnot]         = useState<any>(null)
  const [user, setUser]                     = useState<any>(null)
  const [profile, setProfile]               = useState<any>(null)
  const [showHome, setShowHome]             = useState(true)
  const [showNewKnot, setShowNewKnot]       = useState(false)
  const [showRenameKnot, setShowRenameKnot] = useState(false)
  const [showKnotMenu, setShowKnotMenu]     = useState(false)
  const [showProfile, setShowProfile]       = useState(false)
  const [showMore, setShowMore]             = useState(false)
  const [showKnotList, setShowKnotList]     = useState(false)
  const [newKnotName, setNewKnotName]       = useState('')
  const [newKnotEmoji, setNewKnotEmoji]     = useState('🔗')
  const [knots, setKnots]                   = useState<any[]>([])
  const [knotsLoading, setKnotsLoading]     = useState(true)
  const [knotMembers, setKnotMembers]       = useState<any[]>([])
  const [editName, setEditName]             = useState('')
  const [editBudget, setEditBudget]         = useState('mid')
  const [savingProfile, setSavingProfile]   = useState(false)
  const [knotError, setKnotError]           = useState('')
  const [avatarError, setAvatarError]       = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/'; return }
      setUser(data.user)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single()
      if (prof) {
        setProfile(prof)
        setEditName(prof.name || '')
        setEditBudget(prof.budget_tier || 'mid')
      }

      const { data: memberships } = await supabase
        .from('knot_members')
        .select('knot_id, knots(id, name, emoji)')
        .eq('user_id', data.user.id)

      if (memberships && memberships.length > 0) {
        const knotList = await Promise.all(
          memberships.map(async (m: any) => {
            const k = m.knots
            const { count } = await supabase
              .from('knot_members')
              .select('*', { count: 'exact', head: true })
              .eq('knot_id', k.id)
            return { id: k.id, name: k.name, emoji: k.emoji, count: count || 1 }
          })
        )
        setKnots(knotList)
const savedKnotId = localStorage.getItem('active_knot_id')
const savedKnot = savedKnotId ? knotList.find(k => k.id === savedKnotId) : null
const startKnot = savedKnot || knotList[0]
const savedShowHome = localStorage.getItem('show_home')
if (savedShowHome === 'false' && savedKnot) {
  setShowHome(false)
  setActiveKnot(startKnot)
} else {
  setActiveKnot(startKnot)
}
await loadKnotMembers(startKnot.id, data.user.id)
      } else {
        setShowHome(false)
      }
      setKnotsLoading(false)
    })
  }, [])

  async function loadKnotMembers(knotId: string, userId?: string) {
    const { data } = await supabase
      .from('knot_members')
      .select('user_id, role, profiles:user_id(id, name)')
      .eq('knot_id', knotId)
    if (data) {
      const currentUserId = userId || user?.id
      setKnotMembers(data.map((m: any, i: number) => ({
        id:       m.user_id,
        name:     m.profiles?.name || 'Unknown',
        initials: (m.profiles?.name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
        color:    MEMBER_COLORS[i % MEMBER_COLORS.length].bg,
        text:     MEMBER_COLORS[i % MEMBER_COLORS.length].text,
        you:      m.user_id === currentUserId,
      })))
    }
  }

async function switchKnot(k: any) {
  setShowHome(false)
  setActiveKnot(k)
  localStorage.setItem('active_knot_id', k.id)
  localStorage.setItem('show_home', 'false')
    setShowKnotMenu(false)
    setShowMore(false)
    setShowKnotList(false)
    setActive('feed')
    await loadKnotMembers(k.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function createKnot() {
    if (!newKnotName.trim()) { setKnotError('Please enter a name'); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    setKnotError('')
    try {
      const { data: knot, error } = await supabase
        .from('knots')
        .insert({ name: newKnotName.trim(), emoji: newKnotEmoji, created_by: u.id })
        .select().single()
      if (error) { setKnotError('Could not create Knot. Please try again.'); return }
      if (knot) {
        await supabase.from('knot_members').insert({ knot_id: knot.id, user_id: u.id, role: 'founder' })
        const newK = { id: knot.id, name: knot.name, emoji: knot.emoji, count: 1 }
        setKnots(k => [...k, newK])
        setActiveKnot(newK)
        await loadKnotMembers(newK.id)
        setNewKnotName('')
        setNewKnotEmoji('🔗')
        setShowNewKnot(false)
      }
    } catch { setKnotError('Could not create Knot. Please try again.') }
  }

  async function renameKnot() {
    if (!newKnotName.trim() || !activeKnot || !user) return
    setKnotError('')
    const { error } = await supabase
      .from('knots')
      .update({ name: newKnotName.trim(), emoji: newKnotEmoji })
      .eq('id', activeKnot.id)
      .eq('created_by', user.id)
    if (error) { setKnotError('Only the founder can rename this Knot.'); return }
    const updated = { ...activeKnot, name: newKnotName.trim(), emoji: newKnotEmoji }
    setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))
    setActiveKnot(updated)
    setShowRenameKnot(false)
    setNewKnotName('')
  }

  async function deleteKnot() {
    if (!activeKnot || !user) return
    if (!confirm(`Delete "${activeKnot.name}"? This cannot be undone.`)) return
    const { error } = await supabase
      .from('knots').delete()
      .eq('id', activeKnot.id)
      .eq('created_by', user.id)
    if (error) { setKnotError('Only the founder can delete this Knot.'); return }
    const remaining = knots.filter(k => k.id !== activeKnot.id)
    setKnots(remaining)
    setActiveKnot(remaining[0] || null)
    if (remaining[0]) await loadKnotMembers(remaining[0].id)
    else setKnotMembers([])
  }

  async function saveProfile() {
    if (!editName.trim() || !user) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: editName.trim(), budget_tier: editBudget })
      .eq('id', user.id)
    if (error) { setSavingProfile(false); return }
    setProfile({ ...profile, name: editName.trim(), budget_tier: editBudget })
    setShowProfile(false)
    setSavingProfile(false)
  }

  const initials = (profile?.name || user?.user_metadata?.name || 'U')
    .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  if (!user) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text2)', fontSize: 14 }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>

      {/* TOP GLOBAL NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            kn<span style={{ color: 'var(--yellow)' }}>o</span>t
          </span>
        </div>

        <button onClick={() => { setShowHome(true); setActiveKnot(null); localStorage.setItem('show_home', 'true') }}
          style={{ padding: '6px 14px', background: showHome ? 'var(--yellow)' : 'var(--bg3)', border: `1px solid ${showHome ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 8, color: showHome ? '#111' : 'var(--text2)', fontSize: 13, fontWeight: showHome ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Home
        </button>

        <div style={{ position: 'relative', flex: 1 }}>
          <button onClick={() => setShowKnotList(!showKnotList)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
            <span>{activeKnot ? `${activeKnot.emoji} ${activeKnot.name}` : 'Select a Knot'}</span>
            <span style={{ color: 'var(--text3)', fontSize: 10 }}>▾</span>
          </button>
          {showKnotList && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, minWidth: 220, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px', marginBottom: 4 }}>Your Knots</div>
              {knots.map(k => (
                <div key={k.id} onClick={() => switchKnot(k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: activeKnot?.id === k.id ? 'var(--yellow-soft)' : 'transparent' }}>
                  <span style={{ fontSize: 16 }}>{k.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: activeKnot?.id === k.id ? 600 : 400, color: activeKnot?.id === k.id ? 'var(--yellow)' : 'var(--text)' }}>{k.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                <div onClick={() => { setShowKnotList(false); setShowNewKnot(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--yellow)', fontWeight: 600 }}>
                  + New Knot
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Notifications userId={user?.id || ''} knots={knots} onSelectKnot={(k) => switchKnot(k)} />
          <button onClick={() => setShowProfile(true)}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#111', border: 'none', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials}
          </button>
        </div>
      </div>

      {/* MAIN VIEWS */}
      {activeKnot && !showHome ? (
        <>
          {/* COVER BANNER */}
          <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ height: 180, background: 'linear-gradient(135deg, #F9F9F9 0%, #F2F2F2 50%, #E8E8E8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(248,189,3,0.2) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(248,189,3,0.1) 0%, transparent 60%)' }} />
              <span style={{ fontSize: 64 }}>{activeKnot.emoji}</span>
            </div>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.5px' }}>{activeKnot.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text3)' }}>
                  <span>Private group</span>
                  <span>·</span>
                  <span>{activeKnot.count} member{activeKnot.count !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <div style={{ display: 'flex' }}>
                    {knotMembers.slice(0, 4).map((m, i) => (
                      <div key={m.id} style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg2)', marginLeft: i > 0 ? -6 : 0 }}>
                        {m.initials}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setActive('members')}
                  style={{ padding: '8px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Invite
                </button>
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowKnotMenu(!showKnotMenu)}
                    style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ⋯
                  </button>
                  {showKnotMenu && (
                    <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 180, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                      <div onClick={() => { setShowKnotMenu(false); setShowRenameKnot(true); setNewKnotName(activeKnot.name); setNewKnotEmoji(activeKnot.emoji) }}
                        style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        Rename Knot
                      </div>
                      <div onClick={() => { setShowKnotMenu(false); deleteKnot() }}
                        style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--danger)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-soft)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        Delete Knot
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABS — desktop only */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 4, borderTop: '1px solid var(--border)' }} className="desktop-only">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActive(t.id)}
                  style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: `3px solid ${active === t.id ? 'var(--yellow)' : 'transparent'}`, color: active === t.id ? 'var(--yellow)' : 'var(--text2)', fontSize: 14, fontWeight: active === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: -1 }}>
                  {t.label}
                </button>
              ))}
              <button onClick={() => setActive('split')}
                style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: `3px solid ${active === 'split' ? 'var(--yellow)' : 'transparent'}`, color: active === 'split' ? 'var(--yellow)' : 'var(--text2)', fontSize: 14, fontWeight: active === 'split' ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: -1 }}>
                Bills
              </button>
              <button onClick={() => setActive('games')}
                style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: `3px solid ${active === 'games' ? 'var(--yellow)' : 'transparent'}`, color: active === 'games' ? 'var(--yellow)' : 'var(--text2)', fontSize: 14, fontWeight: active === 'games' ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: -1 }}>
                Games
              </button>
            </div>
          </div>

          {/* TWO COLUMN CONTENT */}
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', paddingBottom: 80, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }} className="desktop-layout">
            <div>
              {active === 'discover'  && <Discover  members={knotMembers} />}
              {active === 'feed'      && <Feed      members={knotMembers} knotName={activeKnot.name} knotId={activeKnot?.id} currentUser={profile} />}
              {active === 'hangout'   && <Hangout   members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'split'     && <BillSplit members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'members'   && <Members   members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'memories'  && <Memories  members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'games'     && <Games     members={knotMembers} knotId={activeKnot?.id} currentUser={profile} />}
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>About</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>Private · Invite only</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>No algorithm · Chronological</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--yellow)' }}>⊕</span>
                    <span>No ads · Ever</span>
                  </div>
                </div>
                <button onClick={() => setActive('members')}
                  style={{ width: '100%', marginTop: 14, padding: '9px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Invite someone
                </button>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Members</div>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{activeKnot.count}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {knotMembers.slice(0, 5).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {m.initials}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.name}{m.you ? ' (you)' : ''}</div>
                    </div>
                  ))}
                </div>
                {knotMembers.length > 5 && (
                  <button onClick={() => setActive('members')}
                    style={{ width: '100%', marginTop: 12, padding: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    See all members
                  </button>
                )}
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Recent media</div>
                  <button onClick={() => setActive('memories')} style={{ background: 'none', border: 'none', color: 'var(--yellow)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>See all</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} onClick={() => setActive('memories')} style={{ aspectRatio: '1', borderRadius: 6, background: 'var(--bg3)', cursor: 'pointer', border: '1px solid var(--border)' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>

      ) : showHome ? (
        /* HOME FEED */
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }} className="desktop-layout">
          <div>
            
            <HomeFeed knots={knots} onSelectKnot={(k) => switchKnot(k)} />
          </div>
          <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Your Knots</div>
              {knots.map(k => (
                <div key={k.id} onClick={() => switchKnot(k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 18 }}>{k.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{k.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowNewKnot(true)}
              style={{ width: '100%', padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + New Knot
            </button>
          </div>
        </div>

      ) : (
        /* NO KNOTS */
        <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>+</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>No Knots yet</div>
          <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            Create your first Knot — a private group for the people you actually hang out with.
          </div>
          <button onClick={() => setShowNewKnot(true)}
            style={{ padding: '12px 28px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Create a Knot
          </button>
        </div>
      )}

      {/* BOTTOM NAV + MORE DRAWER — only inside a Knot on mobile */}
      {activeKnot && !showHome && (
        <>
          <nav className="bottom-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, background: 'var(--bg2)', borderTop: '1px solid var(--border)', zIndex: 100, alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
            {BOTTOM_NAV.map(n => {
              const isActive = n.id === 'more' ? showMore : active === n.id
              return (
                <button key={n.id}
                  onClick={() => {
                    if (n.id === 'more') { setShowMore(!showMore) }
                    else { setActive(n.id); setShowMore(false); setShowHome(false) }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flex: 1 }}>
                  <div style={{ width: 20, height: 3, borderRadius: 2, background: isActive ? 'var(--yellow)' : 'transparent', transition: 'all 0.15s' }} />
                  <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 400, color: isActive ? 'var(--yellow)' : 'var(--text3)' }}>{n.label}</span>
                </button>
              )
            })}
          </nav>

          {showMore && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }} onClick={() => setShowMore(false)}>
              <div onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', bottom: 60, left: 0, right: 0, background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Navigate</div>
                {[{ id: 'split', label: 'Bills' }, { id: 'games', label: 'Games' }, { id: 'discover', label: 'Discover' }].map(n => (
                  <button key={n.id} onClick={() => { setActive(n.id); setShowMore(false) }}
                    style={{ width: '100%', padding: '11px 12px', background: active === n.id ? 'var(--yellow-soft)' : 'transparent', border: 'none', borderRadius: 8, color: active === n.id ? 'var(--yellow)' : 'var(--text)', fontSize: 14, fontWeight: active === n.id ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 4 }}>
                    {n.label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                  <button onClick={() => { setShowMore(false); setShowProfile(true) }}
                    style={{ width: '100%', padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Edit profile
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* NEW KNOT MODAL */}
      {showNewKnot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Create a new Knot</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Invite only. Your friends need a vote to join.</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an emoji</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['🍻','🏀','💼','🎮','🎵','🌍','🏕️','🎉','❤️','🔗'].map(e => (
                <span key={e} onClick={() => setNewKnotEmoji(e)}
                  style={{ fontSize: 20, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${newKnotEmoji === e ? 'var(--yellow)' : 'var(--border)'}`, background: newKnotEmoji === e ? 'var(--yellow-soft)' : 'transparent' }}>
                  {e}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Knot name</div>
            <input value={newKnotName} onChange={e => setNewKnotName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKnot()}
              placeholder="e.g. The Brampton Crew"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />
            {knotError && <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger-dim)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{knotError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createKnot}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Create Knot
              </button>
              <button onClick={() => { setShowNewKnot(false); setNewKnotName(''); setKnotError('') }}
                style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME KNOT MODAL */}
      {showRenameKnot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Rename Knot</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an emoji</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['🍻','🏀','💼','🎮','🎵','🌍','🏕️','🎉','❤️','🔗'].map(e => (
                <span key={e} onClick={() => setNewKnotEmoji(e)}
                  style={{ fontSize: 20, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${newKnotEmoji === e ? 'var(--yellow)' : 'var(--border)'}`, background: newKnotEmoji === e ? 'var(--yellow-soft)' : 'transparent' }}>
                  {e}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Knot name</div>
            <input value={newKnotName} onChange={e => setNewKnotName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameKnot()}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />
            {knotError && <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger-dim)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{knotError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={renameKnot}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Save changes
              </button>
              <button onClick={() => { setShowRenameKnot(false); setNewKnotName(''); setKnotError('') }}
                style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Your profile</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Visible to members of your Knots.</div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => document.getElementById('avatar-upload')?.click()}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--yellow)' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#111' }}>
                    {editName ? editName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() : initials}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#111', fontWeight: 700, border: '2px solid var(--bg2)' }}>+</div>
                <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !user) return
                    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
                    const allowedExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
                    const ext = (file.name.split('.').pop() || '').toLowerCase()
                    if (!allowed.has(file.type) || !allowedExts.has(ext)) { setAvatarError('Only JPEG, PNG, WebP, or GIF images are allowed.'); return }
                    if (file.size > 2 * 1024 * 1024) { setAvatarError('Max 2 MB for avatar.'); return }
                    setAvatarError('')
                    const safeType = file.type === 'image/png' ? 'image/png' : file.type === 'image/gif' ? 'image/gif' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
                    const safePath = `avatars/${user.id}.${ext}`
                    const { error: upErr } = await supabase.storage.from('knot-photos').upload(safePath, file, { upsert: true, contentType: safeType })
                    if (upErr) { setAvatarError('Upload failed. Please try again.'); return }
                    const { data: { publicUrl } } = supabase.storage.from('knot-photos').getPublicUrl(safePath)
                    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
                    setProfile((p: any) => ({ ...p, avatar_url: publicUrl }))
                  }} />
              </div>
            </div>

            {avatarError && (
              <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger-dim)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{avatarError}</div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Your name</div>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="Your name"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Email</div>
            <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{user?.email}</div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Budget comfort for a night out</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 6 }}>
              {[
                { id: 'casual', symbol: '$', label: 'Casual' },
                { id: 'mid', symbol: '$$', label: 'Mid' },
                { id: 'nice', symbol: '$$$', label: 'Nice' },
                { id: 'splurge', symbol: '$$$$', label: 'Splurge' },
              ].map(b => (
                <div key={b.id} onClick={() => setEditBudget(b.id)}
                  style={{ padding: '10px 6px', border: `1px solid ${editBudget === b.id ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: editBudget === b.id ? 'var(--yellow-soft)' : 'transparent' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: editBudget === b.id ? 'var(--yellow)' : 'var(--text)' }}>{b.symbol}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 20 }}>Never shown as a number to others</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveProfile} disabled={savingProfile || !editName.trim()}
                style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: savingProfile ? 0.7 : 1 }}>
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
              <button onClick={() => setShowProfile(false)}
                style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 14 }}>
              <button onClick={() => { setShowProfile(false); signOut() }}
                style={{ width: '100%', padding: '9px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}









