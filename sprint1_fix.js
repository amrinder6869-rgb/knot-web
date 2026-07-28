const fs = require('fs')

const cardPath = 'components/HangoutCard.tsx'
const lines = fs.readFileSync(cardPath, 'utf8').split('\n')

// Find the Directions line and the Book a table line by content
const directionsIdx = lines.findIndex(l =>
  l.includes('hangout.venue_maps_url') && l.includes('isConfirmed || isLive') && !l.includes('venue_lat')
)
const bookingIdx = lines.findIndex(l =>
  l.includes('hangout.venue_booking_url') && l.includes('isConfirmed || isLive') && l.includes('Book a table')
)

if (directionsIdx === -1) {
  console.log('ERROR: Could not find Directions block. Check HangoutCard.tsx manually.')
  process.exit(1)
}
if (bookingIdx === -1) {
  console.log('ERROR: Could not find Book a table block. Check HangoutCard.tsx manually.')
  process.exit(1)
}

console.log('Found Directions block at line', directionsIdx + 1)
console.log('Found Book a table block at line', bookingIdx + 1)

// The Directions block spans lines directionsIdx, directionsIdx+1, directionsIdx+2 (the closing )})
// The Booking block spans lines bookingIdx, bookingIdx+1, bookingIdx+2
// We keep Directions as-is and replace the Booking block + insert Lyft + Uber before it

const indent = '        '

const lyftBlock = [
  `${indent}{(hangout.venue_lat && hangout.venue_lng) && (isConfirmed || isLive) && (`,
  `${indent}  <a`,
  `${indent}    href={\`https://ride.lyft.com/ridetype?id=lyft&destination[latitude]=\${hangout.venue_lat}&destination[longitude]=\${hangout.venue_lng}&destination[address]=\${encodeURIComponent(hangout.venue_name || '')}\`}`,
  `${indent}    target="_blank" rel="noreferrer"`,
  `${indent}    style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>`,
  `${indent}    Lyft`,
  `${indent}  </a>`,
  `${indent})}`,
]

const uberBlock = [
  `${indent}{(hangout.venue_lat && hangout.venue_lng) && (isConfirmed || isLive) && (`,
  `${indent}  <a`,
  `${indent}    href={\`uber://?action=setPickup&pickup=my_location&dropoff[latitude]=\${hangout.venue_lat}&dropoff[longitude]=\${hangout.venue_lng}&dropoff[nickname]=\${encodeURIComponent(hangout.venue_name || '')}\`}`,
  `${indent}    target="_blank" rel="noreferrer"`,
  `${indent}    style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>`,
  `${indent}    Uber`,
  `${indent}  </a>`,
  `${indent})}`,
]

const openTableBlock = [
  `${indent}{(hangout.venue_booking_url || hangout.venue_name) && (isConfirmed || isLive) && (`,
  `${indent}  <a`,
  `${indent}    href={hangout.venue_booking_url || \`https://www.opentable.com/s/?term=\${encodeURIComponent(hangout.venue_name || '')}\`}`,
  `${indent}    target="_blank" rel="noreferrer"`,
  `${indent}    style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>`,
  `${indent}    Book a table`,
  `${indent}  </a>`,
  `${indent})}`,
]

// Remove the old 3-line booking block (condition line, <a> line, closing line)
// bookingIdx points to the condition line e.g. "        {hangout.venue_booking_url && ..."
// bookingIdx+1 is the <a> line
// bookingIdx+2 is the closing        )}
lines.splice(bookingIdx, 3, ...lyftBlock, ...uberBlock, ...openTableBlock)

fs.writeFileSync(cardPath, lines.join('\n'), 'utf8')
console.log('HangoutCard.tsx: Lyft, Uber, and upgraded Book a table added successfully.')
console.log('Done. Push and deploy.')
