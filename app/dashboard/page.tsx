'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Feed from '@/components/Feed'
import Hangout from '@/components/Hangout'
import BillSplit from '@/components/BillSplit'
import Members from '@/components/Members'
import Memories from '@/components/Memories'
import Discover from '@/components/Discover'
import Games from '@/components/Games'

const NAV = [
  { id: 'discover', label: 'Discover' },
  { id: 'feed',     label: 'Feed' },
  { id: 'hangout',  label: 'Tonight' },
  { id: 'split',    label: 'Bills' },
  { id: 'members',  label: 'Members' },
  { id: 'memories', label: 'Memories' },
  { id: 'games',    label: 'Games' },
]

const BOTTOM_NAV = [
  { id: 'feed',     label: 'Feed' },
  { id: 'hangout',  label: 'Tonight' },
  { id: 'discover', label: 'Discover' },
  { id: 'memories', label: 'Memories' },
  { id: 'more',     label: 'More' },
]

const MEMBER_COLORS = [
  { bg: '#EDE6DC', text: '#6B705C' },
  { bg: '#F7EAE4', text: '#B85C38' },
  { bg: '#E6F0EA', text: '#4A7C5F' },
  { bg: '#FEF3E2', text: '#C07A10' },
  { bg: '#EDE6DC', text: '#8B7355' },
]

export default function Dashboard() {
  const [active, setActive]                 = useState('feed')
  const [activeKnot, setActiveKnot]         = useState<any>(null)
  const [user, setUser]                     = useState<any>(null)
  const [profile, setProfile]               = useState<any>(null)
  const [sidebarOpen, setSidebarOpen]       = useState(true)
  const [showNewKnot, setShowNewKnot]       = useState(false)
  const [showRenameKnot, setShowRenameKnot] = useState(false)
  const [showKnotMenu, setShowKnotMenu]     = useState(false)
  const [showProfile, setShowProfile]       = useState(false)
  const [showMore, setShowMore]             = useState(false)
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
        setActiveKnot(knotList[0])
        await loadKnotMembers(knotList[0].id, data.user.id)
      }
      setKnotsLoading(false)
    })
  }, [])

  async function loadKnotMembers(knotId: string, userId?: string) {
    const { data } = await supabase
      .from('knot_members')
      // budget_tier is intentionally excluded — it is private per-user data
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
    setActiveKnot(k)
    setShowKnotMenu(false)
    setShowMore(false)
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
    // Only the founder can rename — enforce in the query by also matching created_by
    const { error } = await supabase
      .from('knots')
      .update({ name: newKnotName.trim(), emoji: newKnotEmoji })
      .eq('id', activeKnot.id)
      .eq('created_by', user.id)
    if (error) { setKnotError('Could not rename. Only the founder can rename this Knot.'); return }
    const updated = { ...activeKnot, name: newKnotName.trim(), emoji: newKnotEmoji }
    setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))
    setActiveKnot(updated)
    setShowRenameKnot(false)
    setNewKnotName('')
  }

  async function deleteKnot() {
    if (!activeKnot || !user) return
    if (!confirm(`Delete "${activeKnot.name}"? This cannot be undone.`)) return
    // Only the founder can delete — enforce in the query by also matching created_by
    const { error } = await supabase
      .from('knots')
      .delete()
      .eq('id', activeKnot.id)
      .eq('created_by', user.id)
    if (error) { setKnotError('Could not delete. Only the founder can delete this Knot.'); return }
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

  const s: Record<string, React.CSSProperties> = {
    app:      { display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' },
    sidebar:  { width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', overflow: 'hidden' },
    main:     { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    topbar:   { padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0, background: 'var(--bg2)' },
    content:  { flex: 1, overflowY: 'auto', padding: 24 },
    navItem:  { display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--text2)', transition: 'all 0.15s' },
    knotItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  }

  if (!user) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text2)', fontSize: 14 }}>
      Loading...
    </div>
  )

  return (
    <div style={s.app}>

      {/* SIDEBAR — hidden on mobile */}
      <aside className="desktop-only" style={s.sidebar}>
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="26" height="26" viewBox="0 0 44 44" fill="none">
              <circle cx="17" cy="17" r="10" stroke="var(--rust)" strokeWidth="3" fill="none"/>
              <circle cx="27" cy="27" r="10" stroke="var(--olive)" strokeWidth="3" fill="none"/>
            </svg>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>
              kn<span style={{ color: 'var(--rust)' }}>o</span>t
            </span>
          </div>
        </div>

        <div style={{ padding: '10px 10px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 6 }}>Your Knots</div>
          {knotsLoading ? (
            <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text3)' }}>Loading...</div>
          ) : knots.length === 0 ? (
            <div style={{ padding: '8px 4px', fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>No Knots yet.</div>
          ) : knots.map(k => (
            <div key={k.id} onClick={() => switchKnot(k)}
              style={{ ...s.knotItem, background: activeKnot?.id === k.id ? 'var(--rust-soft)' : 'transparent' }}>
              <span style={{ fontSize: 16 }}>{k.emoji}</span>
              <span style={{ flex: 1, color: activeKnot?.id === k.id ? 'var(--rust)' : 'var(--text)', fontWeight: activeKnot?.id === k.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
            </div>
          ))}
          <div onClick={() => setShowNewKnot(true)}
            style={{ ...s.knotItem, border: '1px dashed var(--border2)', borderRadius: 8, marginTop: 4, color: 'var(--text3)', fontSize: 12 }}>
            <span style={{ width: 20, height: 20, border: '1px dashed var(--border2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>+</span>
            <span>New Knot</span>
          </div>
        </div>

        <nav style={{ padding: '12px 10px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 4px', marginBottom: 6 }}>Navigate</div>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setActive(n.id)}
              style={{ ...s.navItem, background: active === n.id ? 'var(--rust-soft)' : 'transparent', color: active === n.id ? 'var(--rust)' : 'var(--text2)' }}>
              <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => setShowProfile(true)}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0, cursor: 'pointer', overflow: 'hidden' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </div>
            <div onClick={() => setShowProfile(true)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.name || user?.user_metadata?.name || 'Loading...'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize' }}>
                {profile?.budget_tier || 'mid'}-range · Edit profile
              </div>
            </div>
            <span style={{ fontSize: 16, cursor: 'pointer', color: 'var(--text3)' }} onClick={signOut} title="Sign out">↪</span>
          </div>
        </div>
      </aside>

      {/* NEW KNOT MODAL */}
      {showNewKnot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Create a new Knot</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Invite only. Your friends need a vote to join.</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an emoji</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['🍻','🏀','💼','🎮','🎵','🌍','🏕️','🎉','❤️','🔗'].map(e => (
                <span key={e} onClick={() => setNewKnotEmoji(e)}
                  style={{ fontSize: 20, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${newKnotEmoji === e ? 'var(--rust)' : 'var(--border)'}`, background: newKnotEmoji === e ? 'var(--rust-soft)' : 'transparent' }}>
                  {e}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Knot name</div>
            <input value={newKnotName} onChange={e => setNewKnotName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createKnot()}
              placeholder="e.g. The Brampton Crew"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />
            {knotError && <div style={{ padding: '8px 12px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, fontSize: 12, color: 'var(--rust)', marginBottom: 12 }}>{knotError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createKnot}
                style={{ flex: 1, padding: '10px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
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

      {/* RENAME KNOT MODAL */}
      {showRenameKnot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Rename Knot</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an emoji</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {['🍻','🏀','💼','🎮','🎵','🌍','🏕️','🎉','❤️','🔗'].map(e => (
                <span key={e} onClick={() => setNewKnotEmoji(e)}
                  style={{ fontSize: 20, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${newKnotEmoji === e ? 'var(--rust)' : 'var(--border)'}`, background: newKnotEmoji === e ? 'var(--rust-soft)' : 'transparent' }}>
                  {e}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Knot name</div>
            <input value={newKnotName} onChange={e => setNewKnotName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && renameKnot()}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={renameKnot}
                style={{ flex: 1, padding: '10px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Save changes
              </button>
              <button onClick={() => { setShowRenameKnot(false); setNewKnotName('') }}
                style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Your profile</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Visible to members of your Knots.</div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => document.getElementById('avatar-upload')?.click()}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar"
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--rust)' }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>
                    {editName ? editName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase() : initials}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--rust)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', border: '2px solid var(--bg2)' }}>+</div>
                <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !user) return
                    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
                    const allowedExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
                    const ext = (file.name.split('.').pop() || '').toLowerCase()
                    if (!allowed.has(file.type) || !allowedExts.has(ext)) {
                      setAvatarError('Only JPEG, PNG, WebP, or GIF images are allowed.')
                      return
                    }
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
              <div style={{ padding: '8px 12px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, fontSize: 12, color: 'var(--rust)', marginBottom: 12 }}>
                {avatarError}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Your name</div>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="Your name"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Email</div>
            <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
              {user?.email}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Budget comfort for a night out</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 6 }}>
              {[
                { id: 'casual',  symbol: '$',    label: 'Casual' },
                { id: 'mid',     symbol: '$$',   label: 'Mid' },
                { id: 'nice',    symbol: '$$$',  label: 'Nice' },
                { id: 'splurge', symbol: '$$$$', label: 'Splurge' },
              ].map(b => (
                <div key={b.id} onClick={() => setEditBudget(b.id)}
                  style={{ padding: '10px 6px', border: `1px solid ${editBudget === b.id ? 'var(--rust)' : 'var(--border2)'}`, borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: editBudget === b.id ? 'var(--rust-soft)' : 'transparent' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: editBudget === b.id ? 'var(--rust)' : 'var(--text)' }}>{b.symbol}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 20 }}>Never shown as a number to others</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveProfile} disabled={savingProfile || !editName.trim()}
                style={{ flex: 1, padding: '10px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: savingProfile ? 0.7 : 1 }}>
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
              <button onClick={() => setShowProfile(false)}
                style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 14 }}>
              <button onClick={() => { setShowProfile(false); signOut() }}
                style={{ width: '100%', padding: '9px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, color: 'var(--rust)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MORE DRAWER — mobile only */}
      {showMore && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} onClick={() => setShowMore(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 64, left: 0, right: 0, background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Your Knots</div>
            {knots.map(k => (
              <div key={k.id} onClick={() => switchKnot(k)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', background: activeKnot?.id === k.id ? 'var(--rust-soft)' : 'transparent', marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{k.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: activeKnot?.id === k.id ? 600 : 400, color: activeKnot?.id === k.id ? 'var(--rust)' : 'var(--text)' }}>{k.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
              </div>
            ))}
            <div onClick={() => { setShowMore(false); setShowNewKnot(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', color: 'var(--text3)', fontSize: 13, marginBottom: 4 }}>
              + New Knot
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', gap: 8 }}>
              {['Bills', 'Members', 'Games'].map(label => (
                <button key={label} onClick={() => { setActive(label.toLowerCase() === 'bills' ? 'split' : label.toLowerCase()); setShowMore(false) }}
                  style={{ flex: 1, padding: '9px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={() => { setShowMore(false); setShowProfile(true) }}
                style={{ width: '100%', padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                Edit profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div style={s.main}>
        <div style={s.topbar}>
          <button className="desktop-only" onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 18, padding: '4px', borderRadius: 6 }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <svg className="mobile-only" width="22" height="22" viewBox="0 0 44 44" fill="none">
              <circle cx="17" cy="17" r="10" stroke="var(--rust)" strokeWidth="3" fill="none"/>
              <circle cx="27" cy="27" r="10" stroke="var(--olive)" strokeWidth="3" fill="none"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeKnot ? `${activeKnot.emoji} ${activeKnot.name}` : 'Select a Knot'}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 4, flexShrink: 0 }}>
            {activeKnot ? `${activeKnot.count} members` : ''}
          </span>
          {activeKnot && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowKnotMenu(!showKnotMenu)}
                style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', cursor: 'pointer', fontSize: 16, padding: '4px 10px', fontFamily: 'inherit' }}>
                ⋯
              </button>
              {showKnotMenu && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px', minWidth: 180, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                  <div onClick={() => { setShowKnotMenu(false); setShowRenameKnot(true); setNewKnotName(activeKnot.name); setNewKnotEmoji(activeKnot.emoji) }}
                    style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    Rename Knot
                  </div>
                  <div onClick={() => { setShowKnotMenu(false); deleteKnot() }}
                    style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--rust)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--rust-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    Delete Knot
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="content-pad" style={s.content}>
          {!activeKnot ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>No Knots yet</div>
              <div style={{ fontSize: 14, color: 'var(--text2)' }}>Create your first Knot to get started.</div>
              <button onClick={() => setShowNewKnot(true)}
                style={{ padding: '10px 24px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Create a Knot
              </button>
            </div>
          ) : (
            <>
              {active === 'discover'  && <Discover  members={knotMembers} />}
              {active === 'feed'      && <Feed      members={knotMembers} knotName={activeKnot.name} knotId={activeKnot?.id} currentUser={profile} />}
              {active === 'hangout'   && <Hangout   members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'split'     && <BillSplit members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'members'   && <Members   members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'memories'  && <Memories  members={knotMembers} knotId={activeKnot?.id} />}
              {active === 'games'     && <Games     members={knotMembers} knotId={activeKnot?.id} currentUser={profile} />}
            </>
          )}
        </div>

        {/* BOTTOM NAV — mobile only */}
        <nav className="bottom-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, height: 64, background: 'var(--bg2)', borderTop: '1px solid var(--border)', zIndex: 40, alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
          {BOTTOM_NAV.map(n => {
            const isActive = n.id === 'more' ? showMore : active === n.id
            return (
              <button key={n.id}
                onClick={() => {
                  if (n.id === 'more') { setShowMore(!showMore) }
                  else { setActive(n.id); setShowMore(false) }
                }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flex: 1 }}>
                <div style={{ width: 24, height: 3, borderRadius: 2, background: isActive ? 'var(--rust)' : 'transparent', marginBottom: 2, transition: 'all 0.15s' }} />
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--rust)' : 'var(--text3)' }}>{n.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}