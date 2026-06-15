'use client'
import { useState } from 'react'

const CATEGORIES = [
  { id: '13000', emoji: '🍽️', label: 'Restaurants' },
  { id: '13003', emoji: '🍺', label: 'Bars' },
  { id: '10000', emoji: '🎭', label: 'Arts & Culture' },
  { id: '18000', emoji: '🏃', label: 'Outdoors' },
  { id: '13059', emoji: '☕', label: 'Cafes' },
  { id: '10032', emoji: '🎳', label: 'Activities' },
  { id: '13049', emoji: '🍕', label: 'Fast & Casual' },
  { id: '13029', emoji: '🍣', label: 'Asian' },
]

const BUDGETS = [
  { id: 1, label: 'Casual',  symbol: '$' },
  { id: 2, label: 'Mid',     symbol: '$$' },
  { id: 3, label: 'Nice',    symbol: '$$$' },
  { id: 4, label: 'Splurge', symbol: '$$$$' },
]

const PRICE_MAP: Record<number, string> = { 1:'$', 2:'$$', 3:'$$$', 4:'$$$$' }

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
          setLocation(loc)
          setLocating(false)
          resolve(loc)
        },
        () => {
          const loc = { lat: 43.5890, lng: -79.6441, name: 'Mississauga, ON' }
          setLocation(loc)
          setLocating(false)
          resolve(loc)
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

  const params = new URLSearchParams({
    ll: `${loc.lat},${loc.lng}`,
    categories: category,
    limit: '10',
    ...(budget ? { price: String(budget) } : {}),
  })

  try {
    const res = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: {
        Authorization: '1MP2WKRQKBQ3GMSUZMXZO4TX5G1KD5ZKFIBD2T1KYWWWY0A3',
        Accept: 'application/json',
      }
    })
    const data = await res.json()
    console.log('Venues:', data)

    if (data.results && data.results.length > 0) {
      setVenues(data.results)
    } else {
      setError('No venues found nearby. Try a different category or location.')
    }
  } catch (e: any) {
    setError('Error: ' + e.message)
  }
  setLoading(false)
}Authorization: '1MP2WKRQKBQ3GMSUZMXZO4TX5G1KD5ZKFIBD2T1KYWWWY0A3',
  function lockVenue(venue: any) {
    setSelected(venue)
    setLocked(true)
  }

  const distanceLabel = (v: any) => {
    const d = v.distance
    if (!d) return ''
    return d < 1000 ? `${d}m away` : `${(d / 1000).toFixed(1)}km away`
  }

  return (
    <div style={{ maxWidth: 800 }}>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🗺️ Discover</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Find something to do — filtered to your group's budget, near you.</div>
      </div>

      {locked && selected ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--sage)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--sage)' }}>Plan locked in!</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
            {selected.location?.formatted_address || selected.location?.address || ''}
          </div>
          {selected.distance && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{distanceLabel(selected)}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            {selected.categories?.map((c: any) => (
              <span key={c.id} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--indigo-soft)', color: 'var(--indigo)' }}>{c.name}</span>
            ))}
            {selected.price && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>{PRICE_MAP[selected.price]}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => { setLocked(false); setSelected(null) }}
              style={{ padding: '9px 20px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Change plan
            </button>
            {selected.fsq_id && (
              <a href={`https://foursquare.com/v/${selected.fsq_id}`} target="_blank" rel="noreferrer"
                style={{ padding: '9px 20px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
                View on Foursquare ↗
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* LOCATION */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>📍 LOCATION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontSize: 13, color: location ? 'var(--sage)' : 'var(--text2)' }}>
                {location
                  ? `✓ ${location.name} (${location.lat.toFixed(3)}, ${location.lng.toFixed(3)})`
                  : 'Click to detect your location'}
              </div>
              <button onClick={getLocation} disabled={locating}
                style={{ padding: '7px 14px', background: 'var(--indigo)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: locating ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                {locating ? 'Locating...' : location ? '📍 Update' : '📍 Use my location'}
              </button>
            </div>
          </div>

          {/* CATEGORIES */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>WHAT ARE YOU IN THE MOOD FOR?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CATEGORIES.map(c => (
                <div key={c.id} onClick={() => setCategory(c.id)}
                  style={{ padding: '10px 8px', border: `1px solid ${category === c.id ? 'var(--indigo)' : 'var(--border2)'}`, borderRadius: 10, textAlign: 'center', cursor: 'pointer', background: category === c.id ? 'var(--indigo-dim)' : 'transparent', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: category === c.id ? 'var(--indigo)' : 'var(--text2)' }}>{c.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* BUDGET */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>💰 GROUP BUDGET</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {BUDGETS.map(b => (
                <div key={b.id} onClick={() => setBudget(b.id)}
                  style={{ flex: 1, padding: '10px 6px', border: `1px solid ${budget === b.id ? 'var(--indigo)' : 'var(--border2)'}`, borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: budget === b.id ? 'var(--indigo-dim)' : 'transparent', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: budget === b.id ? 'var(--indigo)' : 'var(--text)' }}>{b.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              🔒 Budget matched to group sweet spot automatically
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--coral-soft)', border: '1px solid rgba(232,98,74,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--coral)', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* SEARCH BUTTON */}
          <button onClick={searchVenues} disabled={loading || !category}
            style={{ width: '100%', padding: '13px', background: category ? 'var(--indigo)' : 'var(--bg3)', border: `1px solid ${category ? 'var(--indigo)' : 'var(--border2)'}`, borderRadius: 10, color: category ? '#fff' : 'var(--text3)', fontSize: 14, fontWeight: 600, cursor: category ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 20, opacity: loading ? 0.7 : 1 }}>
            {loading ? '🔍 Finding places...' : '🔍 Find places nearby'}
          </button>

          {/* LOADING SKELETONS */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 90, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', opacity: 0.5 }} />
              ))}
            </div>
          )}

          {/* RESULTS */}
          {!loading && searched && venues.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                {venues.length} places found near {location?.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {venues.map(v => (
                  <div key={v.fsq_id}
                    style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--bg2)', border: `1px solid ${selected?.fsq_id === v.fsq_id ? 'var(--indigo)' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                    onClick={() => setSelected(selected?.fsq_id === v.fsq_id ? null : v)}>
                    <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                      {v.categories?.[0]?.icon
                        ? <img src={`${v.categories[0].icon.prefix}64${v.categories[0].icon.suffix}`} alt="" style={{ width: 36, height: 36 }} />
                        : '📍'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                        {v.location?.formatted_address || v.location?.address || v.location?.locality || ''}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {v.categories?.slice(0,2).map((c: any) => (
                          <span key={c.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--indigo-soft)', color: 'var(--indigo)' }}>{c.name}</span>
                        ))}
                        {v.price && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>{PRICE_MAP[v.price]}</span>}
                        {v.distance && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg4)', color: 'var(--text3)' }}>{distanceLabel(v)}</span>}
                        {v.closed_bucket === 'VeryLikelyOpen' && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Open now</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); lockVenue(v) }}
                        style={{ padding: '7px 14px', background: 'var(--sage-soft)', border: '1px solid rgba(76,175,135,0.3)', borderRadius: 8, color: 'var(--sage)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        Lock in ✓
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && searched && venues.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text2)', fontSize: 14 }}>
              No venues found. Try a different category or budget.
            </div>
          )}
        </>
      )}
    </div>
  )
}