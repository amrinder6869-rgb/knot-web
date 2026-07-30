const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
let src = fs.readFileSync(filePath, 'utf8')

// Fix 1: hide Directions on online hangouts
src = src.replace(
  `{hangout.venue_maps_url && (isConfirmed || isLive) && (`,
  `{hangout.venue_maps_url && !hangout.meeting_url && (isConfirmed || isLive) && (`
)

// Fix 2: hide Uber/Lyft on online hangouts
src = src.replace(
  `{(isConfirmed || isLive) && (hangout.venue_name || hangout.venue_address) && (`,
  `{(isConfirmed || isLive) && !hangout.meeting_url && (hangout.venue_name || hangout.venue_address) && (`
)

// Fix 3: hide OpenTable/Resy on online hangouts
src = src.replace(
  `{(isConfirmed || isLive) && hangout.venue_name && (`,
  `{(isConfirmed || isLive) && !hangout.meeting_url && hangout.venue_name && (`
)

// Fix 4: hide Viator/GetYourGuide activity chips on online hangouts
src = src.replace(
  `{(isConfirmed || isLive) && hangout.venue_name && isActivityVenue(hangout.venue_category) && (`,
  `{(isConfirmed || isLive) && !hangout.meeting_url && hangout.venue_name && isActivityVenue(hangout.venue_category) && (`
)

// Fix 5: Cancel hangout button — red destructive styling instead of yellow
src = src.replace(
  `style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--yellow-dim)', borderRadius: 8, color: 'var(--yellow)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: cancellingHangout ? 0.5 : 1 }}>`,
  `style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: cancellingHangout ? 0.5 : 1 }}>`
)

fs.writeFileSync(filePath, src, 'utf8')
console.log('Fixed. Run: npm run build')
