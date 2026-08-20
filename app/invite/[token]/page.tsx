'use client'

import { useEffect, useState, use } from 'react'
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
      localStorage.setItem('pending_invite', token)
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
      localStorage.setItem('pending_invite', token)
      window.location.href = '/'
      return
    }

    if (data.success) {
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
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{joinError || "This link doesn't exist or has been removed."}</div>
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Clock size={36} color="var(--amber)" strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Invite expired</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>This invite link expired. Ask your friend to send a new one.</div>
          </>
        )}

        {status === 'valid' && invite && knot && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{knot.emoji}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>You&apos;re invited!</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              Join <strong style={{ color: 'var(--text)' }}>{knot.name}</strong> on Knot — a private circle for people who actually know each other.
            </div>

            {joinError && (
              <div className="error-banner" style={{ marginBottom: 12, textAlign: 'left' }}>{joinError}</div>
            )}

            {!user ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
                  Sign up or log in to join this Knot.
                </div>
                <button onClick={joinKnot}
                  style={{ width: '100%', padding: '11px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
                  Sign up to join
                </button>
                <button onClick={() => { localStorage.setItem('pending_invite', token); window.location.href = '/' }}
                  style={{ width: '100%', padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Already have an account? Sign in
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
