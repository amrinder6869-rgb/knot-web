const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Find all lines with livePhotoPosted useState
const indices = lines.reduce((acc, l, i) => {
  if (l.includes('livePhotoPosted') && l.includes('useState')) acc.push(i)
  return acc
}, [])

console.log('Found livePhotoPosted useState at lines:', indices.map(i => i + 1))

if (indices.length === 2) {
  // Remove the second one (the duplicate)
  lines.splice(indices[1], 1)
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
  console.log('Removed duplicate at line', indices[1] + 1)
} else {
  console.log('Expected 2 occurrences, found', indices.length, '— no change made')
}
