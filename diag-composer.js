const fs = require('fs')
let raw = fs.readFileSync('components/Composer.tsx', 'utf8')
const hadCRLF = raw.includes('\r\n')
console.log('Has CRLF line endings:', hadCRLF)
raw = raw.replace(/\r\n/g, '\n')
const lines = raw.split('\n')
const idx = lines.findIndex(l => l.includes('if (momentPhoto) {'))
console.log('momentPhoto block found at line', idx + 1)
for (let i = Math.max(0, idx - 2); i < idx + 20; i++) {
  console.log((i + 1) + ': ' + lines[i])
}
