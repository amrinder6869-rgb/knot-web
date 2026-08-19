'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Lock, MapPin, Users, CalendarCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type PublicProfile = {
  id: string | null
  username: string
  name: string | null
  bio: string | null
  resident_city: string | null
  avatar_url: string | null
  privacy_tier: 'private' | 'members_only' | 'public'
  hangouts_attended: number | null
  hangouts_organised: number | null
  is_owner: boolean
  locked: boolean
}

const TIER_BADGE: Record<PublicProfile['privacy_tier'], { label: string; color: string; bg: string; border: string }> = {
  public:       { label: 'Public',       color: 'var(--sage)',   bg: 'var(--sage-soft)',   border: 'var(--sage-dim)' },
  members_only: { label: 'Members Only', color: 'var(--amber)',  bg: 'var(--amber-soft)',  border: 'var(--border2)' },
  private:      { label: 'Private',      color: 'var(--text2)',  bg: 'var(--bg3)',         border: 'var(--border2)' },
}

function initialsOf(name: string | null, username: string) {
  const source = name?.trim() || username
  return source
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)

  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Resolve the session first: get_public_profile keys off auth.uid(), so
      // calling before the client has rehydrated would gate the owner out of
      // their own profile.
      const { data: auth } = await supabase.auth.getUser()
      if (cancelled) return
      setSignedIn(!!auth.user)

      const { data, error } = await supabase
        .rpc('get_public_profile', { p_username: username })
      if (cancelled) return

      if (error) { setStatus('error'); return }

      const row = (data as PublicProfile[] | null)?.[0]
      if (!row) { setStatus('notfound'); return }

      setProfile(row)
      setStatus('ready')
    }

    load()
    return () => { cancelled = true }
  }, [username])

  if (status === 'loading') return <Centered>Loading…</Centered>

  if (status === 'error') return (
    <Centered>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Something went wrong</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>We couldn&apos;t load this profile. Try again in a moment.</div>
    </Centered>
  )

  if (status === 'notfound' || !profile) return (
    <Centered>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No such profile</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>Nobody on Knot goes by @{username}.</div>
    </Centered>
  )

  const badge = TIER_BADGE[profile.privacy_tier] ?? TIER_BADGE.private

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif', display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>

          {/* Avatar initials */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div style={{ width: 76, height: 76, borderRadius: '50%', background: profile.locked ? 'var(--bg3)' : 'var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: profile.locked ? 'var(--text3)' : '#111' }}>
              {profile.locked ? <Lock size={26} /> : initialsOf(profile.name, profile.username)}
            </div>
          </div>

          {/* Identity */}
          <div style={{ textAlign: 'center' }}>
            {!profile.locked && profile.name && (
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>{profile.name}</div>
            )}
            <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: profile.locked ? 0 : 2 }}>@{profile.username}</div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: badge.bg, border: `1px solid ${badge.border}`, fontSize: 11, fontWeight: 600, color: badge.color }}>
                {profile.privacy_tier !== 'public' && <Lock size={11} />}
                {badge.label}
              </span>
            </div>
          </div>

          {profile.locked ? (
            <LockedState tier={profile.privacy_tier} signedIn={signedIn} />
          ) : (
            <>
              {profile.resident_city && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 14, fontSize: 13, color: 'var(--text2)' }}>
                  <MapPin size={13} />
                  {profile.resident_city}
                </div>
              )}

              {profile.bio && (
                <p style={{ margin: '18px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text2)', textAlign: 'center', whiteSpace: 'pre-wrap' }}>
                  {profile.bio}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 }}>
                <Stat Icon={CalendarCheck} value={profile.hangouts_attended ?? 0} label="Hangouts attended" />
                <Stat Icon={Users}         value={profile.hangouts_organised ?? 0} label="Hangouts organised" />
              </div>
            </>
          )}
        </div>

        {profile.is_owner && (
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            This is your profile. Change what others see in{' '}
            <Link href="/dashboard" style={{ color: 'var(--text2)', fontWeight: 600 }}>Profile settings</Link>.
          </div>
        )}
      </div>
    </div>
  )
}

function LockedState({ tier, signedIn }: { tier: PublicProfile['privacy_tier']; signedIn: boolean }) {
  const membersOnlyNeedsSignIn = tier === 'members_only' && !signedIn

  return (
    <div style={{ marginTop: 22, padding: '22px 18px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        {membersOnlyNeedsSignIn ? 'Members only' : 'This profile is private'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
        {membersOnlyNeedsSignIn
          ? 'Sign in to Knot to see this profile.'
          : 'The person who owns this profile has chosen not to share it.'}
      </div>
      {membersOnlyNeedsSignIn && (
        <Link href="/" style={{ display: 'inline-block', marginTop: 14, padding: '9px 18px', background: 'var(--yellow)', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          Sign in
        </Link>
      )}
    </div>
  )
}

function Stat({ Icon, value, label }: { Icon: typeof Users; value: number; label: string }) {
  return (
    <div style={{ padding: '14px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
      <Icon size={15} color="var(--text3)" />
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Manrope, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: 'var(--text2)', fontSize: 14 }}>
      {children}
    </div>
  )
}
