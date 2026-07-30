const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Lines 1-16 (0-indexed 0-15) are the orphaned handler — remove them
console.log('Removing lines 1-16:')
for (let i = 0; i < 16; i++) {
  console.log(`  ${i + 1}: ${lines[i].trim()}`)
}

lines.splice(0, 16)

console.log('\nLine 1 is now:', lines[0].trim())

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('Fixed. Run: npm run build')
