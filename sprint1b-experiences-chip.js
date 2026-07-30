const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function readLines(relPath) {
  return fs.readFileSync(path.join(BASE, relPath), 'utf8').split('\n')
}

function writeLines(relPath, lines) {
  fs.writeFileSync(path.join(BASE, relPath), lines.join('\n'), 'utf8')
  console.log('UPDATED: ' + relPath)
}

// ─── 1. Composer.tsx — store venue_category on hangout insert ─────────────────

const composerLines = readLines('components/Composer.tsx')

// Find the line with venue_place_id in the insert block and add venue_category after it
const placeidIdx = composerLines.findIndex(l => l.includes('venue_place_id:') && l.includes('selectedVenue'))
if (placeidIdx === -1) {
  console.log('WARNING: could not find venue_place_id line in Composer.tsx')
} else {
  // Check if already patched
  if (!composerLines[placeidIdx + 1].includes('venue_category')) {
    composerLines.splice(placeidIdx + 1, 0, `      venue_category:     selectedVenue?.category_id || null,\r`)
    writeLines('components/Composer.tsx', composerLines)
  } else {
    console.log('SKIP: Composer.tsx already has venue_category')
  }
}

// ─── 2. Discover.tsx — pass category_id on the venue object ──────────────────

const discoverLines = readLines('components/Discover.tsx')

// Find the lockVenue call — the venue object passed to onVenueSelect needs category_id
// The venue comes from Foursquare API results stored in venues state
// We need to attach category to each venue when results come in
// Find where venues are set from API results
const setVenuesIdx = discoverLines.findIndex(l => l.includes('setVenues(') || l.includes('setVenues ('))

// Instead, attach category_id when lockVenue is called since category is in component state
const lockVenueIdx = discoverLines.findIndex(l => l.includes('function lockVenue(venue: any)'))
if (lockVenueIdx === -1) {
  console.log('WARNING: could not find lockVenue in Discover.tsx')
} else {
  // Check the line that calls onVenueSelect
  const onVenueSelectIdx = discoverLines.findIndex((l, i) => i > lockVenueIdx && l.includes('onVenueSelect(venue)'))
  if (onVenueSelectIdx !== -1 && !discoverLines[onVenueSelectIdx].includes('category_id')) {
    discoverLines[onVenueSelectIdx] = discoverLines[onVenueSelectIdx].replace(
      'onVenueSelect(venue)',
      'onVenueSelect({ ...venue, category_id: category })'
    )
    writeLines('components/Discover.tsx', discoverLines)
  } else {
    console.log('SKIP: Discover.tsx already passes category_id or line not found')
  }
}

// ─── 3. HangoutCard.tsx — add Viator/GetYourGuide chip for activity hangouts ──

const cardLines = readLines('components/HangoutCard.tsx')

// Activity category IDs from Discover.tsx: 10000 Arts & Culture, 18000 Outdoors, 10032 Activities
// Add helper function after buildResyLink
const resyFnIdx = cardLines.findIndex(l => l.includes('function buildResyLink('))
if (resyFnIdx === -1) {
  console.log('WARNING: could not find buildResyLink in HangoutCard.tsx')
} else {
  // Find closing brace of buildResyLink
  let closingIdx = resyFnIdx
  for (let i = resyFnIdx + 1; i < cardLines.length; i++) {
    if (cardLines[i].trim() === '}' || cardLines[i].trim() === '}\r') {
      closingIdx = i
      break
    }
  }

  if (!cardLines.some(l => l.includes('buildViatorLink'))) {
    const newHelpers = [
      `\r`,
      `function isActivityVenue(category: string | null | undefined) {\r`,
      `  const activityIds = ['10000', '18000', '10032']\r`,
      `  return category ? activityIds.includes(category) : false\r`,
      `}\r`,
      `\r`,
      `function buildViatorLink(venueName: string) {\r`,
      `  const q = encodeURIComponent(venueName)\r`,
      `  return \`https://www.viator.com/searchResults/all?text=\${q}\`\r`,
      `}\r`,
      `\r`,
      `function buildGetYourGuideLink(venueName: string) {\r`,
      `  const q = encodeURIComponent(venueName)\r`,
      `  return \`https://www.getyourguide.com/s/?q=\${q}\`\r`,
      `}\r`,
    ]
    cardLines.splice(closingIdx + 1, 0, ...newHelpers)
    console.log('Added Viator/GetYourGuide helpers to HangoutCard.tsx')
  }
}

// Now find the Resy chip in the render (last affiliate chip added in Sprint 1)
// and add the experiences chip block right after it
const resyChipIdx = cardLines.findIndex(l => l.includes('buildResyLink(hangout.venue_name)') && l.includes('<a href='))
if (resyChipIdx === -1) {
  console.log('WARNING: could not find Resy chip line in HangoutCard.tsx')
} else {
  // Find the closing }) of the Resy block — look for the next )}
  let resyBlockEnd = resyChipIdx
  for (let i = resyChipIdx + 1; i < resyChipIdx + 10; i++) {
    if (cardLines[i] && (cardLines[i].trim() === ')}' || cardLines[i].trim() === ')}\r')) {
      resyBlockEnd = i
      break
    }
  }

  if (!cardLines.some(l => l.includes('isActivityVenue') && l.includes('isConfirmed'))) {
    const experiencesChip = [
      `        {(isConfirmed || isLive) && hangout.venue_name && isActivityVenue(hangout.venue_category) && (\r`,
      `          <>\r`,
      `            <a href={buildViatorLink(hangout.venue_name)} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Viator</a>\r`,
      `            <a href={buildGetYourGuideLink(hangout.venue_name)} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>GetYourGuide</a>\r`,
      `          </>\r`,
      `        )}\r`,
    ]
    cardLines.splice(resyBlockEnd + 1, 0, ...experiencesChip)
    console.log('Added experiences chip to HangoutCard.tsx')
  } else {
    console.log('SKIP: experiences chip already exists in HangoutCard.tsx')
  }
}

// Write HangoutCard
fs.writeFileSync(path.join(BASE, 'components/HangoutCard.tsx'), cardLines.join('\n'), 'utf8')
console.log('UPDATED: components/HangoutCard.tsx')

console.log('\nDone. Run: npm run build')
