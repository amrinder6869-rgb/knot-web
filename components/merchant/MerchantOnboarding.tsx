'use client'
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
  const [category, setCategory] = useState('restaurant')
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
          place_id: selectedPlace?.place_id || name.toLowerCase().replace(/\s+/g, '-') + '-' + user.id.slice(0, 8),
          name: name.trim(),
          address: selectedPlace?.formatted_address || selectedPlace?.secondary_text || '',
          phone: phone.trim() || null,
          cuisine: cuisine.trim() || null,
          category: category,
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
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Business type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { id: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
                { id: 'bar', label: 'Bar', emoji: '🍻' },
                { id: 'cafe', label: 'Cafe', emoji: '☕' },
                { id: 'activity', label: 'Activity', emoji: '🎳' },
                { id: 'experience', label: 'Experience', emoji: '🎨' },
                { id: 'tour', label: 'Tour', emoji: '🗺️' },
                { id: 'event_venue', label: 'Event Venue', emoji: '🎉' },
                { id: 'other', label: 'Other', emoji: '📍' },
              ].map(c => (
                <button key={c.id} onClick={() => setCategory(c.id)}
                  style={{ padding: '10px 6px', borderRadius: 8, border: category === c.id ? '1.5px solid #F8BD03' : '1px solid #E5E5E5', background: category === c.id ? '#FFFBEB' : '#fff', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{c.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: category === c.id ? '#D97706' : '#555' }}>{c.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Business name</label>
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
