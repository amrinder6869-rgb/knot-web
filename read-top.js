const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

for (let i = 0; i < 25; i++) {
  console.log(`LINE ${i + 1}: ${JSON.stringify(lines[i])}`)
}
