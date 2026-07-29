const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split('\n')

// Lines 607 and 608 (0-indexed: 606 and 607) are the two lines to replace
// Confirm before replacing
console.log('Line 607:', JSON.stringify(lines[606]))
console.log('Line 608:', JSON.stringify(lines[607]))

const newLines = [
  `        {(isConfirmed || isLive) && (hangout.venue_name || hangout.venue_address) && (\r`,
  `          <>\r`,
  `            <a href={buildUberLink(hangout.venue_name || '', hangout.venue_address || '')} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Uber</a>\r`,
  `            <a href={buildLyftLink(hangout.venue_name || '', hangout.venue_address || '')} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Lyft</a>\r`,
  `          </>\r`,
  `        )}\r`,
  `        {(isConfirmed || isLive) && hangout.venue_name && (\r`,
  `          <>\r`,
  `            <a href={buildOpenTableLink(hangout.venue_name)} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>OpenTable</a>\r`,
  `            <a href={buildResyLink(hangout.venue_name)} target="_blank" rel="noreferrer" style={{ padding: '8px 14px', background: isLive ? 'rgba(255,255,255,0.06)' : 'var(--bg3)', border: \`1px solid \${isLive ? 'rgba(255,255,255,0.15)' : 'var(--border2)'}\`, borderRadius: 8, color: isLive ? 'rgba(255,255,255,0.65)' : 'var(--text2)', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit' }}>Resy</a>\r`,
  `          </>\r`,
  `        )}\r`,
  // closing ) for the original block — line 609 should be this, keep it
]

// Replace lines 606 and 607 (the two original lines) with the new lines
lines.splice(606, 2, ...newLines)

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('\nReplaced. Run: npm run build')
