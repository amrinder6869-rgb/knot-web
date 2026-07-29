const fs = require('fs')
const path = require('path')

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web', 'components', 'HangoutCard.tsx')
const lines = fs.readFileSync(filePath, 'utf8').split('\n')

// Lines 619-629 (0-indexed 618-628) are the duplicates + orphaned )}
// Confirm what we are deleting
console.log('Deleting lines 619-629:')
for (let i = 618; i <= 628; i++) {
  console.log(`  LINE ${i + 1}: ${lines[i].trim()}`)
}

lines.splice(618, 11)

fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
console.log('\nFixed. Run: npm run build')
