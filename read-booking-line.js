const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split('\n')

// Print lines around venue_booking_url
lines.forEach((line, i) => {
  if (line.includes('venue_booking_url') || line.includes('Book a table')) {
    console.log(`LINE ${i + 1}: ${JSON.stringify(line)}`)
  }
})
