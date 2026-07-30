const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx'), 'utf8').split('\n')

// Find lines with key anchors
const anchors = ['displayRating', 'if (!hangout)', 'const isCreator', 'cancelHangout', 'livePhotoPosted', 'handlePhotoUpload', 'return (']
anchors.forEach(a => {
  const idx = lines.findIndex(l => l.includes(a))
  if (idx !== -1) console.log(`"${a}" found at line ${idx + 1}: ${lines[idx].trim()}`)
  else console.log(`"${a}" NOT FOUND`)
})
