const fs = require('fs')

// ─── FIX 1 + FIX 3: Composer.tsx ───────────────────────────────────────────
let composer = fs.readFileSync('components/Composer.tsx', 'utf8')

// Fix "Figure it out" chip — give it an onClick that sets whereMode to 'tbd'
// and add tbd as a valid whereMode
composer = composer.replace(
  `type WhereMode = 'none' | 'discover' | 'manual' | 'home'`,
  `type WhereMode = 'none' | 'tbd' | 'discover' | 'manual' | 'home'`
)

// Fix Figure it out chip onClick
composer = composer.replace(
  `{ id: 'none-tbd', label: 'Figure it out' },`,
  `{ id: 'tbd', label: 'Figure it out' },`
)

composer = composer.replace(
  `if (id === 'home') setWhereMode('home')
                      else if (id === 'discover') setWhereMode('discover')`,
  `if (id === 'tbd') setWhereMode('tbd')
                      else if (id === 'home') setWhereMode('home')
                      else if (id === 'discover') setWhereMode('discover')`
)

// Show a settled state when tbd is selected
composer = composer.replace(
  `{whereMode === 'discover' && !selectedVenue && (`,
  `{whereMode === 'tbd' && (
              <div style={{ padding: '8px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>No venue set — you will figure it out</span>
                <button onClick={() => setWhereMode('none')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
              </div>
            )}

            {whereMode === 'discover' && !selectedVenue && (`
)

// Fix font weights in composer — label text
composer = composer.replace(
  /fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' \}/g,
  `fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontWeight: 500 }`
)

// Fix post type button text weight when inactive
composer = composer.replace(
  `fontSize: 13, fontWeight: activeType === type ? 700 : 400,`,
  `fontSize: 13, fontWeight: activeType === type ? 700 : 500,`
)

// Fix when chip inactive weight
composer = composer.replace(
  `fontSize: 12, fontWeight: whenType === id ? 700 : 400,`,
  `fontSize: 12, fontWeight: whenType === id ? 700 : 500,`
)

// Fix day chip inactive weight
composer = composer.replace(
  `fontSize: 11, fontWeight: recurrenceDay === i ? 700 : 400,`,
  `fontSize: 11, fontWeight: recurrenceDay === i ? 700 : 500,`
)

// Fix placeholder text colour — input labels
composer = composer.replace(
  /color: 'var\(--text2\)', marginLeft: 6 \}/g,
  `color: 'var(--text)', marginLeft: 6 }`
)

fs.writeFileSync('components/Composer.tsx', composer, 'utf8')
console.log('Composer.tsx fixed')

// ─── FIX 2: Discover.tsx — add text location input ──────────────────────────
let discover = fs.readFileSync('components/Discover.tsx', 'utf8')

// Add locationText state after the existing location state
discover = discover.replace(
  `  const [searched, setSearched] = useState(false)`,
  `  const [searched, setSearched] = useState(false)
  const [locationText, setLocationText] = useState('')`
)

// Add geocodeLocation function after getLocation function closing brace
discover = discover.replace(
  `  async function searchVenues() {`,
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
  }

  async function searchVenues() {`
)

// Replace the location bar with one that includes a text input
discover = discover.replace(
  `      {/* Location bar */}
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
      </div>`,
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
      </div>`
)

// Remove emojis from category grid — replace emoji div with empty space for now
discover = discover.replace(
  `              <div style={{ fontSize: 22, marginBottom: 4 }}>{c.emoji}</div>`,
  ``
)

// Remove emoji from no venues found empty state
discover = discover.replace(
  `        <div style={{ fontSize: 32, marginBottom: 12 }}>??</div>`,
  ``
)

// Remove emoji from search button
discover = discover.replace(
  `{loading ? 'Finding places...' : \`Find \${catObj ? catObj.emoji + ' ' + catObj.label : 'places'} nearby\`}`,
  `{loading ? 'Finding places...' : \`Find \${catObj ? catObj.label : 'places'} nearby\`}`
)

fs.writeFileSync('components/Discover.tsx', discover, 'utf8')
console.log('Discover.tsx fixed')

console.log('\nAll fixes applied. Run: npm run build')
