'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  async function handleReset() {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError(''); setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setMessage('Password updated! Redirecting…')
    setTimeout(() => { window.location.href = '/dashboard' }, 1500)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
          <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="var(--yellow)" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            kn<span style={{ color: 'var(--yellow)' }}>o</span>t
          </span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Set new password</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>Choose a new password for your account.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            style={inputStyle}
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReset()}
          />

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', padding: '8px 12px', background: 'var(--danger-soft)', borderRadius: 6 }}>{error}</p>}
          {message && <p style={{ fontSize: 13, color: 'var(--sage)', padding: '8px 12px', background: 'var(--sage-soft)', borderRadius: 6 }}>{message}</p>}

          <button style={btnPrimary} onClick={handleReset} disabled={loading}>
            {loading ? 'Please wait...' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}
