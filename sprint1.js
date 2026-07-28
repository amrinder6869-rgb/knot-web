const fs = require('fs')

// ── 1. PATCH venues API to include lat/lng ──────────────────────────────────
const venuesPath = 'app/api/venues/route.ts'
let venues = fs.readFileSync(venuesPath, 'utf8')

const oldMap = `        google_maps_url: \`https://www.google.com/maps/place/?q=place_id:\${p.place_id}\`,`
const newMap = `        google_maps_url: \`https://www.google.com/maps/place/?q=place_id:\${p.place_id}\`,
        lat: p.geometry?.location?.lat || null,
        lng: p.geometry?.location?.lng || null,`

if (venues.includes(oldMap)) {
  venues = venues.replace(oldMap, newMap)
  fs.writeFileSync(venuesPath, venues, 'utf8')
  console.log('venues/route.ts: added lat/lng to venue object')
} else {
  console.log('venues/route.ts: pattern not found, check manually')
}

// ── 2. PATCH Composer to pass lat/lng through to hangout insert ─────────────
const composerPath = 'components/Composer.tsx'
let composer = fs.readFileSync(composerPath, 'utf8')

// Add getVenueCoords helper after getVenueBookingUrl
const oldHelper = `  function getVenueBookingUrl() {
    return selectedVenue?.booking_url || null
  }`
const newHelper = `  function getVenueBookingUrl() {
    return selectedVenue?.booking_url || null
  }

  function getVenueCoords(): { lat: number | null; lng: number | null } {
    return {
      lat: selectedVenue?.lat || null,
      lng: selectedVenue?.lng || null,
    }
  }`

if (composer.includes(oldHelper)) {
  composer = composer.replace(oldHelper, newHelper)
  console.log('Composer.tsx: added getVenueCoords helper')
} else {
  console.log('Composer.tsx: getVenueBookingUrl not found')
}

// Add venue_lat and venue_lng to hangout insert
const oldInsert = `      venue_booking_url: getVenueBookingUrl(),
      venue_place_id:    selectedVenue?.place_id || null,`
const newInsert = `      venue_booking_url: getVenueBookingUrl(),
      venue_place_id:    selectedVenue?.place_id || null,
      venue_lat:         getVenueCoords().lat,
      venue_lng:         getVenueCoords().lng,`

if (composer.includes(oldInsert)) {
  composer = composer.replace(oldInsert, newInsert)
  console.log('Composer.tsx: added venue_lat/venue_lng to hangout insert')
} else {
  console.log('Composer.tsx: hangout insert pattern not found')
}

fs.writeFileSync(composerPath, composer, 'utf8')

// ── 3. PATCH HangoutCard to add rideshare and OpenTable links ───────────────
const cardPath = 'components/HangoutCard.tsx'
let card = fs.readFileSync(cardPath, 'utf8')

// Replace the existing venue action buttons block with an upgraded version
// Find the Directions + Book a table section and replace it
const oldButtons = `        {hangout.venue_maps_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_maps_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Directions</a>
        )}
        {hangout.venue_booking_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_booking_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>Book a table</a>
        )}`

const newButtons = `        {hangout.venue_maps_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_maps_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Directions</a>
        )}
        {(hangout.venue_lat && hangout.venue_lng) && (isConfirmed || isLive) && (
          <a
            href={\`https://ride.lyft.com/ridetype?id=lyft&destination[latitude]=\${hangout.venue_lat}&destination[longitude]=\${hangout.venue_lng}&destination[address]=\${encodeURIComponent(hangout.venue_name || '')}\`}
            target="_blank" rel="noreferrer"
            style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>
            Lyft
          </a>
        )}
        {(hangout.venue_lat && hangout.venue_lng) && (isConfirmed || isLive) && (
          <a
            href={\`uber://?action=setPickup&pickup=my_location&dropoff[latitude]=\${hangout.venue_lat}&dropoff[longitude]=\${hangout.venue_lng}&dropoff[nickname]=\${encodeURIComponent(hangout.venue_name || '')}\`}
            target="_blank" rel="noreferrer"
            style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>
            Uber
          </a>
        )}
        {(hangout.venue_booking_url || hangout.venue_name) && (isConfirmed || isLive) && (
          <a
            href={hangout.venue_booking_url || \`https://www.opentable.com/s/?term=\${encodeURIComponent(hangout.venue_name || '')}\`}
            target="_blank" rel="noreferrer"
            style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
            Book a table
          </a>
        )}`

if (card.includes(oldButtons)) {
  card = card.replace(oldButtons, newButtons)
  console.log('HangoutCard.tsx: added Lyft, Uber, and upgraded Book a table')
} else {
  console.log('HangoutCard.tsx: button pattern not found, check manually')
}

fs.writeFileSync(cardPath, card, 'utf8')

console.log('\nAll patches applied. Now run the Supabase migration.')
