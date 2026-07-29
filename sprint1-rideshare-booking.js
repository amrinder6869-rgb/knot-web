const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// ─── 1. Add deep link helper functions after the formatDate function ───────────

const helperFunctions = `
function buildUberLink(venueName: string, venueAddress: string) {
  const dest = encodeURIComponent((venueName + ' ' + venueAddress).trim())
  return \`https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[nickname]=\${encodeURIComponent(venueName)}&dropoff[formatted_address]=\${encodeURIComponent(venueAddress)}\`
}

function buildLyftLink(venueName: string, venueAddress: string) {
  const dest = encodeURIComponent(venueAddress || venueName)
  return \`https://ride.lyft.com/ridetype?id=lyft&destination=\${dest}\`
}

function buildOpenTableLink(venueName: string) {
  const q = encodeURIComponent(venueName)
  return \`https://www.opentable.com/s?term=\${q}\`
}

function buildResyLink(venueName: string) {
  const q = encodeURIComponent(venueName)
  return \`https://resy.com/cities?query=\${q}\`
}
`

// Insert after the formatDate function (find the closing brace of BRIEF_BUDGET_LABELS block)
const insertAfter = `const BRIEF_BUDGET_LABELS: Record<string, string> = {`
if (!content.includes('buildUberLink')) {
  content = content.replace(
    `const BRIEF_BUDGET_LABELS: Record<string, string> = {`,
    helperFunctions + `\nconst BRIEF_BUDGET_LABELS: Record<string, string> = {`
  )
  console.log('Added deep link helpers')
}

// ─── 2. Replace the existing generic booking URL link and add rideshare row ───

const oldBookingButton = `        {hangout.venue_booking_url && (isConfirmed || isLive) && (
          <a href={hangout.venue_booking_url} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: 'var(--yellow)', border: 'none', borderRadius: 8, color: '#111', fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>Book a table</a>
        )}`

const newBookingAndRideshare = `        {(isConfirmed || isLive) && (hangout.venue_name || hangout.venue_address) && (
          <>
            <a
              href={buildUberLink(hangout.venue_name || '', hangout.venue_address || '')}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}
            >Uber</a>
            <a
              href={buildLyftLink(hangout.venue_name || '', hangout.venue_address || '')}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}
            >Lyft</a>
          </>
        )}
        {(isConfirmed || isLive) && hangout.venue_name && (
          <>
            <a
              href={buildOpenTableLink(hangout.venue_name)}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}
            >OpenTable</a>
            <a
              href={buildResyLink(hangout.venue_name)}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}
            >Resy</a>
          </>
        )}`

if (content.includes(oldBookingButton)) {
  content = content.replace(oldBookingButton, newBookingAndRideshare)
  console.log('Replaced booking button with rideshare + table booking links')
} else {
  console.log('WARNING: could not find old booking button — check HangoutCard.tsx manually')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('\nDone. Run: npm run build')
