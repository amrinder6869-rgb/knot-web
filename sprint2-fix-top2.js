const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

console.log('Current lines 1-5:')
for (let i = 0; i < 5; i++) console.log(`  ${i+1}: ${JSON.stringify(lines[i])}`)

// Remove lines until we hit 'use client'
let removeCount = 0
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("'use client'") || lines[i].includes('"use client"')) break
  removeCount++
}

console.log('Removing', removeCount, 'lines before use client')
lines.splice(0, removeCount)

console.log('Line 1 is now:', lines[0].trim())

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('Fixed. Run: npm run build')
