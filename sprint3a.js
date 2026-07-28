const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

function write(relPath, content) {
  const full = path.join(BASE, relPath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('Created: ' + relPath);
}

// ─── 1. Merchant layout ───────────────────────────────────────────────────────
write('app/merchant/layout.tsx', `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Knot for Business',
  description: 'Manage your restaurant on Knot',
}

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'Manrope, sans-serif' }}>
      {children}
    </div>
  )
}
`);

// ─── 2. Merchant landing / sign-up page ───────────────────────────────────────
write('app/merchant/page.tsx', `'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MerchantSignup() {
  const [step, setStep] = useState<'intro' | 'auth' | 'profile'>('intro')
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

      <button onClick={() => setStep('auth')}
        style={{ width: '100%', padding: '14px', background: '#F8BD03', border: 'none', borderRadius: 10, color: '#111', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
        List my restaurant
      </button>
      <button onClick={() => { setStep('auth') }}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 10, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        Already have an account? Sign in
      </button>
    </div>
  )

  if (step === 'auth') return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '80px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>Create your account</h2>
        <p style={{ fontSize: 14, color: '#666' }}>You will set up your restaurant profile in the next step.</p>
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
          onKeyDown={e => e.key === 'Enter' && signUp()}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      <button onClick={signUp} disabled={loading}
        style={{ width: '100%', padding: '12px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <button onClick={signIn} disabled={loading}
        style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 8, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}>
        Sign in instead
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
`);

// ─── 3. Merchant dashboard page ───────────────────────────────────────────────
write('app/merchant/dashboard/page.tsx', `'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import MerchantOnboarding from '@/components/merchant/MerchantOnboarding'
import MerchantHome from '@/components/merchant/MerchantHome'

export default function MerchantDashboard() {
  const [user, setUser] = useState<any>(null)
  const [merchant, setMerchant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { window.location.href = '/merchant'; return }
      setUser(data.user)

      const { data: m } = await supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', data.user.id)
        .single()

      setMerchant(m || null)
      setLoading(false)
    })
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/merchant'
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope, sans-serif', color: '#666', fontSize: 14 }}>
      Loading...
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA', fontFamily: 'Manrope, sans-serif' }}>
      {/* Top nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E5E5', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 44 44" fill="none">
            <circle cx="17" cy="17" r="10" stroke="#F8BD03" strokeWidth="3" fill="none"/>
            <circle cx="27" cy="27" r="10" stroke="#F8BD03" strokeWidth="3" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>
            kn<span style={{ color: '#F8BD03' }}>o</span>t <span style={{ fontSize: 12, fontWeight: 500, color: '#888' }}>for business</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {merchant && <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{merchant.name}</span>}
          <button onClick={signOut}
            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 6, color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      {!merchant || !merchant.onboarded
        ? <MerchantOnboarding user={user} onComplete={(m) => setMerchant(m)} />
        : <MerchantHome merchant={merchant} user={user} onUpdate={(m) => setMerchant(m)} />
      }
    </div>
  )
}
`);

// ─── 4. MerchantOnboarding component ─────────────────────────────────────────
write('components/merchant/MerchantOnboarding.tsx', `'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  user: any
  onComplete: (merchant: any) => void
}

export default function MerchantOnboarding({ user, onComplete }: Props) {
  const [step, setStep] = useState<'search' | 'confirm' | 'details'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedPlace, setSelectedPlace] = useState<any>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [capacity, setCapacity] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function searchPlaces() {
    if (!searchQuery.trim()) return
    setSearching(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(searchQuery) + '&types=establishment', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      setSearchResults(data.suggestions || [])
    } catch {
      setError('Search failed. Please try again.')
    }
    setSearching(false)
  }

  async function selectPlace(suggestion: any) {
    setSearching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?place_id=' + suggestion.place_id, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      const place = data.place || {}
      setSelectedPlace({ ...suggestion, ...place })
      setName(suggestion.main_text || '')
      setStep('confirm')
    } catch {
      setError('Could not load place details.')
    }
    setSearching(false)
  }

  async function saveProfile() {
    if (!name.trim()) { setError('Please enter your restaurant name.'); return }
    setSaving(true); setError('')
    try {
      const { data, error: insertError } = await supabase
        .from('merchants')
        .upsert({
          owner_id: user.id,
          email: user.email,
          place_id: selectedPlace?.place_id || name.toLowerCase().replace(/\\s+/g, '-') + '-' + user.id.slice(0, 8),
          name: name.trim(),
          address: selectedPlace?.formatted_address || selectedPlace?.secondary_text || '',
          phone: phone.trim() || null,
          cuisine: cuisine.trim() || null,
          capacity: capacity ? parseInt(capacity) : null,
          onboarded: true,
          active: true,
        }, { onConflict: 'owner_id' })
        .select()
        .single()

      if (insertError) { setError(insertError.message); setSaving(false); return }
      onComplete(data)
    } catch (err) {
      setError('Could not save profile. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F8BD03', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Step {step === 'search' ? '1' : step === 'confirm' ? '2' : '3'} of 3
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 8 }}>
          {step === 'search' ? 'Find your restaurant' : step === 'confirm' ? 'Confirm your listing' : 'Complete your profile'}
        </h2>
        <p style={{ fontSize: 14, color: '#666' }}>
          {step === 'search' ? 'Search for your restaurant on Google to link your Knot profile.' : step === 'confirm' ? 'Make sure this is the correct listing before continuing.' : 'Add a few details so groups know what to expect.'}
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 'search' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchPlaces()}
              placeholder="e.g. Yogurty's Mississauga"
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={searchPlaces} disabled={searching}
              style={{ padding: '10px 16px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: searching ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchResults.map(s => (
            <div key={s.place_id} onClick={() => selectPlace(s)}
              style={{ padding: '12px 14px', background: '#fff', border: '1px solid #E5E5E5', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#F8BD03')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E5E5')}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{s.main_text}</div>
              {s.secondary_text && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.secondary_text}</div>}
            </div>
          ))}
          <button onClick={() => { setSelectedPlace(null); setStep('details') }}
            style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', border: '1px dashed #E5E5E5', borderRadius: 8, color: '#888', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            My restaurant is not on Google yet, add manually
          </button>
        </div>
      )}

      {step === 'confirm' && selectedPlace && (
        <div>
          <div style={{ padding: '16px', background: '#fff', border: '2px solid #F8BD03', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 4 }}>{selectedPlace.main_text}</div>
            <div style={{ fontSize: 13, color: '#666' }}>{selectedPlace.secondary_text || selectedPlace.formatted_address}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('search')}
              style={{ flex: 1, padding: '11px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 8, color: '#555', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Wrong listing
            </button>
            <button onClick={() => setStep('details')}
              style={{ flex: 2, padding: '11px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Yes, this is my restaurant
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Restaurant name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Phone number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="For booking confirmations"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Cuisine type</label>
            <input value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Italian, Japanese, Burgers"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Seating capacity</label>
            <input value={capacity} onChange={e => setCapacity(e.target.value)} type="number" placeholder="e.g. 60"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E5E5', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <button onClick={saveProfile} disabled={saving}
            style={{ width: '100%', padding: '13px', background: '#F8BD03', border: 'none', borderRadius: 8, color: '#111', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Complete setup'}
          </button>
        </div>
      )}
    </div>
  )
}
`);

// ─── 5. MerchantHome dashboard component ─────────────────────────────────────
write('components/merchant/MerchantHome.tsx', `'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  merchant: any
  user: any
  onUpdate: (m: any) => void
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MerchantHome({ merchant, user, onUpdate }: Props) {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'bookings' | 'specials' | 'profile'>('bookings')
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null)

  useEffect(() => {
    loadBookings()
    const channel = supabase
      .channel('merchant_bookings:' + merchant.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'merchant_bookings', filter: 'merchant_id=eq.' + merchant.id }, () => loadBookings())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [merchant.id])

  async function loadBookings() {
    const { data } = await supabase
      .from('merchant_bookings')
      .select('*, knot:knot_id(name, emoji)')
      .eq('merchant_id', merchant.id)
      .order('scheduled_for', { ascending: true })
    setBookings(data || [])
    setLoading(false)
  }

  async function updateBookingStatus(id: string, status: string) {
    setUpdatingBooking(id)
    await supabase.from('merchant_bookings').update({ status }).eq('id', id)
    setUpdatingBooking(null)
    loadBookings()
  }

  const pending = bookings.filter(b => b.status === 'pending')
  const confirmed = bookings.filter(b => b.status === 'confirmed')
  const past = bookings.filter(b => b.status === 'cancelled' || b.status === 'declined' || (b.scheduled_for && new Date(b.scheduled_for) < new Date()))

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pending', value: pending.length, color: '#F8BD03' },
          { label: 'Confirmed upcoming', value: confirmed.length, color: '#22C55E' },
          { label: 'Total bookings', value: bookings.length, color: '#6366F1' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E5E5E5' }}>
        {([
          { id: 'bookings', label: 'Bookings' },
          { id: 'specials', label: 'Knot Specials' },
          { id: 'profile', label: 'Profile' },
        ] as { id: 'bookings' | 'specials' | 'profile', label: string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === t.id ? '2px solid #F8BD03' : '2px solid transparent', color: activeTab === t.id ? '#F8BD03' : '#888', fontSize: 14, fontWeight: activeTab === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'bookings' && (
        <div>
          {loading && <div style={{ color: '#888', fontSize: 14 }}>Loading bookings...</div>}

          {!loading && pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F8BD03', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Needs your response</div>
              {pending.map(b => (
                <div key={b.id} style={{ background: '#fff', border: '1.5px solid #F8BD03', borderRadius: 12, padding: '16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                        {b.knot?.emoji} {b.knot?.name || 'Group booking'}
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                        {b.group_size} people {b.scheduled_for ? '· ' + formatDate(b.scheduled_for) : ''}
                      </div>
                      {b.notes && <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{b.notes}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{timeAgo(b.created_at)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateBookingStatus(b.id, 'confirmed')} disabled={updatingBooking === b.id}
                      style={{ flex: 1, padding: '9px', background: '#22C55E', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: updatingBooking === b.id ? 0.6 : 1 }}>
                      Confirm
                    </button>
                    <button onClick={() => updateBookingStatus(b.id, 'declined')} disabled={updatingBooking === b.id}
                      style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #E5E5E5', borderRadius: 8, color: '#DC2626', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: updatingBooking === b.id ? 0.6 : 1 }}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && confirmed.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Confirmed upcoming</div>
              {confirmed.map(b => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '16px', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>
                    {b.knot?.emoji} {b.knot?.name || 'Group booking'}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
                    {b.group_size} people {b.scheduled_for ? '· ' + formatDate(b.scheduled_for) : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && bookings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>No bookings yet</div>
              <div style={{ fontSize: 13, color: '#888' }}>Bookings from Knot groups will appear here when they choose your restaurant.</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'specials' && (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 6 }}>Knot Specials coming in Sprint 3B</div>
          <div style={{ fontSize: 13, color: '#888' }}>Create exclusive deals for confirmed Knot groups on your slow nights.</div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: 12, padding: '20px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 16 }}>Your profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Restaurant name', value: merchant.name },
              { label: 'Address', value: merchant.address || 'Not set' },
              { label: 'Cuisine', value: merchant.cuisine || 'Not set' },
              { label: 'Capacity', value: merchant.capacity ? merchant.capacity + ' seats' : 'Not set' },
              { label: 'Phone', value: merchant.phone || 'Not set' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F5F5F5' }}>
                <span style={{ fontSize: 13, color: '#888' }}>{f.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 13, color: '#16A34A' }}>
            Your restaurant is live on Knot. Groups near you can discover and book you.
          </div>
        </div>
      )}
    </div>
  )
}
`);

console.log('\nSprint 3A complete.');
console.log('Merchant portal created at /merchant');
console.log('Merchant dashboard at /merchant/dashboard');
console.log('Three-step onboarding: search Google Places, confirm listing, add details');
console.log('Merchant home with bookings tab, specials tab (placeholder), and profile tab');
