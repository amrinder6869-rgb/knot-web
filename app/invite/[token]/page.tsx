'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invite, setInvite]   = useState<any>(null)
  const [knot, setKnot]       = useState<any>(null)
  const [status, setStatus]   = useState<'loading'|'valid'|'expired'|'used'|'joined'|'error'>('loading')
  const [user, setUser]       = useState<any>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: inv, error: invError } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single()

      if (invError || !inv) { setStatus('error'); return }
      if (inv.used_by) { setStatus('used'); return }
      if (new Date(inv.expires_at) < new Date()) { setStatus('expired'); return }

      setInvite(inv)

      const { data: knotData } = await supabase
        .from('knots')
        .select('id, name, emoji')
        .eq('id', inv.knot_id)
        .single()

      if (!knotData) { setStatus('error'); return }

      setKnot(knotData)
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

    const { error } = await supabase
      .from('knot_members')
      .insert({ knot_id: knot.id, user_id: user.id, role: 'member' })

    if (error && !error.message.includes('duplicate')) {
      alert('Error joining: ' + error.message)
      setJoining(false)
      return
    }

    await supabase.from('invites')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('token', token)

    setStatus('joined')
    setTimeout(() => { window.location.href = '/dashboard' }, 2000)
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
            <circle cx="17" cy="17" r="10" stroke="#6C63FF" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="#4CAF87" strokeWidth="3" fill="none"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
            kn<span style={{ color: '#6C63FF' }}>o</span>t
          </span>
        </div>

        {status === 'loading' && (
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>Checking invite...</div>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Invalid invite</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>This link doesn't exist or has been removed.</div>
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏱️</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Invite expired</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>This invite link expired. Ask your friend to send a new one.</div>
          </>
        )}

        {status === 'used' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Already used</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>This one-time link has already been claimed.</div>
          </>
        )}

        {status === 'valid' && invite && knot && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{knot.emoji}</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>You're invited!</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              Join <strong style={{ color: 'var(--text)' }}>{knot.name}</strong> on Knot — a private circle for people who actually know each other.
            </div>

            {!user ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
                  Sign up or log in to join this Knot.
                </div>
                <button onClick={joinKnot}
                  style={{ width: '100%', padding: '11px', background: '#6C63FF', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
                  Sign up to join
                </button>
                <button onClick={() => { localStorage.setItem('pending_invite', token); window.location.href = '/' }}
                  style={{ width: '100%', padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Already have an account? Sign in
                </button>
              </>
            ) : (
              <button onClick={joinKnot} disabled={joining}
                style={{ width: '100%', padding: '11px', background: '#6C63FF', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: joining ? 'not-allowed' : 'pointer', opacity: joining ? 0.7 : 1, fontFamily: 'inherit' }}>
                {joining ? 'Joining...' : `Join ${knot.name}`}
              </button>
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)' }}>
              🔐 Invite-only · one-time link · expires in 48hrs
            </div>
          </>
        )}

        {status === 'joined' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#4CAF87' }}>You're in!</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Taking you to your dashboard...</div>
          </>
        )}
      </div>
    </div>
  )
}