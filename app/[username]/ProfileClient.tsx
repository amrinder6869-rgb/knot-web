'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, MapPin, Users, CalendarCheck } from 'lucide-react'
import { supabase, getSignedUrl } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'

type PrivacyTier = 'private' | 'members_only' | 'public'

type Highlight = {
  id: string
  photo_id: string
  storage_path: string | null
  caption: string | null
  media_type: string | null
  sort_order: number
}

type PlaceVisit = {
  place_id: string
  name: string | null
  lat: number | null
  lng: number | null
  count: number
}

// Shape of the jsonb object returned by the get_public_profile RPC. Field
// availability differs between the locked and unlocked branches server-side
// (e.g. locked responses carry `tier`, not `privacy_tier`), so most fields
// beyond `found`/`locked`/`username`/`name` are optional here.
type PublicProfile = {
  found: boolean
  locked: boolean
  tier?: PrivacyTier
  username: string
  name: string | null
  bio?: string | null
  resident_city?: string | null
  avatar_url?: string | null
  privacy_tier?: PrivacyTier
  id?: string | null
  is_owner?: boolean
  attended?: number
  organised?: number
  followers?: number
  connections?: number
  follow_status?: 'pending' | 'accepted' | 'declined' | null
  highlights?: Highlight[]
  places?: PlaceVisit[]
}

const TIER_BADGE: Record<PrivacyTier, { label: string; color: string; bg: string; border: string }> = {
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

export default function ProfileClient({ username }: { username: string }) {
  const router = useRouter()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function load() {
      // Resolve the session first: get_public_profile keys off auth.uid(), so
      // calling before the client has rehydrated would gate the owner out of
      // their own profile.
      await supabase.auth.getUser()
      if (cancelled) return

      const { data, error } = await supabase
        .rpc('get_public_profile', { p_username: username })
      if (cancelled) return

      if (error) { setStatus('error'); return }

      // The RPC returns a single jsonb object, not a row set.
      const row = data as PublicProfile | null
      if (!row || !row.found) { setStatus('notfound'); return }

      setProfile(row)
      setStatus('ready')
    }

    load()
    return () => { cancelled = true }
  }, [username])

  function updateProfile(patch: Partial<PublicProfile>) {
    setProfile(p => p ? { ...p, ...patch } : p)
  }

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
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Nobody on Knot goes by @{username}.</div>
      <BackHomeActions onBack={() => router.back()} />
    </Centered>
  )

  const tier = profile.privacy_tier ?? profile.tier ?? 'private'
  const badge = TIER_BADGE[tier] ?? TIER_BADGE.private
  const isOwner = !!profile.is_owner

  // get_public_profile only sets `locked: true` for the private tier (viewer
  // isn't the owner) — it does not gate members_only server-side, so the
  // full profile payload (bio, stats, highlights, places) is delivered to
  // the browser for members_only regardless of who's asking. This section
  // hides that content in the UI for non-connections, but it is NOT real
  // access control: a determined caller could read the network response
  // directly. A proper fix needs get_public_profile updated to lock
  // members_only server-side the same way it already does for private.
  const isConnection = isOwner || profile.follow_status === 'accepted'
  const membersOnlyGated = !profile.locked && tier === 'members_only' && !isConnection

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
                {tier !== 'public' && <Lock size={11} />}
                {badge.label}
              </span>
            </div>

            {isOwner && !profile.locked && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <ShareButton username={username} />
              </div>
            )}
          </div>

          {profile.locked ? (
            <LockedState />
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

              {!isOwner && (tier === 'public' || tier === 'members_only') && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14 }}>
                  <FollowButton profile={profile} onChange={updateProfile} />
                  <ShareButton username={username} />
                </div>
              )}

              {membersOnlyGated ? (
                <div style={{ marginTop: 22, padding: '22px 18px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Follow to see more</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
                    This member shares stats, highlights, and places with people they follow back.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 }}>
                    <Stat Icon={CalendarCheck} value={profile.attended ?? 0} label="Hangouts attended" />
                    <Stat Icon={Users}         value={profile.organised ?? 0} label="Hangouts organised" />
                  </div>

                  <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
                    {profile.followers ?? 0} followers · {profile.connections ?? 0} connections
                  </div>

                  <HighlightsRow highlights={profile.highlights ?? []} isOwner={isOwner} />
                  <PlacesGrid places={profile.places ?? []} isOwner={isOwner} />
                </>
              )}
            </>
          )}
        </div>

        {isOwner && (
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text3)' }}>
            This is your profile. Change what others see in{' '}
            <Link href="/dashboard" style={{ color: 'var(--text2)', fontWeight: 600 }}>Profile settings</Link>.
          </div>
        )}
      </div>
    </div>
  )
}

function ShareButton({ username }: { username: string }) {
  const toast = useToast()

  function share() {
    navigator.clipboard.writeText(`https://knot.app/${username}`)
    toast.success('Link copied.')
  }

  return (
    <button onClick={share}
      style={{ padding: '8px 20px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 999, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      Share profile
    </button>
  )
}

function FollowButton({ profile, onChange }: { profile: PublicProfile; onChange: (patch: Partial<PublicProfile>) => void }) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  async function authHeader(): Promise<Record<string, string> | null> {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }

  async function follow() {
    if (!profile.id || working) return
    setWorking(true)
    setError('')
    const headers = await authHeader()
    if (!headers) { setError('Sign in to follow.'); setWorking(false); return }
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers,
      body: JSON.stringify({ addressee_id: profile.id, type: 'follow' }),
    })
    if (!res.ok) { setError('Could not follow. Try again.'); setWorking(false); return }
    const row = await res.json()
    onChange({ follow_status: row?.status ?? 'pending' })
    setWorking(false)
  }

  async function unfollow() {
    if (!profile.id || working) return
    setWorking(true)
    setError('')
    const headers = await authHeader()
    if (!headers) { setError('Sign in to manage follows.'); setWorking(false); return }
    const res = await fetch('/api/connections', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ addressee_id: profile.id, type: 'follow' }),
    })
    if (!res.ok) { setError('Could not unfollow. Try again.'); setWorking(false); return }
    onChange({ follow_status: null })
    setWorking(false)
  }

  const followStatus = profile.follow_status ?? null

  return (
    <div style={{ textAlign: 'center' }}>
      {followStatus === 'accepted' ? (
        <button onClick={unfollow} disabled={working}
          style={{ padding: '8px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: working ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: working ? 0.7 : 1 }}>
          {working ? 'Working…' : 'Following'}
        </button>
      ) : followStatus === 'pending' ? (
        <button disabled
          style={{ padding: '8px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 13, fontWeight: 600, cursor: 'not-allowed', fontFamily: 'inherit' }}>
          Requested
        </button>
      ) : (
        <button onClick={follow} disabled={working}
          style={{ padding: '8px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 13, fontWeight: 700, cursor: working ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: working ? 0.7 : 1 }}>
          {working ? 'Working…' : 'Follow'}
        </button>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
    </div>
  )
}

function HighlightsRow({ highlights, isOwner }: { highlights: Highlight[]; isOwner: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    if (highlights.length === 0) { setUrls({}); return }
    Promise.all(highlights.slice(0, 6).map(async h => [h.id, await getSignedUrl(h.storage_path)] as const))
      .then(entries => {
        if (cancelled) return
        const next: Record<string, string> = {}
        for (const [id, url] of entries) if (url) next[id] = url
        setUrls(next)
      })
    return () => { cancelled = true }
  }, [highlights])

  if (highlights.length === 0) {
    if (!isOwner) return null
    return (
      <div style={{ marginTop: 24 }}>
        <SectionLabel>Highlights</SectionLabel>
        <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px dashed var(--border2)', borderRadius: 12 }}>
          Pin your favourite memories here
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <SectionLabel>Highlights</SectionLabel>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {highlights.slice(0, 6).map(h => (
          <div key={h.id} title={h.caption || undefined}
            style={{ flex: '0 0 auto', width: 84, height: 84, borderRadius: 12, overflow: 'hidden', background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            {urls[h.id] && (
              h.media_type === 'video'
                ? <video src={urls[h.id]} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <img src={urls[h.id]} alt={h.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PlacesGrid({ places, isOwner }: { places: PlaceVisit[]; isOwner: boolean }) {
  if (places.length === 0) {
    if (!isOwner) return null
    return (
      <div style={{ marginTop: 24 }}>
        <SectionLabel>Places</SectionLabel>
        <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text3)', background: 'var(--bg3)', border: '1px dashed var(--border2)', borderRadius: 12 }}>
          Places you hang out will show up here
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 24 }}>
      <SectionLabel>Places</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {places.slice(0, 12).map(p => (
          <div key={p.place_id} style={{ padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <MapPin size={12} color="var(--text3)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name || 'Unknown venue'}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.count} visit{p.count !== 1 ? 's' : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
      {children}
    </div>
  )
}

// Only ever rendered when profile.locked is true, which get_public_profile
// only sets for the private tier (viewer isn't the owner). members_only
// gating is handled separately above via membersOnlyGated, since the RPC
// doesn't lock that tier server-side.
function LockedState() {
  const router = useRouter()
  return (
    <div style={{ marginTop: 22, padding: '22px 18px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        This profile is private
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 16 }}>
        The person who owns this profile has chosen not to share it.
      </div>
      <BackHomeActions onBack={() => router.back()} />
    </div>
  )
}

function BackHomeActions({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      <button onClick={onBack} style={{ padding: '8px 16px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Back
      </button>
      <Link href="/" style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
        Go home
      </Link>
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
