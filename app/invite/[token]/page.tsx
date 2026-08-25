'use client'

import { useEffect, useState, use } from 'react'
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { track } from '@/lib/track'

// Carries the invite through to whichever auth path the user takes next:
// localStorage for the client-side sign-in flow in app/page.tsx, and a
// cookie for the server-side /auth/callback redirect (email confirmation /
// magic link), which can't see localStorage at all.
function storePendingInvite(token: string) {
  localStorage.setItem('pending_invite', token)
  // Match invite expiry (48h) so email confirmation can still redeem the token.
  document.cookie = `pending_invite_token=${token}; path=/; max-age=172800`
}

function getInitials(name: string) {
  return (name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

function memberSummary(names: string[], count: number): string {
  if (count === 0) return ''
  const shown = names.slice(0, 3)
  if (count <= shown.length) {
    if (shown.length === 1) return `${shown[0]} is inside`
    return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]} are inside`
  }
  const others = count - shown.length
  return `${shown.join(', ')} and ${others} other${others === 1 ? '' : 's'} are inside`
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invite, setInvite]   = useState<any>(null)
  const [knot, setKnot]       = useState<any>(null)
  const [status, setStatus]   = useState<'loading'|'valid'|'expired'|'joined'|'error'>('loading')
  const [user, setUser]       = useState<any>(null)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    async function load() {
      // invites_select RLS only allows the creator, used_by, or an existing
      // knot member to read the row — exactly the people who don't need a
      // preview. get_invite_preview() is SECURITY DEFINER so it can show
      // the knot name/emoji to a brand-new invitee before they've joined.
      const { data, error: rpcError } = await supabase.rpc('get_invite_preview', { p_token: token })

      if (rpcError || !data || !data.found) { setStatus('error'); return }
      if (data.expired) { setStatus('expired'); return }
      if (data.used) {
        setStatus('error')
        setJoinError('This invite has already been used.')
        return
      }

      setInvite(data)
      setKnot({ name: data.knot_name, emoji: data.knot_emoji })
      setStatus('valid')

      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) setUser(u)
    }
    load()
  }, [token])

  async function joinKnot() {
    if (!user) {
      storePendingInvite(token)
      window.location.href = '/'
      return
    }
    setJoining(true)
    setJoinError('')

    const { data, error } = await supabase.rpc('redeem_invite', { p_token: token })

    if (error || !data) {
      setJoinError('Could not join: ' + (error?.message || 'Please try again.'))
      setJoining(false)
      return
    }

    if (data.error === 'not_found') {
      setStatus('error')
      setJoinError('This invite link is not valid.')
      return
    }
    if (data.error === 'expired') {
      setStatus('expired')
      return
    }
    if (data.error === 'already_used') {
      setStatus('error')
      setJoinError('This invite has already been used.')
      return
    }
    if (data.error === 'not_authenticated') {
      storePendingInvite(token)
      window.location.href = '/'
      return
    }

    if (data.success) {
      track(supabase, 'invite_accepted', { knot_id: data.knot_id })
      setStatus('joined')
      setTimeout(() => { window.location.href = '/dashboard' }, 2000)
      return
    }

    setJoinError('Could not join: please try again.')
    setJoining(false)
  }

  const box: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--bg)', padding: 24
  }
  const card: React.CSSProperties = {
    background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 16, padding: 32, width: '100%', maxWidth: 380, textAlign: 'center'
  }

  return (
    <div style={box}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
            kn<span style={{ color: 'var(--yellow)' }}>o</span>t
          </span>
        </div>

        {status === 'loading' && (
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Checking invite...</div>
        )}

        {status === 'error' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <AlertCircle size={36} color="var(--danger)" strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Invalid invite</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>{joinError || "This link doesn't exist or has been removed."}</div>
            <DeadEndActions />
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Clock size={36} color="var(--amber)" strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Invite expired</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>This invite link expired. Ask your friend to send a new one.</div>
            <DeadEndActions />
          </>
        )}

        {status === 'valid' && invite && knot && (
          <>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{knot.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.5px' }}>{knot.name}</div>
            {invite.inviter_name && (
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
                <strong style={{ color: 'var(--text)' }}>{invite.inviter_name}</strong> invited you to join
              </div>
            )}

            {invite.member_count > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ display: 'flex' }}>
                  {(invite.member_names || []).slice(0, 4).map((n: string, i: number) => (
                    <div key={i} style={{
                      width: 32, height: 32, borderRadius: '50%', background: 'var(--yellow)', color: '#111',
                      fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid var(--bg2)', marginLeft: i > 0 ? -8 : 0,
                    }}>
                      {getInitials(n)}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {memberSummary(invite.member_names || [], invite.member_count)}
                </div>
              </div>
            )}

            <div style={{
              padding: '18px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 12,
              marginBottom: 24, filter: 'blur(3px)', opacity: 0.6, userSelect: 'none', pointerEvents: 'none',
            }}>
              <div style={{ height: 8, width: '60%', background: 'var(--border2)', borderRadius: 4, margin: '0 auto 8px' }} />
              <div style={{ height: 8, width: '80%', background: 'var(--border2)', borderRadius: 4, margin: '0 auto' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: -18, marginBottom: 24 }}>Active plans inside</div>

            {joinError && (
              <div className="error-banner" style={{ marginBottom: 12, textAlign: 'left' }}>{joinError}</div>
            )}

            {!user ? (
              <>
                <button onClick={joinKnot}
                  style={{ width: '100%', padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
                  Join {knot.name}
                </button>
                <button onClick={() => { storePendingInvite(token); window.location.href = '/' }}
                  style={{ width: '100%', padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Sign in to join
                </button>
              </>
            ) : (
              <button onClick={joinKnot} disabled={joining}
                style={{ width: '100%', padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 600, cursor: joining ? 'not-allowed' : 'pointer', opacity: joining ? 0.7 : 1, fontFamily: 'inherit' }}>
                {joining ? 'Joining...' : `Join ${knot.name}`}
              </button>
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ShieldCheck size={14} strokeWidth={2} />
              Invite-only · one-time link · expires in 48hrs
            </div>
          </>
        )}

        {status === 'joined' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <ShieldCheck size={48} color="var(--sage)" strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--sage)' }}>You&apos;re in!</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Taking you to your dashboard...</div>
          </>
        )}
      </div>
    </div>
  )
}

function DeadEndActions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <a href="/dashboard"
        style={{ display: 'block', width: '100%', padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', textDecoration: 'none', boxSizing: 'border-box' }}>
        Go to dashboard
      </a>
      <a href="/" style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none' }}>
        Learn more about Knot
      </a>
    </div>
  )
}
