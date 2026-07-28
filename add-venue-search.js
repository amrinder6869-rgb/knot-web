const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Composer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add 'search' to whereMode type
content = content.replace(
  `useState<'none' | 'tbd' | 'discover' | 'manual' | 'home'>('none')`,
  `useState<'none' | 'tbd' | 'discover' | 'manual' | 'home' | 'search'>('none')`
);

// 2. Add venue search state after manualVenue state
content = content.replace(
  `  const [manualVenue, setManualVenue]     = useState('')`,
  `  const [manualVenue, setManualVenue]     = useState('')
  const [venueSearch, setVenueSearch]     = useState('')
  const [venueResults, setVenueResults]   = useState<any[]>([])
  const [searchingVenue, setSearchingVenue] = useState(false)`
);

// 3. Reset venue search in reset()
content = content.replace(
  `    setManualVenue('')\n    setManualAddress('')`,
  `    setManualVenue('')\n    setManualAddress('')\n    setVenueSearch('')\n    setVenueResults([])`
);

// 4. Add venue search function before postHangout
content = content.replace(
  `  async function postHangout() {`,
  `  async function searchVenueByName(query: string) {
    if (query.trim().length < 2) { setVenueResults([]); return }
    setSearchingVenue(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?input=' + encodeURIComponent(query) + '&types=establishment', {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      setVenueResults(data.suggestions || [])
    } catch {}
    setSearchingVenue(false)
  }

  async function selectVenueFromSearch(suggestion: any) {
    setSearchingVenue(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/autocomplete?place_id=' + suggestion.place_id, {
        headers: { Authorization: 'Bearer ' + session.access_token }
      })
      const data = await res.json()
      const place = data.place || {}
      setSelectedVenue({
        name: suggestion.main_text,
        place_id: suggestion.place_id,
        fsq_id: suggestion.place_id,
        location: { formatted_address: suggestion.secondary_text || place.formatted_address || '' },
        lat: place.lat || null,
        lng: place.lng || null,
        google_maps_url: \`https://www.google.com/maps/place/?q=place_id:\${suggestion.place_id}\`,
      })
      setWhereMode('search')
      setVenueResults([])
      setVenueSearch('')
    } catch {}
    setSearchingVenue(false)
  }

  async function postHangout() {`
);

// 5. Add 'Search a place' button to the Where none state
content = content.replace(
  `                  { id: 'tbd', label: 'Figure it out' },
                  { id: 'home', label: "Someone's place" },
                  { id: 'discover', label: 'Find a spot' },`,
  `                  { id: 'tbd', label: 'Figure it out' },
                  { id: 'home', label: "Someone's place" },
                  { id: 'search', label: 'Search a place' },
                  { id: 'discover', label: 'Browse Discover' },`
);

// 6. Add search handler in the onClick
content = content.replace(
  `                      if (id === 'tbd') setWhereMode('tbd')
                      else if (id === 'home') setWhereMode('home')
                      else if (id === 'discover') setWhereMode('discover')`,
  `                      if (id === 'tbd') setWhereMode('tbd')
                      else if (id === 'home') setWhereMode('home')
                      else if (id === 'search') setWhereMode('search')
                      else if (id === 'discover') setWhereMode('discover')`
);

// 7. Add search mode UI — insert before the tbd mode block
content = content.replace(
  `            {whereMode === 'tbd' && (`,
  `            {whereMode === 'search' && !selectedVenue && (
              <div style={{ position: 'relative' }}>
                <input
                  value={venueSearch}
                  onChange={e => { setVenueSearch(e.target.value); searchVenueByName(e.target.value) }}
                  placeholder="e.g. Sooper Tiffin, Yogurty's..."
                  autoFocus
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                {searchingVenue && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Searching...</div>}
                {venueResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                    {venueResults.map((s: any) => (
                      <div key={s.place_id} onClick={() => selectVenueFromSearch(s)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.main_text}</div>
                        {s.secondary_text && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.secondary_text}</div>}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { setWhereMode('none'); setVenueSearch(''); setVenueResults([]) }}
                  style={{ width: '100%', marginTop: 8, padding: '8px', background: 'transparent', border: '1px dashed var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Cancel
                </button>
              </div>
            )}

            {whereMode === 'search' && selectedVenue && (
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selectedVenue.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{selectedVenue.location?.formatted_address}</div>
                </div>
                <button onClick={() => { setSelectedVenue(null); setWhereMode('search') }}
                  style={{ padding: '4px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Change
                </button>
              </div>
            )}

            {whereMode === 'tbd' && (`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added Search a place option to composer Where section.');
console.log('Venue search uses autocomplete API and captures place_id for merchant linking.');
console.log('Selected venue shows confirmation card with change option.');
