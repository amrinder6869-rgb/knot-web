'use client'
import { useState } from 'react'

const CATEGORIES = [
  { id: '13000', label: 'Restaurants' },
  { id: '13003', label: 'Bars' },
  { id: '10000', label: 'Arts & Culture' },
  { id: '18000', label: 'Outdoors' },
  { id: '13059', label: 'Cafes' },
  { id: '10032', label: 'Activities' },
  { id: '13049', label: 'Fast & Casual' },
  { id: '13029', label: 'Asian' },
]

const BUDGETS = [
  { id: 1, label: 'Casual',  symbol: '$' },
  { id: 2, label: 'Mid',     symbol: '$$' },
  { id: 3, label: 'Nice',    symbol: '$$$' },
  { id: 4, label: 'Splurge', symbol: '$$$$' },
]

const PRICE_MAP: Record<number, string> = { 1:'$', 2:'$$', 3:'$$$', 4:'$$$$' }

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: 'var(--amber)', fontSize: 12 }}>
      {'★'.repeat(Math.floor(rating))}{rating % 1 >= 0.5 ? '½' : ''}{'☆'.repeat(5 - Math.floor(rating) - (rating % 1 >= 0.5 ? 1 : 0))}
      <span style={{ color: 'var(--text3)', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  )
}

export default function Discover({ members }: { members: any[] }) {
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
        pos => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Your location' }
          setLocation(loc); setLocating(false); resolve(loc)
        },
        () => {
          const loc = { lat: 43.5890, lng: -79.6441, name: 'Mississauga, ON' }
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
    const params = new URLSearchParams({ ll: `${loc.lat},${loc.lng}`, categories: category, limit: '10' })
    try {
      const res  = await fetch(`/api/venues?${params}`)
      const data = await res.json()
      if (data.error) {
        setError(`Error: ${data.error} ${data.message || ''}`)
      } else if (data.results && data.results.length > 0) {
        setVenues(data.results)
      } else {
        setError('No venues found nearby. Try a different category or location.')
      }
    } catch (e: any) {
      setError('Failed to fetch venues: ' + e.message)
    }
    setLoading(false)
  }

  function lockVenue(venue: any) {
    setSelected(venue); setLocked(true)
  }

  return (
    <div style={{ maxWidth: 800 }}>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Discover</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Find somewhere to go — filtered to your group's budget, near you.</div>
      </div>

      {locked && selected ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--sage)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--sage)' }}>Plan locked in</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{selected.location?.formatted_address}</div>
          {selected.rating && <div style={{ marginBottom: 8 }}><Stars rating={selected.rating} /></div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {selected.categories?.map((c: any) => (
              <span key={c.id} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--olive-soft)', color: 'var(--olive)', textTransform: 'capitalize' }}>{c.name}</span>
            ))}
            {selected.price && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>{PRICE_MAP[selected.price]}</span>}
            {selected.closed_bucket === 'VeryLikelyOpen' && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Open now</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => { setLocked(false); setSelected(null) }} style={{ fontSize: 13, padding: '9px 20px' }}>
              Change plan
            </button>
            <a href={selected.google_maps_url} target="_blank" rel="noreferrer"
              style={{ padding: '9px 20px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
              Open in Maps
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Location */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Location</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontSize: 13, color: location ? 'var(--sage)' : 'var(--text2)' }}>
                {location ? `${location.name} (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})` : 'Click to detect your location'}
              </div>
              <button onClick={() => getLocation()} disabled={locating}
                style={{ padding: '7px 14px', background: 'var(--rust)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: locating ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {locating ? 'Locating...' : location ? 'Update' : 'Use my location'}
              </button>
            </div>
          </div>

          {/* Categories */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>What are you in the mood for?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CATEGORIES.map(c => (
                <div key={c.id} onClick={() => setCategory(c.id)}
                  style={{ padding: '10px 8px', border: `1px solid ${category === c.id ? 'var(--rust)' : 'var(--border2)'}`, borderRadius: 10, textAlign: 'center', cursor: 'pointer', background: category === c.id ? 'var(--rust-soft)' : 'transparent', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: category === c.id ? 'var(--rust)' : 'var(--text2)' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Group Budget</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {BUDGETS.map(b => (
                <div key={b.id} onClick={() => setBudget(b.id)}
                  style={{ flex: 1, padding: '10px 6px', border: `1px solid ${budget === b.id ? 'var(--rust)' : 'var(--border2)'}`, borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: budget === b.id ? 'var(--rust-soft)' : 'transparent', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: budget === b.id ? 'var(--rust)' : 'var(--text)' }}>{b.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>Budget matched to group sweet spot automatically</div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--rust-soft)', border: '1px solid var(--rust-dim)', borderRadius: 8, fontSize: 13, color: 'var(--rust)', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* Search */}
          <button className="btn btn-primary" onClick={searchVenues} disabled={loading || !category}
            style={{ width: '100%', padding: '13px', fontSize: 14, marginBottom: 20, opacity: !category ? 0.55 : loading ? 0.7 : 1 }}>
            {loading ? 'Finding places...' : 'Find places nearby'}
          </button>

          {/* Skeletons */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 90, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', opacity: 0.5 }} />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && searched && venues.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                {venues.length} places found near {location?.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {venues.map(v => (
                  <div key={v.fsq_id}
                    style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--bg2)', border: `1px solid ${selected?.fsq_id === v.fsq_id ? 'var(--rust)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => setSelected(selected?.fsq_id === v.fsq_id ? null : v)}>

                    {/* Category label block */}
                    <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textAlign: 'center', padding: '0 4px' }}>
                        {CATEGORIES.find(c => c.id === category)?.label?.split(' ')[0] || '—'}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>{v.location?.formatted_address}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {v.rating && <Stars rating={v.rating} />}
                        {v.rating_count && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({v.rating_count.toLocaleString()})</span>}
                        {v.price && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>{PRICE_MAP[v.price]}</span>}
                        {v.closed_bucket === 'VeryLikelyOpen' && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Open</span>}
                        {v.categories?.[0] && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--olive-soft)', color: 'var(--olive)', textTransform: 'capitalize' }}>{v.categories[0].name}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); lockVenue(v) }}
                        style={{ padding: '7px 14px', background: 'var(--sage-soft)', border: '1px solid var(--sage-dim)', borderRadius: 8, color: 'var(--sage)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        Lock in
                      </button>
                      <a href={v.google_maps_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: 'var(--rust)', textDecoration: 'none' }}>
                        Maps →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && searched && venues.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: 14, opacity: 0.2 }}>
                <circle cx="18" cy="18" r="12" stroke="var(--text)" strokeWidth="2"/>
                <path d="M28 28l8 8" stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>No places found.</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>Try a different category or update your location.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}