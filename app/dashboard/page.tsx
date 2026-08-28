'use client'

import HomeFeed from '@/components/HomeFeed'
import HomeEvents from '@/components/HomeEvents'
import HomeBills from '@/components/HomeBills'
import CrossKnotBalances from '@/components/CrossKnotBalances'
import { useState, useEffect } from 'react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import Feed from '@/components/Feed'
import VibesCounter from '@/components/VibesCounter'
import HangoutChatView from '@/components/HangoutChatView'
import { type OpenChatOpts } from '@/components/AttentionStrip'
import BillSplit from '@/components/BillSplit'
import Members from '@/components/Members'
import Memories from '@/components/Memories'
import Discover from '@/components/Discover'
import Games from '@/components/Games'
import Notifications from '@/components/Notifications'
import KnotGroupChat from '@/components/KnotGroupChat'
import { useToast } from '@/components/ToastProvider'
import DateTimePicker from '@/components/DateTimePicker'
import { CONFIRM, TOAST } from '@/lib/copy'
import { DIETARY_OPTIONS, ACCESSIBILITY_OPTIONS, ICON_SIZE, KNOT_ICONS, DEFAULT_KNOT_ICON, getKnotIcon } from '@/lib/constants'
import MemberAvatar from '@/components/MemberAvatar'
import KnotIcon from '@/components/KnotIcon'
import Onboarding from '@/components/Onboarding'
import { track } from '@/lib/track'

const TABS = [
  { id: 'feed',     label: 'Feed' },
  { id: 'memories', label: 'Photos' },
  { id: 'members',  label: 'People' },
  { id: 'discover', label: 'Discover' },
]

// icon holds a Tabler ti-* class suffix, not raw glyph content — see AGENTS.md icon audit notes.
const BOTTOM_NAV = [
  { id: 'feed',     label: 'Feed',    icon: 'ti-message-circle' },
  { id: 'memories', label: 'Photos',  icon: 'ti-photo' },
  { id: 'members',  label: 'People',  icon: 'ti-users' },
  { id: 'discover', label: 'Discover', icon: 'ti-compass' },
  { id: 'more',     label: 'More',    icon: 'ti-dots' },
]

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

// /[username] lives at the app root, so these would be shadowed by real routes.
// Keep in sync with profiles_username_not_reserved in
// supabase/migrations/20260818120000_public_profiles.sql.
const RESERVED_USERNAMES = new Set([
  'api', 'auth', 'dashboard', 'invite', 'merchant',
  'admin', 'settings', 'login', 'logout', 'signup', 'about',
  'help', 'support', 'terms', 'privacy', 'static', 'public', 'www',
])

const VISIBILITY = [
  { id: 'private',      label: 'Private',      hint: 'Only you can open your profile link.' },
  { id: 'members_only', label: 'Members Only', hint: 'Any signed-in Knot member can see it.' },
  { id: 'public',       label: 'Public',       hint: 'Anyone with the link, signed in or not.' },
] as const

const MEMBER_COLORS = [
  { bg: '#2A2A2A', text: '#F8BD03' },
  { bg: '#1A1A1A', text: '#F8BD03' },
  { bg: '#222222', text: '#F8BD03' },
  { bg: '#2E2E2E', text: '#F8BD03' },
  { bg: '#1E1E1E', text: '#F8BD03' },
]

function KnotIconPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, margin: '10px 0' }}>
      {KNOT_ICONS.map(k => (
        <button
          key={k.id}
          type="button"
          onClick={() => onChange(k.id)}
          title={k.label}
          style={{
            width: 44, height: 44, borderRadius: 10,
            background: value === k.id ? k.bg : 'var(--bg3)',
            border: value === k.id ? `2px solid ${k.color}` : '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'all 0.12s',
          }}
        >
          <i className={`ti ${k.icon}`} style={{ fontSize: 18, color: value === k.id ? k.color : 'var(--text3)' }} />
        </button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [active, setActive]                 = useState(() => {
    if (typeof window === 'undefined') return 'feed'
    return localStorage.getItem('active_tab') || 'feed'
  })
  const [activeKnot, setActiveKnot]         = useState<any>(null)
  const [homeTab, setHomeTab]               = useState<'feed' | 'events' | 'bills'>('feed')
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
  const [newKnotEmoji, setNewKnotEmoji]     = useState(DEFAULT_KNOT_ICON)
  const [knots, setKnots]                   = useState<any[]>([])
  const [knotMembers, setKnotMembers]       = useState<any[]>([])
  const [recentMedia, setRecentMedia]       = useState<{ id: string; url: string; media_type: string }[]>([])
  const [coverSignedUrl, setCoverSignedUrl] = useState<string | null>(null)
  const [editName, setEditName]             = useState('')
  const [editBudget, setEditBudget]         = useState('mid')
  const [editUsername, setEditUsername]     = useState('')
  const [editBio, setEditBio]               = useState('')
  const [editCity, setEditCity]             = useState('')
  const [editTier, setEditTier]             = useState<'private' | 'members_only' | 'public'>('private')
  const [editDietary, setEditDietary]       = useState<string[]>([])
  const [editAccessibility, setEditAccessibility] = useState<string[]>([])
  const [usernameCheck, setUsernameCheck]   = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [savingProfile, setSavingProfile]   = useState(false)
  const [knotError, setKnotError]           = useState('')
  const [avatarError, setAvatarError]       = useState('')
  const [profileError, setProfileError]     = useState('')

  const [showCreateEvent, setShowCreateEvent]     = useState(false)
  const [eventTitle, setEventTitle]               = useState('')
  const [eventWhen, setEventWhen]                 = useState<Date | null>(null)
  const [eventLocation, setEventLocation]         = useState('')
  const [eventDescription, setEventDescription]   = useState('')
  const [creatingEvent, setCreatingEvent]         = useState(false)
  const [eventError, setEventError]               = useState('')
  const [createdEventLink, setCreatedEventLink]   = useState<string | null>(null)
  const [activeChat, setActiveChat]               = useState<OpenChatOpts | null>(null)
  const [showGroupChat, setShowGroupChat]         = useState(false)
  const [showCrossKnotBalances, setShowCrossKnotBalances] = useState(false)

  function openHangoutChat(opts: OpenChatOpts | string) {
    setActiveChat(typeof opts === 'string' ? { hangoutId: opts } : opts)
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/'; return }
      setUser(data.user)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single()
      if (prof) {
        const rawAvatar = prof.avatar_url || null
        const signedAvatar = rawAvatar
          ? (rawAvatar.startsWith('http') ? rawAvatar : await getSignedUrl(rawAvatar))
          : null
        setProfile({ ...prof, avatar_url: signedAvatar || null, avatar_path: rawAvatar })
        setEditName(prof.name || '')
        setEditBudget(prof.budget_tier || 'mid')
        setEditUsername(prof.username || '')
        setEditBio(prof.bio || '')
        setEditCity(prof.resident_city || '')
        setEditTier(prof.privacy_tier || 'private')
        setEditDietary(prof.dietary_restrictions || [])
        setEditAccessibility(prof.accessibility_needs || [])
      }

      await loadKnots(data.user.id)
    })
    // Mount-only: establishes `user` for the first time, so `loadKnots`
    // (which closes over `user?.id` as a fallback) can't safely be a dep
    // here without re-firing this fetch right after setUser above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadKnots(userId?: string) {
    const uid = userId || user?.id
    if (!uid) return

    const { data: memberships } = await supabase
      .from('knot_members')
      .select('knot_id, knots(id, name, emoji, created_by, cover_url)')
      .eq('user_id', uid)

    if (memberships && memberships.length > 0) {
      const knotIds = memberships.map((m: any) => {
        const k = Array.isArray(m.knots) ? m.knots[0] : m.knots
        return k?.id
      }).filter(Boolean)
      const { data: memberCounts } = await supabase.from('knot_members').select('knot_id').in('knot_id', knotIds)
      const knotList = memberships.flatMap((m: any) => {
        const k = Array.isArray(m.knots) ? m.knots[0] : m.knots
        if (!k) return []
        const count = (memberCounts || []).filter((mc: any) => mc.knot_id === k.id).length
        return [{ id: k.id, name: k.name, emoji: k.emoji, count: count || 1, created_by: k.created_by, cover_url: k.cover_url || null }]
      })
      setKnots(knotList)
      const savedKnotId = localStorage.getItem('active_knot_id')
      const savedKnot = savedKnotId ? knotList.find(k => k.id === savedKnotId) : null
      const startKnot = savedKnot || knotList[0]
      const savedShowHome = localStorage.getItem('show_home')
      const savedActiveTab = localStorage.getItem('active_tab')
      if (savedShowHome === 'false' && savedKnot) {
        setShowHome(false)
        setActiveKnot(startKnot)
        if (savedActiveTab) setActive(savedActiveTab === 'hangout' ? 'feed' : savedActiveTab)
      } else {
        setActiveKnot(startKnot)
      }
      await loadKnotMembers(startKnot.id, uid)
      await loadRecentMedia(startKnot.id)
    } else {
      setShowHome(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('active_tab', active)
  }, [active])

  useEffect(() => {
    const url = activeKnot?.cover_url
    // Only render an <img> for real public http(s) URLs. Null/empty/legacy
    // storage paths must keep coverSignedUrl null so the placeholder shows.
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      setCoverSignedUrl(null)
      return
    }
    setCoverSignedUrl(url ? url.split('?')[0] + '?t=' + Date.now() : null)
  }, [activeKnot?.cover_url])

  async function loadKnotMembers(knotId: string, userId?: string) {
    const { data } = await supabase
      .from('knot_members')
      .select('user_id, role, profiles:user_id(id, name, avatar_url, username, dietary_restrictions, accessibility_needs)')
      .eq('knot_id', knotId)
    if (data) {
      const currentUserId = userId || user?.id
      setKnotMembers(data.map((m: any, i: number) => ({
        id:                     m.user_id,
        name:                   m.profiles?.name || 'Unknown',
        initials:               (m.profiles?.name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase(),
        avatar_url:             m.profiles?.avatar_url || null,
        username:               m.profiles?.username || null,
        color:                  MEMBER_COLORS[i % MEMBER_COLORS.length].bg,
        text:                   MEMBER_COLORS[i % MEMBER_COLORS.length].text,
        you:                    m.user_id === currentUserId,
        dietary_restrictions:   m.profiles?.dietary_restrictions || [],
        accessibility_needs:    m.profiles?.accessibility_needs || [],
      })))
    }
  }

  async function loadRecentMedia(knotId: string) {
    const { data } = await supabase
      .from('photos')
      .select('id, storage_path, media_type')
      .eq('knot_id', knotId)
      .order('created_at', { ascending: false })
      .limit(6)
    if (!data) { setRecentMedia([]); return }
    const withUrls = await Promise.all(
      data.map(async (p: any) => {
        const url = await getSignedUrl(p.storage_path)
        return { id: p.id, url: url ?? '', media_type: p.media_type ?? 'image' }
      })
    )
    setRecentMedia(withUrls.filter(p => p.url))
  }

  
  async function switchKnot(k: any) {
    // HomeFeed (and similar) pass partial knot objects without created_by/cover_url.
    // Always prefer the full knot from memberships state when available.
    if (!k?.id) return
    const knot = knots.find(x => x.id === k.id) || k
    if (!knot?.id) return
    setShowHome(false)
    setActiveKnot(knot)
    localStorage.setItem('active_knot_id', knot.id)
    localStorage.setItem('show_home', 'false')
    setShowKnotMenu(false)
    setShowMore(false)
    setShowKnotList(false)
    setActive('feed')
    await loadKnotMembers(knot.id)
    await loadRecentMedia(knot.id)
  }

  async function uploadCover(file: File) {
    if (!file || !user || !activeKnot) return
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const safeType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const coverPath = `${activeKnot.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('knot-covers')
      .upload(coverPath, file, { upsert: true, contentType: safeType })
    if (upErr) { toast.error('Upload failed'); return }
    const publicCoverUrl = `https://vcrnktkttgprbnoyjeff.supabase.co/storage/v1/object/public/knot-covers/${coverPath}`
    const { error: dbErr } = await supabase.from('knots').update({ cover_url: publicCoverUrl }).eq('id', activeKnot.id)
    if (dbErr) { toast.error('Could not save cover'); return }
    const updated = { ...activeKnot, cover_url: publicCoverUrl }
    setActiveKnot(updated)
    setCoverSignedUrl(publicCoverUrl)
    setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))
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
        const newK = { id: knot.id, name: knot.name, emoji: knot.emoji, count: 1, created_by: u.id, cover_url: null }
        track(supabase, 'knot_created', { knot_id: newK.id })
        setKnots(k => [...k, newK])
        setActiveKnot(newK)
        setCoverSignedUrl(null)
        await loadKnotMembers(newK.id)
        setNewKnotName('')
        setNewKnotEmoji(DEFAULT_KNOT_ICON)
        setShowNewKnot(false)
      }
    } catch { setKnotError('Could not create Knot. Please try again.') }
  }

  async function renameKnot() {
    if (!newKnotName.trim() || !activeKnot || !user) return
    setKnotError('')
    const { data, error } = await supabase
      .from('knots')
      .update({ name: newKnotName.trim(), emoji: newKnotEmoji })
      .eq('id', activeKnot.id)
      .eq('created_by', user.id)
      .select('id')
    if (error || !data?.length) {
      setKnotError('Only the founder can rename this Knot.')
      return
    }
    const updated = { ...activeKnot, name: newKnotName.trim(), emoji: newKnotEmoji, cover_url: activeKnot.cover_url || null }
    setKnots(ks => ks.map(k => k.id === activeKnot.id ? updated : k))
    setActiveKnot(updated)
    setShowRenameKnot(false)
    setNewKnotName('')
  }

  async function deleteKnot() {
    if (!activeKnot || !user) return
    if (!confirm(CONFIRM.DELETE_KNOT)) return
    setKnotError('')
    const { data, error } = await supabase
      .from('knots').delete()
      .eq('id', activeKnot.id)
      .eq('created_by', user.id)
      .select('id')
    if (error || !data?.length) {
      toast.error('Only the founder can delete this Knot.')
      return
    }
    toast.success(TOAST.KNOT_DELETED)
    const remaining = knots.filter(k => k.id !== activeKnot.id)
    setKnots(remaining)
    setActiveKnot(remaining[0] || null)
    if (remaining[0]) {
      await loadKnotMembers(remaining[0].id)
      await loadRecentMedia(remaining[0].id)
    } else {
      setKnotMembers([])
      setRecentMedia([])
      setShowHome(true)
      localStorage.setItem('show_home', 'true')
      localStorage.removeItem('active_knot_id')
    }
  }

  async function createEvent() {
    if (!eventTitle.trim()) { setEventError('Please enter a title.'); return }
    if (!eventWhen) { setEventError('Please pick a date and time.'); return }
    if (!user) return
    setCreatingEvent(true)
    setEventError('')

    const token = crypto.randomUUID()
    const { data, error } = await supabase.from('hangouts').insert({
      created_by:        user.id,
      knot_id:            null,
      title:               eventTitle.trim(),
      type:                'planned',
      status:              'confirmed',
      is_live:             false,
      scheduled_for:       eventWhen.toISOString(),
      venue_name:          eventLocation.trim() || null,
      brief:               eventDescription.trim() || null,
      is_standalone:       true,
      standalone_token:    token,
    }).select('standalone_token').single()

    if (error || !data) {
      setEventError('Could not create the event. Please try again.')
      setCreatingEvent(false)
      return
    }

    const link = `${window.location.origin}/event/${data.standalone_token}`
    setCreatedEventLink(link)
    navigator.clipboard.writeText(link).catch(() => {})
    setCreatingEvent(false)
  }

  function closeCreateEvent() {
    setShowCreateEvent(false)
    setEventTitle('')
    setEventWhen(null)
    setEventLocation('')
    setEventDescription('')
    setEventError('')
    setCreatedEventLink(null)
  }

  // Debounced availability hint. Runs through the is_username_available RPC
  // because profiles rows the viewer can't read would otherwise look free.
  useEffect(() => {
    const value = editUsername.trim()
    if (!value || value === (profile?.username || '') || usernameProblem(value)) {
      setUsernameCheck('idle')
      return
    }
    setUsernameCheck('checking')
    let cancelled = false
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('is_username_available', { p_username: value })
      if (cancelled) return
      setUsernameCheck(error ? 'idle' : data ? 'free' : 'taken')
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [editUsername, profile?.username])

  function usernameProblem(value: string): string {
    if (!USERNAME_RE.test(value)) return 'Usernames are 3–20 characters, letters, numbers and underscores only.'
    if (RESERVED_USERNAMES.has(value.toLowerCase())) return `“${value}” is reserved. Pick another.`
    return ''
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  async function saveProfile() {
    if (!editName.trim() || !user) return

    const username = editUsername.trim()
    const bio      = editBio.trim()
    const city     = editCity.trim()

    if (username) {
      const problem = usernameProblem(username)
      if (problem) { setProfileError(problem); return }
    } else if (editTier !== 'private') {
      setProfileError('Pick a username first — a shared profile needs a link.')
      return
    }
    if (bio.length > 300) { setProfileError('Bio is limited to 300 characters.'); return }

    setSavingProfile(true)
    setProfileError('')

    const patch = {
      name:                  editName.trim(),
      budget_tier:           editBudget,
      username:              username || null,
      bio:                   bio || null,
      resident_city:         city || null,
      privacy_tier:          editTier,
      dietary_restrictions:  editDietary,
      accessibility_needs:   editAccessibility,
    }

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) {
      // 23505 = unique violation on profiles_username_lower_key. The inline
      // availability hint is advisory; this is the check that actually holds.
      setProfileError(
        error.code === '23505'
          ? 'That username is already taken.'
          : 'Could not save profile. Please try again.'
      )
      setSavingProfile(false)
      return
    }
    setProfile({ ...profile, ...patch })
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

  const isFounder = activeKnot?.created_by === user.id

  return (
    <div style={{ minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif' }}>

      {profile && profile.onboarding_completed === false && (
        <Onboarding
          profile={profile}
          onComplete={() => {
            setProfile((p: any) => ({ ...p, onboarding_completed: true }))
            loadKnots()
          }}
        />
      )}

      {/* TOP GLOBAL NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)', height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12 }}>
        <div onClick={() => { setShowHome(true); setActiveKnot(null); localStorage.setItem('show_home', 'true') }} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer' }}>
          {/* Knot logomark — only permitted inline SVG in the codebase */}
          <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            kn<span style={{ color: 'var(--yellow)' }}>o</span>t
          </span>
        </div>

        <div style={{ position: 'relative', flex: 1 }}>
          <button onClick={() => setShowKnotList(!showKnotList)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
            <span style={{ maxWidth: 180, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              {activeKnot ? (
                <>
                  <KnotIcon value={activeKnot.emoji} size={22} iconSize={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeKnot.name}</span>
                </>
              ) : 'Select a Knot'}
            </span>
            <i className="ti ti-chevron-down" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} />
          </button>
          {showKnotList && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 8, minWidth: 220, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px', marginBottom: 4 }}>Your Knots</div>
              {knots.map(k => {
                const isActiveKnot = activeKnot?.id === k.id
                return (
                  <div key={k.id} onClick={() => switchKnot(k)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 999, cursor: 'pointer', background: isActiveKnot ? 'var(--pill-bg)' : 'transparent', marginBottom: 2 }}>
                    <KnotIcon value={k.emoji} size={24} iconSize={13} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActiveKnot ? 600 : 400, color: isActiveKnot ? 'var(--pill-text)' : 'var(--text)' }}>{k.name}</span>
                    <span style={{ fontSize: 11, color: isActiveKnot ? 'rgba(255,255,255,0.6)' : 'var(--text3)' }}>{k.count}</span>
                  </div>
                )
              })}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
                <div onClick={() => { setShowKnotList(false); setShowNewKnot(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--yellow)', fontWeight: 600 }}>
                  <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.inline, color: 'var(--yellow)' }} /> New Knot
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <VibesCounter userId={user?.id} userName={profile?.name} />
          <Notifications userId={user?.id || ''} knots={knots} onSelectKnot={(k) => switchKnot(k)} onOpenChat={openHangoutChat} />
          <button onClick={() => setShowProfile(true)}
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#111', border: profile?.equipped_ring_color ? `3px solid ${profile.equipped_ring_color}` : 'none', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, boxSizing: 'border-box' }}>
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
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 0 20px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', height: 180, background: coverSignedUrl ? 'transparent' : 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 50%, var(--bg4) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', borderRadius: 12, boxSizing: 'border-box' }}>
              {coverSignedUrl ? (
                <img src={coverSignedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', top: 0, left: 0 }} />
              ) : (
                <>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 50%, rgba(248,189,3,0.2) 0%, transparent 60%)' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(248,189,3,0.1) 0%, transparent 60%)' }} />
                  <span style={{ position: 'relative', zIndex: 1 }}><KnotIcon value={activeKnot.emoji} size={72} iconSize={36} /></span>
                </>
              )}
              {activeKnot.created_by === user.id && (
                <label style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 2, padding: '6px 12px', background: 'rgba(0,0,0,0.5)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {/* Deliberate exception to the 3-color icon rule: this label
                      sits over an arbitrary user cover photo, so it keeps the
                      same white as the text beside it rather than a fixed token. */}
                  {!activeKnot.cover_url && <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.inline, color: '#fff' }} />}
                  {activeKnot.cover_url ? 'Change cover' : 'Add cover'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) await uploadCover(file)
                    }}
                  />
                </label>
              )}
            </div>
            </div>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.5px' }}>{activeKnot.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text3)' }}>
                  <span>Private group</span>
                  <span>·</span>
                  <span>{activeKnot.count} member{activeKnot.count !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <div style={{ display: 'flex' }}>
                    {knotMembers.slice(0, 4).map((m, i) => (
                      <div key={m.id} style={{ borderRadius: '50%', border: '2px solid var(--bg)', marginLeft: i > 0 ? -6 : 0, lineHeight: 0 }}>
                        <MemberAvatar name={m.name} avatarUrl={m.avatar_url} size={20} textColor="#111" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isFounder && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowKnotMenu(!showKnotMenu)}
                      style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex' }}>
                      <i className="ti ti-dots" style={{ fontSize: ICON_SIZE.card, color: 'var(--text3)' }} />
                    </button>
                    {showKnotMenu && (
                      <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 6, minWidth: 180, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                        <div onClick={() => { setShowKnotMenu(false); setShowRenameKnot(true); setNewKnotName(activeKnot.name); setNewKnotEmoji(getKnotIcon(activeKnot.emoji).id) }}
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
                )}
              </div>
            </div>

            {/* TABS — desktop only */}
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '10px 20px', display: 'flex', gap: 4, borderTop: '1px solid var(--border)' }} className="desktop-only">
              {[...TABS, { id: 'split', label: 'Bills' }, { id: 'games', label: 'Games' }].map(t => (
                <button key={t.id} onClick={() => setActive(t.id)}
                  style={{ padding: '8px 16px', borderRadius: 999, background: active === t.id ? 'var(--pill-bg)' : 'none', border: 'none', color: active === t.id ? 'var(--pill-text)' : 'var(--text2)', fontSize: 14, fontWeight: active === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* TWO COLUMN CONTENT */}
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 20, alignItems: 'start', width: '100%', boxSizing: 'border-box', minWidth: 0, overflowX: 'hidden' }} className="desktop-layout">
            <div className="feed-shell">
              {active === 'discover'  && <Discover  members={knotMembers} currentUser={profile} />}
              {active === 'feed'      && (
                <Feed
                  members={knotMembers}
                  knotName={activeKnot.name}
                  knotEmoji={activeKnot.emoji}
                  knotId={activeKnot?.id}
                  currentUser={profile}
                  onOpenBills={() => setActive('split')}
                  onOpenChat={openHangoutChat}
                />
              )}
              {active === 'split'     && <BillSplit members={knotMembers} knotId={activeKnot?.id} currentUser={profile} />}
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
                    <KnotIcon value={activeKnot.emoji} size={28} iconSize={14} />
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{activeKnot.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-lock" style={{ fontSize: ICON_SIZE.inline, color: 'var(--yellow)' }} />
                    <span>Private · Invite only</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="ti ti-users" style={{ fontSize: ICON_SIZE.inline, color: 'var(--yellow)' }} />
                    <span>{activeKnot.count} member{activeKnot.count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Members</div>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{activeKnot.count}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {knotMembers.slice(0, 5).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <MemberAvatar name={m.name} avatarUrl={m.avatar_url || null} size={32} />
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
                  {recentMedia.length > 0 ? recentMedia.map(p => (
                    <div key={p.id} onClick={() => setActive('memories')} style={{ aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#000', cursor: 'pointer', border: '1px solid var(--border)' }}>
                      {p.media_type === 'video' ? (
                        <video src={p.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                  )) : (
                    <button onClick={() => setActive('memories')}
                      style={{ gridColumn: '1 / -1', aspectRatio: 'auto', minHeight: 88, borderRadius: 8, background: 'var(--bg3)', border: '1px dashed var(--border2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', color: 'var(--text3)' }}>
                      <i className="ti ti-photo" style={{ fontSize: ICON_SIZE.nav, color: 'var(--text3)' }} />
                      <span style={{ fontSize: 12 }}>No photos yet — add some</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {activeKnot && (
            <button onClick={() => setShowGroupChat(true)} aria-label="Group chat"
              style={{ position: 'fixed', bottom: 72, right: 16, width: 52, height: 52, borderRadius: '50%', background: '#111', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
              <i className="ti ti-message-circle" style={{ fontSize: 22, color: '#F8BD03' }} />
            </button>
          )}
        </>

      ) : showHome ? (
        /* HOME FEED */
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }} className="desktop-layout">
          <div>
            
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {([
                { id: 'feed' as const, label: 'Feed' },
                { id: 'events' as const, label: 'Events' },
                { id: 'bills' as const, label: 'Bills' },
              ]).map(t => (
                <button key={t.id} onClick={() => setHomeTab(t.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 8,
                    border: `1px solid ${homeTab === t.id ? 'var(--yellow)' : 'var(--border2)'}`,
                    background: homeTab === t.id ? 'var(--yellow-soft)' : 'transparent',
                    color: homeTab === t.id ? 'var(--yellow)' : 'var(--text2)',
                    fontSize: 13, fontWeight: homeTab === t.id ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {homeTab === 'feed' && (
              <HomeFeed knots={knots} onSelectKnot={(k) => switchKnot(k)} />
            )}
            {homeTab === 'events' && (
              <HomeEvents knots={knots} onOpenKnotTab={(k, tabId) => { switchKnot(k); setActive(tabId) }} />
            )}
            {homeTab === 'bills' && (
              <HomeBills
                knots={knots}
                currentUser={profile}
                onOpenKnotTab={(k, tabId) => { switchKnot(k); setActive(tabId) }}
                onOpenCrossKnot={() => setShowCrossKnotBalances(true)}
              />
            )}
          </div>
          <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Your Knots</div>
              {knots.map(k => (
                <div key={k.id} onClick={() => switchKnot(k)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <KnotIcon value={k.emoji} size={28} iconSize={14} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{k.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.count}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowNewKnot(true)}
              style={{ width: '100%', padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.inline, color: '#111' }} /> New Knot
            </button>
            <button onClick={() => setShowCreateEvent(true)}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Create event
            </button>
          </div>
        </div>

      ) : (
        /* NO KNOTS */
        <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.header, color: '#111' }} />
          </div>
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
          <nav className="bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', height: 64, background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', zIndex: 100, alignItems: 'center', justifyContent: 'space-around', padding: '6px 8px', paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}>
            {BOTTOM_NAV.map(n => {
              const isActive = n.id === 'more' ? showMore : active === n.id
              return (
                <button key={n.id}
                  onClick={() => {
                    if (n.id === 'more') { setShowMore(!showMore) }
                    else { setActive(n.id); setShowMore(false); setShowHome(false) }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 12px', borderRadius: 999, background: isActive ? 'var(--pill-bg)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <i className={`ti ${n.icon}`} style={{ fontSize: ICON_SIZE.nav, color: isActive ? 'var(--pill-text)' : 'var(--text3)' }} />
                  <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 400, color: isActive ? 'var(--pill-text)' : 'var(--text3)' }}>{n.label}</span>
                </button>
              )
            })}
          </nav>

          {showMore && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }} onClick={() => setShowMore(false)}>
              <div onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', bottom: 60, left: 0, right: 0, background: 'var(--bg2)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Navigate</div>
                {[
                  { id: 'home', label: 'Home', icon: 'ti-home' },
                  { id: 'split', label: 'Bills', icon: 'ti-receipt' },
                  { id: 'games', label: 'Games', icon: 'ti-device-gamepad-2' },
                ].map(n => (
                  <button key={n.id} onClick={() => {
                    if (n.id === 'home') {
                      setShowHome(true); setShowMore(false)
                      localStorage.setItem('show_home', 'true')
                    } else {
                      setActive(n.id); setShowMore(false)
                    }
                  }}
                    style={{ width: '100%', padding: '11px 12px', background: active === n.id && n.id !== 'home' ? 'var(--yellow-soft)' : 'transparent', border: 'none', borderRadius: 8, color: active === n.id && n.id !== 'home' ? 'var(--yellow)' : 'var(--text)', fontSize: 14, fontWeight: active === n.id && n.id !== 'home' ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className={`ti ${n.icon}`} style={{ fontSize: ICON_SIZE.nav, color: active === n.id && n.id !== 'home' ? 'var(--yellow)' : 'var(--text3)' }} />
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
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an icon</div>
            <KnotIconPicker value={newKnotEmoji} onChange={setNewKnotEmoji} />
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

      {/* CREATE EVENT MODAL */}
      {showCreateEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            {createdEventLink ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Event created</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Share this link — anyone with it can view and RSVP.</div>
                <div style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12, color: 'var(--text)', wordBreak: 'break-all', marginBottom: 16 }}>
                  {createdEventLink}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(createdEventLink).catch(() => {}); toast.success('Link copied') }}
                    style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Copy link
                  </button>
                  <button onClick={closeCreateEvent}
                    style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>Create event</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>A one-time event outside any Knot. Anyone with the link can RSVP.</div>

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Title</div>
                <input value={eventTitle} onChange={e => setEventTitle(e.target.value)}
                  placeholder="e.g. Rooftop birthday party"
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Date and time</div>
                <div style={{ marginBottom: 16 }}>
                  <DateTimePicker value={eventWhen} onChange={setEventWhen} minDate={new Date()} />
                </div>

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Location</div>
                <input value={eventLocation} onChange={e => setEventLocation(e.target.value)}
                  placeholder="Address or venue name"
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />

                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Description (optional)</div>
                <textarea value={eventDescription} onChange={e => setEventDescription(e.target.value)}
                  placeholder="What's the plan?"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: 16 }} />

                <div style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                  Invite mode: anyone with the link can view and RSVP.
                </div>

                {eventError && <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger-dim)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{eventError}</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createEvent} disabled={creatingEvent}
                    style={{ flex: 1, padding: '10px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: creatingEvent ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: creatingEvent ? 0.6 : 1 }}>
                    {creatingEvent ? 'Creating...' : 'Create event'}
                  </button>
                  <button onClick={closeCreateEvent}
                    style={{ padding: '10px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* RENAME KNOT MODAL */}
      {showRenameKnot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Rename Knot</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Choose an icon</div>
            <KnotIconPicker value={newKnotEmoji} onChange={setNewKnotEmoji} />
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
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg2)' }}>
                  <i className="ti ti-plus" style={{ fontSize: ICON_SIZE.inline, color: '#111' }} />
                </div>
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
                    const signedUrl = await getSignedUrl(safePath)
                    await supabase.from('profiles').update({ avatar_url: safePath }).eq('id', user.id)
                    setProfile((p: any) => ({ ...p, avatar_url: signedUrl || null, avatar_path: safePath }))
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

            {/* PUBLIC PROFILE SETTINGS */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Public profile</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
                Your profile page, shared by link. You control who can open it.
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Username</div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg3)', border: `1px solid ${usernameCheck === 'taken' ? 'var(--danger-dim)' : 'var(--border2)'}`, borderRadius: 8, paddingLeft: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>@</span>
                <input value={editUsername}
                  onChange={e => setEditUsername(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20))}
                  placeholder="yourname"
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  style={{ flex: 1, padding: '10px 12px 10px 2px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
                {usernameCheck === 'checking' && <span style={{ fontSize: 11, color: 'var(--text3)', paddingRight: 12 }}>checking…</span>}
                {usernameCheck === 'free'     && <span style={{ fontSize: 11, color: 'var(--sage)', paddingRight: 12, fontWeight: 600 }}>available</span>}
                {usernameCheck === 'taken'    && <span style={{ fontSize: 11, color: 'var(--danger)', paddingRight: 12, fontWeight: 600 }}>taken</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>
                {editUsername
                  ? <>knot.app/{editUsername} · 3–20 characters, letters, numbers and underscores</>
                  : <>3–20 characters, letters, numbers and underscores</>}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>City</div>
              <input value={editCity} onChange={e => setEditCity(e.target.value.slice(0, 80))}
                placeholder="Where you're based"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Bio</div>
              <textarea value={editBio} onChange={e => setEditBio(e.target.value.slice(0, 300))}
                placeholder="A line or two about you"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', marginBottom: 4 }} />
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginBottom: 16 }}>{editBio.length}/300</div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Who can see your profile</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {VISIBILITY.map(v => (
                  <div key={v.id} onClick={() => setEditTier(v.id)}
                    style={{ display: 'flex', gap: 10, padding: '10px 12px', border: `1px solid ${editTier === v.id ? 'var(--yellow)' : 'var(--border2)'}`, borderRadius: 8, cursor: 'pointer', background: editTier === v.id ? 'var(--yellow-soft)' : 'transparent' }}>
                    <div style={{ width: 15, height: 15, borderRadius: '50%', marginTop: 1, flexShrink: 0, border: `1px solid ${editTier === v.id ? 'var(--yellow)' : 'var(--border2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {editTier === v.id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--yellow)' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{v.hint}</div>
                    </div>
                  </div>
                ))}
              </div>

              {editUsername && editTier !== 'private' && (
                <a href={`/${editUsername}`} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 16 }}>
                  View your profile <i className="ti ti-chevron-right" style={{ fontSize: ICON_SIZE.inline, color: 'var(--text3)' }} />
                </a>
              )}
              {(!editUsername || editTier === 'private') && <div style={{ marginBottom: 16 }} />}
            </div>

            {/* RESTRICTIONS */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginBottom: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2, fontWeight: 600 }}>Dietary restrictions</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Shared with organizers and merchants for group orders</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                {DIETARY_OPTIONS.map(opt => {
                  const selected = editDietary.includes(opt.id)
                  return (
                    <button key={opt.id} onClick={() => toggleTag(editDietary, setEditDietary, opt.id)}
                      style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${selected ? 'var(--yellow)' : 'var(--border2)'}`, background: selected ? 'var(--yellow-soft)' : 'transparent', color: selected ? 'var(--yellow)' : 'var(--text3)', fontSize: 12, fontWeight: selected ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2, fontWeight: 600 }}>Accessibility needs</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Helps us filter venues that work for everyone</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {ACCESSIBILITY_OPTIONS.map(opt => {
                  const selected = editAccessibility.includes(opt.id)
                  return (
                    <button key={opt.id} onClick={() => toggleTag(editAccessibility, setEditAccessibility, opt.id)}
                      style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${selected ? 'var(--yellow)' : 'var(--border2)'}`, background: selected ? 'var(--yellow-soft)' : 'transparent', color: selected ? 'var(--yellow)' : 'var(--text3)', fontSize: 12, fontWeight: selected ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {profileError && (
              <div style={{ padding: '8px 12px', background: 'var(--danger-soft)', border: '1px solid var(--danger-dim)', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{profileError}</div>
            )}

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

      {activeChat && (
        <>
          <div
            className="hangout-chat-backdrop"
            onClick={() => setActiveChat(null)}
          />
          <div className="hangout-chat-panel">
            <HangoutChatView
              hangoutId={activeChat.hangoutId}
              knotId={activeKnot?.id}
              currentUser={profile ?? { id: user!.id, name: (user!.user_metadata?.name as string) || 'You' }}
              scrollTarget={activeChat.scrollTarget ?? null}
              scrollToBottom={activeChat.scrollToBottom ?? true}
              autoJoinCall={activeChat.autoJoinCall ?? false}
              onClose={() => setActiveChat(null)}
            />
          </div>
        </>
      )}

      {showGroupChat && activeKnot && (
        <>
          <div
            onClick={() => setShowGroupChat(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 398 }}
          />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480, background: '#F5F3EE', zIndex: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <KnotGroupChat
              knotId={activeKnot.id}
              knotName={activeKnot.name}
              knotEmoji={activeKnot.emoji}
              members={knotMembers}
              currentUser={profile ?? { id: user!.id, name: user!.user_metadata?.name || 'You' }}
              onClose={() => setShowGroupChat(false)}
              onOpenHangout={(hangoutId: string) => { setShowGroupChat(false); openHangoutChat({ hangoutId }) }}
            />
          </div>
        </>
      )}

      {showCrossKnotBalances && profile && (
        <CrossKnotBalances
          currentUser={profile}
          knots={knots}
          onClose={() => setShowCrossKnotBalances(false)}
          onOpenKnot={(k) => {
            setShowCrossKnotBalances(false)
            switchKnot(k)
            setActive('split')
          }}
        />
      )}
    </div>
  )
}




















