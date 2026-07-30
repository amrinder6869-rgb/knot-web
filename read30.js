const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx'), 'utf8').split('\n')
for (let i = 0; i < 30; i++) console.log(`${i+1}: ${JSON.stringify(lines[i])}`)
