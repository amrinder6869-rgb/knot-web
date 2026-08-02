'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MerchantSignup() {
  const [step, setStep] = useState<'intro' | 'auth' | 'profile'>('intro')
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signUp() {
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    const { error: authError } = await supabase.auth.signUp({ email: email.trim(), password })
    if (authError) { setError(authError.message); setLoading(false); return }
    setLoading(false)
    setStep('profile')
  }

  async function signIn() {
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) { setError(authError.message); setLoading(false); return }
    setLoading(false)
    window.location.href = '/merchant/dashboard'
  }

  if (step === 'intro') return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
        <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
          <circle cx="17" cy="17" r="10" stroke="#F8BD03" strokeWidth="3" fill="none"/>
          <circle cx="27" cy="27" r="10" stroke="#F8BD03" strokeWidth="3" fill="none" opacity="0.5"/>
        </svg>
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: '#111' }}>
          kn<span style={{ color: '#F8BD03' }}>o</span>t <span style={{ fontSize: 14, fontWeight: 500, color: '#888' }}>for business</span>
        </span>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111', marginBottom: 16, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
        Fill your tables with confirmed groups
      </h1>
      <p style={{ fontSize: 16, color: '#555', lineHeight: 1.6, marginBottom: 40 }}>
        Knot sends you pre-committed group bookings with prepayment. No more no-shows. No more empty covers on slow nights.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {[
          { icon: '👥', title: 'Groups of 2 to 20', desc: 'Confirmed groups who have pre-committed before they arrive' },
          { icon: '💳', title: 'Prepaid orders', desc: 'Payment collected before the hangout. You get guaranteed revenue' },
          { icon: '🎯', title: 'Knot Specials', desc: 'Offer exclusive deals to Knot groups on your slow nights' },
        ].map(item => (
          <div key={item.title} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, textAlign: 'left' }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => { setAuthMode('signup'); setStep('auth'); setError('') }}
        style={{ width: '100%', padding: '14px', background: '#F8BD03', border: 'none', borderRadius: 10, color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
        List my restaurant
      </button>
      <button onClick={() => { setAuthMode('signin'); setStep('auth'); setError('') }}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 10, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        Already have an account? Sign in
      </button>
    </div>
  )

  if (step === 'auth') return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '80px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>{authMode === 'signin' ? 'Sign in to your account' : 'Create your account'}</h2>
        <p style={{ fontSize: 14, color: '#666' }}>
          {authMode === 'signin' ? 'Welcome back — continue to your merchant dashboard.' : 'You will set up your restaurant profile in the next step.'}
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)}
          type="email" placeholder="you@restaurant.com"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Password</label>
        <input value={password} onChange={e => setPassword(e.target.value)}
          type="password" placeholder="At least 8 characters"
          onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? signIn() : signUp())}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <button onClick={authMode === 'signin' ? signIn : signUp} disabled={loading}
        style={{ width: '100%', padding: '12px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, opacity: loading ? 0.6 : 1 }}>
        {loading
          ? (authMode === 'signin' ? 'Signing in...' : 'Creating account...')
          : (authMode === 'signin' ? 'Sign in' : 'Create account')}
      </button>
      <button onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setError('') }} disabled={loading}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 8, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
        {authMode === 'signin' ? 'Need an account? Create one' : 'Sign in instead'}
      </button>
      <button onClick={() => setStep('intro')}
        style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
        Back
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>Account created</h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>Check your email to confirm your account, then set up your restaurant profile.</p>
      <a href="/merchant/dashboard"
        style={{ display: 'inline-block', padding: '12px 28px', background: '#F8BD03', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        Go to dashboard
      </a>
    </div>
  )
}
