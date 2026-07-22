'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [mode, setMode] = useState<'landing' | 'signin' | 'signup'>('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSignUp() {
    if (!name.trim()) { setError('Please enter your name'); return }
    setLoading(true); setError(''); setMessage('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    })
    if (error) setError(error.message)
    else setMessage('Check your email to confirm your account!')
    setLoading(false)
  }

  async function handleSignIn() {
    setLoading(true); setError(''); setMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.session) {
      const pendingInvite = localStorage.getItem('pending_invite')
      localStorage.removeItem('pending_invite')
      // Accept UUID tokens or other opaque invite tokens from the DB
      if (pendingInvite && /^[A-Za-z0-9_-]{8,128}$/.test(pendingInvite)) {
        window.location.href = `/invite/${pendingInvite}`
      } else {
        window.location.href = '/dashboard'
      }
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text)', fontSize: 14,
    outline: 'none', fontFamily: 'inherit',
  }

  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '11px',
    background: 'var(--yellow)', color: '#111',
    border: 'none', borderRadius: 8,
    fontSize: 14, fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    fontFamily: 'inherit',
  }

  if (mode === 'landing') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none"/>
          <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5"/>
        </svg>
        <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
          kn<span style={{ color: 'var(--yellow)' }}>o</span>t
        </span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', maxWidth: 520, marginBottom: 48 }}>
        <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 20, color: 'var(--text)' }}>
          Your private circle.<br />
          <span style={{ color: 'var(--yellow)' }}>No noise. No strangers.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text2)', lineHeight: 1.7 }}>
          Plan nights out, split bills, vote on new members, and keep memories — all inside a closed group of people you actually know.
        </p>
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
        {['Hangout polls', 'Bill splitting', 'Treat gestures', 'Invite-only', 'Memories vault', 'Trip planning'].map(f => (
          <span key={f} style={{ padding: '6px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>{f}</span>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => setMode('signup')} style={{ ...btnPrimary, width: 'auto', padding: '13px 32px', fontSize: 15, borderRadius: 10 }}>
          Create your Knot
        </button>
        <button onClick={() => setMode('signin')} style={{ padding: '13px 32px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          Sign in
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text3)' }}>No ads. No algorithm. No public profiles.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo small */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            kn<span style={{ color: 'var(--yellow)' }}>o</span>t
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
          {mode === 'signup' ? 'Start your first Knot after signing up.' : 'Sign in to your Knots.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input style={inputStyle} placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          )}
          <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (mode === 'signup' ? handleSignUp() : handleSignIn())} />

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 6 }}>{error}</p>}
          {message && <p style={{ fontSize: 13, color: 'var(--sage)', padding: '8px 12px', background: 'var(--sage-soft)', borderRadius: 6 }}>{message}</p>}

          <button style={btnPrimary} onClick={mode === 'signup' ? handleSignUp : handleSignIn} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <span style={{ color: 'var(--yellow)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setMessage('') }}>
            {mode === 'signup' ? 'Sign in' : 'Sign up'}
          </span>
        </p>

        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)', textAlign: 'center', cursor: 'pointer' }} onClick={() => setMode('landing')}>
          ← Back
        </p>
      </div>
    </div>
  )
}