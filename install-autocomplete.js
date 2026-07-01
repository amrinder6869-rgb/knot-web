const fs = require('fs')
const path = require('path')

// Install the autocomplete API route
const routeDir = path.join('app', 'api', 'autocomplete')
if (!fs.existsSync(routeDir)) fs.mkdirSync(routeDir, { recursive: true })
fs.copyFileSync('autocomplete-route.ts', path.join(routeDir, 'route.ts'))
console.log('Installed: app/api/autocomplete/route.ts')

// Patch Discover.tsx — replace the location bar and geocodeLocation with autocomplete
let discover = fs.readFileSync('components/Discover.tsx', 'utf8')

// Add autocomplete state after locationText state
discover = discover.replace(
  `  const [locationText, setLocationText] = useState('')`,
  `  const [locationText, setLocationText]       = useState('')
  const [suggestions, setSuggestions]           = useState<any[]>([])
  const [showSuggestions, setShowSuggestions]   = useState(false)
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false)
  const suggestionsRef = typeof window !== 'undefined' ? require('react').useRef<ReturnType<typeof setTimeout> | null>(null) : { current: null }`
)

// Replace geocodeLocation with autocomplete fetch + place details
discover = discover.replace(
  `  async function geocodeLocation() {
    if (!locationText.trim()) return
    setLocating(true)
    setError('')
    try {
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
        encodeURIComponent(locationText.trim())
      )
      const data = await res.json()
      if (data && data.length > 0) {
        const loc = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: data[0].display_name.split(',').slice(0, 2).join(', '),
        }
        setLocation(loc)
        setLocationText('')
      } else {
        setError('Location not found. Try a city name or postal code.')
      }
    } catch {
      setError('Could not search location. Try using GPS instead.')
    }
    setLocating(false)
  }`,
  `  async function fetchSuggestions(value: string) {
    if (value.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setFetchingSuggestions(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(value), {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setShowSuggestions((data.suggestions || []).length > 0)
    } catch {}
    setFetchingSuggestions(false)
  }

  async function selectSuggestion(suggestion: any) {
    setShowSuggestions(false)
    setLocationText(suggestion.main_text)
    setLocating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?place_id=' + suggestion.place_id, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      if (data.place) {
        setLocation({ lat: data.place.lat, lng: data.place.lng, name: data.place.name || suggestion.main_text })
        setLocationText('')
        setSuggestions([])
      }
    } catch {
      setError('Could not load location details.')
    }
    setLocating(false)
  }`
)

// Replace the location bar UI with autocomplete version
discover = discover.replace(
  `      {/* Location bar */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span style={{ flex: 1, fontSize: 13, color: location ? 'var(--text)' : 'var(--text3)', fontWeight: location ? 500 : 400 }}>
            {location ? location.name : 'No location set'}
          </span>
          <button onClick={() => getLocation()} disabled={locating}
            style={{ padding: '5px 12px', background: locating ? 'var(--bg3)' : 'var(--yellow)', border: 'none', borderRadius: 8, color: locating ? 'var(--text3)' : '#111', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {locating ? 'Detecting...' : 'Use my location'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
          <input
            value={locationText}
            onChange={e => setLocationText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && geocodeLocation()}
            placeholder="Or enter a city, address, or postal code..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
          />
          <button onClick={geocodeLocation} disabled={!locationText.trim() || locating}
            style={{ padding: '5px 12px', background: locationText.trim() ? 'var(--yellow)' : 'var(--bg3)', border: 'none', borderRadius: 8, color: locationText.trim() ? '#111' : 'var(--text3)', fontSize: 12, fontWeight: 600, cursor: locationText.trim() ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            Search
          </button>
        </div>
      </div>`,
  `      {/* Location bar with autocomplete */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'visible', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: location ? '1px solid var(--border)' : 'none' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <input
            value={locationText}
            onChange={e => {
              setLocationText(e.target.value)
              fetchSuggestions(e.target.value)
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={location ? location.name : 'Search city, address, or postal code...'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 500 }}
          />
          <button onClick={() => getLocation()} disabled={locating}
            style={{ padding: '5px 12px', background: locating ? 'var(--bg3)' : 'var(--yellow)', border: 'none', borderRadius: 8, color: locating ? 'var(--text3)' : '#111', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {locating ? 'Detecting...' : 'Use GPS'}
          </button>
        </div>
        {location && (
          <div style={{ padding: '6px 14px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--sage)', fontWeight: 600 }}>{location.name}</span>
            <button onClick={() => { setLocation(null); setLocationText('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Change</button>
          </div>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
            {suggestions.map((s: any) => (
              <div key={s.place_id} onMouseDown={() => selectSuggestion(s)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.main_text}</div>
                {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.secondary_text}</div>}
              </div>
            ))}
          </div>
        )}
      </div>`
)

fs.writeFileSync('components/Discover.tsx', discover, 'utf8')
console.log('Installed: components/Discover.tsx with autocomplete')
console.log('\nAll done. Run: npm run build')
