'use client'
// Full-screen two-step onboarding modal, shown once when profile.onboarding_completed is false.
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { track } from '@/lib/track'
import { DIETARY_OPTIONS } from '@/lib/constants'
import { ONBOARDING_SUBTITLE } from '@/lib/copy'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

// Keep in sync with RESERVED_USERNAMES in app/dashboard/page.tsx and
// profiles_username_not_reserved in supabase/migrations/20260818120000_public_profiles.sql.
const RESERVED_USERNAMES = new Set([
  'api', 'auth', 'dashboard', 'invite', 'merchant',
  'admin', 'settings', 'login', 'logout', 'signup', 'about',
  'help', 'support', 'terms', 'privacy', 'static', 'public', 'www',
])

const TASTE_CATEGORIES = [
  { id: 'restaurants', label: 'Restaurants',      icon: String.fromCodePoint(0x1F37D) },
  { id: 'bars',         label: 'Bars and drinks',  icon: String.fromCodePoint(0x1F378) },
  { id: 'coffee',       label: 'Coffee shops',     icon: String.fromCodePoint(0x2615) },
  { id: 'outdoors',     label: 'Outdoors',         icon: String.fromCodePoint(0x1F333) },
  { id: 'arts',         label: 'Arts and culture', icon: String.fromCodePoint(0x1F3A8) },
  { id: 'sports',       label: 'Sports',           icon: String.fromCodePoint(0x26BD) },
  { id: 'live_music',   label: 'Live music',       icon: String.fromCodePoint(0x1F3B5) },
  { id: 'movies',       label: 'Movies',           icon: String.fromCodePoint(0x1F3AC) },
  { id: 'gaming',       label: 'Gaming',           icon: String.fromCodePoint(0x1F3AE) },
  { id: 'fitness',      label: 'Fitness',          icon: String.fromCodePoint(0x1F4AA) },
]

const ONBOARDING_DIETARY_OPTIONS = DIETARY_OPTIONS.filter(o => o.id !== 'other')

const GROUP_SIZE_OPTIONS = [
  { id: 'pair',   label: 'Just us 2-3' },
  { id: 'small',  label: 'Small crew 4-6' },
  { id: 'big',    label: 'Big group 7-12' },
  { id: 'varies', label: 'Varies' },
]

const SPEND_OPTIONS = [
  { id: 'under_20', label: 'Under $20' },
  { id: '20_50',    label: '$20-50' },
  { id: '50_100',   label: '$50-100' },
  { id: 'splurge',  label: 'Splurge' },
]

type DietaryState = 'unset' | 'prefer' | 'avoid'

function nextDietaryState(s: DietaryState): DietaryState {
  if (s === 'unset') return 'prefer'
  if (s === 'prefer') return 'avoid'
  return 'unset'
}

export default function Onboarding({ profile, onComplete }: { profile: any, onComplete: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [screen, setScreen] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(profile?.name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [city, setCity] = useState(profile?.resident_city || '')
  const [dob, setDob] = useState(profile?.dob || '')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url || null)
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState('')

  const [tasteCategories, setTasteCategories] = useState<string[]>([])
  const [dietary, setDietary] = useState<Record<string, DietaryState>>({})
  const [groupSize, setGroupSize] = useState('')
  const [spend, setSpend] = useState('')

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    track(supabase, 'onboarding_started')
  }, [])

  useEffect(() => {
    let cancelled = false
    if (avatarPath && !avatarPath.startsWith('http')) {
      getSignedUrl(avatarPath).then(url => { if (!cancelled) setAvatarSignedUrl(url || null) })
    } else {
      setAvatarSignedUrl(avatarPath)
    }
    return () => { cancelled = true }
  }, [avatarPath])

  useEffect(() => {
    const value = username.trim()
    if (!value || value === (profile?.username || '') || usernameProblem(value)) {
      setUsernameCheck('idle')
      return
    }
    setUsernameCheck('checking')
    let cancelled = false
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('is_username_available', { p_username: value })
      if (cancelled) return
      setUsernameCheck(rpcError ? 'idle' : data ? 'free' : 'taken')
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [username, profile?.username])

  function usernameProblem(value: string): string {
    if (!USERNAME_RE.test(value)) return 'Usernames are 3–20 characters, letters, numbers and underscores only.'
    if (RESERVED_USERNAMES.has(value.toLowerCase())) return `"${value}" is reserved. Pick another.`
    return ''
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile?.id) return
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    const allowedExts = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!allowed.has(file.type) || !allowedExts.has(ext)) { setAvatarError('Only JPEG, PNG, WebP, or GIF images are allowed.'); return }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Max 2 MB for avatar.'); return }
    setAvatarError('')
    const safeType = file.type === 'image/png' ? 'image/png' : file.type === 'image/gif' ? 'image/gif' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const safePath = `avatars/${profile.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('knot-photos').upload(safePath, file, { upsert: true, contentType: safeType })
    if (upErr) { setAvatarError('Upload failed. Please try again.'); return }
    await supabase.from('profiles').update({ avatar_url: safePath }).eq('id', profile.id)
    setAvatarPath(safePath)
  }

  async function handleContinue() {
    if (!name.trim() || !profile?.id) return
    const trimmedUsername = username.trim()
    if (trimmedUsername) {
      const problem = usernameProblem(trimmedUsername)
      if (problem) { setError(problem); return }
      if (usernameCheck === 'taken') { setError('That username is already taken.'); return }
    }
    setSaving(true)
    setError('')

    const { error: updateError } = await supabase.from('profiles').update({
      name: name.trim(),
      username: trimmedUsername || null,
      resident_city: city.trim() || null,
      dob: dob || null,
    }).eq('id', profile.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.code === '23505' ? 'That username is already taken.' : 'Could not save. Please try again.')
      return
    }
    setScreen(2)
  }

  function toggleTaste(id: string) {
    setTasteCategories(prev => {
      if (prev.includes(id)) return prev.filter(t => t !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  function cycleDietary(id: string) {
    setDietary(prev => ({ ...prev, [id]: nextDietaryState(prev[id] || 'unset') }))
  }

  async function finish(skipped: boolean) {
    if (!profile?.id || saving) return
    setSaving(true)
    setError('')

    if (skipped) {
      const { error: updateError } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', profile.id)
      setSaving(false)
      if (updateError) { setError('Could not save. Please try again.'); return }
      track(supabase, 'onboarding_completed', { skipped: true })
      onComplete()
      return
    }

    const dietaryPreferences: Record<string, DietaryState> = {}
    Object.entries(dietary).forEach(([id, state]) => {
      if (state !== 'unset') dietaryPreferences[id] = state
    })

    const { error: updateError } = await supabase.from('profiles').update({
      taste_categories: tasteCategories,
      dietary_preferences: dietaryPreferences,
      typical_group_size: groupSize || null,
      typical_spend: spend || null,
      onboarding_completed: true,
    }).eq('id', profile.id)

    setSaving(false)
    if (updateError) { setError('Could not save. Please try again.'); return }
    track(supabase, 'onboarding_completed', { skipped: false })
    onComplete()
  }

  if (!mounted) return null

  const initials = (name || 'U').split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 24px 48px' }}>

        {screen === 1 ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Set up your profile</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>{ONBOARDING_SUBTITLE}</div>

            {error && (
              <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => document.getElementById('onboarding-avatar-upload')?.click()}>
                {avatarSignedUrl ? (
                  <img src={avatarSignedUrl} alt="avatar" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--yellow)' }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#111' }}>
                    {initials}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#111', fontWeight: 700, border: '2px solid var(--bg)' }}>+</div>
                <input id="onboarding-avatar-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>
            </div>
            {avatarError && (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>{avatarError}</div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Display name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Username</div>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg3)', border: `1px solid ${usernameCheck === 'taken' ? 'var(--danger-dim)' : 'var(--border2)'}`, borderRadius: 8, paddingLeft: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>@</span>
              <input value={username}
                onChange={e => setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20))}
                placeholder="yourname" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ flex: 1, padding: '10px 12px 10px 2px', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
              {usernameCheck === 'checking' && <span style={{ fontSize: 11, color: 'var(--text3)', paddingRight: 12 }}>checking…</span>}
              {usernameCheck === 'free'     && <span style={{ fontSize: 11, color: 'var(--sage)', paddingRight: 12, fontWeight: 600 }}>available</span>}
              {usernameCheck === 'taken'    && <span style={{ fontSize: 11, color: 'var(--danger)', paddingRight: 12, fontWeight: 600 }}>taken</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>Optional — 3–20 characters, letters, numbers and underscores</div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Where are you based?</div>
            <input value={city} onChange={e => setCity(e.target.value.slice(0, 80))} placeholder="City"
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16 }} />

            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Your birthday</div>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 28 }} />

            <button onClick={handleContinue} disabled={!name.trim() || saving}
              style={{ width: '100%', padding: '12px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: (!name.trim() || saving) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: (!name.trim() || saving) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Help us find better plans for you</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
              Your preferences stay private. We use these to suggest venues and filter Discover.
            </div>

            {error && (
              <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>
            )}

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              What are you into? <span style={{ textTransform: 'none', fontWeight: 400 }}>(up to 5)</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {TASTE_CATEGORIES.map(t => {
                const selected = tasteCategories.includes(t.id)
                const disabled = !selected && tasteCategories.length >= 5
                return (
                  <button key={t.id} onClick={() => toggleTaste(t.id)} disabled={disabled}
                    style={{
                      padding: '7px 14px', borderRadius: 999,
                      border: `1px solid ${selected ? 'var(--yellow)' : 'var(--border2)'}`,
                      background: selected ? 'var(--yellow)' : 'var(--bg3)',
                      color: selected ? '#111' : 'var(--text2)',
                      fontSize: 13, fontWeight: selected ? 700 : 500,
                      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      opacity: disabled ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Dietary
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Tap to cycle: no preference &rarr; prefer &rarr; avoid</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {ONBOARDING_DIETARY_OPTIONS.map(d => {
                const state: DietaryState = dietary[d.id] || 'unset'
                const border = state === 'prefer' ? 'var(--yellow)' : state === 'avoid' ? 'var(--danger)' : 'var(--border2)'
                const bg     = state === 'prefer' ? 'var(--yellow-soft)' : state === 'avoid' ? 'var(--danger-soft)' : 'var(--bg3)'
                const color  = state === 'prefer' ? 'var(--yellow)' : state === 'avoid' ? 'var(--danger)' : 'var(--text2)'
                return (
                  <button key={d.id} onClick={() => cycleDietary(d.id)}
                    style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${border}`, background: bg, color, fontSize: 13, fontWeight: state === 'unset' ? 500 : 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {d.label}{state !== 'unset' && ` · ${state}`}
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Typical group size
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {GROUP_SIZE_OPTIONS.map(g => (
                <button key={g.id} onClick={() => setGroupSize(groupSize === g.id ? '' : g.id)}
                  style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${groupSize === g.id ? 'var(--yellow)' : 'var(--border2)'}`, background: groupSize === g.id ? 'var(--yellow)' : 'var(--bg3)', color: groupSize === g.id ? '#111' : 'var(--text2)', fontSize: 13, fontWeight: groupSize === g.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {g.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Typical spend per person
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {SPEND_OPTIONS.map(s => (
                <button key={s.id} onClick={() => setSpend(spend === s.id ? '' : s.id)}
                  style={{ padding: '7px 14px', borderRadius: 999, border: `1px solid ${spend === s.id ? 'var(--yellow)' : 'var(--border2)'}`, background: spend === s.id ? 'var(--yellow)' : 'var(--bg3)', color: spend === s.id ? '#111' : 'var(--text2)', fontSize: 13, fontWeight: spend === s.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {s.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => finish(true)} disabled={saving}
                style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                Skip for now
              </button>
              <button onClick={() => finish(false)} disabled={saving}
                style={{ flex: 1, padding: '12px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Done'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
