'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const CATEGORIES = [
  { id: '13000', label: 'Restaurants', emoji: String.fromCodePoint(0x1F374) },
  { id: '13003', label: 'Bars', emoji: String.fromCodePoint(0x1F37B) },
  { id: '10000', label: 'Arts & Culture', emoji: String.fromCodePoint(0x1F3AD) },
  { id: '18000', label: 'Outdoors', emoji: String.fromCodePoint(0x1F33F) },
  { id: '13059', label: 'Cafes', emoji: String.fromCodePoint(0x2615) },
  { id: '10032', label: 'Activities', emoji: String.fromCodePoint(0x1F3B3) },
  { id: '13049', label: 'Fast & Casual', emoji: String.fromCodePoint(0x1F32E) },
  { id: '13029', label: 'Asian', emoji: String.fromCodePoint(0x1F35C) },
]

const BUDGETS = [
  { id: 1, label: 'Casual',  symbol: '$' },
  { id: 2, label: 'Mid',     symbol: '$$' },
  { id: 3, label: 'Nice',    symbol: '$$$' },
  { id: 4, label: 'Splurge', symbol: '$$$$' },
]

const PRICE_MAP: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating)
  const half  = rating % 1 >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <span style={{ fontSize: 13, letterSpacing: 1 }}>
      <span style={{ color: 'var(--amber)' }}>{String.fromCodePoint(0x2605).repeat(full)}{half ? String.fromCodePoint(0xBD) : ''}</span>
      <span style={{ color: 'var(--border2)' }}>{String.fromCodePoint(0x2606).repeat(empty)}</span>
      <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 5 }}>{rating.toFixed(1)}</span>
    </span>
  )
}

export default function Discover({ members: _members }: { members: any[] }) {
  const [category, setCategory] = useState<string|null>(null)
  const [budget, setBudget]     = useState<number|null>(2)
  const [venues, setVenues]     = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [locating, setLocating] = useState(false)
  const [location, setLocation] = useState<{lat:number,lng:number,name:string}|null>(null)
  const [selected, setSelected] = useState<any|null>(null)
  const [locked, setLocked]     = useState(false)
  const [searched, setSearched] = useState(false)

  async function getLocation(): Promise<{lat:number,lng:number,name:string}|null> {
    setLocating(true)
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          // Reverse geocode for city name
          let name = 'Your location'
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
            const geo = await res.json()
            const addr = geo.address
            name = addr.city || addr.town || addr.village || addr.county || 'Your location'
          } catch {}
          const loc = { lat, lng, name }
          setLocation(loc); setLocating(false); resolve(loc)
        },
        () => {
          const loc = { lat: 43.5890, lng: -79.6441, name: 'Mississauga' }
          setLocation(loc); setLocating(false); resolve(loc)
        }
      )
    })
  }

  async function searchVenues() {
    if (!category) { setError('Pick a category first'); return }
    let loc = location
    if (!loc) { loc = await getLocation() }
    if (!loc) { setError('Could not get location'); return }
    setLoading(true); setError(''); setVenues([]); setSearched(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not authenticated'); setLoading(false); return }

    const params = new URLSearchParams({ ll: `${loc.lat},${loc.lng}`, categories: category, limit: '10' })
    try {
      const res  = await fetch(`/api/venues?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.error) {
        setError('Could not load venues. Please try again.')
      } else if (data.results && data.results.length > 0) {
        setVenues(data.results)
      } else {
        setError('No venues found nearby. Try a different category or location.')
      }
    } catch {
      setError('Failed to fetch venues. Please try again.')
    }
    setLoading(false)
  }

  async function lockVenue(venue: any) {
    setSelected(venue)
    setLocked(true)
    // Post to feed
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    // We don't have knotId here so just store selected for now
  }

  const catObj = CATEGORIES.find(c => c.id === category)

  if (locked && selected) return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: 'var(--bg2)', border: '2px solid var(--sage)', borderRadius: 20, overflow: 'hidden' }}>
        {selected.photo_url && (
          <div style={{ width: '100%', height: 200, overflow: 'hidden' }}>
            <img src={selected.photo_url} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--sage-soft)', borderRadius: 20, fontSize: 12, color: 'var(--sage)', fontWeight: 600, marginBottom: 12 }}>
            Tonight is locked in
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.5px' }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>{selected.location?.formatted_address}</div>
          {selected.rating && <div style={{ marginBottom: 12 }}><StarRating rating={selected.rating} /></div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {selected.price && <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>{PRICE_MAP[selected.price]}</span>}
            {selected.closed_bucket === 'VeryLikelyOpen' && <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Open now</span>}
            {selected.categories?.[0] && <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'var(--olive-soft)', color: 'var(--olive)', textTransform: 'capitalize' }}>{selected.categories[0].name}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => { setLocked(false); setSelected(null) }}
              style={{ padding: '10px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Change plan
            </button>
            <a href={selected.google_maps_url} target="_blank" rel="noreferrer"
              style={{ padding: '10px 20px', background: 'var(--yellow)', border: 'none', borderRadius: 10, color: '#111', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
              Open in Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 800 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Discover</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Find the perfect spot for your group tonight.</div>
      </div>

      {/* Location bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span style={{ flex: 1, fontSize: 13, color: location ? 'var(--text)' : 'var(--text3)' }}>
          {location ? location.name : 'Tap to detect your location'}
        </span>
        <button onClick={() => getLocation()} disabled={locating}
          style={{ padding: '5px 12px', background: locating ? 'var(--bg3)' : 'var(--yellow)', border: 'none', borderRadius: 8, color: locating ? 'var(--text3)' : '#111', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          {locating ? 'Locating...' : location ? 'Update' : 'Use location'}
        </button>
      </div>

      {/* Categories */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>What are you in the mood for?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {CATEGORIES.map(c => (
            <div key={c.id} onClick={() => setCategory(c.id)}
              style={{ padding: '12px 8px', border: `1.5px solid ${category === c.id ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: category === c.id ? 'var(--yellow-soft)' : 'var(--bg2)', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: category === c.id ? 'var(--yellow)' : 'var(--text2)' }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Group budget</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {BUDGETS.map(b => (
            <div key={b.id} onClick={() => setBudget(b.id)}
              style={{ flex: 1, padding: '10px 6px', border: `1.5px solid ${budget === b.id ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 10, textAlign: 'center', cursor: 'pointer', background: budget === b.id ? 'var(--yellow-soft)' : 'var(--bg2)', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: budget === b.id ? 'var(--yellow)' : 'var(--text)' }}>{b.symbol}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--danger-soft)', border: '1px solid var(--danger-dim)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Search button */}
      <button onClick={searchVenues} disabled={loading || !category}
        style={{ width: '100%', padding: '14px', background: category ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 12, color: category ? '#111' : 'var(--text3)', fontSize: 15, fontWeight: 700, cursor: category ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 24, opacity: loading ? 0.7 : 1, transition: 'all 0.15s' }}>
        {loading ? 'Finding places...' : `Find ${catObj ? catObj.emoji + ' ' + catObj.label : 'places'} nearby`}
      </button>

      {/* Skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 110, background: 'var(--bg2)', borderRadius: 14, border: '1px solid var(--border)', opacity: 0.5 }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && venues.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              <strong style={{ color: 'var(--text)' }}>{venues.length} places</strong> near {location?.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sorted by rating</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {venues.map((v, idx) => (
              <div key={v.fsq_id}
                style={{ background: 'var(--bg2)', border: `1.5px solid ${selected?.fsq_id === v.fsq_id ? 'var(--yellow)' : 'var(--border)'}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                onClick={() => setSelected(selected?.fsq_id === v.fsq_id ? null : v)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(248,189,3,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = selected?.fsq_id === v.fsq_id ? 'var(--yellow)' : 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>

                <div style={{ display: 'flex', gap: 0 }}>
                  {/* Photo */}
                  <div style={{ width: 110, flexShrink: 0, background: 'var(--bg3)', position: 'relative' }}>
                    {v.photo_url ? (
                      <img src={v.photo_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 110 }} />
                    ) : (
                      <div style={{ width: '100%', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                        {catObj?.emoji || String.fromCodePoint(0x1F4CD)}
                      </div>
                    )}
                    {idx === 0 && (
                      <div style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', background: 'var(--yellow)', borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#111' }}>
                        Top Pick
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, color: 'var(--text)' }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>{v.location?.formatted_address}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                        {v.rating && <StarRating rating={v.rating} />}
                        {v.rating_count && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({v.rating_count.toLocaleString()})</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {v.price && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)', fontWeight: 600 }}>{PRICE_MAP[v.price]}</span>}
                        {v.closed_bucket === 'VeryLikelyOpen' && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Open now</span>}
                        {v.categories?.[0] && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg3)', color: 'var(--text3)', textTransform: 'capitalize' }}>{v.categories[0].name}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={e => { e.stopPropagation(); lockVenue(v) }}
                        style={{ padding: '7px 16px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Lock in tonight
                      </button>
                      <a href={v.google_maps_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ padding: '7px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Maps
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && searched && venues.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>??</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No venues found</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Try a different category or expand your search area.</div>
        </div>
      )}
    </div>
  )
}





